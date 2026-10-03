// backend/routes/worker-register.js
// Worker self-registration — pending admin approval
const express  = require("express");
const router   = express.Router();
const supabase = require("../db");
const bcrypt   = require("bcryptjs");

// POST /api/worker-register — worker submits registration request
router.post("/", async (req, res) => {
  const { name, email, phone, role, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "Name, email and password are required." });

  try {
    // Check if email already registered
    const { data: existing } = await supabase
      .from("admins")
      .select("id")
      .eq("email", email)
      .single()
      .catch(() => ({ data: null }));
    if (existing) return res.status(409).json({ error: "An account with this email already exists." });

    // Create account with status=pending (not yet approved)
    const hash = bcrypt.hashSync(password, 10);
    const { data, error } = await supabase
      .from("admins")
      .insert({
        username:      name.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now().toString().slice(-4),
        email,
        password_hash: hash,
        role:         "farm_worker",
        status:       "pending",
        full_name:    name,
        phone:        phone || null,
        job_title:    role  || "Farm Worker",
      })
      .select("id, username")
      .single();
    if (error) throw new Error(error.message);
    res.json({ ok: true, message: "Registration submitted! Your account is pending approval by the farm manager." });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/worker-register/pending — farm manager sees pending workers
router.get("/pending", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("admins")
      .select("id, full_name, email, phone, job_title, created_at")
      .eq("role", "farm_worker")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/worker-register/:id/approve — approve a pending worker
router.patch("/:id/approve", async (req, res) => {
  try {
    const { error } = await supabase
      .from("admins")
      .update({ status: "active" })
      .eq("id", req.params.id)
      .eq("role", "farm_worker");
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/worker-register/:id/reject — reject/delete a pending worker
router.patch("/:id/reject", async (req, res) => {
  try {
    const { error } = await supabase
      .from("admins")
      .delete()
      .eq("id", req.params.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
