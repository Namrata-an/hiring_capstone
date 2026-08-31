"""Build a chronologically-merged candidate timeline from existing tables.

Phase 7.1 — pure read-side. We do not introduce any new schema; instead, we
re-derive the lifecycle of a candidate by stitching together rows we already
have:

    candidate.applied_at                    → "applied"
    CandidateStatusHistory                  → "status_changed"
    InterviewSchedule (per row, derived):   → "interview_assigned"
                                             "invite_sent"
                                             "interview_confirmed"
                                             "interview_declined"
                                             "reschedule_requested"
                                             "reschedule_processed"
                                             "interview_completed"
    InterviewReview                         → "review_submitted"
    CommunicationLog                        → "email_sent"

The lifecycle events on a single InterviewSchedule are reconstructed from
status, invite_sent_at, confirmed_at, and reschedule_count. process_reschedule
overwrites confirmed_at and re-uses invite_sent_at, so for schedules that were
rescheduled and then re-processed, the "reschedule_requested" timestamp is
synthesised as `invite_sent_at - 1s` to preserve correct ordering before the
"reschedule_processed" event.
"""
from datetime import timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from models import (
    Candidate,
    CandidateStatusHistory,
    CommunicationLog,
    InterviewQuestionsSnapshot,
    InterviewReview,
    InterviewRound,
    InterviewSchedule,
    InterviewStatus,
    Job,
    QuestionBank,
    User,
)


def _format_status(value: Optional[str]) -> Optional[str]:
    """Render a candidate-status enum value as a human-readable phrase."""
    if not value:
        return None
    return value.replace("_", " ")


def _round_label(round_obj: Optional[InterviewRound]) -> str:
    if not round_obj:
        return "Interview"
    if round_obj.round_name:
        return round_obj.round_name
    return f"Round {round_obj.round_number}"


def _actor_dict(user: Optional[User], role_override: Optional[str] = None) -> Optional[Dict[str, Any]]:
    if not user:
        return None
    return {
        "id": user.id,
        "name": user.name,
        "role": role_override or (user.role.value if hasattr(user.role, "value") else str(user.role)),
    }


