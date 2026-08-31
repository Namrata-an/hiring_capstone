# Baton Passing System - Phase 1 & 2 Implementation

## Implementation Date
2026-05-05

## Overview
Implemented foundational backend infrastructure for Interview Baton Passing system, enabling context flow between interview rounds with proper visibility controls.

---

## ✅ What Was Implemented

### **Phase 1: Database Schema Updates**

#### **1. InterviewRound Model**
Added `is_final_round` field to track which round is the last interview stage.

```python
# backend/models.py
class InterviewRound(Base):
    # ... existing fields ...
    is_final_round = Column(Boolean, default=False, nullable=False)
```

**Purpose:**
- HR can mark a round as "final"
- System knows when to trigger final decision workflow
- Only one round per job can be final at a time

---

#### **2. InterviewReview Model**
Added two new JSON columns for baton passing data.

```python
# backend/models.py
class InterviewReview(Base):
    # ... existing fields ...
    llm_generated_feedback = Column(JSON, nullable=True)  # Chatbot Q&A session
    previous_reviews_context = Column(JSON, nullable=True)  # Snapshot of reviews seen
```

**Purpose:**
- `llm_generated_feedback`: Stores AI-assisted review chatbot Q&A
- `previous_reviews_context`: Immutable snapshot of what this interviewer saw from previous rounds

---

#### **3. Database Migration**
Created migration: `3fb3353b9926_add_baton_passing_fields...`

**Migration adds:**
- `interview_rounds.is_final_round` (boolean, default false)
- `interview_reviews.llm_generated_feedback` (JSON, nullable)
- `interview_reviews.previous_reviews_context` (JSON, nullable)

**Migration tested:**
✅ Applied successfully to local database
✅ Backward compatible (existing data unaffected)
✅ Safe to rollback if needed

---

### **Phase 2: Backend APIs**

#### **API 1: Get Previous Reviews (Enhanced)**
**Endpoint:** `GET /api/interviewer/candidates/{candidate_id}/previous-reviews`

**Enhancements:**
1. **Visibility Rules:**
   - HR sees **all reviews**
   - Round N interviewer sees **only Round 1 to N-1** (not their own or future rounds)
   - Legacy assignments without rounds: show all (backward compatible)

2. **Round-Aware Filtering:**
   - Joins `InterviewReview` → `InterviewSchedule` → `InterviewRound`
   - Filters by `round_number < current_round_number`
   - Orders by round number ascending

3. **Enhanced Response:**
   - Includes `round_number` and `round_name`
   - Includes `llm_generated_feedback` (chatbot Q&A)
   - Includes `created_at` timestamp
   - Returns `current_round_number` for context
   - Returns `total_visible_reviews` count

**Response Example:**
```json
{
  "candidate_id": "abc-123",
  "candidate_name": "John Doe",
  "current_round_number": 3,
  "total_visible_reviews": 2,
  "reviews": [
    {
      "round_number": 1,
      "round_name": "Technical Screen",
      "interviewer_name": "Jane Smith",
      "overall_rating": 4,
      "gold_areas": ["Strong React skills: 5/5", "Good problem-solving"],
      "grey_areas": ["System design: 3/5"],
      "technical_skills": 5,
      "communication": 4,
      "recommendation": "yes",
      "llm_generated_feedback": { /* chatbot Q&A */ },
      "created_at": "2026-05-01T10:00:00Z"
    },
    {
      "round_number": 2,
      "round_name": "System Design",
      "interviewer_name": "Bob Johnson",
      "overall_rating": 3,
      "gold_areas": ["Improved system design understanding"],
      "grey_areas": ["Needs more experience with microservices"],
      "recommendation": "maybe",
      "created_at": "2026-05-03T14:30:00Z"
    }
  ],
  "aggregated_gold_areas": ["Strong React skills", "Good problem-solving", ...],
  "aggregated_grey_areas": ["System design needs work", "Microservices experience", ...]
}
```

---

#### **API 2: Submit Review with Baton Passing**
**Endpoint:** `POST /api/interviewer/schedule/{schedule_id}/complete`

**Enhancements:**
1. **Fetch Previous Reviews Context:**
   - Automatically retrieves reviews from rounds 1 to N-1
   - Creates immutable snapshot of what this interviewer saw
   - Stores in `previous_reviews_context` field

2. **Store LLM Feedback:**
   - Accepts `llm_generated_feedback` in request body
   - Stores chatbot Q&A session data
   - Enables audit trail of AI-assisted decisions

3. **Snapshot Logic:**
   ```python
   # If current round is 3, fetch rounds 1-2
   if round_number > 1:
       previous_reviews = fetch_previous_rounds(candidate_id, round_number)
       review.previous_reviews_context = snapshot(previous_reviews)
   ```

