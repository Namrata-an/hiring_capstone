"""Talent Search Service.

Provides full-text search and filtering capabilities for the talent database.
Searches across candidates, their insights, and interview history.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func

from models import (
    Candidate, CandidateInsights, Job, InterviewReview,
    InterviewSchedule, InterviewRound, CandidateStatus, User
)


def search_candidates(
    db: Session,
    name: Optional[str] = None,
    skills: Optional[List[str]] = None,
    job_id: Optional[str] = None,
    min_experience_years: Optional[int] = None,
    max_experience_years: Optional[int] = None,
    status: Optional[List[str]] = None,
    min_overall_score: Optional[int] = None,
    min_interview_rating: Optional[float] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    has_insights: Optional[bool] = None,
    rounds_completed: Optional[int] = None,
    page: int = 1,
    page_size: int = 20
) -> Dict[str, Any]:
    """Search candidates with various filters.
    
    Returns paginated results with match scores.
    """
    # Base query
    query = db.query(Candidate)

    # Name/Email search (case-insensitive partial match)
    if name:
        query = query.filter(
            or_(
                Candidate.name.ilike(f"%{name}%"),
                Candidate.email.ilike(f"%{name}%")
            )
        )
    
    # Job filter
    if job_id:
        query = query.filter(Candidate.job_id == job_id)
    
    # Status filter
    if status:
        status_enums = [CandidateStatus(s) for s in status if s in [e.value for e in CandidateStatus]]
        if status_enums:
            query = query.filter(Candidate.status.in_(status_enums))
    
    # Date range filter
    if date_from:
        query = query.filter(Candidate.applied_at >= date_from)
    if date_to:
        query = query.filter(Candidate.applied_at <= date_to)
    
    # Skills filter (any match)
    if skills:
        skill_conditions = []
        for skill in skills:
            # JSON array contains check - SQLite compatible
            skill_conditions.append(
                func.lower(func.json_extract(Candidate.skills, '$')).like(f'%{skill.lower()}%')
            )
        if skill_conditions:
            query = query.filter(or_(*skill_conditions))
    
    # Experience years filter (handle string format like "3" or "3-5")
    # This is approximate due to string storage
    if min_experience_years is not None or max_experience_years is not None:
        # We'll filter in Python after fetching since experience_years is a string
        pass
    
    # Get total before pagination
    candidates = query.all()
    
    # Post-query filtering and enrichment
    results = []
    for candidate in candidates:
        # Parse experience years
        exp_years = _parse_experience_years(candidate.experience_years)
        
        # Filter by experience
        if min_experience_years is not None and exp_years is not None:
            if exp_years < min_experience_years:
                continue
        if max_experience_years is not None and exp_years is not None:
            if exp_years > max_experience_years:
                continue
        
        # Get insights
        insights = db.query(CandidateInsights).filter(
            CandidateInsights.candidate_id == candidate.id
        ).first()
        
        # Filter by insights
        if has_insights is True and not insights:
            continue
        if has_insights is False and insights:
            continue
        
        overall_score = None
        if insights and insights.overall_score:
            try:
                overall_score = int(insights.overall_score)
            except (ValueError, TypeError):
                pass
        
        if min_overall_score is not None and (overall_score is None or overall_score < min_overall_score):
            continue
        
        # Get interview reviews
        reviews = db.query(InterviewReview).filter(
            InterviewReview.candidate_id == candidate.id
        ).all()
        
        avg_rating = None
        if reviews:
            ratings = [r.overall_rating for r in reviews if r.overall_rating is not None]
            if ratings:
                avg_rating = sum(ratings) / len(ratings)
        
        if min_interview_rating is not None and (avg_rating is None or avg_rating < min_interview_rating):
            continue
        
        # Count completed rounds
        completed_rounds = db.query(InterviewSchedule).filter(
            InterviewSchedule.candidate_id == candidate.id,
            InterviewSchedule.status == "completed"
        ).count()
        
        if rounds_completed is not None and completed_rounds < rounds_completed:
            continue
        
        # Get job title
        job = db.query(Job).filter(Job.id == candidate.job_id).first()
        job_title = job.title if job else None
        
        # Calculate match score (simple relevance scoring)
        match_score = _calculate_match_score(
            candidate=candidate,
            insights=insights,
            avg_rating=avg_rating,
            search_skills=skills,
            search_name=name
        )
        
        results.append({
            "candidate_id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "skills": candidate.skills,
            "experience_years": candidate.experience_years,
            "current_position": candidate.current_position,
            "status": candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status),
            "job_id": candidate.job_id,
            "job_title": job_title,
            "applied_at": candidate.applied_at,
            "overall_score": overall_score,
            "average_interview_rating": round(avg_rating, 2) if avg_rating else None,
            "rounds_completed": completed_rounds,
            "match_score": match_score
        })
    
    # Sort by match score
    results.sort(key=lambda x: x["match_score"], reverse=True)
    
    total = len(results)
    
    # Paginate
    start = (page - 1) * page_size
    end = start + page_size
    paginated_results = results[start:end]
    
    return {
        "results": paginated_results,
        "total": total,
        "page": page,
        "page_size": page_size
    }


def _parse_experience_years(exp_str: Optional[str]) -> Optional[int]:
    """Parse experience years string to integer."""
    if not exp_str:
        return None
    try:
        # Handle "3-5" format - take the lower bound
        if "-" in exp_str:
            return int(exp_str.split("-")[0].strip())
        # Handle "3+" format
        if "+" in exp_str:
            return int(exp_str.replace("+", "").strip())
        return int(exp_str.strip())
    except (ValueError, TypeError):
        return None


def _calculate_match_score(
    candidate,
    insights,
    avg_rating: Optional[float],
    search_skills: Optional[List[str]],
    search_name: Optional[str]
) -> float:
    """Calculate a relevance match score for search results."""
    score = 0.0
    
    # Base score from insights
    if insights and insights.overall_score:
        try:
            score += float(insights.overall_score) * 0.3  # 30% weight
        except (ValueError, TypeError):
            pass
    
    # Interview rating contribution
    if avg_rating:
        score += (avg_rating / 5.0) * 30  # Normalize to 30 points max
    
    # Skill match contribution
    if search_skills and candidate.skills:
        candidate_skills_lower = [s.lower() for s in candidate.skills]
        matches = sum(1 for s in search_skills if s.lower() in candidate_skills_lower)
        if matches > 0:
            score += (matches / len(search_skills)) * 20  # Up to 20 points
    
    # Name exact match bonus
    if search_name and candidate.name:
        if search_name.lower() == candidate.name.lower():
            score += 10  # Exact match bonus
        elif search_name.lower() in candidate.name.lower():
            score += 5  # Partial match
    
    return round(score, 2)


def get_candidate_history(db: Session, candidate_id: str) -> Optional[Dict[str, Any]]:
    """Get complete history timeline for a candidate."""
    from models import CandidateStatusHistory
    
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        return None
    
    job = db.query(Job).filter(Job.id == candidate.job_id).first()
    
    # Build timeline
    timeline = []
    
    # Applied event
    timeline.append({
        "type": "applied",
        "timestamp": candidate.applied_at.isoformat() if candidate.applied_at else candidate.created_at.isoformat(),
        "description": f"Applied for {job.title if job else 'position'}"
    })
    
    # Status changes
    status_history = db.query(CandidateStatusHistory).filter(
        CandidateStatusHistory.candidate_id == candidate_id
    ).order_by(CandidateStatusHistory.changed_at.asc()).all()
    
    status_changes = []
    for sh in status_history:
        timeline.append({
            "type": "status_change",
            "timestamp": sh.changed_at.isoformat(),
            "description": f"Status changed from {sh.old_status or 'none'} to {sh.new_status}",
            "notes": sh.notes
        })
        status_changes.append({
            "id": sh.id,
            "candidate_id": sh.candidate_id,
            "old_status": sh.old_status,
            "new_status": sh.new_status,
            "changed_at": sh.changed_at,
            "changed_by": sh.changed_by,
            "changed_by_name": sh.changed_by_user.name if sh.changed_by_user else None,
            "notes": sh.notes
        })
    
    # Interview schedules
    schedules = db.query(InterviewSchedule).filter(
        InterviewSchedule.candidate_id == candidate_id
    ).all()
    
    interview_rounds = []
    for schedule in schedules:
        round_info = db.query(InterviewRound).filter(
            InterviewRound.id == schedule.interview_round_id
        ).first()
        
        timeline.append({
            "type": "interview_scheduled",
            "timestamp": schedule.created_at.isoformat(),
            "description": f"Interview scheduled for {round_info.round_name if round_info else 'round'}",
            "status": schedule.status.value if hasattr(schedule.status, 'value') else str(schedule.status)
        })
        
        if schedule.confirmed_at:
            timeline.append({
                "type": "interview_confirmed",
                "timestamp": schedule.confirmed_at.isoformat(),
                "description": f"Interview {schedule.status.value if hasattr(schedule.status, 'value') else str(schedule.status)}"
            })
        
        interview_rounds.append({
            "schedule_id": schedule.id,
            "round_number": round_info.round_number if round_info else None,
            "round_name": round_info.round_name if round_info else None,
            "scheduled_at": schedule.scheduled_at.isoformat() if schedule.scheduled_at else None,
            "status": schedule.status.value if hasattr(schedule.status, 'value') else str(schedule.status),
            "interviewer_id": schedule.interviewer_id
        })
    
    # Reviews
    reviews = db.query(InterviewReview).filter(
        InterviewReview.candidate_id == candidate_id
    ).order_by(InterviewReview.created_at.asc()).all()
    
    review_contexts = []
    for i, review in enumerate(reviews):
        timeline.append({
            "type": "review_submitted",
            "timestamp": review.created_at.isoformat(),
            "description": f"Interview review submitted: {review.recommendation}",
            "rating": review.overall_rating
        })
        
        interviewer = db.query(User).filter(User.id == review.interviewer_id).first() if review.interviewer_id else None
        
        gold_areas, grey_areas = extract_gold_grey_areas(review)
        
        review_contexts.append({
            "round_number": i + 1,
            "interviewer_name": interviewer.name if interviewer else None,
            "overall_rating": review.overall_rating,
            "gold_areas": gold_areas,
            "grey_areas": grey_areas,
            "recommendation": review.recommendation,
            "technical_skills": review.technical_skills,
            "communication": review.communication,
            "problem_solving": review.problem_solving,
            "cultural_fit": review.cultural_fit
        })
    
    # Insights
    insights = db.query(CandidateInsights).filter(
        CandidateInsights.candidate_id == candidate_id
    ).first()
    
    insights_summary = None
    if insights:
        timeline.append({
            "type": "insights_generated",
            "timestamp": insights.generated_at.isoformat() if insights.generated_at else insights.updated_at.isoformat() if insights.updated_at else datetime.utcnow().isoformat(),
            "description": f"AI insights generated - Overall Score: {insights.overall_score}"
        })
        insights_summary = {
            "overall_score": insights.overall_score,
            "summary": insights.summary,
            "technical_analysis": insights.technical_analysis,
            "mindset_analysis": insights.mindset_analysis
        }
    
    # Sort timeline
    timeline.sort(key=lambda x: x["timestamp"])
    
    return {
        "candidate_id": candidate.id,
        "candidate_name": candidate.name,
        "email": candidate.email,
        "job_id": candidate.job_id,
        "job_title": job.title if job else None,
        "current_status": candidate.status.value if hasattr(candidate.status, 'value') else str(candidate.status),
        "applied_at": candidate.applied_at,
        "timeline": timeline,
        "interview_rounds": interview_rounds,
        "reviews": review_contexts,
        "insights_summary": insights_summary,
        "status_changes": status_changes
    }


def extract_gold_grey_areas(review) -> tuple:
    """Extract gold areas (strengths) and grey areas (weaknesses) from a review.
    
    Gold areas: Ratings of 4-5, positive text from strengths field
    Grey areas: Ratings of 1-3, text from areas_for_improvement field
    """
    gold_areas = []
    grey_areas = []
    
    # Check individual ratings
    rating_fields = [
        ("Technical Skills", review.technical_skills),
        ("Communication", review.communication),
        ("Problem Solving", review.problem_solving),
        ("Cultural Fit", review.cultural_fit)
    ]
    
    for field_name, rating in rating_fields:
        if rating is not None:
            if rating >= 4:
                gold_areas.append(f"{field_name}: {rating}/5")
            elif rating <= 3:
                grey_areas.append(f"{field_name}: {rating}/5")
    
    # Add strengths text
    if review.strengths:
        # Split by common delimiters
        strength_items = [s.strip() for s in review.strengths.replace('\n', ',').split(',') if s.strip()]
        gold_areas.extend(strength_items[:3])  # Limit to top 3
    
    # Add areas for improvement
    if review.areas_for_improvement:
        improvement_items = [s.strip() for s in review.areas_for_improvement.replace('\n', ',').split(',') if s.strip()]
        grey_areas.extend(improvement_items[:3])  # Limit to top 3
    
    return gold_areas, grey_areas


def get_previous_reviews_context(db: Session, candidate_id: str) -> Optional[Dict[str, Any]]:
    """Get previous reviews with extracted gold/grey areas for baton passing."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        return None
    
    reviews = db.query(InterviewReview).filter(
        InterviewReview.candidate_id == candidate_id
    ).order_by(InterviewReview.created_at.asc()).all()
    
    review_contexts = []
    aggregated_gold = []
    aggregated_grey = []
    
    for i, review in enumerate(reviews):
        interviewer = db.query(User).filter(User.id == review.interviewer_id).first() if review.interviewer_id else None
        
        gold_areas, grey_areas = extract_gold_grey_areas(review)
        aggregated_gold.extend(gold_areas)
        aggregated_grey.extend(grey_areas)
        
        review_contexts.append({
            "round_number": i + 1,
            "interviewer_name": interviewer.name if interviewer else None,
            "overall_rating": review.overall_rating,
            "gold_areas": gold_areas,
            "grey_areas": grey_areas,
            "recommendation": review.recommendation,
            "technical_skills": review.technical_skills,
            "communication": review.communication,
            "problem_solving": review.problem_solving,
            "cultural_fit": review.cultural_fit
        })
    
    # Deduplicate aggregated areas
    aggregated_gold = list(dict.fromkeys(aggregated_gold))
    aggregated_grey = list(dict.fromkeys(aggregated_grey))
    
    return {
        "candidate_id": candidate.id,
        "candidate_name": candidate.name,
        "total_reviews": len(reviews),
        "reviews": review_contexts,
        "aggregated_gold_areas": aggregated_gold,
        "aggregated_grey_areas": aggregated_grey
    }


