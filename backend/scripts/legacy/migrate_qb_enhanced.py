"""Migration script to add new columns to question_banks table for enhanced QB features."""
import sqlite3
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./hiring.db")

# Extract path for SQLite
if DATABASE_URL.startswith("sqlite:///"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
else:
    db_path = "hiring.db"


def migrate():
    """Add new columns to question_banks table."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get existing columns
    cursor.execute("PRAGMA table_info(question_banks)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    
    new_columns = [
        ("insights_based_questions", "JSON"),
        ("leetcode_questions", "JSON"),
        ("chat_history", "JSON"),
        ("round_number", "INTEGER DEFAULT 1"),
        ("previous_review_context", "JSON"),
    ]
    
    for col_name, col_type in new_columns:
        if col_name not in existing_columns:
            try:
                cursor.execute(f"ALTER TABLE question_banks ADD COLUMN {col_name} {col_type}")
                print(f"✅ Added column: {col_name}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    print(f"⏭️  Column {col_name} already exists")
                else:
                    print(f"❌ Error adding {col_name}: {e}")
        else:
            print(f"⏭️  Column {col_name} already exists")
    
    conn.commit()
    conn.close()
    print("\n✅ Migration complete!")


if __name__ == "__main__":
    migrate()