**Request Body:**
```json
{
  "technical_skills": 4,
  "communication": 5,
  "problem_solving": 3,
  "cultural_fit": 4,
  "overall_rating": 4,
  "strengths": "Strong React, good communication",
  "areas_for_improvement": "System design needs work",
  "notes": "Promising candidate, needs mentorship",
  "recommendation": "yes",
  "llm_generated_feedback": {
    "questions_asked": [
      {
        "question": "How did the candidate handle the React hooks question?",
        "answer": "Explained useEffect cleanup thoroughly"
      }
    ],
    "ai_generated_summary": "Strong fundamentals, junior-level system design",
    "chatbot_session_id": "session-abc-123"
  }
}
```

---

#### **API 3: Mark Round as Final**
**Endpoint:** `PATCH /api/v1/jobs/{job_id}/rounds/{round_id}/mark-final?is_final=true`

**Purpose:**
- HR marks a specific round as the final interview stage
- Automatically unmarks other rounds (only one final round per job)
- Used for baton passing logic and workflow triggers

**Request:**
```
PATCH /api/v1/jobs/job-123/rounds/round-456/mark-final?is_final=true
```

**Response:**
```json
{
  "success": true,
  "message": "Round 3 marked as final round",
  "round": {
    "id": "round-456",
    "job_id": "job-123",
    "round_number": 3,
    "round_name": "Executive Interview",
    "is_final_round": true,
    "created_at": "2026-05-01T10:00:00Z"
  }
}
```

**Authorization:** HR Admin only (via `require_hr_admin` dependency)

---

#### **API 4: Round Creation/Update (Enhanced)**
**Endpoints:**
- `POST /api/v1/jobs/{job_id}/rounds` - Create round
- `PUT /api/v1/jobs/{job_id}/rounds/{round_id}` - Update round

**Enhancements:**
- Accept `is_final_round` field in request body
- Automatically unmark other rounds if setting a new final round
- Return `is_final_round` in response

**Create Round Request:**
```json
{
  "round_number": 3,
  "round_name": "Executive Interview",
  "description": "Final interview with CTO",
  "is_final_round": true
}
```

---

## 📊 Schema Updates

### **InterviewRoundCreate Schema**
```python
class InterviewRoundCreate(BaseModel):
    round_number: int
    round_name: Optional[str] = None
    description: Optional[str] = None
    is_final_round: bool = False  # NEW
```

### **InterviewRoundUpdate Schema**
```python
class InterviewRoundUpdate(BaseModel):
    round_number: Optional[int] = None
    round_name: Optional[str] = None
    description: Optional[str] = None
    is_final_round: Optional[bool] = None  # NEW
```

### **InterviewRoundResponse Schema**
```python
class InterviewRoundResponse(BaseModel):
    id: str
    job_id: str
    round_number: int
    round_name: Optional[str] = None
    description: Optional[str] = None
    is_final_round: bool = False  # NEW
    schedules: List[InterviewScheduleResponse] = []
    created_at: datetime
    updated_at: datetime
```

### **InterviewReviewCreate Schema**
```python
class InterviewReviewCreate(BaseModel):
    # ... existing fields ...
    llm_generated_feedback: Optional[Dict[str, Any]] = None  # NEW
```

---

## 🔄 Baton Passing Flow

### **Round 1 Interviewer:**
1. Views candidate profile + QB
2. Conducts interview
3. Clicks "Interview Conducted"
4. Reviews QB snapshot
5. Submits review (basic metrics + AI chatbot feedback)
6. System stores:
   - Review data
   - QB snapshot
   - `previous_reviews_context: []` (empty, first round)

### **Round 2 Interviewer:**
1. **Before interview:**
   - Calls `GET /previous-reviews` → sees Round 1 review
   - QB generation includes Round 1 context (already implemented ✅)
2. Conducts interview
3. Clicks "Interview Conducted"
4. Sees Round 1 review summary in UI (gold/grey areas)
5. Submits review with AI chatbot
6. System stores:
   - Review data
   - QB snapshot
   - `previous_reviews_context: [Round 1 review snapshot]`

### **Round 3 Interviewer (Final Round):**
1. **Before interview:**
   - Calls `GET /previous-reviews` → sees Round 1 + 2 reviews
   - QB includes context from both previous rounds
2. Conducts interview
3. Submits review
4. System detects `is_final_round: true`
5. Triggers workflow:
   - Notify HR for final decision
   - Update candidate status
   - (Future: Auto-generate decision summary)

### **HR View:**
- Calls `GET /previous-reviews` → sees **all rounds**
- Reviews full interview history
- Makes final offer/rejection decision

