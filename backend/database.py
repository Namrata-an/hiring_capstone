"""Database connection and session management."""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from config import DATABASE_URL

# SQLite needs check_same_thread=False for FastAPI
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

# Connection pool settings for Postgres (prevent stale SSL connections)
pool_settings = {}
if DATABASE_URL.startswith("postgresql"):
    pool_settings = {
        "pool_pre_ping": True,           # Test connection before using (fixes stale connections)
        "pool_recycle": 300,              # Recycle connections after 5 minutes
        "pool_size": 5,                   # Max connections in pool
        "max_overflow": 10,               # Extra connections if pool exhausted
        "connect_args": {
            "connect_timeout": 10,        # Fail fast if Neon is unreachable
            "options": "-c statement_timeout=30000"  # Kill queries after 30s
        }
    }
else:
    pool_settings = {"connect_args": connect_args}

engine = create_engine(DATABASE_URL, **pool_settings)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