def build_candidate_timeline(db: Session, candidate: Candidate) -> List[Dict[str, Any]]:
    """Return one chronologically-ordered list of timeline event dicts."""
    events: List[Dict[str, Any]] = []

    # ----- applied -----
    job = db.query(Job).filter(Job.id == candidate.job_id).first()
    events.append({
        "kind": "applied",
        "at": candidate.applied_at,
        "actor": {"role": "candidate", "name": candidate.name},
        "title": "Candidate applied",
        "body": f"Applied for {job.title}" if job else "Applied",
        "meta": {
            "job_title": job.title if job else None,
        },
    })

    # ----- status_changed -----
    status_changes = (
        db.query(CandidateStatusHistory)
        .filter(CandidateStatusHistory.candidate_id == candidate.id)
        .order_by(CandidateStatusHistory.changed_at.asc())
        .all()
    )
    for change in status_changes:
        actor = _actor_dict(change.changed_by_user) if change.changed_by_user else None
        old_label = _format_status(change.old_status) or "—"
        new_label = _format_status(change.new_status) or "—"
        events.append({
            "kind": "status_changed",
            "at": change.changed_at,
            "actor": actor,
            "title": f"Status changed to {new_label}",
            "body": change.notes,
            "meta": {
                "from": old_label,
                "to": new_label,
            },
        })

    # ----- interview schedule lifecycle -----
    schedules = (
        db.query(InterviewSchedule)
        .filter(InterviewSchedule.candidate_id == candidate.id)
        .all()
    )

    # Bulk-load question snapshots so we can link review/completed events back
    # to the exact set of questions used.
    schedule_ids = [s.id for s in schedules]
    snapshots_by_schedule: Dict[str, InterviewQuestionsSnapshot] = {}
    if schedule_ids:
        for snap in (
            db.query(InterviewQuestionsSnapshot)
            .filter(InterviewQuestionsSnapshot.schedule_id.in_(schedule_ids))
            .all()
        ):
            snapshots_by_schedule[snap.schedule_id] = snap

    def _snapshot_meta(schedule_id: str) -> Dict[str, Any]:
        snap = snapshots_by_schedule.get(schedule_id)
        if not snap:
            return {}
        total = sum(len(getattr(snap, attr) or []) for attr in (
            "jd_based_questions", "fundamental_questions", "resume_questions",
            "behavioral_questions", "insights_based_questions",
            "red_flag_probes", "leetcode_questions",
        ))
        return {
            "questions_snapshot_id": snap.id,
            "questions_asked_count": total,
            # The frontend deep-links via schedule_id (the GET endpoint key),
            # so we ship it on the same event for one-click navigation.
            "schedule_id": schedule_id,
        }

    for schedule in schedules:
        round_obj = schedule.interview_round
        interviewer = schedule.interviewer
        round_label = _round_label(round_obj)
        scheduled_at = schedule.scheduled_at

        common_meta = {
            "round": round_label,
            "interviewer": interviewer.name if interviewer else None,
            "scheduled_at": scheduled_at.isoformat() if scheduled_at else None,
        }

        # interview_assigned
        events.append({
            "kind": "interview_assigned",
            "at": schedule.created_at,
            "actor": _actor_dict(interviewer, role_override="interviewer"),
            "title": f"{round_label} assigned to {interviewer.name}" if interviewer else f"{round_label} assigned",
            "body": None,
            "meta": common_meta,
        })

        # invite_sent
        if schedule.invite_sent_at:
            events.append({
                "kind": "invite_sent",
                "at": schedule.invite_sent_at,
                "actor": {"role": "system", "name": "Hiring Co-Pilot"},
                "title": f"Invite sent to {interviewer.name}" if interviewer else "Invite sent to interviewer",
                "body": None,
                "meta": common_meta,
            })

        # reschedule events
        rcount = schedule.reschedule_count or 0
        if rcount > 0:
            if schedule.status == InterviewStatus.RESCHEDULE_REQUESTED:
                ts = schedule.confirmed_at or schedule.updated_at or schedule.created_at
                events.append({
                    "kind": "reschedule_requested",
                    "at": ts,
                    "actor": _actor_dict(interviewer, role_override="interviewer"),
                    "title": f"{interviewer.name} requested a reschedule" if interviewer else "Interviewer requested a reschedule",
                    "body": schedule.reschedule_reason,
                    "meta": {
                        **common_meta,
                        "proposed_at": schedule.proposed_at.isoformat() if schedule.proposed_at else None,
                        "reschedule_count": rcount,
                    },
                })
            else:
                # HR has processed: reconstruct both events. The most recent
                # invite_sent_at is HR's re-sent invite, so request preceded it.
                anchor = schedule.invite_sent_at or schedule.updated_at or schedule.created_at
                request_ts = anchor - timedelta(seconds=1)
                events.append({
                    "kind": "reschedule_requested",
                    "at": request_ts,
                    "actor": _actor_dict(interviewer, role_override="interviewer"),
                    "title": f"{interviewer.name} requested a reschedule" if interviewer else "Interviewer requested a reschedule",
                    "body": schedule.reschedule_reason,
                    "meta": {
                        **common_meta,
                        "reschedule_count": rcount,
                    },
                })
                events.append({
                    "kind": "reschedule_processed",
                    "at": anchor,
                    "actor": {"role": "hr_admin", "name": "HR"},
                    "title": "HR processed reschedule",
                    "body": None,
                    "meta": {
                        **common_meta,
                        "reschedule_count": rcount,
                    },
                })

        # confirmation / decline / completion
        if schedule.status == InterviewStatus.CONFIRMED and schedule.confirmed_at:
            events.append({
                "kind": "interview_confirmed",
                "at": schedule.confirmed_at,
                "actor": _actor_dict(interviewer, role_override="interviewer"),
                "title": f"{interviewer.name} confirmed the interview" if interviewer else "Interview confirmed",
                "body": None,
                "meta": common_meta,
            })
        elif schedule.status == InterviewStatus.DECLINED and schedule.confirmed_at:
            events.append({
                "kind": "interview_declined",
                "at": schedule.confirmed_at,
                "actor": _actor_dict(interviewer, role_override="interviewer"),
                "title": f"{interviewer.name} declined the interview" if interviewer else "Interview declined",
                "body": None,
                "meta": common_meta,
            })
        elif schedule.status == InterviewStatus.COMPLETED:
            ts = schedule.confirmed_at or schedule.updated_at or schedule.created_at
            # The schedule must have been confirmed before it could be completed,
            # but `confirmed_at` is overwritten on /complete, so we synthesise the
            # confirm event one second before the completion to keep ordering.
            if schedule.invite_sent_at:
                events.append({
                    "kind": "interview_confirmed",
                    "at": ts - timedelta(seconds=1),
                    "actor": _actor_dict(interviewer, role_override="interviewer"),
                    "title": f"{interviewer.name} confirmed the interview" if interviewer else "Interview confirmed",
                    "body": None,
                    "meta": common_meta,
                })
            events.append({
                "kind": "interview_completed",
                "at": ts,
                "actor": _actor_dict(interviewer, role_override="interviewer"),
                "title": f"{round_label} completed",
                "body": None,
                "meta": {**common_meta, **_snapshot_meta(schedule.id)},
            })

    # ----- question banks -----
    qbs = (
        db.query(QuestionBank)
        .filter(QuestionBank.candidate_id == candidate.id)
        .all()
    )
    for qb in qbs:
        # Count generated questions across categories so HR sees "what work did
        # the interviewer prepare" without leaving the timeline.
        category_counts = {
            "fundamentals": len(qb.fundamental_questions or []),
            "jd_based": len(qb.jd_based_questions or []),
            "resume": len(qb.resume_questions or []),
            "behavioral": len(qb.behavioral_questions or []),
            "insights_based": len(qb.insights_based_questions or []),
            "red_flag_probes": len(qb.red_flag_probes or []),
            "leetcode": len(qb.leetcode_questions or []),
        }
        total_questions = sum(category_counts.values())
        events.append({
            "kind": "question_bank_generated",
            "at": qb.created_at,
            "actor": {"role": "system", "name": "Hiring Co-Pilot"} if qb.auto_generated
                     else {"role": "interviewer", "name": "Interviewer"},
            "title": f"Question bank generated ({total_questions} questions)",
            "body": None,
            "meta": {
                "round": qb.round_number,
                "auto_generated": bool(qb.auto_generated),
                "total_questions": total_questions,
                **{k: v for k, v in category_counts.items() if v > 0},
            },
        })

        # If the interviewer subsequently edited the QB, surface that as its
        # own event so we can see "Shlok refined the question bank" later.
        if qb.modified_by_interviewer and qb.updated_at and qb.updated_at != qb.created_at:
            events.append({
                "kind": "question_bank_modified",
                "at": qb.updated_at,
                "actor": {"role": "interviewer", "name": "Interviewer"},
                "title": "Question bank refined by interviewer",
                "body": None,
                "meta": {
                    "round": qb.round_number,
                    "chat_history_length": len(qb.chat_history or []),
                },
            })

    # ----- reviews -----
    reviews = (
        db.query(InterviewReview)
        .filter(InterviewReview.candidate_id == candidate.id)
        .order_by(InterviewReview.created_at.asc())
        .all()
    )
    for review in reviews:
        interviewer = review.interviewer
        meta = {
            "overall_rating": review.overall_rating,
            "recommendation": review.recommendation,
            **_snapshot_meta(review.schedule_id),
        }
        for axis_key, axis_label in (
            ("technical_skills", "technical"),
            ("communication", "communication"),
            ("problem_solving", "problem_solving"),
            ("cultural_fit", "cultural_fit"),
        ):
            value = getattr(review, axis_key, None)
            if value is not None:
                meta[axis_label] = value
        if review.strengths:
            meta["strengths"] = review.strengths
        if review.areas_for_improvement:
            meta["areas_for_improvement"] = review.areas_for_improvement

        # Compose a body that's a real human read of the review, not just
        # raw notes. Notes lead, then strengths/areas if present.
        body_lines: List[str] = []
        if review.notes:
            body_lines.append(review.notes)
        events.append({
            "kind": "review_submitted",
            "at": review.created_at,
            "actor": _actor_dict(interviewer, role_override="interviewer"),
            "title": f"{interviewer.name} submitted a review" if interviewer else "Review submitted",
            "body": "\n\n".join(body_lines) or None,
            "meta": meta,
        })

    # ----- communications -----
    comm_logs = (
        db.query(CommunicationLog)
        .filter(CommunicationLog.candidate_id == candidate.id)
        .order_by(CommunicationLog.sent_at.asc())
        .all()
    )
    for log in comm_logs:
        events.append({
            "kind": "email_sent",
            "at": log.sent_at,
            "actor": {"role": "system", "name": "Hiring Co-Pilot"},
            "title": log.subject,
            "body": None,
            "meta": {
                "to": log.recipient_email,
                "to_name": log.recipient_name,
                "status": log.status,
            },
        })

    # Single chronological sort. Datetime columns are written tz-aware
    # (_utcnow), but SQLite strips tzinfo on read — treat naive as UTC.
    def _key(event: Dict[str, Any]):
        at = event["at"]
        if at is None:
            return (1, 0.0)
        if at.tzinfo is None:
            at = at.replace(tzinfo=timezone.utc)
        return (0, at.timestamp())

    events.sort(key=_key)
    return events
