"""Tests for candidate endpoints."""
import io
from datetime import datetime, timedelta, timezone

import pytest


class TestCandidates:
    """Test candidate CRUD operations."""
    
    @pytest.fixture
    def job_id(self, client, auth_headers):
        """Create a job and return its ID."""
        response = client.post("/api/v1/jobs", json={
            "title": "Test Job",
            "status": "active"
        }, headers=auth_headers)
        return response.json()["id"]
    
    def test_create_candidate(self, client, auth_headers, job_id):
        """Test creating a candidate without resume."""
        response = client.post("/api/v1/candidates", data={
            "name": "John Doe",
            "email": "john@example.com",
            "phone": "123-456-7890",
            "job_id": job_id
        }, headers=auth_headers)
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "John Doe"
        assert data["email"] == "john@example.com"
        assert data["status"] == "applied"
        assert data["job_id"] == job_id
    
    def test_create_candidate_with_resume(self, client, auth_headers, job_id):
        """Test creating a candidate with PDF resume."""
        # Create a minimal PDF-like content (not a real PDF but tests the upload)
        pdf_content = b"%PDF-1.4 test content"
        
        response = client.post("/api/v1/candidates", 
            data={
                "name": "Jane Doe",
                "email": "jane@example.com",
                "job_id": job_id
            },
            files={
                "resume": ("resume.pdf", io.BytesIO(pdf_content), "application/pdf")
            },
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Jane Doe"
        assert data["resume_path"] is not None
    
    def test_create_candidate_invalid_job(self, client, auth_headers):
        """Test creating a candidate with nonexistent job."""
        response = client.post("/api/v1/candidates", data={
            "name": "Invalid Candidate",
            "job_id": "nonexistent-job-id"
        }, headers=auth_headers)
        
        assert response.status_code == 404
    
    def test_list_candidates(self, client, auth_headers, job_id):
        """Test listing candidates."""
        # Create candidates
        client.post("/api/v1/candidates", data={
            "name": "Candidate 1",
            "job_id": job_id
        }, headers=auth_headers)
        client.post("/api/v1/candidates", data={
            "name": "Candidate 2",
            "job_id": job_id
        }, headers=auth_headers)
        
        response = client.get("/api/v1/candidates", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
    
    def test_list_candidates_filter_by_job(self, client, auth_headers, job_id):
        """Test filtering candidates by job."""
        # Create another job
        job2_response = client.post("/api/v1/jobs", json={"title": "Job 2"}, headers=auth_headers)
        job2_id = job2_response.json()["id"]
        
        # Create candidates for different jobs
        client.post("/api/v1/candidates", data={
            "name": "Candidate for Job 1",
            "job_id": job_id
        }, headers=auth_headers)
        client.post("/api/v1/candidates", data={
            "name": "Candidate for Job 2",
            "job_id": job2_id
        }, headers=auth_headers)
        
        response = client.get(f"/api/v1/candidates?job_id={job_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["candidates"][0]["name"] == "Candidate for Job 1"
    
    def test_get_candidate(self, client, auth_headers, job_id):
        """Test getting a specific candidate."""
        # Create candidate
        create_response = client.post("/api/v1/candidates", data={
            "name": "Test Candidate",
            "email": "test@example.com",
            "job_id": job_id
        }, headers=auth_headers)
        candidate_id = create_response.json()["id"]
        
        # Get candidate
        response = client.get(f"/api/v1/candidates/{candidate_id}", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == candidate_id
        assert data["name"] == "Test Candidate"
        assert data["job_title"] == "Test Job"
    
    def test_update_candidate(self, client, auth_headers, job_id):
        """Test updating a candidate."""
        # Create candidate
        create_response = client.post("/api/v1/candidates", data={
            "name": "Original Name",
            "job_id": job_id
        }, headers=auth_headers)
        candidate_id = create_response.json()["id"]
        
        # Update candidate
        response = client.put(f"/api/v1/candidates/{candidate_id}", json={
            "name": "Updated Name",
            "email": "updated@example.com"
        }, headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["email"] == "updated@example.com"
    
    def test_update_candidate_status(self, client, auth_headers, job_id):
        """Test updating candidate status."""
        # Create candidate
        create_response = client.post("/api/v1/candidates", data={
            "name": "Status Test",
            "job_id": job_id
        }, headers=auth_headers)
        candidate_id = create_response.json()["id"]
        
        # Update status
        response = client.put(
            f"/api/v1/candidates/{candidate_id}/status?status=screening",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        assert response.json()["status"] == "screening"
    
    def test_delete_candidate(self, client, auth_headers, job_id):
        """Test deleting a candidate."""
        # Create candidate
        create_response = client.post("/api/v1/candidates", data={
            "name": "To Delete",
            "job_id": job_id
        }, headers=auth_headers)
        candidate_id = create_response.json()["id"]
        
        # Delete candidate
        response = client.delete(f"/api/v1/candidates/{candidate_id}", headers=auth_headers)
        
        assert response.status_code == 204
        
        # Verify deleted
        get_response = client.get(f"/api/v1/candidates/{candidate_id}", headers=auth_headers)
        assert get_response.status_code == 404
    
    def test_candidate_count_on_job(self, client, auth_headers, job_id):
        """Test that job shows correct candidate count."""
        # Create candidates
        client.post("/api/v1/candidates", data={"name": "C1", "job_id": job_id}, headers=auth_headers)
        client.post("/api/v1/candidates", data={"name": "C2", "job_id": job_id}, headers=auth_headers)
        
        # Check job candidate count
        response = client.get(f"/api/v1/jobs/{job_id}", headers=auth_headers)
        
        assert response.status_code == 200
        assert response.json()["candidate_count"] == 2


class TestCandidateAssignment:
    """Test candidate-interviewer assignment."""
    
    @pytest.fixture
    def setup_data(self, client, auth_headers, interviewer_headers):
        """Set up job, candidate, and get interviewer ID."""
        # Create job
        job_response = client.post("/api/v1/jobs", json={"title": "Test Job"}, headers=auth_headers)
        job_id = job_response.json()["id"]
        
        # Create candidate
        candidate_response = client.post("/api/v1/candidates", data={
            "name": "Assignable Candidate",
            "job_id": job_id
        }, headers=auth_headers)
        candidate_id = candidate_response.json()["id"]
        
        # Get interviewer ID
        me_response = client.get("/api/v1/auth/me", headers=interviewer_headers)
        interviewer_id = me_response.json()["id"]
        
        return {
            "job_id": job_id,
            "candidate_id": candidate_id,
            "interviewer_id": interviewer_id
        }
    
    def test_assign_candidate(self, client, auth_headers, setup_data):
        """Test assigning a candidate to an interviewer."""
        response = client.post(
            f"/api/v1/candidates/{setup_data['candidate_id']}/assign",
            json={
                "candidate_id": setup_data["candidate_id"],
                "interviewer_id": setup_data["interviewer_id"],
                "round_number": "round_1"
            },
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["candidate_id"] == setup_data["candidate_id"]
        assert data["interviewer_id"] == setup_data["interviewer_id"]
        assert data["round_number"] == "round_1"
    
    def test_interviewer_view_assigned_candidates(self, client, auth_headers, interviewer_headers, setup_data):
        """Test that interviewer can see assigned candidates."""
        # Assign candidate
        client.post(
            f"/api/v1/candidates/{setup_data['candidate_id']}/assign",
            json={
                "candidate_id": setup_data["candidate_id"],
                "interviewer_id": setup_data["interviewer_id"]
            },
            headers=auth_headers
        )
        
        # Interviewer views their candidates
        response = client.get("/api/v1/interviewer/candidates", headers=interviewer_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert data["candidates"][0]["id"] == setup_data["candidate_id"]
    
    def test_interviewer_view_unassigned_candidate_fails(self, client, auth_headers, interviewer_headers, setup_data):
        """Test that interviewer cannot view candidates not assigned to them."""
        # Don't assign candidate, try to view
        response = client.get(
            f"/api/v1/interviewer/candidates/{setup_data['candidate_id']}",
            headers=interviewer_headers
        )

        assert response.status_code == 404


class TestCandidateInterviewTimeline:
    """Phase 7 — chronologically-merged candidate interview timeline."""

    def _seed_round_trip(self, db, candidate_id: str, interviewer_id: str, job_id: str):
        """Seed a Phase-6 reschedule round-trip in the DB.

        applied → screening → invite_sent → reschedule_requested → reschedule_processed → confirmed
        Returns the schedule id for further assertions.
        """
        from models import (
            Candidate,
            CandidateStatusHistory,
            CommunicationLog,
            InterviewRound,
            InterviewSchedule,
            InterviewStatus,
        )

        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        # Anchor seeded events strictly after applied_at so the timeline starts
        # with "applied" then proceeds chronologically.
        applied_at = candidate.applied_at
        if applied_at.tzinfo is None:
            applied_at = applied_at.replace(tzinfo=timezone.utc)
        base = applied_at

        # Status change: applied → screening
        db.add(CandidateStatusHistory(
            candidate_id=candidate_id,
            old_status="applied",
            new_status="screening",
            changed_at=base + timedelta(hours=1),
            changed_by=None,
            notes="Moved to screening",
        ))

        # Round + schedule that went through full reschedule round-trip
        round_obj = InterviewRound(
            job_id=job_id,
            round_number=1,
            round_name="Technical",
        )
        db.add(round_obj)
        db.flush()

        schedule = InterviewSchedule(
            interview_round_id=round_obj.id,
            candidate_id=candidate_id,
            interviewer_id=interviewer_id,
            scheduled_at=base + timedelta(days=2),
            status=InterviewStatus.CONFIRMED,
            invite_sent_at=base + timedelta(days=1, hours=4),  # HR's re-sent invite
            confirmed_at=base + timedelta(days=1, hours=5),    # interviewer's final confirm
            reschedule_count=1,
            reschedule_reason="Asked for an evening slot",
            created_at=base + timedelta(hours=2),
            updated_at=base + timedelta(days=1, hours=4),
        )
        db.add(schedule)

        # An email was logged when the invite went out
        db.add(CommunicationLog(
            candidate_id=candidate_id,
            recipient_email="someone@example.com",
            subject="Interview invite",
            body_html="<p>hi</p>",
            sent_at=base + timedelta(days=1, hours=4, minutes=1),
            status="sent",
        ))

        db.commit()
        return schedule.id

    def test_hr_can_fetch_timeline_with_chronological_order(self, client, auth_headers, db):
        """HR fetches a candidate's timeline; events come back in time order
        and include the full Phase-6 reschedule round-trip."""
        # Create job + candidate via API so we exercise the real auth path.
        job_response = client.post("/api/v1/jobs", json={"title": "Backend Eng"}, headers=auth_headers)
        job_id = job_response.json()["id"]
        cand_response = client.post(
            "/api/v1/candidates",
            data={"name": "Aria Singh", "email": "aria@example.com", "job_id": job_id},
            headers=auth_headers,
        )
        candidate_id = cand_response.json()["id"]

        # Seed an interviewer + the round-trip events
        from models import User, UserRole
        from services.auth_service import hash_password
        interviewer = User(
            email="iv@example.com",
            name="Iv Tester",
            role=UserRole.INTERVIEWER,
            password_hash=hash_password("x"),
        )
        db.add(interviewer)
        db.commit()

        self._seed_round_trip(db, candidate_id, interviewer.id, job_id)

        response = client.get(
            f"/api/v1/candidates/{candidate_id}/interview-timeline",
            headers=auth_headers,
        )
        assert response.status_code == 200, response.text
        body = response.json()

        kinds = [e["kind"] for e in body["events"]]
        assert kinds[0] == "applied"
        # Phase-6 round-trip must be visible end-to-end
        for required in ("status_changed", "interview_assigned", "reschedule_requested",
                         "reschedule_processed", "interview_confirmed", "email_sent"):
            assert required in kinds, f"missing {required} in {kinds}"

        # request must come before processed
        req_idx = kinds.index("reschedule_requested")
        proc_idx = kinds.index("reschedule_processed")
        assert req_idx < proc_idx

        # Strict chronological order
        timestamps = [e["at"] for e in body["events"]]
        assert timestamps == sorted(timestamps), "events out of order"

    def test_interviewer_unassigned_can_still_read_timeline(self, client, auth_headers, interviewer_headers, db):
        """Talent memory is shared: any authenticated interviewer can read any
        candidate's timeline, even ones they were never assigned to."""
        job_response = client.post("/api/v1/jobs", json={"title": "Backend Eng"}, headers=auth_headers)
        job_id = job_response.json()["id"]
        cand_response = client.post(
            "/api/v1/candidates",
            data={"name": "Shared Memory", "job_id": job_id},
            headers=auth_headers,
        )
        candidate_id = cand_response.json()["id"]

        response = client.get(
            f"/api/v1/candidates/{candidate_id}/interview-timeline",
            headers=interviewer_headers,
        )
        assert response.status_code == 200
        kinds = [e["kind"] for e in response.json()["events"]]
        assert kinds == ["applied"]

    def test_timeline_includes_question_bank_and_review_body(self, client, auth_headers, db):
        """Question-bank generation and interviewer reviews appear in the
        merged stream with full body content (notes, strengths, axis ratings)."""
        from datetime import datetime, timedelta, timezone
        from models import (
            Candidate,
            InterviewRound,
            InterviewSchedule,
            InterviewStatus,
            InterviewReview,
            QuestionBank,
            User,
            UserRole,
        )
        from services.auth_service import hash_password

        job_response = client.post("/api/v1/jobs", json={"title": "Backend Eng"}, headers=auth_headers)
        job_id = job_response.json()["id"]
        cand_response = client.post(
            "/api/v1/candidates",
            data={"name": "Reviewed Person", "job_id": job_id},
            headers=auth_headers,
        )
        candidate_id = cand_response.json()["id"]

        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        applied_at = candidate.applied_at
        if applied_at.tzinfo is None:
            applied_at = applied_at.replace(tzinfo=timezone.utc)

        interviewer = User(
            email="iv2@example.com",
            name="Iv Reviewer",
            role=UserRole.INTERVIEWER,
            password_hash=hash_password("x"),
        )
        db.add(interviewer)
        db.flush()

        round_obj = InterviewRound(job_id=job_id, round_number=1, round_name="Tech")
        db.add(round_obj)
        db.flush()

        # Seed a QB created right after applying, then refined a bit later
        qb = QuestionBank(
            candidate_id=candidate_id,
            job_id=job_id,
            jd_based_questions=[{"question": "X", "suggested_answer": "Y"}],
            fundamental_questions=[
                {"question": "A", "suggested_answer": "B"},
                {"question": "C", "suggested_answer": "D"},
            ],
            round_number=1,
            auto_generated=True,
            modified_by_interviewer=True,
            created_at=applied_at + timedelta(hours=1),
            updated_at=applied_at + timedelta(hours=2),
        )
        db.add(qb)

        # Seed a completed schedule + review
        schedule = InterviewSchedule(
            interview_round_id=round_obj.id,
            candidate_id=candidate_id,
            interviewer_id=interviewer.id,
            scheduled_at=applied_at + timedelta(days=1),
            status=InterviewStatus.COMPLETED,
            invite_sent_at=applied_at + timedelta(hours=3),
            confirmed_at=applied_at + timedelta(days=1, hours=1),
            created_at=applied_at + timedelta(hours=2, minutes=30),
        )
        db.add(schedule)
        db.flush()

        review = InterviewReview(
            schedule_id=schedule.id,
            interviewer_id=interviewer.id,
            candidate_id=candidate_id,
            technical_skills=4,
            communication=5,
            problem_solving=4,
            cultural_fit=5,
            overall_rating=4,
            strengths="Strong in system design, clear communicator",
            areas_for_improvement="Could deepen distributed-systems knowledge",
            notes="Great signal across the board",
            recommendation="strong_yes",
            created_at=applied_at + timedelta(days=1, hours=2),
        )
        db.add(review)
        db.commit()

        response = client.get(
            f"/api/v1/candidates/{candidate_id}/interview-timeline",
            headers=auth_headers,
        )
        assert response.status_code == 200
        events = response.json()["events"]
        kinds = [e["kind"] for e in events]
        assert "question_bank_generated" in kinds
        assert "question_bank_modified" in kinds
        assert "review_submitted" in kinds
        assert "interview_completed" in kinds
        # Completed schedules with a sent invite imply an earlier confirm —
        # we synthesise it so the timeline doesn't appear to skip a stage.
        assert "interview_confirmed" in kinds
        confirm_idx = kinds.index("interview_confirmed")
        complete_idx = kinds.index("interview_completed")
        assert confirm_idx < complete_idx

        qb_event = next(e for e in events if e["kind"] == "question_bank_generated")
        assert qb_event["meta"]["total_questions"] == 3
        assert qb_event["meta"]["fundamentals"] == 2
        assert qb_event["meta"]["jd_based"] == 1

        review_event = next(e for e in events if e["kind"] == "review_submitted")
        assert review_event["meta"]["overall_rating"] == 4
        assert review_event["meta"]["recommendation"] == "strong_yes"
        assert review_event["meta"]["technical"] == 4
        assert review_event["meta"]["strengths"].startswith("Strong in system design")
        assert review_event["meta"]["areas_for_improvement"]
        assert review_event["body"] == "Great signal across the board"

    def test_add_question_actually_persists(self, client, auth_headers, interviewer_headers, db):
        """Regression: the QB add endpoint mutated the existing JSON list and
        relied on SQLAlchemy detecting the change, which Postgres + the
        non-Mutable JSON column type doesn't do reliably. The fix uses a fresh
        list reference plus flag_modified."""
        from models import (
            Candidate, InterviewRound, InterviewSchedule, InterviewStatus, QuestionBank,
        )
        job = client.post("/api/v1/jobs", json={"title": "QB Persist"}, headers=auth_headers).json()
        cand = client.post(
            "/api/v1/candidates",
            data={"name": "Persist Cand", "job_id": job["id"]},
            headers=auth_headers,
        ).json()
        me = client.get("/api/v1/auth/me", headers=interviewer_headers).json()
        round_obj = InterviewRound(job_id=job["id"], round_number=1)
        db.add(round_obj)
        db.flush()
        db.add(InterviewSchedule(
            interview_round_id=round_obj.id,
            candidate_id=cand["id"],
            interviewer_id=me["id"],
            status=InterviewStatus.PENDING,
        ))
        # Pre-existing QB with two fundamentals
        qb = QuestionBank(
            candidate_id=cand["id"],
            job_id=job["id"],
            fundamental_questions=[
                {"question": "F-1", "suggested_answer": ""},
                {"question": "F-2", "suggested_answer": ""},
            ],
        )
        db.add(qb)
        db.commit()

        # Add via the endpoint
        resp = client.post(
            f"/api/v1/interviewer/candidates/{cand['id']}/question-bank/add",
            json={"category": "fundamental", "question": "Custom Q", "suggested_answer": "Custom A"},
            headers=interviewer_headers,
        )
        assert resp.status_code == 200

        # Re-read from DB (don't trust the in-memory return value)
        db.expire_all()
        refreshed = db.query(QuestionBank).filter(QuestionBank.candidate_id == cand["id"]).first()
        questions = refreshed.fundamental_questions or []
        assert len(questions) == 3, f"add did not persist: {questions}"
        assert questions[-1]["question"] == "Custom Q"

    def test_complete_takes_question_snapshot_and_links_in_timeline(self, client, auth_headers, interviewer_headers, db):
        """Phase 7.8: marking an interview conducted snapshots the QB into
        InterviewQuestionsSnapshot, the new GET endpoint serves it, and the
        timeline review_submitted event carries the snapshot id so the UI
        can deep-link to "questions asked"."""
        from models import (
            Candidate, InterviewRound, InterviewSchedule, InterviewStatus,
            QuestionBank,
        )

        # Set up: HR creates job + candidate, assigns interviewer to a Round 1
        job = client.post("/api/v1/jobs", json={"title": "Snap Job"}, headers=auth_headers).json()
        cand = client.post(
            "/api/v1/candidates",
            data={"name": "Snap Candidate", "job_id": job["id"]},
            headers=auth_headers,
        ).json()
        me = client.get("/api/v1/auth/me", headers=interviewer_headers).json()

        round_obj = InterviewRound(job_id=job["id"], round_number=1, round_name="Tech")
        db.add(round_obj)
        db.flush()
        schedule = InterviewSchedule(
            interview_round_id=round_obj.id,
            candidate_id=cand["id"],
            interviewer_id=me["id"],
            status=InterviewStatus.CONFIRMED,
        )
        db.add(schedule)
        db.flush()

        # Hand-craft a QB so we can predict the snapshot contents.
        qb = QuestionBank(
            candidate_id=cand["id"],
            job_id=job["id"],
            jd_based_questions=[{"question": "JD-1", "suggested_answer": ""}],
            fundamental_questions=[
                {"question": "F-1", "suggested_answer": ""},
                {"question": "F-2", "suggested_answer": ""},
            ],
            resume_questions=[{"question": "R-1", "suggested_answer": ""}],
            behavioral_questions=[],
            insights_based_questions=[],
            red_flag_probes=[],
            leetcode_questions=[],
            modified_by_interviewer=True,
            chat_history=[{"role": "user", "content": "make them harder"}],
        )
        db.add(qb)
        db.commit()

        # Interviewer marks the interview conducted with a review.
        complete_resp = client.post(
            f"/api/v1/interviewer/schedule/{schedule.id}/complete",
            json={
                "technical_skills": 4,
                "communication": 4,
                "problem_solving": 4,
                "cultural_fit": 4,
                "overall_rating": 4,
                "strengths": "k",
                "areas_for_improvement": "k",
                "notes": "k",
                "recommendation": "yes",
            },
            headers=interviewer_headers,
        )
        assert complete_resp.status_code == 200
        snap_id = complete_resp.json()["questions_snapshot_id"]
        assert snap_id, "complete should return the snapshot id"

        # GET endpoint returns the exact frozen QB (with chat_history + modified flag)
        snap_resp = client.get(
            f"/api/v1/interviews/{schedule.id}/questions-asked",
            headers=interviewer_headers,
        )
        assert snap_resp.status_code == 200
        snap = snap_resp.json()
        assert snap["id"] == snap_id
        assert len(snap["fundamental_questions"]) == 2
        assert snap["jd_based_questions"][0]["question"] == "JD-1"
        assert snap["modified_by_interviewer"] is True
        assert snap["chat_history"][0]["content"] == "make them harder"

        # Re-completing must not duplicate the snapshot.
        # (The complete endpoint guards against double-review, so we test the
        # snapshot uniqueness by re-running build_timeline and asserting one snapshot.)
        from models import InterviewQuestionsSnapshot
        rows = db.query(InterviewQuestionsSnapshot).filter(
            InterviewQuestionsSnapshot.schedule_id == schedule.id
        ).all()
        assert len(rows) == 1

        # Timeline review_submitted event surfaces the snapshot id + question count.
        tl = client.get(f"/api/v1/candidates/{cand['id']}/interview-timeline", headers=auth_headers).json()
        review_event = next(e for e in tl["events"] if e["kind"] == "review_submitted")
        assert review_event["meta"]["questions_snapshot_id"] == snap_id
        assert review_event["meta"]["questions_asked_count"] == 4  # 1 JD + 2 fund + 1 resume

        # And so does interview_completed.
        completed_event = next(e for e in tl["events"] if e["kind"] == "interview_completed")
        assert completed_event["meta"]["questions_snapshot_id"] == snap_id

    def test_memory_list_scopes_and_filters(self, client, auth_headers, interviewer_headers, db):
        """The /interviewer/memory/candidates endpoint returns 'mine' (only
        candidates the user reviewed/completed) vs 'all', plus filters by
        status, job, and free-text search."""
        from datetime import timezone
        from models import (
            InterviewRound, InterviewSchedule, InterviewStatus,
            InterviewReview, Candidate,
        )

        # Two jobs, three candidates: one reviewed by current interviewer,
        # one assigned but not reviewed, one untouched.
        job_a = client.post("/api/v1/jobs", json={"title": "Backend"}, headers=auth_headers).json()
        job_b = client.post("/api/v1/jobs", json={"title": "Frontend"}, headers=auth_headers).json()

        c_reviewed = client.post(
            "/api/v1/candidates",
            data={"name": "Aria Reviewed", "email": "aria.r@x.com", "job_id": job_a["id"]},
            headers=auth_headers,
        ).json()
        c_assigned_only = client.post(
            "/api/v1/candidates",
            data={"name": "Bilal Assigned", "email": "bilal@x.com", "job_id": job_a["id"]},
            headers=auth_headers,
        ).json()
        c_untouched = client.post(
            "/api/v1/candidates",
            data={"name": "Caro Untouched", "email": "caro@x.com", "job_id": job_b["id"]},
            headers=auth_headers,
        ).json()

        # Move c_assigned_only's status so we can filter on it later
        client.put(
            f"/api/v1/candidates/{c_assigned_only['id']}/status?status=screening",
            headers=auth_headers,
        )

        me = client.get("/api/v1/auth/me", headers=interviewer_headers).json()
        interviewer_id = me["id"]

        round_a = InterviewRound(job_id=job_a["id"], round_number=1)
        db.add(round_a)
        db.flush()

        # Schedule for the reviewed candidate — completed + reviewed
        s_reviewed = InterviewSchedule(
            interview_round_id=round_a.id,
            candidate_id=c_reviewed["id"],
            interviewer_id=interviewer_id,
            status=InterviewStatus.COMPLETED,
        )
        db.add(s_reviewed)
        # Schedule for the assigned-only candidate — pending
        db.add(InterviewSchedule(
            interview_round_id=round_a.id,
            candidate_id=c_assigned_only["id"],
            interviewer_id=interviewer_id,
            status=InterviewStatus.PENDING,
        ))
        db.flush()
        db.add(InterviewReview(
            schedule_id=s_reviewed.id,
            interviewer_id=interviewer_id,
            candidate_id=c_reviewed["id"],
            recommendation="yes",
            overall_rating=4,
        ))
        db.commit()

        # scope=mine should return only the reviewed candidate
        resp = client.get("/api/v1/interviewer/memory/candidates?scope=mine", headers=interviewer_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["scope"] == "mine"
        names = {c["name"] for c in data["candidates"]}
        assert names == {"Aria Reviewed"}
        row = data["candidates"][0]
        assert row["my_role"] == "interviewed"
        assert row["my_review_id"] is not None
        assert row["rounds_completed"] == 1

        # scope=all returns all three; my_role distinguishes them
        resp = client.get("/api/v1/interviewer/memory/candidates?scope=all", headers=interviewer_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert {c["name"] for c in data["candidates"]} == {"Aria Reviewed", "Bilal Assigned", "Caro Untouched"}
        roles = {c["name"]: c["my_role"] for c in data["candidates"]}
        assert roles["Aria Reviewed"] == "interviewed"
        assert roles["Bilal Assigned"] == "assigned"
        assert roles["Caro Untouched"] == "none"

        # status filter
        resp = client.get("/api/v1/interviewer/memory/candidates?scope=all&status=screening", headers=interviewer_headers)
        assert resp.status_code == 200
        names = {c["name"] for c in resp.json()["candidates"]}
        assert names == {"Bilal Assigned"}

        # job filter
        resp = client.get(f"/api/v1/interviewer/memory/candidates?scope=all&job_id={job_b['id']}", headers=interviewer_headers)
        names = {c["name"] for c in resp.json()["candidates"]}
        assert names == {"Caro Untouched"}

        # free-text search
        resp = client.get("/api/v1/interviewer/memory/candidates?scope=all&q=aria", headers=interviewer_headers)
        names = {c["name"] for c in resp.json()["candidates"]}
        assert names == {"Aria Reviewed"}

    def test_interviewer_assigned_via_schedule_can_read(self, client, auth_headers, interviewer_headers, db):
        """An interviewer with an InterviewSchedule for the candidate gets 200."""
        # Create job + candidate
        job_response = client.post("/api/v1/jobs", json={"title": "Backend Eng"}, headers=auth_headers)
        job_id = job_response.json()["id"]
        cand_response = client.post(
            "/api/v1/candidates",
            data={"name": "Has Access", "job_id": job_id},
            headers=auth_headers,
        )
        candidate_id = cand_response.json()["id"]

        # Identify the interviewer user
        me = client.get("/api/v1/auth/me", headers=interviewer_headers).json()
        interviewer_id = me["id"]

        from models import InterviewRound, InterviewSchedule, InterviewStatus
        round_obj = InterviewRound(job_id=job_id, round_number=1)
        db.add(round_obj)
        db.flush()
        db.add(InterviewSchedule(
            interview_round_id=round_obj.id,
            candidate_id=candidate_id,
            interviewer_id=interviewer_id,
            status=InterviewStatus.PENDING,
        ))
        db.commit()

        response = client.get(
            f"/api/v1/candidates/{candidate_id}/interview-timeline",
            headers=interviewer_headers,
        )
        assert response.status_code == 200
        body = response.json()
        kinds = [e["kind"] for e in body["events"]]
        assert "applied" in kinds
        assert "interview_assigned" in kinds
