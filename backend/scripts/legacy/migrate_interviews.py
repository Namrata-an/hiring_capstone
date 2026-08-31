"""Database migration for Interview Pipeline tables.

Run this script to add the interview_rounds and interview_schedules tables.

Usage:
    python migrate_interviews.py
"""
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import inspect, text
from database import engine, Base
from models import InterviewRound, InterviewSchedule

def check_table_exists(table_name: str) -> bool:
    """Check if a table exists in the database."""
    inspector = inspect(engine)
    return table_name in inspector.get_table_names()

def migrate():
    """Run the migration to create interview pipeline tables."""
    print("=" * 50)
    print("Interview Pipeline Migration")
    print("=" * 50)
    
    # Check current state
    rounds_exists = check_table_exists("interview_rounds")
    schedules_exists = check_table_exists("interview_schedules")
    
    print(f"\nCurrent state:")
    print(f"  - interview_rounds table exists: {rounds_exists}")
    print(f"  - interview_schedules table exists: {schedules_exists}")
    
    if rounds_exists and schedules_exists:
        print("\n✅ All tables already exist. Nothing to do.")
        return
    
    # Create tables
    print("\nCreating tables...")
    
    try:
        # Create only the new tables
        Base.metadata.create_all(bind=engine, tables=[
            InterviewRound.__table__,
            InterviewSchedule.__table__
        ])
        
        # Verify creation
        rounds_exists = check_table_exists("interview_rounds")
        schedules_exists = check_table_exists("interview_schedules")
        
        print(f"\nVerification:")
        print(f"  - interview_rounds table: {'✅ Created' if rounds_exists else '❌ Failed'}")
        print(f"  - interview_schedules table: {'✅ Created' if schedules_exists else '❌ Failed'}")
        
        if rounds_exists and schedules_exists:
            print("\n✅ Migration completed successfully!")
        else:
            print("\n❌ Migration failed - some tables were not created")
            
    except Exception as e:
        print(f"\n❌ Migration failed with error: {e}")
        raise

if __name__ == "__main__":
    migrate()
