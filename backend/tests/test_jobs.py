"""Tests for job endpoints."""
import pytest


class TestJobs:
    """Test job CRUD operations."""
    
    def test_create_job(self, client, auth_headers):
        """Test creating a new job."""
        response = client.post("/api/v1/jobs", json={
            "title": "Senior Backend Engineer",
            "description": "We are looking for a senior backend engineer...",
            "requirements": {
                "skills": ["Python", "FastAPI", "PostgreSQL"],
                "experience_years": 5,
                "education": "Bachelor's in CS",
                "nice_to_have": ["Kubernetes", "AWS"]
            },
            "status": "active"
        }, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Senior Backend Engineer"
        assert data["status"] == "active"
        assert "id" in data
    
    def test_create_job_minimal(self, client, auth_headers):
        """Test creating a job with minimal data."""
        response = client.post("/api/v1/jobs", json={
            "title": "Junior Developer"
        }, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Junior Developer"
        assert data["status"] == "draft"  # Default status
    
    def test_create_job_unauthorized(self, client, interviewer_headers):
        """Test that interviewers cannot create jobs."""
        response = client.post("/api/v1/jobs", json={
            "title": "Unauthorized Job"
        }, headers=interviewer_headers)
        
        assert response.status_code == 403
    
    def test_list_jobs(self, client, auth_headers):
        """Test listing jobs."""
        # Create a job first
        client.post("/api/v1/jobs", json={"title": "Job 1"}, headers=auth_headers)
        client.post("/api/v1/jobs", json={"title": "Job 2"}, headers=auth_headers)
        
        response = client.get("/api/v1/jobs", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["jobs"]) == 2
    
    def test_list_jobs_with_status_filter(self, client, auth_headers):
        """Test filtering jobs by status."""
        client.post("/api/v1/jobs", json={"title": "Draft Job", "status": "draft"}, headers=auth_headers)
        client.post("/api/v1/jobs", json={"title": "Active Job", "status": "active"}, headers=auth_headers)
        
        response = client.get("/api/v1/jobs?status=active", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["jobs"][0]["title"] == "Active Job"
    
    def test_get_job(self, client, auth_headers):
        """Test getting a specific job."""
        # Create a job
        create_response = client.post("/api/v1/jobs", json={
            "title": "Specific Job",
            "description": "Test description"
        }, headers=auth_headers)
        job_id = create_response.json()["id"]
        
        # Get the job
        response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == job_id
        assert data["title"] == "Specific Job"
    
    def test_get_nonexistent_job(self, client, auth_headers):
        """Test getting a job that doesn't exist."""
        response = client.get("/api/v1/jobs/nonexistent-id", headers=auth_headers)
        
        assert response.status_code == 404
    
    def test_update_job(self, client, auth_headers):
        """Test updating a job."""
        # Create a job
        create_response = client.post("/api/v1/jobs", json={
            "title": "Original Title"
        }, headers=auth_headers)
        job_id = create_response.json()["id"]
        
        # Update the job
        response = client.put(f"/api/v1/jobs/{job_id}", json={
            "title": "Updated Title",
            "status": "active"
        }, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "Updated Title"
        assert data["status"] == "active"
    
    def test_delete_job(self, client, auth_headers):
        """Test deleting a job."""
        # Create a job
        create_response = client.post("/api/v1/jobs", json={
            "title": "Job to Delete"
        }, headers=auth_headers)
        job_id = create_response.json()["id"]
        
        # Delete the job
        response = client.delete(f"/api/v1/jobs/{job_id}", headers=auth_headers)
        
        assert response.status_code == 204
        
        # Verify it's deleted
        get_response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
        assert get_response.status_code == 404
    
    def test_interviewer_can_list_jobs(self, client, auth_headers, interviewer_headers):
        """Test that interviewers can view jobs."""
        # HR creates a job
        client.post("/api/v1/jobs", json={"title": "Viewable Job"}, headers=auth_headers)
        
        # Interviewer views jobs
        response = client.get("/api/v1/jobs", headers=interviewer_headers)
        
        assert response.status_code == 200
        assert response.json()["total"] == 1
