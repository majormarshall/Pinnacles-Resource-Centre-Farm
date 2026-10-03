// backend/routes/exports.js
// Excel & PDF exports: payroll, harvest report, monthly summary, individual payslips
const express  = require('express');
const router   = express.Router();
const supabase = require('../db');
const { requireAuth } = require('../middleware/auth');
const XLSX     = require('xlsx');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

// ── Helper: build XLSX buffer ──────────────────────────────────────────────
function buildXlsx(sheetName, headers, rows) {
  const wb  = XLSX.utils.book_new();
  const ws  = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

function monthName(month, year) {
  return new Date(year, month - 1, 1).toLocaleString('en-NG', { month: 'long' });
}

// ── GET /api/exports/payroll/excel?month=&year= ───────────────────────────
router.get('/payroll/excel', requireAuth, async (req, res) => {
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const end   = new Date(year, month, 0).toISOString().slice(0, 10);

  try {
    const { data: workers } = await supabase.from('farm_workers').select('*').eq('status', 'active');
    const rows = [];

    for (const w of (workers || [])) {
      const { data: att } = await supabase.from('farm_attendance')
        .select('hours_worked').eq('worker_id', w.id).gte('work_date', start).lte('work_date', end);
      const { count: days } = await supabase.from('farm_attendance')
        .select('*', { count: 'exact', head: true }).eq('worker_id', w.id).gte('work_date', start).lte('work_date', end);
      const hours = (att || []).reduce((s, r) => s + (Number(r.hours_worked) || 0), 0);

      let gross = 0;
      if (w.pay_type === 'daily')        gross = (days || 0) * Number(w.pay_rate);
      else if (w.pay_type === 'weekly')  gross = Math.ceil((days || 0) / 5) * Number(w.pay_rate);
      else if (w.pay_type === 'monthly') gross = Number(w.pay_rate);
      else                               gross = (days || 0) * Number(w.pay_rate);

      const { data: payRec } = await supabase.from('farm_payroll').select('paid, paid_date')
        .eq('worker_id', w.id).eq('period_start', start).single().catch(() => ({ data: null }));

      rows.push([
        w.name,
        (w.role || '').replace('_', ' '),
        w.pay_type,
        `NGN ${Number(w.pay_rate).toLocaleString()}`,
        days || 0,
        hours.toFixed(1),
        `NGN ${gross.toLocaleString()}`,
        payRec?.paid ? 'PAID' : 'UNPAID',
        payRec?.paid_date || '-',
      ]);
    }

    const headers = ['Worker Name', 'Role', 'Pay Type', 'Pay Rate', 'Days Worked', 'Hours Worked', 'Gross Pay', 'Status', 'Date Paid'];
    const buf = buildXlsx(`Payroll ${month}-${year}`, headers, rows);
    const mn  = monthName(month, year);
    res.setHeader('Content-Disposition', `attachment; filename="Pinnacles_Payroll_${mn}_${year}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/exports/harvest/excel?month=&year= ───────────────────────────
router.get('/harvest/excel', requireAuth, async (req, res) => {
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const end   = new Date(year, month, 0).toISOString().slice(0, 10);

  try {
    const { data: harvests } = await supabase.from('farm_harvests')
      .select('harvest_date, crop_name, quantity, unit, quality_grade, harvested_by, sent_to_store, notes, farm_plantings(farm_fields(name))')
      .gte('harvest_date', start).lte('harvest_date', end).order('harvest_date');

    const headers = ['Date', 'Crop', 'Field', 'Quantity', 'Unit', 'Grade', 'Harvested By', 'Sent to Store', 'Notes'];
    const rows = (harvests || []).map(h => [
      h.harvest_date, h.crop_name, h.farm_plantings?.farm_fields?.name || '-',
      h.quantity, h.unit, 'Grade ' + h.quality_grade,
      h.harvested_by, h.sent_to_store ? 'Yes' : 'No', h.notes || '',
    ]);

    const buf = buildXlsx('Harvests', headers, rows);
    const mn  = monthName(month, year);
    res.setHeader('Content-Disposition', `attachment; filename="Pinnacles_Harvests_${mn}_${year}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/exports/monthly/excel?month=&year= — multi-sheet report ───────
router.get('/monthly/excel', requireAuth, async (req, res) => {
  const month = parseInt(req.query.month) || new Date().getMonth() + 1;
  const year  = parseInt(req.query.year)  || new Date().getFullYear();
  const start = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const end   = new Date(year, month, 0).toISOString().slice(0, 10);
  const mn    = monthName(month, year);
  const wb    = XLSX.utils.book_new();

  try {
    // Fetch all data in parallel
    const [
      { data: harvestData },
      { count: workerCount },
      { data: orderData },
      { count: sprayCount },
      { data: harvRows },
      { data: payRows },
      { data: sprayRows },
      { data: maintRows },
    ] = await Promise.all([
      supabase.from('farm_harvests').select('quantity').gte('harvest_date', start).lte('harvest_date', end),
      supabase.from('farm_workers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('orders').select('total').gte('created_at', start).lte('created_at', end + 'T23:59:59').neq('status', 'cancelled').catch(() => ({ data: [] })),
      supabase.from('farm_sprays').select('*', { count: 'exact', head: true }).gte('spray_date', start).lte('spray_date', end),
      supabase.from('farm_harvests').select('harvest_date, crop_name, quantity, unit, quality_grade, harvested_by').gte('harvest_date', start).lte('harvest_date', end).order('harvest_date'),
      supabase.from('farm_payroll').select('*, farm_workers(name, role)').eq('period_start', start).catch(() => ({ data: [] })),
      supabase.from('farm_sprays').select('spray_date, chemical_name, area_sprayed, dosage, sprayed_by').gte('spray_date', start).lte('spray_date', end),
      supabase.from('farm_equipment_maintenance').select('scheduled_date, equipment_name, maintenance_type, status, performed_by, cost').gte('scheduled_date', start).lte('scheduled_date', end).catch(() => ({ data: [] })),
    ]);

    const totalKg  = (harvestData || []).reduce((s, r) => s + (Number(r.quantity) || 0), 0);
    const totalRev = (orderData   || []).reduce((s, r) => s + (Number(r.total)    || 0), 0);

    // Sheet 1: Summary
    const summaryWs = XLSX.utils.aoa_to_sheet([
      [`Pinnacles Resource Centre Farm — Monthly Report: ${mn} ${year}`],
      [],
      ['Metric', 'Value'],
      ['Total Harvest (kg)',  totalKg.toFixed(1)],
      ['Harvest Events',      (harvestData || []).length],
      ['Active Workers',      workerCount || 0],
      ['E-commerce Orders',   (orderData   || []).length],
      ['Revenue (NGN)',       totalRev.toLocaleString()],
      ['Spray Applications',  sprayCount  || 0],
      [],
      ['Generated', new Date().toLocaleString('en-NG')],
    ]);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Sheet 2: Harvests
    const harvWs = XLSX.utils.aoa_to_sheet([
      ['Date', 'Crop', 'Quantity', 'Unit', 'Grade', 'Harvested By'],
      ...(harvRows || []).map(r => [r.harvest_date, r.crop_name, r.quantity, r.unit, r.quality_grade, r.harvested_by]),
    ]);
    XLSX.utils.book_append_sheet(wb, harvWs, 'Harvests');

    // Sheet 3: Payroll
    const payWs = XLSX.utils.aoa_to_sheet([
      ['Worker', 'Role', 'Days', 'Hours', 'Gross Pay (NGN)', 'Paid', 'Date Paid'],
      ...(payRows || []).map(r => [
        r.farm_workers?.name || r.worker_name, r.farm_workers?.role || r.role,
        r.days_worked, r.hours_worked, r.gross_pay, r.paid ? 'Yes' : 'No', r.paid_date || '-'
      ]),
    ]);
    XLSX.utils.book_append_sheet(wb, payWs, 'Payroll');

    // Sheet 4: Sprays
    const sprayWs = XLSX.utils.aoa_to_sheet([
      ['Date', 'Chemical', 'Area', 'Dosage', 'Sprayed By'],
      ...(sprayRows || []).map(r => [r.spray_date, r.chemical_name, r.area_sprayed, r.dosage, r.sprayed_by]),
    ]);
    XLSX.utils.book_append_sheet(wb, sprayWs, 'Sprays');

    // Sheet 5: Maintenance
    const maintWs = XLSX.utils.aoa_to_sheet([
      ['Date', 'Equipment', 'Type', 'Status', 'Performed By', 'Cost (NGN)'],
      ...(maintRows || []).map(r => [r.scheduled_date, r.equipment_name, r.maintenance_type, r.status, r.performed_by || '-', r.cost || 0]),
    ]);
    XLSX.utils.book_append_sheet(wb, maintWs, 'Maintenance');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', `attachment; filename="Pinnacles_Monthly_${mn}_${year}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/exports/payslip/:workerId?month=&year= — PDF payslip ─────────
router.get('/payslip/:workerId', requireAuth, async (req, res) => {
  const month  = parseInt(req.query.month) || new Date().getMonth() + 1;
  const year   = parseInt(req.query.year)  || new Date().getFullYear();
  const start  = new Date(year, month - 1, 1).toISOString().slice(0, 10);
  const end    = new Date(year, month, 0).toISOString().slice(0, 10);
  const mn     = monthName(month, year);

  try {
    const { data: worker } = await supabase.from('farm_workers').select('*').eq('id', req.params.workerId).single();
    if (!worker) return res.status(404).json({ error: 'Worker not found' });

    const { data: att } = await supabase.from('farm_attendance').select('hours_worked')
      .eq('worker_id', worker.id).gte('work_date', start).lte('work_date', end);
    const { count: days } = await supabase.from('farm_attendance')
      .select('*', { count: 'exact', head: true }).eq('worker_id', worker.id).gte('work_date', start).lte('work_date', end);

    const hours = (att || []).reduce((s, r) => s + (Number(r.hours_worked) || 0), 0);
    const gross = worker.pay_type === 'monthly' ? Number(worker.pay_rate) : (days || 0) * Number(worker.pay_rate);

    const { data: payRec } = await supabase.from('farm_payroll').select('*')
      .eq('worker_id', worker.id).eq('period_start', start).single().catch(() => ({ data: null }));

    const doc  = await PDFDocument.create();
    const page = doc.addPage([595, 420]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();
    const GREEN = rgb(0.11, 0.42, 0.22);
    const BLACK = rgb(0.1, 0.1, 0.1);
    const WHITE = rgb(1, 1, 1);
    const GREY  = rgb(0.55, 0.55, 0.55);
    const LGREY = rgb(0.94, 0.94, 0.94);

    // Header strip
    page.drawRectangle({ x: 0, y: height - 64, width, height: 64, color: GREEN });
    page.drawText('PINNACLES RESOURCE CENTRE FARM', { x: 20, y: height - 28, size: 13, font: bold, color: WHITE });
    page.drawText('PAYSLIP', { x: width - 84, y: height - 28, size: 15, font: bold, color: WHITE });
    page.drawText(`Period: ${mn} ${year}`, { x: 20, y: height - 50, size: 9, font, color: WHITE });
    page.drawText(`Offa, Kwara State, Nigeria`, { x: width - 180, y: height - 50, size: 8, font, color: rgb(0.8, 0.95, 0.85) });

    // Worker details panel
    page.drawText('EMPLOYEE DETAILS', { x: 20, y: height - 86, size: 8, font: bold, color: GREEN });
    page.drawLine({ start: { x: 20, y: height - 91 }, end: { x: 270, y: height - 91 }, thickness: 0.4, color: LGREY });
    const details = [
      ['Name',      worker.name],
      ['Role',      (worker.role || 'Worker').replace(/_/g, ' ')],
      ['Pay Type',  worker.pay_type],
      ['Rate',      `NGN ${Number(worker.pay_rate).toLocaleString()} per ${worker.pay_type}`],
    ];
    details.forEach(([label, val], i) => {
      page.drawText(label + ':', { x: 20,  y: height - 108 - i * 18, size: 8, font: bold, color: BLACK });
      page.drawText(val,         { x: 90,  y: height - 108 - i * 18, size: 8, font,       color: BLACK });
    });

    // Attendance panel
    page.drawText('ATTENDANCE', { x: 310, y: height - 86, size: 8, font: bold, color: GREEN });
    page.drawLine({ start: { x: 310, y: height - 91 }, end: { x: width - 20, y: height - 91 }, thickness: 0.4, color: LGREY });
    [['Days Worked', days || 0], ['Total Hours', hours.toFixed(1) + ' hrs']].forEach(([label, val], i) => {
      page.drawText(label + ':', { x: 310, y: height - 108 - i * 18, size: 8, font: bold, color: BLACK });
      page.drawText(String(val), { x: 420, y: height - 108 - i * 18, size: 8, font,       color: BLACK });
    });

    // Earnings table header
    page.drawRectangle({ x: 20, y: height - 205, width: width - 40, height: 22, color: LGREY });
    page.drawText('DESCRIPTION', { x: 28, y: height - 198, size: 8, font: bold, color: GREEN });
    page.drawText('AMOUNT',      { x: width - 110, y: height - 198, size: 8, font: bold, color: GREEN });

    // Gross pay row
    const grossDesc = `Basic Pay — ${days || 0} day${(days || 0) !== 1 ? 's' : ''} x NGN ${Number(worker.pay_rate).toLocaleString()}`;
    page.drawText(grossDesc,                      { x: 28,           y: height - 222, size: 8, font,       color: BLACK });
    page.drawText(`NGN ${gross.toLocaleString()}`, { x: width - 120, y: height - 222, size: 9, font: bold, color: BLACK });
    page.drawLine({ start: { x: 20, y: height - 234 }, end: { x: width - 20, y: height - 234 }, thickness: 0.3, color: LGREY });

    // Net pay box
    page.drawRectangle({ x: 20, y: height - 262, width: width - 40, height: 26, color: GREEN });
    page.drawText('NET PAY', { x: 28, y: height - 253, size: 10, font: bold, color: WHITE });
    page.drawText(`NGN ${gross.toLocaleString()}`, { x: width - 130, y: height - 253, size: 12, font: bold, color: WHITE });

    // Payment status
    const isPaid = payRec?.paid;
    const statusText  = isPaid ? `PAID on ${payRec.paid_date || '-'}` : 'PAYMENT PENDING';
    const statusColor = isPaid ? GREEN : rgb(0.75, 0.1, 0.1);
    page.drawText(statusText, { x: 22, y: height - 290, size: 10, font: bold, color: statusColor });

    if (isPaid && payRec?.paid_by) {
      page.drawText(`Authorised by: ${payRec.paid_by}`, { x: 22, y: height - 308, size: 8, font, color: GREY });
    }

    // Signature line
    page.drawLine({ start: { x: width - 200, y: height - 310 }, end: { x: width - 30, y: height - 310 }, thickness: 0.4, color: LGREY });
    page.drawText('Authorised Signature', { x: width - 185, y: height - 322, size: 7, font, color: GREY });

    // Footer
    page.drawLine({ start: { x: 20, y: 38 }, end: { x: width - 20, y: 38 }, thickness: 0.3, color: LGREY });
    page.drawText('Pinnacles Resource Centre Farm — Offa, Kwara State, Nigeria | agribusiness@pinnaclescentre.com', { x: 20, y: 24, size: 7, font, color: GREY });
    page.drawText(`Generated: ${new Date().toLocaleDateString('en-NG')}`, { x: width - 160, y: 24, size: 7, font, color: GREY });

    const bytes = await doc.save();
    const safeName = (worker.name || 'Worker').replace(/\s+/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename="Payslip_${safeName}_${mn}_${year}.pdf"`);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(bytes));
  } catch (e) {
    res.status(500).json({ error: 'PDF generation failed: ' + e.message });
  }
});

module.exports = router;