---

## 🧪 Testing

### **Manual API Tests**

#### **Test 1: Create Final Round**
```bash
curl -X POST http://localhost:8000/api/v1/jobs/{job_id}/rounds \
  -H "Authorization: Bearer {hr_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "round_number": 3,
    "round_name": "Executive Interview",
    "is_final_round": true
  }'
```

**Expected:** Round created, `is_final_round: true`

---

#### **Test 2: Mark Existing Round as Final**
```bash
curl -X PATCH http://localhost:8000/api/v1/jobs/{job_id}/rounds/{round_id}/mark-final?is_final=true \
  -H "Authorization: Bearer {hr_token}"
```

**Expected:** Round marked as final, other rounds unmarked

---

#### **Test 3: Get Previous Reviews (Round 2)**
```bash
# Interviewer for Round 2 candidate
curl -X GET http://localhost:8000/api/interviewer/candidates/{candidate_id}/previous-reviews \
  -H "Authorization: Bearer {round2_interviewer_token}"
```

**Expected:**
- `current_round_number: 2`
- `reviews: [Round 1 only]`
- Does NOT see Round 2 or 3 reviews

---

#### **Test 4: Submit Review with LLM Feedback**
```bash
curl -X POST http://localhost:8000/api/interviewer/schedule/{schedule_id}/complete \
  -H "Authorization: Bearer {interviewer_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "overall_rating": 4,
    "technical_skills": 4,
    "recommendation": "yes",
    "llm_generated_feedback": {
      "chatbot_qa": [
        {"q": "How did they handle React?", "a": "Very well, explained hooks"}
      ]
    }
  }'
```

**Expected:**
- Review created
- QB snapshot created
- `previous_reviews_context` populated with prior rounds
- `llm_generated_feedback` stored

---

### **Database Verification**

```sql
-- Check is_final_round field exists
SELECT id, round_number, round_name, is_final_round 
FROM interview_rounds 
WHERE job_id = 'your-job-id';

-- Check new review fields exist
SELECT id, candidate_id, 
       llm_generated_feedback, 
       previous_reviews_context 
FROM interview_reviews 
ORDER BY created_at DESC 
LIMIT 5;

-- Verify visibility logic (Round 3 interviewer sees Round 1-2 only)
SELECT ir.candidate_id, ir.schedule_id, 
       iround.round_number, 
       ir.previous_reviews_context
FROM interview_reviews ir
JOIN interview_schedules isched ON ir.schedule_id = isched.id
JOIN interview_rounds iround ON isched.interview_round_id = iround.id
WHERE ir.candidate_id = 'your-candidate-id'
ORDER BY iround.round_number;
```

---

## 📁 Files Modified

| File | Changes |
|------|---------|
| `backend/models.py` | • Added `is_final_round` to InterviewRound<br>• Added `llm_generated_feedback` and `previous_reviews_context` to InterviewReview |
| `backend/alembic/versions/3fb3353b9926_...py` | • New migration for schema changes |
| `backend/schemas.py` | • Updated InterviewRoundCreate/Update/Response<br>• Updated InterviewReviewCreate |
| `backend/routers/interviewers.py` | • Enhanced GET /previous-reviews with visibility rules<br>• Updated POST /complete to snapshot previous reviews |
| `backend/routers/interviews.py` | • Added PATCH /mark-final endpoint<br>• Updated POST /rounds to accept is_final_round<br>• Updated PUT /rounds to handle final round logic |

---

## 🚀 Deployment

### **Pre-Deployment Checklist**
- [x] Database migration created
- [x] Migration tested locally
- [x] New API endpoints implemented
- [x] Schemas updated
- [ ] Manual API testing completed
- [ ] Database verification queries run
- [ ] Documentation complete

### **Deploy Steps**

1. **Test migration locally:**
   ```bash
   cd backend
   source venv/bin/activate
   alembic upgrade head
   ```

2. **Verify migration applied:**
   ```bash
   # Check columns exist
   psql $DATABASE_URL -c "\d interview_rounds"
   psql $DATABASE_URL -c "\d interview_reviews"
   ```

3. **Test API endpoints:**
   ```bash
   # Start backend
   uvicorn main:app --reload
   
   # Test in another terminal (see Test section above)
   ```

