# 🚀 Hiring Co-Pilot - Setup Guide

## ✅ Prerequisites

- macOS with Homebrew
- Python 3.9+
- Node.js + npm (will be installed via Homebrew)

## 🎯 First Time Setup (5 minutes)

### Step 1: Install Node.js & npm

```bash
brew install node
export PATH="/opt/homebrew/bin:$PATH"
node --version  # Should show v25.8.1+
npm --version   # Should show 11.11.0+
```

### Step 2: Install Frontend Dependencies

```bash
cd /Users/siyer/hiring_capstone/frontend
npm install
```

### Step 3: Backend is Ready

The backend is already set up! Virtual environment and dependencies are installed.

## 🚀 Running the Application

### Quick Start (Copy & Paste)

**Terminal 1:**
```bash
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2:**
```bash
export PATH="/opt/homebrew/bin:$PATH"
cd /Users/siyer/hiring_capstone/frontend
npm run dev
```

Then open: **http://localhost:5173**

## 🔐 Test Login

- Email: `hr@test.com`
- Password: `password123`

Or sign up a new account!

## 📋 What Works

✅ User authentication (Register/Login)
✅ Create job postings
✅ Upload candidate resumes (PDF)
✅ View candidates by job
✅ Update candidate status (pipeline tracking)
✅ Assign candidates to interviewers
✅ Interviewer view of assigned candidates

## 🎓 Using the App

### As HR Admin:

1. Sign up or log in
2. Go to "Jobs" → Click "Create Job"
3. Create a job posting
4. Go to "Candidates" → Click "Upload Resume"
5. Upload candidate resumes and assign to interviewers

### As Interviewer:

1. Sign up as "Interviewer"
2. Go to "My Assigned Candidates"
3. View candidates assigned to you
4. Click any candidate to see their resume

## 📖 More Commands

See **COMMANDS.md** for:
- Running tests
- Building for production
- Troubleshooting
- Advanced development

---

**Ready to go!** 🎉
