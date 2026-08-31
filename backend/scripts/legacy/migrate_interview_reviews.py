"""Migration script to create interview_reviews table.

Run this script to add the interview reviews table to the database.
"""

import sqlite3
from pathlib import Path

# Path to the database
DB_PATH = Path(__file__).parent / "hiring_copilot.db"


def migrate():
    """Create the interview_reviews table."""
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    # Create interview_reviews table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS interview_reviews (
            id VARCHAR(36) PRIMARY KEY,
            schedule_id VARCHAR(36) NOT NULL UNIQUE,
            interviewer_id VARCHAR(36) NOT NULL,
            candidate_id VARCHAR(36) NOT NULL,
            
            -- Ratings (1-5 scale)
            technical_skills INTEGER,
            communication INTEGER,
            problem_solving INTEGER,
            cultural_fit INTEGER,
            overall_rating INTEGER,
            
            -- Feedback
            strengths TEXT,
            areas_for_improvement TEXT,
            notes TEXT,
            
            -- Recommendation
            recommendation VARCHAR(50) NOT NULL,
            
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            
            FOREIGN KEY (schedule_id) REFERENCES interview_schedules(id),
            FOREIGN KEY (interviewer_id) REFERENCES users(id),
            FOREIGN KEY (candidate_id) REFERENCES candidates(id)
        )
    """)
    
    conn.commit()
    conn.close()
    print("✅ Successfully created 'interview_reviews' table")


if __name__ == "__main__":
    migrate()
