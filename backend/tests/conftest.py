"""Pytest configuration and fixtures."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base, get_db
from main import app

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    """Create a fresh database for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    """Create a test client with database override."""
    def override_get_db():
        try:
            yield db
        finally:
            pass
    
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def hr_admin_token(client):
    """Create an HR admin user and return auth token."""
    response = client.post("/api/v1/auth/register", json={
        "email": "hr@example.com",
        "password": "password123",
        "name": "HR Admin",
        "role": "hr_admin"
    })
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def interviewer_token(client):
    """Create an interviewer user and return auth token."""
    response = client.post("/api/v1/auth/register", json={
        "email": "interviewer@example.com",
        "password": "password123",
        "name": "Test Interviewer",
        "role": "interviewer"
    })
    assert response.status_code == 200
    return response.json()["access_token"]


@pytest.fixture
def auth_headers(hr_admin_token):
    """Return authorization headers for HR admin."""
    return {"Authorization": f"Bearer {hr_admin_token}"}


@pytest.fixture
def interviewer_headers(interviewer_token):
    """Return authorization headers for interviewer."""
    return {"Authorization": f"Bearer {interviewer_token}"}
