"""Database cleanup script - Delete all data except users/interviewers.

This script removes:
- All candidates and their related data (insights, assignments, status history)
- All jobs and interview rounds
- All interview schedules and reviews
- All question banks and snapshots
- All communications (emails, templates, offer letters)
- All talent memory entries

This script keeps:
- All users (HR, interviewers)
- Database schema/tables

Usage:
    python scripts/cleanup_db.py

Safety:
    - Prompts for confirmation before deletion
    - Shows counts of what will be deleted
    - Can be interrupted with Ctrl+C
"""

import sys
from pathlib import Path

# Add parent directory to path to import from backend
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.orm import Session
from sqlalchemy import func
from database import SessionLocal, engine
from models import (
    Base,
    Candidate,
    CandidateInsights,
    CandidateAssignment,
    CandidateStatusHistory,
    Job,
    InterviewRound,
    InterviewSchedule,
    InterviewReview,
    QuestionBank,
    InterviewQuestionsSnapshot,
    EmailTemplate,
    CommunicationLog,
    ScheduledEmail,
    OfferLetter,
    NoticePeriodTracking,
    FollowUpSchedule,
    ReengagementCandidate,
    User
)


def get_table_counts(db: Session) -> dict:
    """Get counts of records in each table."""
    return {
        "candidates": db.query(Candidate).count(),
        "candidate_insights": db.query(CandidateInsights).count(),
        "candidate_assignments": db.query(CandidateAssignment).count(),
        "candidate_status_history": db.query(CandidateStatusHistory).count(),
        "jobs": db.query(Job).count(),
        "interview_rounds": db.query(InterviewRound).count(),
        "interview_schedules": db.query(InterviewSchedule).count(),
        "interview_reviews": db.query(InterviewReview).count(),
        "question_banks": db.query(QuestionBank).count(),
        "interview_questions_snapshots": db.query(InterviewQuestionsSnapshot).count(),
        "email_templates": db.query(EmailTemplate).count(),
        "communication_logs": db.query(CommunicationLog).count(),
        "scheduled_emails": db.query(ScheduledEmail).count(),
        "offer_letters": db.query(OfferLetter).count(),
        "notice_period_tracking": db.query(NoticePeriodTracking).count(),
        "follow_up_schedules": db.query(FollowUpSchedule).count(),
        "reengagement_candidates": db.query(ReengagementCandidate).count(),
        "users": db.query(User).count(),
    }


def display_summary(counts: dict):
    """Display a formatted summary of what will be deleted."""
    print("\n" + "=" * 70)
    print("DATABASE CLEANUP SUMMARY")
    print("=" * 70)

    print("\n🗑️  DATA TO BE DELETED:")
    print("-" * 70)

    delete_items = [
        ("Candidates", counts["candidates"]),
        ("Candidate Insights", counts["candidate_insights"]),
        ("Candidate Assignments", counts["candidate_assignments"]),
        ("Candidate Status History", counts["candidate_status_history"]),
        ("Jobs", counts["jobs"]),
        ("Interview Rounds", counts["interview_rounds"]),
        ("Interview Schedules", counts["interview_schedules"]),
        ("Interview Reviews", counts["interview_reviews"]),
        ("Question Banks", counts["question_banks"]),
        ("Interview Questions Snapshots", counts["interview_questions_snapshots"]),
        ("Email Templates", counts["email_templates"]),
        ("Communication Logs", counts["communication_logs"]),
        ("Scheduled Emails", counts["scheduled_emails"]),
        ("Offer Letters", counts["offer_letters"]),
        ("Notice Period Tracking", counts["notice_period_tracking"]),
        ("Follow-up Schedules", counts["follow_up_schedules"]),
        ("Re-engagement Candidates", counts["reengagement_candidates"]),
    ]

    total_to_delete = 0
    for name, count in delete_items:
        if count > 0:
            print(f"  • {name:<35} {count:>6} records")
            total_to_delete += count

    print("-" * 70)
    print(f"  TOTAL RECORDS TO DELETE: {total_to_delete:>6}")

    print("\n✅ DATA TO KEEP:")
    print("-" * 70)
    print(f"  • Users (HR, Interviewers)      {counts['users']:>6} records")

    print("\n⚠️  WARNING:")
    print("  This action CANNOT be undone!")
    print("  All candidate and job data will be permanently deleted.")
    print("=" * 70 + "\n")


