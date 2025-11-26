# Deployment Guide

## 🚀 Quick Links

- **Live Application**: [Will be available after deployment]
- **GitHub Repository**: [To be added]
- **GitLab Repository**: [To be added]

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development](#local-development)
3. [Git Setup (GitHub & GitLab)](#git-setup)
4. [Deployment to Render](#deployment-to-render)
5. [Environment Variables](#environment-variables)
6. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Accounts

- ✓ **GitHub Account** - [Sign up](https://github.com/signup)
- ✓ **GitLab Account** - [Sign up](https://gitlab.com/users/sign_up)
- ✓ **Render Account** - [Sign up](https://render.com/register)
- ✓ **OpenAI Account** - [Get API Key](https://platform.openai.com/api-keys)
- ✓ **SendGrid Account** - [Sign up](https://signup.sendgrid.com/)

### Required API Keys

1. **OpenAI API Key**: 
   - Go to https://platform.openai.com/api-keys
   - Create new secret key
   - **⚠️ WARNING**: This costs money per request!

2. **SendGrid API Key**:
   - Go to https://app.sendgrid.com/settings/api_keys
   - Create API Key with "Mail Send" permissions
   - Free tier: 100 emails/day

---

## Local Development

### Running Locally with Docker

```bash
# Navigate to project directory
cd /Users/adityanirgude/Documents/Studies/Software\ Project/address_auto_main/automation

# Create .env file with your credentials
cp .env.example .env
# Edit .env and add your API keys

# Start all services
docker-compose up --build

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# Database: localhost:5432
```

### Stopping Services

```bash
docker-compose down
```

---

## Git Setup

### 1. Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `address-automation` (or your choice)
3. Description: "AI-powered address change automation system"
4. Choose **Public** (so supervisors can see it)
5. **DO NOT** initialize with README (we already have one)
6. Click "Create repository"

### 2. Create GitLab Repository

1. Go to https://gitlab.com/projects/new
2. Project name: `address-automation`
3. Visibility: **Public**
4. **DO NOT** initialize with README
5. Click "Create project"

### 3. Push to Both Repositories

```bash
# Navigate to project directory
cd /Users/adityanirgude/Documents/Studies/Software\ Project/address_auto_main

# Initialize git (if not already initialized)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: Address automation system with CrewAI agents

- 7 sequential CrewAI agents for address change workflow
- MCP tools for database operations
- PostgreSQL database with audit logging
- React frontend with admin dashboard
- OCR pipeline with Tesseract + GPT-4
- HITL mechanism for quality assurance
- Docker Compose infrastructure
- SendGrid email integration"

# Add GitHub remote (replace USERNAME and REPO)
git remote add github https://github.com/USERNAME/REPO.git

# Add GitLab remote (replace USERNAME and REPO)
git remote add gitlab https://gitlab.com/USERNAME/REPO.git

# Push to GitHub
git push -u github main

# Push to GitLab
git push -u gitlab main
```

### Verify Push

```bash
# Check remotes
git remote -v

# You should see:
# github  https://github.com/USERNAME/REPO.git (fetch)
# github  https://github.com/USERNAME/REPO.git (push)
# gitlab  https://gitlab.com/USERNAME/REPO.git (fetch)
# gitlab  https://gitlab.com/USERNAME/REPO.git (push)
```

---

## Deployment to Render

### Option 1: Recommended - Web Service Deployment

#### Step 1: Create PostgreSQL Database

1. Log into https://dashboard.render.com
2. Click "New +" → "PostgreSQL"
3. Settings:
   - **Name**: `address-automation-db`
   - **Database**: `address_db`
   - **User**: `app_user`
   - **Region**: Choose closest to you
   - **Plan**: **Free** (for testing)
4. Click "Create Database"
5. **SAVE** the "Internal Database URL" (you'll need it)

#### Step 2: Deploy Backend

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Settings:
   - **Name**: `address-automation-backend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `automation/Dockerfile`
   - **Region**: Same as database
   - **Plan**: **Free**
4. **Environment Variables** (click "Add Environment Variable"):
   ```
   DATABASE_URL=<paste Internal Database URL from Step 1>
   OPENAI_API_KEY=sk-your-openai-key
   SENDGRID_API_KEY=SG.your-sendgrid-key
   SENDER_EMAIL=no-reply@yourdomain.com
   ```
5. Click "Create Web Service"
6. Wait for deployment (5-10 minutes)
7. **SAVE** the service URL (e.g., `https://address-automation-backend.onrender.com`)

#### Step 3: Deploy Frontend

1. Click "New +" → "Web Service"
2. Connect same repository
3. Settings:
   - **Name**: `address-automation-frontend`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `automation/frontend/Dockerfile`
   - **Region**: Same as backend
   - **Plan**: **Free**
4. **Environment Variables**:
   ```
   VITE_API_URL=<paste backend URL from Step 2>
   ```
5. Click "Create Web Service"
6. Wait for deployment

#### Step 4: Initialize Database

```bash
# Get a shell into the backend service
# In Render dashboard → backend service → "Shell" tab

# Run database initialization
psql $DATABASE_URL -f docker/postgres/init.sql
```

### Option 2: Docker Compose on Render (Alternative)

**Note**: Render free tier doesn't support Docker Compose directly. You'll need to deploy services separately as shown in Option 1.

---

## Environment Variables

### Production Environment Variables

Create these in Render dashboard for each service:

#### Backend Service

| Variable | Example Value | Where to Get |
|----------|---------------|--------------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | Render PostgreSQL "Internal Database URL" |
| `OPENAI_API_KEY` | `sk-proj-xxx...` | https://platform.openai.com/api-keys |
| `SENDGRID_API_KEY` | `SG.xxx...` | https://app.sendgrid.com/settings/api_keys |
| `SENDER_EMAIL` | `no-reply@domain.com` | Your verified SendGrid sender |

#### Frontend Service

| Variable | Example Value | Where to Get |
|----------|---------------|--------------|
| `VITE_API_URL` | `https://your-backend.onrender.com` | Backend service URL from Render |

---

## Accessing Your Deployed Application

After deployment completes:

1. **Frontend URL**: `https://address-automation-frontend.onrender.com`
   - Share this with supervisors and friends
   - User portal: `/`
   - Admin dashboard: `/admin`

2. **Backend API**: `https://address-automation-backend.onrender.com`
   - Health check: `https://your-backend.onrender.com/`
   - API docs: `https://your-backend.onrender.com/docs`

---

## Troubleshooting

### Issue: Services are sleeping

**Problem**: Render free tier services sleep after 15 minutes of inactivity

**Solution**: 
- First request will take 30-60 seconds to wake up
- Consider upgrading to paid tier for production
- Or use a service like UptimeRobot to ping every 5 minutes

### Issue: Database connection errors

**Problem**: Backend can't connect to database

**Solution**:
1. Verify `DATABASE_URL` in backend environment variables
2. Ensure database is "Available" status in Render dashboard
3. Check backend logs: Render dashboard → Service → "Logs"

### Issue: CORS errors in frontend

**Problem**: Frontend can't call backend API

**Solution**:
1. Verify `VITE_API_URL` in frontend environment variables
2. Ensure it matches exact backend URL (no trailing slash)
3. Redeploy frontend after changing env vars

### Issue: Email not sending

**Problem**: SendGrid certificate email fails

**Solution**:
1. Verify SendGrid API key is valid
2. Check sender email is verified in SendGrid
3. Free tier limit: 100 emails/day
4. Check backend logs for SendGrid errors

### Issue: OpenAI API errors

**Problem**: Workflow fails with "401 Unauthorized"

**Solution**:
1. Verify OpenAI API key is correct
2. Check you have credits: https://platform.openai.com/usage
3. Ensure key has GPT-4 access

---

## Monitoring & Maintenance

### Check Logs

```bash
# Render Dashboard → Your Service → "Logs" tab
# Real-time logs show all API requests and errors
```

### Monitor API Usage

- **OpenAI**: https://platform.openai.com/usage
- **SendGrid**: https://app.sendgrid.com/stats

### Database Backups

Render free tier doesn't include automatic backups. For production:
1. Upgrade to paid PostgreSQL plan (includes daily backups)
2. Or manually export database periodically

---

## Cost Estimation

### Free Tier Limits

- **Render Web Services**: Free (sleeps after 15 min inactivity)
- **Render PostgreSQL**: Free up to 1GB storage
- **SendGrid**: Free up to 100 emails/day
- **OpenAI GPT-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens

### Expected Costs (10 cases/day)

- Render: **FREE**
- SendGrid: **FREE**
- OpenAI: ~**$1-2/month** (10 cases × 7 agents × avg tokens)

---

## Security Best Practices

### ⚠️ Important Security Notes

1. **Never commit `.env` file** - Already in `.gitignore`
2. **Rotate API keys** if accidentally exposed
3. **Add authentication** before public production use
4. **Monitor API usage** to prevent abuse
5. **Rate limit** API endpoints in production

### Adding Basic Authentication (Optional)

For production, consider adding:
- Login system for admin dashboard
- API key authentication for case submission
- Rate limiting per IP address

---

## Getting Help

### Useful Resources

- **Render Documentation**: https://render.com/docs
- **Docker Documentation**: https://docs.docker.com/
- **FastAPI Documentation**: https://fastapi.tiangolo.com/
- **CrewAI Documentation**: https://docs.crewai.com/

### Project Documentation

- [Technical Analysis](./technical_analysis.html)
- [Agents & MCP Deep Dive](./agents_mcp_detailed.html)
- [README](./README.md)

---

## Next Steps After Deployment

1. ✓ Share frontend URL with supervisors/friends
2. ✓ Add live demo link to README
3. ✓ Monitor logs for errors
4. ✓ Test with real documents
5. ✓ Consider adding authentication
6. ✓ Set up monitoring/alerts

---

**Congratulations! Your application is now live! 🎉**
