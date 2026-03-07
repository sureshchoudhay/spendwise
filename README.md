# 💸 Spendwise — Personal Finance PWA

A personal expense tracker with budget monitoring, analytics, and AI-powered bank statement categorization. Built as a **Progressive Web App (PWA)** — install it on your iPhone like a native app, completely free.

---

## 🚀 Deploy in 5 Steps (Free, ~10 minutes)

### Prerequisites (one-time setup)
- [Node.js](https://nodejs.org) v18+ installed on your computer
- A free [GitHub](https://github.com) account
- A free [Vercel](https://vercel.com) account (sign up with GitHub)
- An [Anthropic API key](https://console.anthropic.com) (for bank statement AI feature)

---

### Step 1 — Get the code on GitHub

1. Go to [github.com](https://github.com) → click **"New repository"**
2. Name it `spendwise`, set to **Private**, click **Create**
3. On your computer, open Terminal in this project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/spendwise.git
git push -u origin main
```

---

### Step 2 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **"Add New Project"**
2. Click **"Import"** next to your `spendwise` repo
3. Vercel auto-detects Vite — just click **"Deploy"**
4. Wait ~60 seconds for your first deploy ✅

---

### Step 3 — Add your Anthropic API Key

This is needed for the AI bank statement categorization feature.

1. In Vercel dashboard → your project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `VITE_ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-...` (your key from [console.anthropic.com](https://console.anthropic.com))
   - **Environment:** Production ✓, Preview ✓
3. Click **Save**
4. Go to **Deployments** → click **"Redeploy"** (top right) to apply the key

> ⚠️ **Security note:** The API key is embedded in the browser bundle. Since this is a personal private app, that's fine. Never share your Vercel URL publicly.

---

### Step 4 — Run locally (optional, for development)

```bash
# Install dependencies
npm install

# Create your local .env file
cp .env.example .env
# Edit .env and paste your Anthropic API key

# Start dev server
npm run dev
# Open http://localhost:5173
```

---

### Step 5 — Install on your iPhone 📱

1. Open **Safari** on your iPhone (must be Safari, not Chrome)
2. Go to your Vercel URL: `https://spendwise-xxx.vercel.app`
3. Tap the **Share button** (box with arrow at bottom of screen)
4. Scroll down and tap **"Add to Home Screen"**
5. Name it **"Spendwise"** → tap **Add**

Done! The app now lives on your home screen with its own icon, opens fullscreen (no browser bar), and works offline for viewing your existing data.

---

## 📁 Project Structure

```
spendwise/
├── src/
│   ├── main.jsx          # React entry point
│   └── App.jsx           # Full app (all components in one file)
├── public/
│   └── icons/            # App icons (192px, 512px, apple-touch)
├── index.html            # HTML shell with iOS PWA meta tags
├── vite.config.js        # Vite + PWA plugin config
├── vercel.json           # Vercel deployment config
├── .env.example          # API key template
└── package.json
```

---

## ✨ Features

| Feature | Details |
|--------|---------|
| 📝 Manual expenses | Add by category, amount, description, date |
| 👥 Multi-user | Anirudh + Guest — fully isolated data |
| 💰 Budget tracking | Monthly budget with gauge, spent/remaining, daily pace |
| 📊 Analytics | Donut chart + bar breakdown by category, month picker |
| 🏦 Bank import | Paste/upload statement → AI categorizes transactions |
| 📱 PWA | Installs on iPhone home screen, works offline |
| 💾 Local storage | All data stored on-device, no backend needed |

---

## 🔧 Customization

**Change your name:** Edit `src/App.jsx` line:
```js
const USERS = ["Anirudh", "Guest"];
// Change to your name(s)
const USERS = ["YourName", "Partner"];
```

**Change default budget:** Edit the fallback in `src/App.jsx`:
```js
const monthBudget = budgets[activeUser] || 3000; // change 3000
```

**Change currency symbol:** Search for `$` in `App.jsx` and replace with your currency symbol (e.g. `S$`, `HK$`, `₹`).

After any changes, just `git commit` + `git push` — Vercel auto-deploys in ~30 seconds.

---

## 🆓 Running Costs

| Service | Cost |
|--------|------|
| Vercel hosting | **Free** (Hobby plan, personal use) |
| GitHub repo | **Free** (private repo) |
| Anthropic API | ~$0.001–0.01 per bank statement parse (pay per use) |

Total monthly cost for personal use: **essentially $0** (only tiny API costs when you parse bank statements).

---

## 🔄 Future Upgrades (if needed)

- **Sync across devices:** Add Supabase (free tier) as a backend
- **Real notifications:** Convert to React Native with Expo
- **CSV export:** Add a download button that generates a CSV of your expenses
