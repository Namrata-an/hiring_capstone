# 🚀 Hiring Co-Pilot - Quick Start Guide

## ⚡ Quick Start (Fastest Way)

```bash
# 1. Terminal 1 - Start Backend
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# 2. Terminal 2 - Start Frontend
export PATH="/opt/homebrew/bin:$PATH"
cd /Users/siyer/hiring_capstone/frontend
npm run dev
```

Then open http://localhost:5173 in your browser.

---

## 📋 Detailed Setup

### Backend Setup (One-time)

```bash
cd /Users/siyer/hiring_capstone/backend

# Create virtual environment (if needed)
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Frontend Setup (One-time)

```bash
cd /Users/siyer/hiring_capstone/frontend

# Install Node.js (if not already installed)
brew install node

# Install dependencies
npm install
```

---

## 🎯 Running the Application

### Option 1: Two Terminal Windows (Recommended)

**Terminal 1 - Backend:**
```bash
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
export PATH="/opt/homebrew/bin:$PATH"
cd /Users/siyer/hiring_capstone/frontend
npm run dev
```

**Access:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Option 2: Using npm/Python directly (without venv)

**Terminal 1 - Backend:**
```bash
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd /Users/siyer/hiring_capstone/frontend
npm run dev
```

### Option 3: Build for Production

```bash
# Build frontend
export PATH="/opt/homebrew/bin:$PATH"
cd /Users/siyer/hiring_capstone/frontend
npm run build

# Backend production
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

---

## 🧪 Testing & Verification

### Test Backend

```bash
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate

# Run all tests
pytest tests/ -v

# Check backend is running
curl http://localhost:8000/health
```

### Test Frontend Build

```bash
export PATH="/opt/homebrew/bin:$PATH"
cd /Users/siyer/hiring_capstone/frontend
npm run build
```

---

## 🔐 Login Credentials

**For Testing:**
- Email: `hr@test.com`
- Password: `password123`
- Role: HR Admin

Or sign up with your own credentials in the frontend.

---

## 📊 Using the Application

### HR Admin Can:
1. Create job postings
2. Upload candidate resumes (PDF)
3. View all candidates
4. Update candidate status through the pipeline
5. Assign candidates to interviewers

### Interviewers Can:
1. View candidates assigned to them
2. See candidate resume content
3. (Phase 4+) Submit reviews and feedback

---

## 🆘 Troubleshooting

### "npm: command not found"
```bash
# Add npm to PATH
export PATH="/opt/homebrew/bin:$PATH"
npm --version
```

### "Port already in use"
```bash
# Kill process on port 8000 (backend)
lsof -ti:8000 | xargs kill -9

# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9
```

### Frontend doesn't start
```bash
export PATH="/opt/homebrew/bin:$PATH"
cd /Users/siyer/hiring_capstone/frontend
npm install  # Reinstall dependencies
npm run dev
```

### Backend test failures
```bash
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
pip install -r requirements.txt  # Reinstall deps
pytest tests/ -v
```

---

## 📦 Development Commands

### Install New Python Package
```bash
cd /Users/siyer/hiring_capstone/backend
source venv/bin/activate
pip install package-name
pip freeze > requirements.txt
```

### Install New NPM Package
```bash
export PATH="/opt/homebrew/bin:$PATH"
cd /Users/siyer/hiring_capstone/frontend
npm install package-name
```

### View Backend Logs
```bash
curl http://localhost:8000/docs  # Open Swagger UI
```

### View Frontend Code
```bash
export PATH="/opt/homebrew/bin:$PATH"
cd /Users/siyer/hiring_capstone/frontend
npm run dev -- --open  # Opens browser automatically
```

---

## 🎯 Quick Reference

| Component | Port | URL | Command |
|-----------|------|-----|---------|
| Backend | 8000 | http://localhost:8000 | `uvicorn main:app --reload` |
| API Docs | 8000 | http://localhost:8000/docs | (auto-generated) |
| Frontend | 5173 | http://localhost:5173 | `npm run dev` |
| Database | - | SQLite | (auto-created) |

---

## 📋 Project Structure

```
/Users/siyer/hiring_capstone/
├── backend/
│   ├── venv/                 # Virtual environment
│   ├── main.py              # FastAPI app
│   ├── models.py            # Database models
│   ├── routers/             # API endpoints
│   ├── services/            # Business logic
│   ├── tests/               # Test suite
│   ├── requirements.txt     # Python dependencies
│   └── hiring_copilot.db    # SQLite database
│
├── frontend/
│   ├── src/
│   │   ├── pages/          # React pages
│   │   ├── apiService.ts   # API client
│   │   ├── contexts/       # React contexts
│   │   └── App.tsx         # Main app
│   ├── node_modules/       # NPM packages
│   ├── package.json        # NPM dependencies
│   └── dist/               # Production build
│
├── COMMANDS.md             # This file
├── PHILOSOPHY.md           # Project philosophy
├── FEATURES_ROADMAP.md     # Feature roadmap
└── IMPLEMENTATION_PLAN.md  # Implementation plan
```

---

## 🚀 Next Steps

1. **First-time setup:**
   - Follow "Backend Setup" and "Frontend Setup" sections above
   - Run both servers in separate terminals

2. **Create test data:**
   - Sign up as HR Admin
   - Create a job posting
   - Upload a sample resume
   - Assign to an interviewer

3. **Test interviewer view:**
   - Sign up as Interviewer
   - View assigned candidates

---

## 📝 Notes

- Backend uses SQLite (perfect for dev, can migrate to PostgreSQL for production)
- Frontend is React + TypeScript + Vite (fast builds)
- All API endpoints require authentication (JWT tokens)
- Resume PDFs are stored locally in `backend/uploads/resumes/`