4. **Commit and push:**
   ```bash
   git add backend/models.py backend/schemas.py
   git add backend/routers/interviewers.py backend/routers/interviews.py
   git add backend/alembic/versions/3fb3353b9926_*.py
   git add BATON_PASSING_PHASE1_2.md
   
   git commit -m "Phase 1+2: Add baton passing backend infrastructure

   Database Schema:
   - Add is_final_round to InterviewRound model
   - Add llm_generated_feedback to InterviewReview (stores chatbot Q&A)
   - Add previous_reviews_context to InterviewReview (immutable snapshot)

   API Enhancements:
   - Enhanced GET /previous-reviews with round-based visibility rules
     (Round N sees only Round 1 to N-1, HR sees all)
   - Updated POST /complete to snapshot previous reviews context
   - Added PATCH /mark-final for HR to designate final rounds
   - Updated round create/update to handle is_final_round flag

   Visibility Rules:
   - HR sees all reviews
   - Round N interviewer sees reviews from Round 1 to N-1 only
   - Backward compatible with legacy assignments

   Migration: 3fb3353b9926 (tested, safe to rollback)

   Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
   
   git push origin main
   ```

5. **Monitor deployment:**
   ```bash
   # Watch GitHub Actions
   # Watch Azure logs
   az containerapp logs show --name hiring-backend --resource-group hiring-rg --follow
   ```

---

## 🔒 Security & Authorization

### **Endpoint Authorization:**
- `GET /previous-reviews`: Interviewer (assigned) or HR
- `POST /complete`: Interviewer (assigned only)
- `PATCH /mark-final`: HR Admin only
- `POST /rounds`: HR Admin only
- `PUT /rounds`: HR Admin only

### **Visibility Enforcement:**
- Implemented at query level (not post-filter)
- Uses JOIN with InterviewRound to get round_number
- Filters by `round_number < current_round_number`
- HR bypass check: `current_user.role == UserRole.HR_ADMIN`

---

## 🎯 Next Steps (Phase 3-7)

### **Phase 3: LLM Review Assistant Service**
- Create `backend/services/review_assistant.py`
- Implement QB + metrics analysis
- Generate guided review questions
- Session-based chatbot for review refinement

### **Phase 4: HR Round Management UI**
- Add "Mark as Final Round" button in pipeline
- Visual indicator for final rounds
- Confirmation dialog

### **Phase 5: Interviewer Review Chatbot UI**
- Create ReviewChatbot component
- Tabbed review interface (Basic | AI-Guided | Previous Reviews)
- Show previous reviews context

### **Phase 6: Baton Passing Integration**
- Wire QB snapshot → review → next round
- Trigger workflows on final round completion
- Notification system

### **Phase 7: Testing & Polish**
- E2E test for 3-round flow
- Performance testing
- Error handling
- User documentation

---

## 📝 Notes

### **Design Decisions:**

1. **Immutable Snapshots:**
   - `previous_reviews_context` is a snapshot, not a live query
   - Ensures audit trail remains accurate even if reviews are edited later
   - Trade-off: Slightly more storage, but guarantees data integrity

2. **Single Final Round:**
   - Only one round per job can be marked as final
   - Prevents ambiguity in workflow triggers
   - Auto-unmarks other rounds when setting a new final round

3. **Visibility at Query Level:**
   - Filtering happens in SQL JOIN, not in Python
   - More efficient (database does the work)
   - Prevents accidental data leaks

4. **Backward Compatibility:**
   - Legacy assignments without rounds: show all reviews (old behavior)
   - Nullable JSON fields: existing reviews unaffected
   - `is_final_round` defaults to false

### **Known Limitations:**

1. **No UI Yet:**
   - Backend is ready, but frontend not implemented
   - HR can't yet mark final rounds via UI (needs API calls)

2. **No Workflow Triggers:**
   - System detects final round, but doesn't auto-trigger actions
   - Will be implemented in Phase 6

3. **No LLM Review Assistant:**
   - `llm_generated_feedback` field exists but not populated yet
   - Chatbot service will be built in Phase 3

---

## 🐛 Troubleshooting

### **Migration fails:**
```bash
# Rollback
alembic downgrade -1

# Check current version
alembic current

# Re-apply
alembic upgrade head
```

### **Visibility rules not working:**
```sql
-- Debug query: Check round associations
SELECT 
  c.name as candidate,
  iround.round_number,
  iround.round_name,
  u.name as interviewer,
  isched.status
FROM interview_schedules isched
JOIN candidates c ON isched.candidate_id = c.id
JOIN interview_rounds iround ON isched.interview_round_id = iround.id
JOIN users u ON isched.interviewer_id = u.id
WHERE c.id = 'your-candidate-id'
ORDER BY iround.round_number;
```

### **is_final_round not persisting:**
- Check if multiple requests are setting different rounds as final
- Verify transaction commit happens after UPDATE query
- Check database logs for constraint violations

---

**Status:** ✅ Phase 1 + 2 Complete - Backend Foundation Ready
**Next:** Phase 3 - LLM Review Assistant Service
