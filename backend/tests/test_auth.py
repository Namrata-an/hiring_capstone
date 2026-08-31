"""Tests for authentication endpoints."""
import pytest


class TestAuth:
    """Test authentication endpoints."""
    
    def test_register_hr_admin(self, client):
        """Test registering a new HR admin."""
        response = client.post("/api/v1/auth/register", json={
            "email": "newhr@example.com",
            "password": "password123",
            "name": "New HR",
            "role": "hr_admin"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "newhr@example.com"
        assert data["user"]["role"] == "hr_admin"
    
    def test_register_interviewer(self, client):
        """Test registering a new interviewer."""
        response = client.post("/api/v1/auth/register", json={
            "email": "newinterviewer@example.com",
            "password": "password123",
            "name": "New Interviewer",
            "role": "interviewer"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["user"]["role"] == "interviewer"
    
    def test_register_duplicate_email(self, client, hr_admin_token):
        """Test that duplicate emails are rejected."""
        response = client.post("/api/v1/auth/register", json={
            "email": "hr@example.com",  # Already registered in fixture
            "password": "password123",
            "name": "Another HR",
            "role": "hr_admin"
        })
        
        assert response.status_code == 400
        assert "already registered" in response.json()["detail"]
    
    def test_login_success(self, client, hr_admin_token):
        """Test successful login."""
        response = client.post("/api/v1/auth/login", json={
            "email": "hr@example.com",
            "password": "password123"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "hr@example.com"
    
    def test_login_wrong_password(self, client, hr_admin_token):
        """Test login with wrong password."""
        response = client.post("/api/v1/auth/login", json={
            "email": "hr@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
    
    def test_login_nonexistent_user(self, client):
        """Test login with nonexistent user."""
        response = client.post("/api/v1/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "password123"
        })
        
        assert response.status_code == 401
    
    def test_get_current_user(self, client, auth_headers):
        """Test getting current user info."""
        response = client.get("/api/v1/auth/me", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "hr@example.com"
    
    def test_protected_endpoint_without_token(self, client):
        """Test that protected endpoints require auth."""
        response = client.get("/api/v1/jobs")
        
        assert response.status_code in [401, 403]  # Either is acceptable
