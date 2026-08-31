# Phased Feature Roadmap - Hiring Platform

**Philosophy:** Start small, make big later. Focus on HR + Interviewer views. Each phase should be usable on its own.

---

## Phase 1: Foundation - Job & Candidate Management
**Goal:** Replace Google Sheets with a proper candidate database. Basic CRUD.

### HR View:
- [ ] Create job posting (title, description, requirements, status)
- [ ] View all job postings (active/closed)
- [ ] Upload candidate resume (PDF) + basic info (name, email, phone, job applied for)
- [ ] View candidate list for a job (table view: name, email, status, date applied)
- [ ] View individual candidate profile (resume + basic details)
- [ ] Update candidate status (Applied → Screening → Interview → Offer → Hired/Rejected)

### Interviewer View:
- [ ] Login/Authentication (basic)
- [ ] View candidates assigned to them (read-only for now)

### Backend:
- [ ] SQLite database schema (jobs, candidates, users/interviewers)
- [ ] File storage for resumes (local filesystem for dev)
- [ ] REST API endpoints for CRUD operations

### Tests:
- [ ] API tests for job creation, candidate upload
- [ ] Database integrity tests

**Outcome:** HR can manage jobs and candidates in one place. Foundation for everything else.

---

## Phase 2: Resume Screening & Prioritization
**Goal:** Solve "too much time screening resumes" - smart ranking and filtering.

### HR View:
- [ ] Auto-scoring of resumes (keyword matching, experience years, skills alignment)
- [ ] Candidate list with score/rank column (sortable)
- [ ] Quick filters: score range, experience level, specific skills
- [ ] Bulk actions: select multiple → move to "Interview" status
- [ ] Priority tags (High/Medium/Low) - manual or auto-suggested

### Backend:
- [ ] Resume parsing service (extract text from PDF)
- [ ] Scoring algorithm (configurable weights for skills, experience, keywords)
- [ ] Search/filter API endpoints

### Tests:
- [ ] Resume parsing accuracy tests
- [ ] Scoring algorithm validation

**Outcome:** HR sees prioritized candidates first. "Who to interview next?" becomes obvious.

---

## Phase 3: Interview Scheduling Pipeline
**Goal:** Solve scheduling hell - visual pipeline, self-service availability, zero ping-pong.

### HR View:
- [ ] Pipeline board (Kanban-style): Applied → Screening → Round 1 → Round 2 → Offer
- [ ] Drag-and-drop candidates between stages
- [ ] Create interview slots (date, time, interviewer, round)
- [ ] View interviewer availability (calendar view)
- [ ] Send interview invite to candidate (automated email with meeting link)
- [ ] View confirmations (candidate accepted/declined)

### Interviewer View:
- [ ] **My Schedule** - see all upcoming interviews
- [ ] Set availability (weekly calendar - mark available slots)
- [ ] View candidate details before interview (resume, previous round notes if applicable)
- [ ] Accept/decline interview assignment

### Backend:
- [ ] Interview scheduling engine (slots, assignments, conflicts detection)
- [ ] Email service integration (automated invites, reminders)
- [ ] Calendar state management

### Tests:
- [ ] Scheduling conflict detection
- [ ] Email notification delivery
- [ ] Drag-drop state persistence

**Outcome:** HR schedules in seconds, not hours. Interviewers see their schedule. No manual follow-ups.

---

## Phase 4: QB Generation & Structured Reviews
**Goal:** Solve QB generation friction + vague reviews. Auto-generate questions, structured feedback.

### Interviewer View:
- [ ] Auto-generated question bank (QB) for assigned interview
  - Based on resume analysis (skills, projects, experience)
  - Categories: Fundamentals, Resume-specific, Behavioral/Startup mindset
- [ ] Edit/modify QB before interview
- [ ] During/After interview: Submit structured review
  - Overall rating (1-5)
  - Topic-based ratings (e.g., Technical: 4/5, Communication: 5/5, Problem-solving: 3/5)
  - Text feedback (strengths, areas of concern)
  - Recommendation (Hire/No Hire/Maybe)

### HR View:
- [ ] View all reviews for a candidate (across rounds)
- [ ] Filter candidates by review scores

### Backend:
- [ ] QB generation service (LLM integration - resume → questions)
- [ ] Review storage (structured data model)
- [ ] Analytics/aggregation for multi-round reviews

### Tests:
- [ ] QB generation quality tests
- [ ] Review submission and retrieval
- [ ] Rating aggregation accuracy

**Outcome:** Interviewers save time, get better questions. Reviews are actionable, not vague.

---

## Phase 5: Baton Passing & Talent Memory
**Goal:** Context flows between rounds. Past candidates are searchable.

### Interviewer View:
- [ ] Before Round N interview: See Round N-1 review summary
  - Strengths (gold areas): "Strong in React, system design"
  - Weaknesses (grey areas): "Struggled with async patterns"
- [ ] QB auto-adjusts based on previous round (dig deeper into grey areas, skip validated gold areas)

### HR View:
- [ ] Talent memory search:
  - Search by name, skills, date range, job applied
  - Filter by past review scores, interview rounds completed
- [ ] Candidate history timeline (all interactions, status changes, reviews)
- [ ] "Re-engage" rejected candidates for new jobs (if they were close)

### Backend:
- [ ] Review context passing logic
- [ ] QB adjustment based on past rounds
- [ ] Full-text search on candidate data + reviews

### Tests:
- [ ] Context passing accuracy
- [ ] Search relevance and performance
- [ ] QB adjustment logic validation

**Outcome:** Each round builds on the last. No lost talent. HR can mine past candidates.

---

## Phase 6: Automated Communications
**Goal:** Reduce manual HR follow-ups, keep candidates engaged.

### HR View:
- [ ] Set up automated message templates (interview confirmation, rejection, notice period check-in)
- [ ] Schedule automated follow-ups for candidates in notice period
- [ ] View communication history per candidate

### Candidate View (optional):
- [ ] Portal to confirm interview, view status, receive updates

### Backend:
- [ ] Email automation engine (scheduled sends, triggers)
- [ ] Template management
- [ ] Communication logs

### Tests:
- [ ] Email scheduling accuracy
- [ ] Template rendering
- [ ] Trigger condition validation

**Outcome:** HR sets it and forgets it. Candidates feel engaged. No manual check-ins.

---

## Phase 7: JD Creation Assistant (Nice-to-Have)
**Goal:** Generate better JDs that attract right candidates.

### HR View:
- [ ] JD creation wizard:
  - Select role type, experience level
  - Auto-populate with company culture/values
  - Suggest startup-specific language
  - Preview and edit
- [ ] Save JD templates for reuse
- [ ] Export to LinkedIn format

### Backend:
- [ ] JD generation service (templates + LLM customization)
- [ ] Template storage

### Tests:
- [ ] Template rendering
- [ ] Export format validation

**Outcome:** Better JDs → Better applicants → Less screening waste.

---

## Prioritization Philosophy
- **Phase 1-3 are must-haves** - Core hiring workflow automation
- **Phase 4-5 are high-value adds** - Significantly improve quality and speed
- **Phase 6-7 are enhancements** - Polish and nice-to-haves

Start with Phase 1, validate with real use, then move forward. Each phase should be deployable and useful on its own.
