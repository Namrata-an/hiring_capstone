#!/usr/bin/env python3
"""Quick verification script to check if backend can start."""

def main():
    print("🔍 Verifying backend setup...\n")
    
    # Test imports
    try:
        from main import app
        print("✅ FastAPI app imports successfully")
    except Exception as e:
        print(f"❌ Failed to import main.py: {e}")
        return False
    
    # Test routers
    try:
        from routers import auth, jobs, candidates, interviewers, health, interviews
        print("✅ All routers import successfully")
    except Exception as e:
        print(f"❌ Failed to import routers: {e}")
        return False
    
    # Test services
    try:
        from services.auth_service import get_current_user
        from services.insights_generator import generate_insights
        from services.qb_generator import qb_generator
        from services.leetcode_questions import get_leetcode_questions_for_skills
        print("✅ All services import successfully")
    except Exception as e:
        print(f"❌ Failed to import services: {e}")
        return False
    
    # Test models
    try:
        from models import User, Candidate, Job, QuestionBank, InterviewReview
        print("✅ All models import successfully")
    except Exception as e:
        print(f"❌ Failed to import models: {e}")
        return False
    
    # Test database connection
    try:
        from database import engine, SessionLocal
        print("✅ Database connection configured")
    except Exception as e:
        print(f"❌ Failed to configure database: {e}")
        return False
    
    print(f"\n🎉 Backend verification complete!")
    print(f"   Total routes: {len(app.routes)}")
    print(f"\n💡 To start the server, run:")
    print(f"   uvicorn main:app --reload --host 0.0.0.0 --port 8000")
    
    return True

if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
