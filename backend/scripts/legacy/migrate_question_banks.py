"""Database migration script for question_banks table.

Run this script to add the question_banks table for storing interview question banks.
"""
import sqlite3
from pathlib import Path

def migrate():
    """Add question_banks table to the database."""
    db_path = Path(__file__).parent / "hiring_copilot.db"
    
    if not db_path.exists():
        print(f"Database not found at {db_path}")
        return
    
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    
    # Check if table already exists
    cursor.execute("""
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='question_banks'
    """)
    
    if cursor.fetchone():
        print("Table 'question_banks' already exists")
        conn.close()
        return
    
    # Create the question_banks table
    cursor.execute("""
        CREATE TABLE question_banks (
            id VARCHAR(36) PRIMARY KEY,
            candidate_id VARCHAR(36) NOT NULL,
            job_id VARCHAR(36) NOT NULL,
            jd_based_questions JSON,
            fundamental_questions JSON,
            resume_questions JSON,
            behavioral_questions JSON,
            follow_up_topics JSON,
            red_flag_probes JSON,
            auto_generated VARCHAR(10) DEFAULT 'true',
            modified_by_interviewer VARCHAR(10) DEFAULT 'false',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (candidate_id) REFERENCES candidates(id),
            FOREIGN KEY (job_id) REFERENCES jobs(id)
        )
    """)
    
    # Create indexes for faster lookups
    cursor.execute("""
        CREATE INDEX idx_qb_candidate_id ON question_banks(candidate_id)
    """)
    cursor.execute("""
        CREATE INDEX idx_qb_job_id ON question_banks(job_id)
    """)
    
    conn.commit()
    conn.close()
    
    print("✅ Successfully created 'question_banks' table")


if __name__ == "__main__":
    migrate()
