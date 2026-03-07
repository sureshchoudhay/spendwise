# 💸 Spendwise — Personal Finance PWA

Track daily expenses, set budgets, and import bank statements with AI categorization.
Installs on your iPhone home screen like a native app. Completely free to host.

---

## 🚀 Deploy to Vercel (Free) — Step by Step

### Step 1 — Push to GitHub

1. Go to [github.com](https://github.com) → **New repository**
2. Name: `spendwise` · Visibility: **Private** · Click **Create repository**
3. Open Terminal in this project folder:

```bash
npm install
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/spendwise.git
git push -u origin main
```

---

### Step 2 — Deploy on Vercel

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Click **Import** next to your `spendwise` repo
3. Click **Deploy** (Vercel auto-detects Vite — no settings needed)
4. Wait ~60 seconds ✅

---

### Step 3 — Add your Anthropic API Key on Vercel

> ⚠️ This is the most important step — skip it and bank AI won't work.

1. In Vercel dashboard → your project → **Settings** tab
2. Click **Environment Variables** in the left sidebar
3. Fill in:
   - **Key:** `VITE_ANTHROPIC_API_KEY`
   - **Value:** your key from [console.anthropic.com](https://console.anthropic.com/settings/keys)
4. Make sure **Production**, **Preview**, **Development** are all checked
5. Click **Save**
6. Go to **Deployments** tab → click the **⋯ menu** on the latest deployment → **Redeploy**
7. Wait ~30 seconds for redeploy ✅

**Get an API key:**
- Go to [console.anthropic.com](https://console.anthropic.com)
- Sign up (free) → **API Keys** → **Create Key**
- Copy the `sk-ant-...` key

---

### Step 4 — Install on iPhone 📱

1. Open **Safari** on your iPhone (must be Safari, not Chrome/Firefox)
2. Go to your Vercel URL e.g. `https://spendwise-abc123.vercel.app`
3. Tap the **Share** button (square with arrow, bottom of Safari)
4. Scroll and tap **"Add to Home Screen"**
5. Tap **Add** — the app icon appears on your home screen ✅

The app opens fullscreen with no browser bar, just like a native app.

---

## 📱 No API Key on Vercel? (Fallback)

If you skip Step 3, the app shows a built-in setup screen where you can
paste your API key directly in the browser. The key is saved in localStorage
on that device only. This works fine for personal use on your iPhone.

---

## 📁 Project Structure

```
spendwise/
├── src/
│   ├── main.jsx          # React entry point
│   └── App.jsx           # Complete app (all-in-one)
├── public/
│   └── icons/            # App icons for PWA + iOS
│       ├── icon-192.png
│       ├── icon-512.png
│       └── apple-touch-icon.png
├── index.html            # HTML shell with iOS PWA meta tags
├── vite.config.js        # Vite + PWA plugin configuration
├── vercel.json           # Vercel deployment settings
├── package.json          # Dependencies
└── .gitignore            # Excludes node_modules, .env, dist
```

---

## ✨ Features

| Feature | Details |
|---|---|
| ➕ Manual expenses | Category picker, amount, description, date |
| 💰 Budget tracking | Monthly gauge, spent/remaining, daily pace, on-track indicator |
| 📊 Analytics | Donut chart + category bars, month picker, all transactions |
| 👥 Multi-user | Anirudh + Guest with fully isolated data |
| 🏦 Bank import | Upload **PDF** / CSV / TXT → AI auto-categorizes |
| 📱 PWA | Installs on iPhone home screen, offline capable |
| 💾 Local storage | All data stays on your device — no backend |

---

## 🔧 Customization

**Change user names** — edit `src/App.jsx`:
```js
const USERS = ["Anirudh", "Guest"];
// change to e.g.:
const USERS = ["Anirudh", "Priya"];
```

**Change currency** — find/replace `$` with `S$`, `HK$`, `₹`, etc.

**Change default budget** — find this line in `src/App.jsx`:
```js
const monthBudget = budgets[activeUser] ?? 3000;
```

After any edit: `git add . && git commit -m "update" && git push`
Vercel auto-deploys in ~30 seconds.

---

## 💰 Cost

| Service | Cost |
|---|---|
| Vercel hosting | **Free** forever for personal projects |
| GitHub private repo | **Free** |
| Anthropic API (bank AI) | ~$0.001 per statement parse |

**Effectively $0/month.**
