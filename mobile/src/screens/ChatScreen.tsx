// ── ChatScreen ────────────────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, RADIUS, SHADOW } from '../theme/tokens';
import { sendMessage } from '../services/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  time: Date;
}

const BOT_RESPONSES: Record<string, string> = {
  default: "Thanks for reaching out to Pinnacles Farm! 🌿 We'll get back to you shortly. You can also place an order directly through the app!",
  hello: "Hello! 👋 Welcome to Pinnacles Resource Centre Farm. How can we help you today?",
  hi: "Hi there! 🌿 Great to hear from you. What can we help you with?",
  price: "Our prices are listed on each product page. We offer fresh farm produce at competitive prices. Is there a specific product you'd like to know about?",
  order: "To place an order, simply browse our products, add items to your cart, and proceed to checkout. We'll confirm your order via WhatsApp! 📱",
  delivery: "We offer local delivery within the area. Delivery details will be confirmed after your order is placed. WhatsApp us for delivery zones!",
  hours: "We're open Monday–Saturday, 7am–6pm. Fresh produce is available daily! 🌅",
  organic: "Yes! All our produce is grown naturally on the farm with minimal chemicals. We believe in fresh, healthy food for everyone 🌱",
  pay: "We accept bank transfers and cash on delivery. Payment details will be shared after order confirmation via WhatsApp.",
  fresh: "All our products are harvested fresh daily and delivered the same day! Nothing stays overnight 🌿",
};

function getBotResponse(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, response] of Object.entries(BOT_RESPONSES)) {
    if (key !== 'default' && lower.includes(key)) return response;
  }
  return BOT_RESPONSES.default;
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      text: "Hello! 👋 Welcome to Pinnacles Resource Centre Farm.\n\nI'm here to help you with questions about our products, pricing, delivery, and orders. What can I help you with today?",
      sender: 'bot',
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [userName, setUserName] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [step, setStep] = useState<'intro' | 'name' | 'phone' | 'chat'>('intro');

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  const addMessage = (text: string, sender: 'user' | 'bot') => {
    setMessages(prev => [...prev, { id: Date.now().toString(), text, sender, time: new Date() }]);
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');

    if (step === 'name') {
      setUserName(text);
      addMessage(text, 'user');
      setTimeout(() => {
        addMessage("Great! And what's your phone number so we can reach you? 📱", 'bot');
        setStep('phone');
      }, 600);
      return;
    }

    if (step === 'phone') {
      setUserPhone(text);
      addMessage(text, 'user');
      setTimeout(() => {
        addMessage("Perfect! Now go ahead and type your message or question. We'll read every message carefully 💬", 'bot');
        setStep('chat');
      }, 600);
      return;
    }

    addMessage(text, 'user');
    setSending(true);

    try {
      // Save to backend for admin visibility
      if (userName) {
        await sendMessage({ name: userName, phone: userPhone, message: text });
      }
    } catch (e) {
      // Silent — bot still responds
    }

    setTimeout(() => {
      addMessage(getBotResponse(text), 'bot');
      setSending(false);
    }, 800 + Math.random() * 600);
  };

  const startChat = () => {
    setStep('name');
    addMessage("Before we chat, what's your name? 😊", 'bot');
  };

  const QUICK_REPLIES = ['Prices?', 'How to order?', 'Delivery?', 'Opening hours?', 'Is it organic?'];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerAvatar}>
          <Text style={{ fontSize: 22 }}>🌿</Text>
        </View>
        <View>
          <Text style={styles.headerName}>Pinnacles Farm</Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Usually replies quickly</Text>
          </View>
        </View>
      </View>

      {/* ── Messages ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) => (
          <View key={m.id} style={[styles.msgRow, m.sender === 'user' ? styles.msgRowUser : styles.msgRowBot]}>
            {m.sender === 'bot' && (
              <View style={styles.botAvatar}><Text style={{ fontSize: 14 }}>🌿</Text></View>
            )}
            <View style={[styles.bubble, m.sender === 'user' ? styles.bubbleUser : styles.bubbleBot]}>
              <Text style={[styles.bubbleText, m.sender === 'user' && styles.bubbleTextUser]}>{m.text}</Text>
              <Text style={[styles.bubbleTime, m.sender === 'user' && { color: 'rgba(255,255,255,0.6)' }]}>
                {m.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        ))}
        {sending && (
          <View style={[styles.msgRow, styles.msgRowBot]}>
            <View style={styles.botAvatar}><Text style={{ fontSize: 14 }}>🌿</Text></View>
            <View style={[styles.bubble, styles.bubbleBot, styles.typingBubble]}>
              <ActivityIndicator size="small" color={COLORS.textLight} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── Intro prompt ── */}
      {step === 'intro' && (
        <View style={styles.introBar}>
          <TouchableOpacity style={styles.startBtn} onPress={startChat}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.white} />
            <Text style={styles.startBtnText}>Start Chat</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Quick replies ── */}
      {step === 'chat' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickRepliesBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {QUICK_REPLIES.map((q) => (
            <TouchableOpacity key={q} style={styles.quickChip} onPress={() => { setInput(q); }}>
              <Text style={styles.quickChipText}>{q}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Input Bar ── */}
      {step !== 'intro' && (
        <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={step === 'name' ? 'Your name...' : step === 'phone' ? 'Your phone number...' : 'Type a message...'}
            placeholderTextColor={COLORS.textMuted}
            multiline
            onSubmitEditing={handleSend}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.5 }]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.primary, paddingHorizontal: 20, paddingBottom: 16,
  },
  headerAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerName: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  onlineRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4ade80' },
  onlineText: { color: 'rgba(255,255,255,0.75)', fontSize: 11 },

  messages: { flex: 1 },

  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginBottom: 4 },
  msgRowUser: { justifyContent: 'flex-end' },
  msgRowBot: { justifyContent: 'flex-start' },
  botAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.offWhite, justifyContent: 'center', alignItems: 'center',
  },
  bubble: { maxWidth: '78%', borderRadius: 18, padding: 12, gap: 4 },
  bubbleBot: { backgroundColor: COLORS.white, borderBottomLeftRadius: 4, ...SHADOW.sm },
  bubbleUser: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, color: COLORS.textDark, lineHeight: 20 },
  bubbleTextUser: { color: COLORS.white },
  bubbleTime: { fontSize: 10, color: COLORS.textMuted, alignSelf: 'flex-end' },
  typingBubble: { paddingHorizontal: 16, paddingVertical: 10 },

  introBar: { padding: 16, alignItems: 'center', backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, borderRadius: RADIUS.full,
    paddingHorizontal: 28, paddingVertical: 13,
  },
  startBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },

  quickRepliesBar: { maxHeight: 46, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  quickChip: {
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.full,
    paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: COLORS.border,
  },
  quickChipText: { fontSize: 12, fontWeight: '600', color: COLORS.primaryLight },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10,
    backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  input: {
    flex: 1, backgroundColor: COLORS.offWhite, borderRadius: RADIUS.lg,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
    color: COLORS.textDark, maxHeight: 100, borderWidth: 1, borderColor: COLORS.border,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
  },
});
