# Pinnacles Farm Mobile App 📱

A cross-platform mobile app for **Pinnacles Resource Centre Farm** built with React Native + Expo.
Available on both **Google Play Store** (Android) and **Apple App Store** (iOS).

---

## 🚀 Quick Start (Development)

### Prerequisites
- Node.js 18+
- [Expo Go](https://expo.dev/go) app installed on your phone

### Run locally
```bash
cd mobile
npm install
npx expo start
```
Scan the QR code with **Expo Go** on your phone to preview the app instantly.

---

## 📁 Project Structure

```
mobile/
├── App.tsx                         # Root navigator & providers
├── app.json                        # Expo app config (name, icons, bundle IDs)
├── babel.config.js                 # Babel config
├── .env                            # Environment variables (API URL, WhatsApp)
└── src/
    ├── context/
    │   ├── AuthContext.tsx          # JWT auth state (admin login/logout)
    │   └── CartContext.tsx          # Shopping cart state
    ├── screens/
    │   ├── HomeScreen.tsx           # Product listing + hero banner
    │   ├── ProductDetailScreen.tsx  # Product detail + add to cart
    │   ├── CartScreen.tsx           # Cart + checkout + order placement
    │   ├── ChatScreen.tsx           # Chatbot + message logging
    │   ├── AdminScreen.tsx          # Admin: orders + messages management
    │   └── AdminLoginScreen.tsx     # Admin login (JWT)
    ├── services/
    │   └── api.ts                   # Axios client for all backend routes
    └── theme/
        └── tokens.ts                # Colors, shadows, radii design tokens
```

---

## ⚙️ Configuration

Edit **`.env`** in the `mobile/` folder:

```env
# Your Vercel backend URL
EXPO_PUBLIC_API_URL=https://your-vercel-url.vercel.app

# Farm WhatsApp in international format (no + or spaces)
EXPO_PUBLIC_FARM_WHATSAPP=2348012345678
```

---

## 👥 App Navigation

### Customer Flow
| Screen | Description |
|---|---|
| **Home** | Hero, featured products, category browser |
| **Product Detail** | Full info, qty selector, add to cart |
| **Cart** | Review items, enter details, place order |
| **Chat** | AI chatbot + message saved to admin inbox |

### Admin Flow (after login)
| Screen | Description |
|---|---|
| **Admin Panel** | Order stats, filter by status, update status |
| **Messages** | Inbox with unread count, mark as read |

> **To access admin:** Go to the **Cart** tab → scroll to bottom → there is no direct button (security). Navigate directly to `AdminLogin` in dev. For production, add a hidden gesture or secret tap sequence.

---

## 📦 Building for Stores

### Step 1 — Install EAS CLI
```bash
npm install -g eas-cli
eas login
```

### Step 2 — Configure EAS
```bash
eas build:configure
```

### Step 3 — Build for Android (Play Store)
```bash
eas build --platform android --profile production
```
Downloads a `.aab` file → upload to Google Play Console.

### Step 4 — Build for iOS (App Store)
```bash
eas build --platform ios --profile production
```
Requires an **Apple Developer account ($99/year)**.

---

## 🏪 Store Requirements

### Google Play Store
- [ ] Google Play Developer account ($25 one-time)
- [ ] App bundle (.aab) from EAS Build
- [ ] App icon 1024×1024px
- [ ] 2–8 screenshots per device type
- [ ] Privacy Policy URL

### Apple App Store
- [ ] Apple Developer Program ($99/year)
- [ ] App binary (.ipa) from EAS Build
- [ ] App Store Connect setup
- [ ] Privacy Policy URL
- [ ] App review (1–3 business days)

---

## 🔧 Adding Admin Access Button

To give admins a way to reach the login screen in production, add a hidden tap sequence to `HomeScreen.tsx`:

```tsx
// Add to the hero section — 5 taps on the logo
const [tapCount, setTapCount] = useState(0);
<TouchableOpacity onPress={() => {
  const next = tapCount + 1;
  setTapCount(next);
  if (next >= 5) { navigation.navigate('AdminLogin'); setTapCount(0); }
}}>
  <Text style={styles.heroTitle}>Pinnacles Farm</Text>
</TouchableOpacity>
```

---

## 🌿 Brand Colors

| Token | Value | Use |
|---|---|---|
| `primary` | `#1b4332` | Main green (buttons, headers) |
| `primaryLight` | `#2d6a4f` | Hover/secondary |
| `accent` | `#52b788` | Highlights |
| `gold` | `#f4a261` | Tags, badges |
| `offWhite` | `#f0faf4` | Background |

---

## 📞 Support
Pinnacles Resource Centre Farm — [pinnaclesfarm@email.com]
