# ⚡ QuizBattle v2.0

Real-time multiplayer Kahoot-style quiz game with Gemini AI questions.

---

## 🚀 Local Setup

```bash
# 1. Install packages
npm install

# 2. Edit server/.env — add your Gemini key
GEMINI_API_KEY=your_key_here

# 3. Start MongoDB locally
mongod

# 4. Run server
npm start

# 5. Open browser
# http://localhost:5000
```

### Get Free Gemini API Key
1. Go to https://aistudio.google.com
2. Click "Get API Key" → Create API Key
3. Paste it in `server/.env`

---

## 🌐 Deploy to Railway (FREE — Recommended)

Railway gives you free hosting with a real URL all devices can access!

### Step 1 — Push code to GitHub
```bash
git init
git add .
git commit -m "QuizBattle initial commit"
# Create a repo on github.com, then:
git remote add origin https://github.com/YOUR_USERNAME/quizbattle.git
git push -u origin main
```

### Step 2 — Deploy on Railway
1. Go to **railway.app** → Sign in with GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repo
4. Railway auto-detects Node.js and deploys ✅

### Step 3 — Add Environment Variables on Railway
In your Railway project → **Variables** tab, add:
```
GEMINI_API_KEY = your_gemini_key_here
MONGODB_URI    = your_mongodb_atlas_uri
PORT           = 5000
```

### Step 4 — Free MongoDB Atlas (Cloud Database)
1. Go to **mongodb.com/atlas** → Free tier
2. Create cluster → Get connection string
3. Paste as `MONGODB_URI` in Railway variables

### Your app URL: `https://your-app.railway.app` 🎉

---

## 🌐 Deploy to Render (Alternative FREE)

1. Go to **render.com** → New Web Service
2. Connect GitHub repo
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Add environment variables same as above

---

## 📱 All Devices Support
- ✅ Mobile (iOS + Android)
- ✅ Tablet
- ✅ Desktop
- ✅ All browsers (Chrome, Safari, Firefox, Edge)

---

## 📁 File Structure

```
quizbattle/
├── server/
│   ├── server.js          ← Backend (Express + Socket.IO + Gemini)
│   ├── .env               ← API keys (never commit this!)
│   └── models/user.js     ← MongoDB schema
├── client/
│   ├── css/
│   │   ├── global.css     ← Shared styles
│   │   ├── index.css      ← Login page
│   │   ├── dashboard.css
│   │   ├── create.css
│   │   ├── join.css
│   │   ├── lobby.css
│   │   ├── game.css
│   │   └── leaderboard.css
│   ├── js/
│   │   ├── index.js
│   │   ├── dashboard.js
│   │   ├── create.js
│   │   ├── join.js
│   │   ├── lobby.js
│   │   ├── game.js
│   │   └── leaderboard.js
│   ├── index.html
│   ├── dashboard.html
│   ├── create.html
│   ├── join.html
│   ├── lobby.html
│   ├── game.html
│   └── leaderboard.html
├── Procfile               ← Railway/Heroku deploy
├── .gitignore
├── package.json
└── README.md
```

---

## ✨ Features
- 🤖 Gemini AI generates questions on ANY topic
- 🎵 Sound effects (correct, wrong, timer, win)
- 🏆 Podium + confetti on results screen
- ⏱️ Live countdown timer
- 📊 Real-time live leaderboard
- 🚫 Host cannot answer questions (server-side block)
- 👤 Host not shown in player list
- 📱 Works on all devices
- 🌐 Deploy-ready (Railway/Render)
