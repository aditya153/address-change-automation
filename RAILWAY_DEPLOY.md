# Railway Deployment Guide

## 🚀 Deploy Address Change Automation on Railway (FREE)

### Prerequisites
- [ ] GitHub account with repo pushed
- [ ] Railway account (sign up free at railway.app)

---

## 📦 Services to Deploy

| Service | Directory | Type |
|---------|-----------|------|
| Backend (FastAPI) | `/automation` | Web Service |
| Frontend (React) | `/automation/frontend` | Static Site |
| Database | - | PostgreSQL Plugin |

---

## Step 1: Push to GitHub

```bash
cd "/Users/adityanirgude/Documents/Studies/Software Project/address_auto_main"
git add -A
git commit -m "chore: prepare for Railway deployment"
git push origin main
```

---

## Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **"New Project"**
3. Select **"Deploy from GitHub repo"**
4. Choose your `address_auto_main` repository

---

## Step 3: Add PostgreSQL Database

1. In your Railway project, click **"+ New"**
2. Select **"Database" → "Add PostgreSQL"**
3. Railway will create and configure the database automatically
4. Copy the `DATABASE_URL` from the PostgreSQL service variables

---

## Step 4: Deploy Backend

1. Click **"+ New" → "GitHub Repo"**
2. Select your repo
3. Set **Root Directory**: `automation`
4. Add Environment Variables:
   - `DATABASE_URL`: (paste from PostgreSQL)
   - `OPENAI_API_KEY`: your-openai-key
   - `GROQ_API_KEY`: your-groq-key
   - `SECRET_KEY`: generate-random-string
5. Railway will auto-detect the Dockerfile and build

---

## Step 5: Deploy Frontend

1. Click **"+ New" → "GitHub Repo"**
2. Select your repo again
3. Set **Root Directory**: `automation/frontend`
4. Add Environment Variable:
   - `VITE_API_URL`: https://your-backend.railway.app
5. Build Command: `npm install && npm run build`
6. Start Command: `npx serve dist -s -p $PORT`

---

## Step 6: Configure Networking

1. Go to your **Backend** service → Settings → Networking
2. Click **"Generate Domain"** (e.g., `your-app-backend.railway.app`)
3. Go to your **Frontend** service → Settings → Networking
4. Click **"Generate Domain"** (e.g., `your-app-frontend.railway.app`)

---

## 🔧 Environment Variables Summary

### Backend Service:
| Variable | Value |
|----------|-------|
| `DATABASE_URL` | From PostgreSQL service |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `GROQ_API_KEY` | Your Groq API key |
| `SECRET_KEY` | Random string for JWT |
| `PORT` | 8000 |

### Frontend Service:
| Variable | Value |
|----------|-------|
| `VITE_API_URL` | https://your-backend.railway.app |

---

## ⚠️ Email Listener Note

The email listener (IMAP polling) may not work well on Railway free tier due to:
- Services sleeping after inactivity
- Continuous background processing limits

**Alternative**: Use web form submission only (already works!)

---

## 🎉 After Deployment

Your app will be live at:
- **Frontend**: https://your-app-frontend.railway.app
- **Backend API**: https://your-backend.railway.app/docs

---

## 💰 Free Tier Limits

| Resource | Limit |
|----------|-------|
| Execution | 500 hrs/month (~21 days 24/7) |
| Memory | 512MB per service |
| Database | 500MB PostgreSQL |
| Sleep | After 15min inactivity |

---

## Need Help?

Railway has excellent docs: https://docs.railway.app
