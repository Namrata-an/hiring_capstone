"""Migration script to add candidate_insights table.

Run this script to add the candidate_insights table for storing AI-generated insights.

Usage:
    cd /Users/siyer/hiring_capstone/backend
    source venv/bin/activate
    python migrate_insights.py
"""
import sqlite3
import os
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent / "hiring_copilot.db"


def migrate():
    """Add candidate_insights table to the database."""
    print(f"Migrating database: {DB_PATH}")
    
    if not DB_PATH.exists():
        print("Database does not exist. Run the backend first to create it.")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Check if table already exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='candidate_insights'
    """)
    
    if cursor.fetchone():
        print("candidate_insights table already exists. Skipping creation.")
    else:
        # Create the candidate_insights table
        cursor.execute("""
            CREATE TABLE candidate_insights (
                id TEXT PRIMARY KEY,
                candidate_id TEXT NOT NULL UNIQUE,
                overall_score TEXT,
                technical_depth_score TEXT,
                experience_relevance_score TEXT,
                education_score TEXT,
                startup_mindset_score TEXT,
                communication_score TEXT,
                scores_breakdown TEXT,
                mindset_analysis TEXT,
                technical_analysis TEXT,
                experience_analysis TEXT,
                summary TEXT,
                raw_response TEXT,
                generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (candidate_id) REFERENCES candidates(id)
            )
        """)
        
        # Create index for faster lookups
        cursor.execute("""
            CREATE INDEX idx_candidate_insights_candidate_id 
            ON candidate_insights(candidate_id)
        """)
        
        conn.commit()
        print("candidate_insights table created successfully!")
    
    conn.close()
    print("Migration complete!")


if __name__ == "__main__":
    migrate()