def cleanup_database(db: Session):
    """Delete all data except users, in correct order respecting foreign keys."""

    print("\n🧹 Starting database cleanup...")

    deleted_counts = {}

    # Delete in order of dependencies (child tables first)

    # 1. Follow-up schedules (depends on notice_period_tracking)
    count = db.query(FollowUpSchedule).delete()
    deleted_counts["follow_up_schedules"] = count
    print(f"  ✓ Deleted {count} follow-up schedules")

    # 2. Notice period tracking (depends on offer_letters)
    count = db.query(NoticePeriodTracking).delete()
    deleted_counts["notice_period_tracking"] = count
    print(f"  ✓ Deleted {count} notice period tracking records")

    # 3. Offer letters (depends on candidates)
    count = db.query(OfferLetter).delete()
    deleted_counts["offer_letters"] = count
    print(f"  ✓ Deleted {count} offer letters")

    # 4. Scheduled emails (depends on candidates, templates)
    count = db.query(ScheduledEmail).delete()
    deleted_counts["scheduled_emails"] = count
    print(f"  ✓ Deleted {count} scheduled emails")

    # 5. Communication logs (depends on candidates, templates)
    count = db.query(CommunicationLog).delete()
    deleted_counts["communication_logs"] = count
    print(f"  ✓ Deleted {count} communication logs")

    # 6. Email templates (independent)
    count = db.query(EmailTemplate).delete()
    deleted_counts["email_templates"] = count
    print(f"  ✓ Deleted {count} email templates")

    # 7. Re-engagement candidates (depends on candidates)
    count = db.query(ReengagementCandidate).delete()
    deleted_counts["reengagement_candidates"] = count
    print(f"  ✓ Deleted {count} re-engagement candidates")

    # 8. Interview reviews (depends on interview_schedules)
    count = db.query(InterviewReview).delete()
    deleted_counts["interview_reviews"] = count
    print(f"  ✓ Deleted {count} interview reviews")

    # 9. Interview questions snapshots (depends on interview_schedules)
    count = db.query(InterviewQuestionsSnapshot).delete()
    deleted_counts["interview_questions_snapshots"] = count
    print(f"  ✓ Deleted {count} interview questions snapshots")

    # 10. Interview schedules (depends on candidates, interview_rounds)
    count = db.query(InterviewSchedule).delete()
    deleted_counts["interview_schedules"] = count
    print(f"  ✓ Deleted {count} interview schedules")

    # 11. Question banks (depends on interview_rounds)
    count = db.query(QuestionBank).delete()
    deleted_counts["question_banks"] = count
    print(f"  ✓ Deleted {count} question banks")

    # 12. Candidate assignments (depends on candidates)
    count = db.query(CandidateAssignment).delete()
    deleted_counts["candidate_assignments"] = count
    print(f"  ✓ Deleted {count} candidate assignments")

    # 13. Candidate status history (depends on candidates)
    count = db.query(CandidateStatusHistory).delete()
    deleted_counts["candidate_status_history"] = count
    print(f"  ✓ Deleted {count} candidate status history records")

    # 14. Candidate insights (depends on candidates)
    count = db.query(CandidateInsights).delete()
    deleted_counts["candidate_insights"] = count
    print(f"  ✓ Deleted {count} candidate insights")

    # 15. Interview rounds (depends on jobs)
    count = db.query(InterviewRound).delete()
    deleted_counts["interview_rounds"] = count
    print(f"  ✓ Deleted {count} interview rounds")

    # 16. Candidates (depends on jobs)
    count = db.query(Candidate).delete()
    deleted_counts["candidates"] = count
    print(f"  ✓ Deleted {count} candidates")

    # 17. Jobs (independent)
    count = db.query(Job).delete()
    deleted_counts["jobs"] = count
    print(f"  ✓ Deleted {count} jobs")

    # Commit all deletions
    db.commit()

    return deleted_counts


def main():
    """Main cleanup function."""

    print("\n" + "=" * 70)
    print("DATABASE CLEANUP SCRIPT")
    print("=" * 70)
    print("\nThis script will DELETE all data except users/interviewers.")
    print("Use this for a fresh demo or testing environment.\n")

    # Create database session
    db = SessionLocal()

    try:
        # Get current counts
        print("📊 Analyzing database...")
        counts = get_table_counts(db)

        # Display summary
        display_summary(counts)

        # Check if there's anything to delete
        total_records = sum(v for k, v in counts.items() if k != "users")
        if total_records == 0:
            print("✅ Database is already clean! Nothing to delete.\n")
            return

        # Ask for confirmation
        print("⚠️  Type 'DELETE' (in capitals) to confirm deletion: ", end="")
        confirmation = input().strip()

        if confirmation != "DELETE":
            print("\n❌ Cleanup cancelled. No data was deleted.\n")
            return

        # Perform cleanup
        deleted_counts = cleanup_database(db)

        # Display results
        total_deleted = sum(deleted_counts.values())

        print("\n" + "=" * 70)
        print("✅ CLEANUP COMPLETED SUCCESSFULLY!")
        print("=" * 70)
        print(f"\n  Total records deleted: {total_deleted}")
        print(f"  Users preserved: {counts['users']}")

        # Verify cleanup
        print("\n🔍 Verifying cleanup...")
        new_counts = get_table_counts(db)

        verification_passed = True
        for key in counts.keys():
            if key == "users":
                if new_counts[key] != counts[key]:
                    print(f"  ⚠️  WARNING: User count changed! Was {counts[key]}, now {new_counts[key]}")
                    verification_passed = False
            else:
                if new_counts[key] != 0:
                    print(f"  ⚠️  WARNING: {key} still has {new_counts[key]} records!")
                    verification_passed = False

        if verification_passed:
            print("  ✓ All data deleted successfully")
            print("  ✓ All users preserved")

        print("\n🎉 Database is now ready for a fresh demo!\n")

    except KeyboardInterrupt:
        print("\n\n❌ Cleanup interrupted by user. Rolling back changes...")
        db.rollback()
        print("✅ Rollback completed. No data was deleted.\n")

    except Exception as e:
        print(f"\n\n❌ ERROR during cleanup: {e}")
        print("Rolling back changes...")
        db.rollback()
        print("✅ Rollback completed. No data was deleted.\n")
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()
