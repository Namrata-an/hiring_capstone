"""Migration script to add new columns to candidates table."""
import sqlite3
import sys

def migrate_database(db_path="hiring_copilot.db"):
    """Add new columns to candidates table if they don't exist."""
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get existing columns
    cursor.execute("PRAGMA table_info(candidates)")
    existing_columns = {row[1] for row in cursor.fetchall()}
    
    migrations = []
    
    if "experience_years" not in existing_columns:
        migrations.append(("experience_years", "ALTER TABLE candidates ADD COLUMN experience_years VARCHAR(50)"))
    
    if "current_position" not in existing_columns:
        migrations.append(("current_position", "ALTER TABLE candidates ADD COLUMN current_position VARCHAR(255)"))
    
    if "education" not in existing_columns:
        migrations.append(("education", "ALTER TABLE candidates ADD COLUMN education JSON"))
    
    if not migrations:
        print("✅ Database is already up to date!")
        conn.close()
        return
    
    print(f"🔄 Running {len(migrations)} migration(s)...")
    
    for column_name, sql in migrations:
        try:
            cursor.execute(sql)
            print(f"  ✅ Added column: {column_name}")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print(f"  ⚠️  Column {column_name} already exists, skipping")
            else:
                print(f"  ❌ Error adding column {column_name}: {e}")
                conn.close()
                sys.exit(1)
    
    conn.commit()
    conn.close()
    print("✅ Migration completed successfully!")

if __name__ == "__main__":
    migrate_database()