def find_close_rejected_candidates(
    db: Session,
    min_avg_rating: float = 3.5,
    min_highest_rating: int = 4
) -> List[Dict[str, Any]]:
    """Find rejected candidates who performed well - good for re-engagement.
    
    "Close" candidates are those with:
    - Status = REJECTED
    - Average interview rating >= min_avg_rating
    - At least one rating >= min_highest_rating
    """
    from models import ReengagementCandidate, CandidateStatusHistory
    
    # Get rejected candidates
    rejected_candidates = db.query(Candidate).filter(
        Candidate.status == CandidateStatus.REJECTED
    ).all()
    
    close_candidates = []
    
    for candidate in rejected_candidates:
        # Get their reviews
        reviews = db.query(InterviewReview).filter(
            InterviewReview.candidate_id == candidate.id
        ).all()
        
        if not reviews:
            continue
        
        # Calculate metrics
        ratings = [r.overall_rating for r in reviews if r.overall_rating is not None]
        if not ratings:
            continue
        
        avg_rating = sum(ratings) / len(ratings)
        highest_rating = max(ratings)
        
        # Check if meets criteria
        if avg_rating < min_avg_rating or highest_rating < min_highest_rating:
            continue
        
        # Count recommendations
        recommendation_counts = {}
        for review in reviews:
            rec = review.recommendation or "unknown"
            recommendation_counts[rec] = recommendation_counts.get(rec, 0) + 1
        
        # Get job title
        job = db.query(Job).filter(Job.id == candidate.job_id).first()
        
        # Check if already marked for re-engagement
        existing_reengagement = db.query(ReengagementCandidate).filter(
            ReengagementCandidate.candidate_id == candidate.id
        ).first()
        
        # Get rejection reason from status history
        rejection_note = db.query(CandidateStatusHistory).filter(
            CandidateStatusHistory.candidate_id == candidate.id,
            CandidateStatusHistory.new_status == "rejected"
        ).order_by(CandidateStatusHistory.changed_at.desc()).first()
        
        close_candidates.append({
            "candidate_id": candidate.id,
            "name": candidate.name,
            "email": candidate.email,
            "original_job_title": job.title if job else "Unknown",
            "skills": candidate.skills,
            "average_rating": round(avg_rating, 2),
            "highest_rating": highest_rating,
            "recommendation_counts": recommendation_counts,
            "rounds_completed": len(reviews),
            "rejection_reason": rejection_note.notes if rejection_note else None,
            "already_marked_for_reengagement": existing_reengagement is not None
        })
    
    # Sort by average rating descending
    close_candidates.sort(key=lambda x: x["average_rating"], reverse=True)
    
    return close_candidates
