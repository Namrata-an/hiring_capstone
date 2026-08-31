"""Migration script for Phase 5: Baton Passing & Talent Memory.

Adds:
- candidate_status_history table
- reengagement_candidates table

Run with: python migrate_phase5.py
"""
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from sqlalchemy import inspect
from database import engine, Base
from models import CandidateStatusHistory, ReengagementCandidate


def run_migration():
    """Create new tables for Phase 5."""
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    tables_to_create = []
    
    if "candidate_status_history" not in existing_tables:
        tables_to_create.append("candidate_status_history")
    
    if "reengagement_candidates" not in existing_tables:
        tables_to_create.append("reengagement_candidates")
    
    if not tables_to_create:
        print("✅ All Phase 5 tables already exist!")
        return
    
    print(f"Creating tables: {', '.join(tables_to_create)}")
    
    # Create tables
    Base.metadata.create_all(bind=engine, tables=[
        CandidateStatusHistory.__table__,
        ReengagementCandidate.__table__
    ])
    
    print("✅ Phase 5 migration completed successfully!")
    print("   - candidate_status_history: Tracks candidate status changes")
    print("   - reengagement_candidates: Tracks re-engagement candidates")


if __name__ == "__main__":
    run_migration()
