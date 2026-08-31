import React, { useState, useEffect, useCallback } from 'react';
import type { Candidate, InterviewSchedule, CandidateInsights, QuestionBank, QuestionWithAnswer, InterviewReviewCreate, LeetCodeQuestion } from '../apiService';
import { api } from '../apiService';
import { useAuth } from '../contexts/AuthContext';
import { 
  Briefcase, LogOut, Users, User, X, Download, FileText,
  Calendar, CheckCircle, XCircle, AlertCircle, ClipboardCheck,
  Brain, MessageSquare, RefreshCw, ChevronDown, ChevronUp,
  Sparkles, ThumbsUp, ThumbsDown, Star, ExternalLink,
  Edit3, Send, Code, Plus, Trash2, Save
} from 'lucide-react';
import { InsightsModal } from '../components/InsightsModal';
import { SwitchUserDropdown } from '../components/SwitchUserDropdown';
import RescheduleModal from '../components/RescheduleModal';
import { InterviewerTalentMemory } from '../components/InterviewerTalentMemory';
import { PreviousReviewsPanel } from '../components/PreviousReviewsPanel';
import { AIGuidedReview } from '../components/AIGuidedReview';
import { Database } from 'lucide-react';
import { jsPDF } from 'jspdf';

function formatRecommendationLabel(recommendation?: string): string | null {
  if (!recommendation) return null;
  const labels: Record<string, string> = {
    strong_yes: 'Strong Yes',
    yes: 'Yes',
    maybe: 'Maybe',
    no: 'No',
    strong_no: 'Strong No',
  };
  return labels[recommendation] || recommendation.replace(/_/g, ' ');
}

function recommendationBadgeClass(recommendation?: string): string {
  switch (recommendation) {
    case 'strong_yes':
      return 'bg-emerald-600 text-white';
    case 'yes':
      return 'bg-green-500/30 text-green-300 border border-green-500/40';
    case 'maybe':
      return 'bg-yellow-500/30 text-yellow-200 border border-yellow-500/40';
    case 'no':
      return 'bg-red-500/30 text-red-200 border border-red-500/40';
    case 'strong_no':
      return 'bg-red-700 text-white';
    default:
      return 'bg-gray-700 text-gray-200 border border-[#d4d4d8]';
  }
}

const InterviewerDashboard: React.FC = () => {
  const { user, logout, token, switchUserRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'candidates' | 'schedule' | 'pipeline' | 'memory'>('schedule');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [schedules, setSchedules] = useState<InterviewSchedule[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [selectedScheduleForReview, setSelectedScheduleForReview] = useState<InterviewSchedule | null>(null);
  const [scheduleForReschedule, setScheduleForReschedule] = useState<InterviewSchedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [candidatesRes, schedulesRes] = await Promise.all([
        api.getMyAssignedCandidates(),
        api.getInterviewerSchedule().catch(() => [])
      ]);
      setCandidates(candidatesRes.candidates);
      setSchedules(schedulesRes);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token, fetchData]);

  const handleRespondToInterview = async (scheduleId: string, action: 'accept' | 'reject') => {
    try {
      const result = await api.respondToInterview(scheduleId, action);
      alert(`✅ ${result.message}`);
      fetchData();
    } catch (error: any) {
      alert(`❌ Failed: ${error.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleViewCandidateFromSchedule = (candidateId: string) => {
    const candidate = candidates.find(c => c.id === candidateId);
    if (candidate) {
      setSelectedCandidate(candidate);
    } else {
      api.getAssignedCandidateDetail(candidateId).then(c => {
        setSelectedCandidate(c);
      }).catch(err => console.error('Failed to fetch candidate:', err));
    }
  };

  const handleInterviewConducted = (schedule: InterviewSchedule) => {
    setSelectedScheduleForReview(schedule);
  };

  const handleRescheduleRequest = (schedule: InterviewSchedule) => {
    setScheduleForReschedule(schedule);
  };

  const submitRescheduleRequest = async (
    proposedAt: string | null,
    reason: string
  ) => {
    if (!scheduleForReschedule) return;
    await api.requestReschedule(scheduleForReschedule.id, {
      proposed_at: proposedAt ?? undefined,
      reason: reason || undefined,
    });
    fetchData();
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#e4e4e7] z-50">
        <div className="flex items-center justify-between h-full px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#eff6ff] flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-[#0070f3]" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[#111111]">Hiring Co-Pilot</h1>
              <p className="text-[10px] text-[#71717a]">Interviewer</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SwitchUserDropdown 
              currentRole={user?.role || 'interviewer'} 
              onRoleSwitch={switchUserRole}
            />
            <div className="flex items-center gap-2.5 pl-3 border-l border-[#e4e4e7]">
              <div className="w-7 h-7 rounded-full bg-[#f4f4f5] flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-[#71717a]" />
              </div>
              <span className="text-sm text-[#374151]">{user?.name}</span>
              <button onClick={logout} className="p-1.5 text-[#a1a1aa] hover:text-red-500 transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="pt-20 px-6 max-w-5xl mx-auto pb-12">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-[#f4f4f5] rounded-xl w-fit">
          {[
            { id: 'schedule', icon: Calendar, label: `Schedule (${schedules.length})`, testId: 'tab-schedule' },
            { id: 'pipeline', icon: ClipboardCheck, label: 'Pipeline', testId: 'tab-pipeline' },
            { id: 'candidates', icon: Users, label: `Candidates (${candidates.length})`, testId: 'tab-candidates' },
            { id: 'memory', icon: Database, label: 'Talent Memory', testId: 'tab-memory' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              data-testid={tab.testId}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-[#111111] shadow-sm'
                  : 'text-[#71717a] hover:text-[#111111]'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Schedule Tab */}
            {activeTab === 'schedule' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-xl font-semibold text-[#111111]">My Interview Schedule</h2>
                  <p className="text-sm text-[#71717a] mt-0.5">Interviews assigned to you by HR</p>
                </div>

                {schedules.length === 0 ? (
                  <div className="bg-white border border-[#e4e4e7] rounded-xl p-12 text-center">
                    <Calendar className="w-12 h-12 text-[#d4d4d8] mx-auto mb-3" />
                    <h3 className="text-base font-semibold text-[#111111] mb-1">No Scheduled Interviews</h3>
                    <p className="text-sm text-[#71717a]">You don't have any interviews scheduled yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-3">
                    {schedules.map(schedule => (
                      <ScheduleCard
                        key={schedule.id}
                        schedule={schedule}
                        onRespond={handleRespondToInterview}
                        onViewCandidate={handleViewCandidateFromSchedule}
                        onInterviewConducted={handleInterviewConducted}
                        onRequestReschedule={handleRescheduleRequest}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* My Pipeline Tab — schedules grouped by status */}
            {activeTab === 'pipeline' && (
              <PipelineView
                schedules={schedules}
                onRespond={handleRespondToInterview}
                onViewCandidate={handleViewCandidateFromSchedule}
                onInterviewConducted={handleInterviewConducted}
                onRequestReschedule={handleRescheduleRequest}
              />
            )}

            {/* Talent Memory Tab — interviewer's persistent record */}
            {activeTab === 'memory' && <InterviewerTalentMemory />}

            {/* Candidates Tab */}
            {activeTab === 'candidates' && (
              <div>
                <div className="mb-5">
                  <h2 className="text-xl font-semibold text-[#111111]">Assigned Candidates</h2>
                  <p className="text-sm text-[#71717a] mt-0.5">Candidates assigned to you for interviews</p>
                </div>

                {candidates.length === 0 ? (
                  <div className="glass-card p-12 text-center">
                    <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-[#111111] mb-2">No Candidates Assigned</h3>
                    <p className="text-gray-400">You don't have any candidates assigned to you yet.</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {candidates.map(candidate => (
                      <div
                        key={candidate.id}
                        onClick={() => setSelectedCandidate(candidate)}
                        className="glass-card p-4 cursor-pointer hover:border-[#0070f3]/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-[#111111] font-medium">{candidate.name}</h4>
                            <p className="text-gray-400 text-sm">{candidate.current_position || 'Position not specified'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {candidate.has_insights && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                                Has Insights
                              </span>
                            )}
                            <StatusBadge status={candidate.status} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <EnhancedCandidateDetailModal 
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}

      {/* Interview Review Modal */}
      {selectedScheduleForReview && (
        <InterviewReviewModal
          schedule={selectedScheduleForReview}
          onClose={() => setSelectedScheduleForReview(null)}
          onSubmitted={() => {
            setSelectedScheduleForReview(null);
            fetchData();
          }}
        />
      )}

      {/* Reschedule Request Modal */}
      {scheduleForReschedule && (
        <RescheduleModal
          mode="request"
          candidateName={
            scheduleForReschedule.candidate?.name ||
            scheduleForReschedule.candidate_name ||
            'Candidate'
          }
          roundName={
            scheduleForReschedule.round?.round_name ||
            scheduleForReschedule.round_name ||
            (scheduleForReschedule.round_number != null
              ? `Round ${scheduleForReschedule.round_number}`
              : 'Interview')
          }
          currentScheduledAt={scheduleForReschedule.scheduled_at}
          onSubmit={submitRescheduleRequest}
          onClose={() => setScheduleForReschedule(null)}
        />
      )}
    </div>
  );
};

// PipelineView — interviewer's schedules grouped by status, useful for
// scanning what's pending/awaiting/upcoming/done at a glance.
const PipelineView: React.FC<{
  schedules: InterviewSchedule[];
  onRespond: (scheduleId: string, action: 'accept' | 'reject') => Promise<void>;
  onViewCandidate: (candidateId: string) => void;
  onInterviewConducted: (schedule: InterviewSchedule) => void;
  onRequestReschedule: (schedule: InterviewSchedule) => void;
}> = ({ schedules, onRespond, onViewCandidate, onInterviewConducted, onRequestReschedule }) => {
  const buckets: Array<{ key: string; label: string; statuses: string[]; tone: string }> = [
    { key: 'pending', label: 'Awaiting your response', statuses: ['pending'], tone: 'text-yellow-400' },
    { key: 'reschedule', label: 'Reschedule pending HR action', statuses: ['reschedule_requested'], tone: 'text-[#0070f3]' },
    { key: 'confirmed', label: 'Confirmed — upcoming', statuses: ['confirmed'], tone: 'text-green-400' },
    { key: 'completed', label: 'Completed', statuses: ['completed'], tone: 'text-blue-400' },
    { key: 'declined', label: 'Declined', statuses: ['declined'], tone: 'text-red-400' },
  ];

  return (
    <div data-testid="pipeline-view">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-[#111111]">My Pipeline</h2>
        <p className="text-gray-400 mt-1">
          Everything you've been assigned, grouped by where it stands.
        </p>
      </div>
      {schedules.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <ClipboardCheck className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[#111111] mb-2">Nothing here yet</h3>
          <p className="text-gray-400">You don't have any assignments yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {buckets.map(bucket => {
            const items = schedules.filter(s => bucket.statuses.includes(s.status));
            if (items.length === 0) return null;
            return (
              <section key={bucket.key} data-testid={`pipeline-bucket-${bucket.key}`}>
                <h3 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${bucket.tone}`}>
                  {bucket.label} ({items.length})
                </h3>
                <div className="grid gap-3">
                  {items.map(schedule => (
                    <ScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      onRespond={onRespond}
                      onViewCandidate={onViewCandidate}
                      onInterviewConducted={onInterviewConducted}
                      onRequestReschedule={onRequestReschedule}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};

// Enhanced Candidate Detail Modal with PDF Viewer
const EnhancedCandidateDetailModal: React.FC<{ 
  candidate: Candidate; 
  onClose: () => void;
}> = ({ candidate, onClose }) => {
  const [fullCandidate, setFullCandidate] = useState<Candidate | null>(null);
  const [insights, setInsights] = useState<CandidateInsights | null>(null);
  const [questionBank, setQuestionBank] = useState<QuestionBank | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'resume' | 'insights' | 'questions'>('overview');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [showInsightsModal, setShowInsightsModal] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [candidateData, insightsData, qbData] = await Promise.all([
          api.getAssignedCandidateDetail(candidate.id),
          api.getInterviewerCandidateInsights(candidate.id).catch(() => null),
          api.getQuestionBank(candidate.id).catch(() => null)
        ]);
        setFullCandidate(candidateData);
        setInsights(insightsData);
        setQuestionBank(qbData);
      } catch (error) {
        console.error('Error fetching data:', error);
      }
      setIsLoading(false);
    };
    fetchAll();
  }, [candidate.id]);

  // Fetch PDF for viewing
  useEffect(() => {
    const fetchPdf = async () => {
      try {
        const blob = await api.getInterviewerCandidateResumeBlob(candidate.id);
        const url = URL.createObjectURL(blob);
        setPdfUrl(url);
      } catch (error) {
        console.error('Error fetching PDF:', error);
      }
    };
    fetchPdf();
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [candidate.id]);

  const handleRegenerateInsights = async () => {
    setIsGeneratingInsights(true);
    try {
      const newInsights = await api.regenerateInterviewerCandidateInsights(candidate.id);
      setInsights(newInsights);
      alert('✅ Insights regenerated successfully!');
    } catch (error: any) {
      alert(`❌ Failed to regenerate insights: ${error.response?.data?.detail || 'Unknown error'}`);
    }
    setIsGeneratingInsights(false);
  };

  const handleDownloadResume = async () => {
    try {
      const blob = await api.getInterviewerCandidateResumeBlob(candidate.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${candidate.name.replace(/\s+/g, '_')}_resume.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('❌ Failed to download resume');
    }
  };

  const handleDownloadQB = () => {
    if (!questionBank) return;
    
    // Generate PDF version of the Question Bank
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;
    let yPosition = margin;
    const lineHeight = 7;
    
    // Helper to add text with wrapping
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, fontSize: number = 11): number => {
      doc.setFontSize(fontSize);
      const lines = doc.splitTextToSize(text, maxWidth);
      lines.forEach((line: string) => {
        if (y > 270) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, x, y);
        y += lineHeight;
      });
      return y;
    };
    
    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(`Question Bank`, margin, yPosition);
    yPosition += 10;
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text(`Candidate: ${candidate.name}`, margin, yPosition);
    yPosition += 8;
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date(questionBank.created_at).toLocaleDateString()}`, margin, yPosition);
    yPosition += 15;
    doc.setTextColor(0);
    
    // Helper to add a section of questions
    const addQuestionSection = (title: string, questions: (string | QuestionWithAnswer)[], color: [number, number, number]) => {
      if (!questions || questions.length === 0) return;
      
      // Check if we need a new page for the section header
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin;
      }
      
      // Section title with colored bar
      doc.setFillColor(...color);
      doc.rect(margin, yPosition - 5, 3, 10, 'F');
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(title, margin + 6, yPosition);
      yPosition += 12;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      
      questions.forEach((q, i) => {
        const questionText = typeof q === 'string' ? q : q.question;
        const answer = typeof q === 'string' ? null : q.suggested_answer;
        
        // Question number and text
        doc.setFont('helvetica', 'bold');
        const questionLine = `${i + 1}. `;
        doc.text(questionLine, margin, yPosition);
        
        doc.setFont('helvetica', 'normal');
        yPosition = addWrappedText(questionText, margin + 8, yPosition, contentWidth - 8, 11);
        
        // Answer if present
        if (answer) {
          doc.setTextColor(34, 139, 34); // Green color for answer
          doc.setFontSize(10);
          doc.setFont('helvetica', 'italic');
          doc.text('Suggested Answer:', margin + 8, yPosition);
          yPosition += lineHeight;
          doc.setFont('helvetica', 'normal');
          yPosition = addWrappedText(answer, margin + 8, yPosition, contentWidth - 8, 10);
          doc.setTextColor(0);
        }
        
        yPosition += 5;
      });
      
      yPosition += 8;
    };
    
    // Add all sections with different colors
    addQuestionSection('Job Description Questions', questionBank.jd_based_questions, [249, 115, 22]); // Orange
    addQuestionSection('Technical Fundamentals', questionBank.fundamental_questions, [59, 130, 246]); // Blue
    addQuestionSection('Resume-Specific Questions', questionBank.resume_questions, [168, 85, 247]); // Purple
    addQuestionSection('Behavioral Questions', questionBank.behavioral_questions, [34, 197, 94]); // Green
    addQuestionSection('Insights-Based Questions', questionBank.insights_based_questions || [], [234, 179, 8]); // Yellow
    addQuestionSection('Red Flag Probes', questionBank.red_flag_probes, [239, 68, 68]); // Red
    
    // LeetCode Questions Section
    const leetcodeQuestions = questionBank.leetcode_questions || [];
    if (leetcodeQuestions.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFillColor(59, 130, 246); // Blue
      doc.rect(margin, yPosition - 5, 3, 10, 'F');
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('LeetCode Practice Questions', margin + 6, yPosition);
      yPosition += 12;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      
      leetcodeQuestions.forEach((lc: LeetCodeQuestion, i: number) => {
        if (yPosition > 265) {
          doc.addPage();
          yPosition = margin;
        }
        
        // Question number and title with difficulty
        doc.setFont('helvetica', 'bold');
        const difficultyColor = lc.difficulty === 'Easy' ? [34, 197, 94] : 
                               lc.difficulty === 'Medium' ? [234, 179, 8] : [239, 68, 68];
        doc.text(`${i + 1}. ${lc.title}`, margin, yPosition);
        doc.setTextColor(difficultyColor[0] as number, difficultyColor[1] as number, difficultyColor[2] as number);
        doc.text(` [${lc.difficulty}]`, margin + doc.getTextWidth(`${i + 1}. ${lc.title}`), yPosition);
        doc.setTextColor(0);
        yPosition += lineHeight;
        
        // URL
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(59, 130, 246); // Blue for link
        doc.text(lc.url, margin + 8, yPosition);
        doc.setTextColor(0);
        yPosition += lineHeight;
        
        // Solution hint
        if (lc.solution_hint) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(10);
          doc.setTextColor(100);
          yPosition = addWrappedText(`Hint: ${lc.solution_hint}`, margin + 8, yPosition, contentWidth - 8, 10);
          doc.setTextColor(0);
          doc.setFontSize(11);
        }
        
        yPosition += 4;
      });
      
      yPosition += 8;
    }
    
    // Follow-up topics
    if (questionBank.follow_up_topics?.length > 0) {
      if (yPosition > 250) {
        doc.addPage();
        yPosition = margin;
      }
      
      doc.setFillColor(100, 100, 100);
      doc.rect(margin, yPosition - 5, 3, 10, 'F');
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Follow-up Topics', margin + 6, yPosition);
      yPosition += 12;
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      
      questionBank.follow_up_topics.forEach((topic, i) => {
        doc.text(`${i + 1}. ${topic}`, margin, yPosition);
        yPosition += lineHeight;
      });
    }
    
    // Save the PDF
    doc.save(`${candidate.name.replace(/\s+/g, '_')}_question_bank.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#e4e4e7] w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#e4e4e7]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-[#111111]">{candidate.name}</h3>
              <p className="text-gray-400">{candidate.current_position || 'Position'}</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-[#111111]">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Section Tabs */}
          <div className="flex gap-4 mt-4 border-b border-[#e4e4e7]">
            {[
              { id: 'overview', icon: User, label: 'Overview' },
              { id: 'resume', icon: FileText, label: 'Resume PDF' },
              { id: 'insights', icon: Brain, label: 'AI Insights' },
              { id: 'questions', icon: MessageSquare, label: 'Question Bank' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`flex items-center gap-2 pb-3 px-2 text-sm font-medium transition-colors ${
                  activeSection === tab.id
                    ? 'text-[#0070f3] border-b-2 border-[#0070f3]'
                    : 'text-gray-400 hover:text-[#111111]'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {/* Overview Section */}
              {activeSection === 'overview' && fullCandidate && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="text-sm text-gray-500">Email</label>
                      <p className="text-[#111111]">{fullCandidate.email || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Phone</label>
                      <p className="text-[#111111]">{fullCandidate.phone || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Experience</label>
                      <p className="text-[#111111]">{fullCandidate.experience_years || '-'} years</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-500">Status</label>
                      <StatusBadge status={fullCandidate.status} />
                    </div>
                  </div>

                  {fullCandidate.skills && fullCandidate.skills.length > 0 && (
                    <div>
                      <label className="text-sm text-gray-500 block mb-2">Skills</label>
                      <div className="flex flex-wrap gap-2">
                        {fullCandidate.skills.map((skill, i) => (
                          <span key={i} className="px-3 py-1 bg-[#f4f4f5] text-[#374151] rounded-full text-sm">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Resume PDF Section */}
              {activeSection === 'resume' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-[#111111]">Resume Document</h4>
                    <div className="flex items-center gap-2">
                      {pdfUrl && (
                        <button
                          onClick={() => window.open(pdfUrl, '_blank')}
                          className="flex items-center gap-2 px-4 py-2 bg-[#f4f4f5] text-[#374151] rounded-lg hover:bg-[#d4d4d8] transition-colors"
                        >
                          <ExternalLink className="w-4 h-4" />
                          Open in New Tab
                        </button>
                      )}
                      <button
                        onClick={handleDownloadResume}
                        className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download PDF
                      </button>
                    </div>
                  </div>
                  
                  {pdfUrl ? (
                    <div className="bg-gray-800 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                      <iframe
                        src={pdfUrl}
                        className="w-full h-full"
                        title="Resume PDF"
                      />
                    </div>
                  ) : (
                    <div className="bg-gray-800 p-8 rounded-lg text-center">
                      <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">Loading PDF...</p>
                    </div>
                  )}
                </div>
              )}

              {/* AI Insights Section */}
              {activeSection === 'insights' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-lg font-semibold text-[#111111]">AI-Generated Insights</h4>
                    <button
                      onClick={handleRegenerateInsights}
                      disabled={isGeneratingInsights}
                      className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] transition-colors disabled:opacity-50"
                    >
                      {isGeneratingInsights ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          {insights ? 'Regenerate' : 'Generate'} Insights
                        </>
                      )}
                    </button>
                  </div>

                  {insights ? (
                    <div className="space-y-4">
                      {insights.scores && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {Object.entries(insights.scores).map(([key, value]) => (
                            value !== null && (
                              <div key={key} className="bg-[#f4f4f5] p-4 rounded-lg">
                                <p className="text-gray-400 text-sm capitalize">{key.replace(/_/g, ' ')}</p>
                                <p className="text-2xl font-bold text-[#0070f3]">{value}/100</p>
                              </div>
                            )
                          ))}
                        </div>
                      )}

                      {insights.summary?.headline && (
                        <div className="bg-[#eff6ff] border border-[#0070f3]/20 p-4 rounded-lg">
                          <p className="text-[#0070f3] font-medium">{insights.summary.headline}</p>
                          {insights.summary.quick_verdict && (
                            <span className={`mt-2 inline-block px-3 py-1 rounded-full text-sm ${
                              insights.summary.quick_verdict.includes('yes') 
                                ? 'bg-green-500/20 text-green-400' 
                                : insights.summary.quick_verdict === 'maybe'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {insights.summary.quick_verdict.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="grid md:grid-cols-2 gap-4">
                        {insights.summary?.top_strengths && insights.summary.top_strengths.length > 0 && (
                          <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                            <h5 className="text-green-400 font-medium mb-2">Strengths</h5>
                            <ul className="space-y-1">
                              {insights.summary.top_strengths.map((s, i) => (
                                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                  {s}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {insights.summary?.key_concerns && insights.summary.key_concerns.length > 0 && (
                          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                            <h5 className="text-red-400 font-medium mb-2">Areas of Concern</h5>
                            <ul className="space-y-1">
                              {insights.summary.key_concerns.map((c, i) => (
                                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {insights.summary?.areas_to_probe && insights.summary.areas_to_probe.length > 0 && (
                        <div className="bg-[#f4f4f5] p-4 rounded-lg">
                          <h5 className="text-[#111111] font-medium mb-2">💡 Areas to Probe in Interview</h5>
                          <ul className="space-y-1">
                            {insights.summary.areas_to_probe.map((a, i) => (
                              <li key={i} className="text-gray-300 text-sm">• {a}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button
                        onClick={() => setShowInsightsModal(true)}
                        className="text-[#0070f3] text-sm hover:underline"
                      >
                        View Full Insights →
                      </button>
                    </div>
                  ) : (
                    <div className="bg-[#f4f4f5] p-8 rounded-lg text-center">
                      <Brain className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-gray-400">No insights generated yet.</p>
                      <p className="text-gray-500 text-sm mt-2">Click "Generate Insights" to analyze this candidate.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Question Bank Section - Enhanced */}
              {activeSection === 'questions' && (
                <EnhancedQuestionBankSection
                  candidate={candidate}
                  questionBank={questionBank}
                  setQuestionBank={setQuestionBank}
                  onDownloadQB={handleDownloadQB}
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#e4e4e7] flex justify-end">
          <button onClick={onClose} className="px-4 py-2 bg-[#f4f4f5] text-[#374151] rounded-lg hover:bg-[#e4e4e7]">
            Close
          </button>
        </div>
      </div>

      {/* Full Insights Modal */}
      {showInsightsModal && (
        <InsightsModal
          candidate={fullCandidate || candidate}
          mode="view"
          onClose={() => setShowInsightsModal(false)}
        />
      )}
    </div>
  );
};

// Enhanced Question Bank Section with Chat, Manual Edit, and LeetCode
type QBCategory = 'jd_based' | 'fundamental' | 'resume' | 'behavioral' | 'insights_based' | 'red_flag_probes';

const CATEGORY_CONFIG: Record<QBCategory, { title: string; emoji: string; colorClass: string }> = {
  jd_based: { title: 'Job Description Questions', emoji: '📋', colorClass: 'orange' },
  fundamental: { title: 'Technical Fundamentals', emoji: '🧠', colorClass: 'blue' },
  resume: { title: 'Resume-Specific Questions', emoji: '📄', colorClass: 'purple' },
  behavioral: { title: 'Behavioral/Startup Mindset', emoji: '💭', colorClass: 'green' },
  insights_based: { title: 'Insights-Based Questions', emoji: '🔍', colorClass: 'yellow' },
  red_flag_probes: { title: 'Red Flag Probes', emoji: '⚠️', colorClass: 'red' },
};

const EnhancedQuestionBankSection: React.FC<{
  candidate: Candidate;
  questionBank: QuestionBank | null;
  setQuestionBank: (qb: QuestionBank | null) => void;
  onDownloadQB: () => void;
}> = ({ candidate, questionBank, setQuestionBank, onDownloadQB }) => {
  const [activeQBTab, setActiveQBTab] = useState<'questions' | 'chat' | 'leetcode'>('questions');
  const [isGenerating, setIsGenerating] = useState(false);
  const [roundNumber, setRoundNumber] = useState(questionBank?.round_number || 1);
  
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  // Edit state
  const [editingQuestion, setEditingQuestion] = useState<{ category: QBCategory; index: number } | null>(null);
  const [editForm, setEditForm] = useState({ question: '', suggested_answer: '' });
  const [isAddingQuestion, setIsAddingQuestion] = useState<QBCategory | null>(null);
  const [addForm, setAddForm] = useState({ question: '', suggested_answer: '' });
  
  // Expanded sections state - track which categories are expanded
  const [expandedSections, setExpandedSections] = useState<Set<QBCategory>>(
    new Set(['jd_based', 'fundamental', 'resume', 'behavioral', 'insights_based', 'red_flag_probes'])
  );
  
  const toggleSection = (category: QBCategory) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setExpandedSections(newSet);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const qb = await api.generateQuestionBank(candidate.id, undefined, roundNumber);
      setQuestionBank(qb);
    } catch (error) {
      console.error('Error generating QB:', error);
      alert('Failed to generate question bank');
    }
    setIsGenerating(false);
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    setIsChatLoading(true);
    const message = chatInput;
    setChatInput('');
    
    try {
      const response = await api.chatModifyQuestionBank(candidate.id, message);
      if (response.success) {
        setQuestionBank(response.question_bank);
      } else {
        alert(response.message);
      }
    } catch (error) {
      console.error('Error in chat:', error);
      alert('Failed to process your request');
    }
    setIsChatLoading(false);
  };

  const handleAddQuestion = async (category: QBCategory) => {
    if (!addForm.question.trim()) return;
    try {
      await api.addQuestion(candidate.id, category, addForm.question, addForm.suggested_answer);
      const qb = await api.getQuestionBank(candidate.id);
      setQuestionBank(qb);
      setIsAddingQuestion(null);
      setAddForm({ question: '', suggested_answer: '' });
    } catch (error) {
      alert('Failed to add question');
    }
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion || !editForm.question.trim()) return;
    try {
      await api.updateQuestion(candidate.id, editingQuestion.category, editingQuestion.index, editForm.question, editForm.suggested_answer);
      const qb = await api.getQuestionBank(candidate.id);
      setQuestionBank(qb);
      setEditingQuestion(null);
    } catch (error) {
      alert('Failed to update question');
    }
  };

  const handleDeleteQuestion = async (category: QBCategory, index: number) => {
    if (!confirm('Delete this question?')) return;
    try {
      await api.deleteQuestion(candidate.id, category, index);
      const qb = await api.getQuestionBank(candidate.id);
      setQuestionBank(qb);
    } catch (error) {
      alert('Failed to delete question');
    }
  };

  const getQuestions = (category: QBCategory): (QuestionWithAnswer | string)[] => {
    if (!questionBank) return [];
    const map: Record<QBCategory, (QuestionWithAnswer | string)[] | undefined> = {
      jd_based: questionBank.jd_based_questions,
      fundamental: questionBank.fundamental_questions,
      resume: questionBank.resume_questions,
      behavioral: questionBank.behavioral_questions,
      insights_based: questionBank.insights_based_questions,
      red_flag_probes: questionBank.red_flag_probes,
    };
    return map[category] || [];
  };

  const renderEditableSection = (category: QBCategory) => {
    const config = CATEGORY_CONFIG[category];
    const questions = getQuestions(category);
    const isExpanded = expandedSections.has(category);
    
    const colorClasses: Record<string, string> = {
      orange: 'bg-[#eff6ff] border-[#0070f3]/20 text-[#0070f3]',
      blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      green: 'bg-green-500/10 border-green-500/20 text-green-400',
      yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
      red: 'bg-red-500/10 border-red-500/20 text-red-400',
    };

    return (
      <div key={category} className={`border rounded-lg mb-4 ${colorClasses[config.colorClass]}`}>
        <div className="w-full flex items-center justify-between p-3">
          <button 
            onClick={() => toggleSection(category)} 
            className="flex-1 flex items-center justify-between text-left"
          >
            <span className="font-medium text-sm">{config.emoji} {config.title} ({questions.length})</span>
            <div className="flex items-center gap-2">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>
          <button 
            onClick={() => setIsAddingQuestion(category)} 
            className="p-1 hover:bg-[#f4f4f5] rounded ml-2" 
            title="Add question"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        {isExpanded && (
          <div className="px-3 pb-3 space-y-2">
            {isAddingQuestion === category && (
              <div className="bg-black/30 rounded-lg p-3 space-y-2">
                <input type="text" value={addForm.question} onChange={(e) => setAddForm({ ...addForm, question: e.target.value })}
                  placeholder="Enter question..." className="w-full bg-[#f4f4f5] text-[#374151] rounded px-2 py-1 text-sm" />
                <textarea value={addForm.suggested_answer} onChange={(e) => setAddForm({ ...addForm, suggested_answer: e.target.value })}
                  placeholder="Suggested answer..." className="w-full bg-[#f4f4f5] text-[#374151] rounded px-2 py-1 text-sm min-h-[50px]" />
                <div className="flex gap-2">
                  <button onClick={() => handleAddQuestion(category)} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs">Add</button>
                  <button onClick={() => setIsAddingQuestion(null)} className="px-2 py-1 bg-[#f4f4f5] text-[#374151] rounded text-xs">Cancel</button>
                </div>
              </div>
            )}
            
            {questions.map((q, i) => {
              const isEditing = editingQuestion?.category === category && editingQuestion?.index === i;
              const question = typeof q === 'string' ? q : q.question;
              const answer = typeof q === 'string' ? '' : q.suggested_answer;
              
              if (isEditing) {
                return (
                  <div key={i} className="bg-black/30 rounded-lg p-3 space-y-2">
                    <input type="text" value={editForm.question} onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                      className="w-full bg-[#f4f4f5] text-[#374151] rounded px-2 py-1 text-sm" />
                    <textarea value={editForm.suggested_answer} onChange={(e) => setEditForm({ ...editForm, suggested_answer: e.target.value })}
                      className="w-full bg-[#f4f4f5] text-[#374151] rounded px-2 py-1 text-sm min-h-[50px]" />
                    <div className="flex gap-2">
                      <button onClick={handleUpdateQuestion} className="px-2 py-1 bg-emerald-600 text-white rounded text-xs flex items-center gap-1">
                        <Save className="w-3 h-3" /> Save
                      </button>
                      <button onClick={() => setEditingQuestion(null)} className="px-2 py-1 bg-[#f4f4f5] text-[#374151] rounded text-xs">Cancel</button>
                    </div>
                  </div>
                );
              }
              
              return (
                <div key={i} className="bg-black/30 rounded-lg overflow-hidden group">
                  <div className="flex items-start gap-2 p-2">
                    <span className="text-gray-500 font-mono text-xs">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-gray-200 text-sm">{question}</p>
                      {answer && (
                        <div className="mt-1 bg-green-500/10 border border-green-500/20 p-2 rounded">
                          <p className="text-green-400 text-xs">✓ {answer}</p>
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                      <button onClick={() => { setEditingQuestion({ category, index: i }); setEditForm({ question, suggested_answer: answer }); }}
                        className="p-1 hover:bg-[#f4f4f5] rounded text-gray-400 hover:text-[#111111]" title="Edit">
                        <Edit3 className="w-3 h-3" />
                      </button>
                      <button onClick={() => handleDeleteQuestion(category, i)}
                        className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400" title="Delete">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h4 className="text-lg font-semibold text-[#111111]">Question Bank</h4>
          <select value={roundNumber} onChange={(e) => setRoundNumber(parseInt(e.target.value))}
            className="bg-[#f4f4f5] text-[#374151] rounded px-2 py-1 text-sm">
            {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Round {n}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          {questionBank && (
            <button onClick={onDownloadQB} className="flex items-center gap-2 px-3 py-2 bg-[#f4f4f5] text-[#374151] rounded-lg hover:bg-[#d4d4d8] text-sm">
              <Download className="w-4 h-4" /> PDF
            </button>
          )}
          <button onClick={handleGenerate} disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] disabled:opacity-50 text-sm">
            {isGenerating ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
            ) : (
              <><Sparkles className="w-4 h-4" /> {questionBank ? 'Regenerate' : 'Generate'}</>
            )}
          </button>
        </div>
      </div>
      
      {/* Sub-tabs */}
      <div className="flex border-b border-[#e4e4e7]">
        {[
          { id: 'questions', label: 'Questions', icon: MessageSquare },
          { id: 'chat', label: 'AI Assistant', icon: Send },
          { id: 'leetcode', label: 'LeetCode', icon: Code },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveQBTab(tab.id as any)}
            className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
              activeQBTab === tab.id ? 'text-[#0070f3] border-b-2 border-[#0070f3]' : 'text-gray-400 hover:text-[#111111]'
            }`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>
      
      {/* Content */}
      {activeQBTab === 'questions' ? (
        questionBank ? (
          <div className="max-h-[400px] overflow-y-auto">
            {(['jd_based', 'fundamental', 'resume', 'behavioral', 'insights_based', 'red_flag_probes'] as QBCategory[]).map(cat => 
              renderEditableSection(cat)
            )}
          </div>
        ) : (
          <div className="bg-[#f4f4f5] p-8 rounded-lg text-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No question bank generated yet.</p>
            <p className="text-gray-500 text-sm mt-2">Click "Generate" to create tailored questions.</p>
          </div>
        )
      ) : activeQBTab === 'chat' ? (
        <div className="space-y-4">
          {!questionBank ? (
            <div className="text-center py-8 text-gray-400">Generate a question bank first</div>
          ) : (
            <>
              <div className="bg-[#f4f4f5] rounded-lg p-3 mb-4">
                <p className="text-gray-300 text-sm">💡 Ask me to modify the questions:</p>
                <ul className="text-gray-500 text-xs mt-2 space-y-1">
                  <li>• "Add more system design questions"</li>
                  <li>• "Add a question about their AWS experience"</li>
                  <li>• "Remove generic behavioral questions"</li>
                </ul>
              </div>
              
              {questionBank.chat_history?.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 text-sm ${
                    msg.role === 'user' ? 'bg-[#eff6ff] text-orange-100' : 'bg-gray-800 text-gray-200'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              
              <div className="flex gap-2">
                <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                  placeholder="Ask me to modify questions..." className="flex-1 bg-[#f4f4f5] text-[#374151] rounded-lg px-3 py-2 text-sm"
                  disabled={isChatLoading} />
                <button onClick={handleChatSubmit} disabled={isChatLoading || !chatInput.trim()}
                  className="px-4 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] disabled:opacity-50">
                  {isChatLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      ) : activeQBTab === 'leetcode' ? (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          <div className="bg-[#f4f4f5] rounded-lg p-3">
            <p className="text-gray-300 text-sm flex items-center gap-2"><Code className="w-4 h-4 text-[#0070f3]" /> LeetCode Practice</p>
            <p className="text-gray-500 text-xs mt-1">Based on skills: {candidate.skills?.join(', ') || 'N/A'}</p>
          </div>
          
          {questionBank?.leetcode_questions?.length ? (
            questionBank.leetcode_questions.map((lc: LeetCodeQuestion, i: number) => (
              <div key={i} className="bg-[#f4f4f5] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[#111111] font-medium text-sm">{lc.title}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    lc.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' :
                    lc.difficulty === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
                  }`}>{lc.difficulty}</span>
                </div>
                <a href={lc.url} target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 text-xs hover:underline flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> Open on LeetCode
                </a>
                {lc.solution_hint && <p className="text-gray-400 text-xs mt-2">💡 {lc.solution_hint}</p>}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">Generate a question bank to see LeetCode recommendations</div>
          )}
        </div>
      ) : null}
    </div>
  );
};

// Interview Review Modal
const InterviewReviewModal: React.FC<{
  schedule: InterviewSchedule;
  onClose: () => void;
  onSubmitted: () => void;
}> = ({ schedule, onClose, onSubmitted }) => {
  const [review, setReview] = useState<InterviewReviewCreate>({
    technical_skills: 3,
    communication: 3,
    problem_solving: 3,
    cultural_fit: 3,
    overall_rating: 3,
    strengths: '',
    areas_for_improvement: '',
    notes: '',
    recommendation: 'maybe'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'previous' | 'ai'>('previous');
  const [previousReviews, setPreviousReviews] = useState<any>(null);
  const [loadingPreviousReviews, setLoadingPreviousReviews] = useState(false);
  const [aiReviewData, setAiReviewData] = useState<any>(null);
  const [showAiTab, setShowAiTab] = useState(false); // Controls AI tab visibility
  const [metricsCompleted, setMetricsCompleted] = useState(false); // Track if mandatory fields filled

  // Fetch previous reviews on mount
  useEffect(() => {
    const fetchPreviousReviews = async () => {
      if (!schedule.candidate_id) return;

      setLoadingPreviousReviews(true);
      try {
        const data = await api.getPreviousReviews(schedule.candidate_id);
        setPreviousReviews(data);
        // Only show previous tab if there are reviews
        if (data.total_visible_reviews === 0) {
          setActiveTab('metrics');
        }
      } catch (error) {
        console.error('Failed to fetch previous reviews:', error);
      } finally {
        setLoadingPreviousReviews(false);
      }
    };

    fetchPreviousReviews();
  }, [schedule.candidate_id]);

  // Check if mandatory metrics are completed
  const checkMetricsCompleted = () => {
    return (
      review.technical_skills !== undefined &&
      review.communication !== undefined &&
      review.problem_solving !== undefined &&
      review.cultural_fit !== undefined &&
      review.overall_rating !== undefined &&
      review.recommendation !== 'maybe' // Must select a recommendation
    );
  };

  // Update metrics completion status whenever review changes
  useEffect(() => {
    setMetricsCompleted(checkMetricsCompleted());
  }, [review]);

  // Submit without AI review
  const handleSubmitWithoutAI = async () => {
    if (!checkMetricsCompleted()) {
      alert('⚠️ Please complete all mandatory fields (ratings and recommendation)');
      return;
    }

    setIsSubmitting(true);
    try {
      const reviewPayload = {
        ...review,
        llm_generated_feedback: undefined,
      };
      await api.submitInterviewReview(schedule.id, reviewPayload);
      alert('✅ Review submitted successfully!');
      onSubmitted();
    } catch (error: any) {
      alert(`❌ Failed to submit review: ${error.response?.data?.detail || 'Unknown error'}`);
    }
    setIsSubmitting(false);
  };

  // Submit with AI review (open AI tab)
  const handleSubmitWithAI = () => {
    if (!checkMetricsCompleted()) {
      alert('⚠️ Please complete all mandatory fields (ratings and recommendation) before using AI review');
      return;
    }
    setShowAiTab(true);
    setActiveTab('ai');
  };

  // Final submit after AI review completed
  const handleFinalSubmit = async () => {
    if (!aiReviewData) {
      alert('⚠️ Please complete the AI review first');
      return;
    }

    setIsSubmitting(true);
    try {
      // Include AI review data in submission for baton passing
      const reviewPayload = {
        ...review,
        llm_generated_feedback: aiReviewData,
      };
      await api.submitInterviewReview(schedule.id, reviewPayload);
      alert('✅ Review with AI guidance submitted successfully! Context will be passed to next interviewer.');
      onSubmitted();
    } catch (error: any) {
      alert(`❌ Failed to submit review: ${error.response?.data?.detail || 'Unknown error'}`);
    }
    setIsSubmitting(false);
  };

  const RatingInput: React.FC<{
    label: string;
    value: number | undefined;
    onChange: (value: number) => void;
  }> = ({ label, value, onChange }) => (
    <div>
      <label className="text-sm text-gray-400 block mb-2">{label}</label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`p-2 rounded ${
              value === n ? 'bg-[#0070f3] text-white' : 'bg-gray-800 text-gray-400 hover:bg-[#e4e4e7]'
            }`}
          >
            <Star className={`w-4 h-4 ${value && n <= value ? 'fill-current' : ''}`} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#e4e4e7] w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[#e4e4e7]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-[#111111]">Interview Review</h3>
              <p className="text-gray-400 text-sm">
                Candidate: {schedule.candidate?.name || schedule.candidate_name || 'Unknown'}
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-[#111111]">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-[#e4e4e7] px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('previous')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'previous'
                  ? 'border-[#0070f3] text-[#0070f3]'
                  : 'border-transparent text-gray-400 hover:text-[#374151]'
              }`}
            >
              Previous Rounds
              {previousReviews && previousReviews.total_visible_reviews > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-[#eff6ff] text-[#0070f3] rounded-full text-xs">
                  {previousReviews.total_visible_reviews}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('metrics')}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === 'metrics'
                  ? 'border-[#0070f3] text-[#0070f3]'
                  : 'border-transparent text-gray-400 hover:text-[#374151]'
              }`}
            >
              Submit Review
            </button>
            {/* AI tab only shows after "Submit with AI" clicked */}
            {showAiTab && (
              <button
                onClick={() => setActiveTab('ai')}
                className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'ai'
                    ? 'border-[#0070f3] text-[#0070f3]'
                    : 'border-transparent text-gray-400 hover:text-[#374151]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI-Guided Review
                  {aiReviewData && (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  )}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tab Content: Previous Reviews */}
          {activeTab === 'previous' && (
            <PreviousReviewsPanel data={previousReviews} isLoading={loadingPreviousReviews} />
          )}

          {/* Tab Content: AI-Guided Review */}
          {activeTab === 'ai' && showAiTab && (
            <>
              {/* Help banner */}
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-semibold text-blue-300 mb-1">AI-Guided Review Mode</h4>
                    <p className="text-xs text-blue-200">
                      Answer the AI-generated questions below (or provide manual review context).
                      Once complete, click "Final Submit" to combine your ratings with AI guidance and submit the review.
                    </p>
                  </div>
                </div>
              </div>

              <AIGuidedReview
                scheduleId={schedule.id}
                basicMetrics={{
                  technical_skills: review.technical_skills,
                  communication: review.communication,
                  problem_solving: review.problem_solving,
                  cultural_fit: review.cultural_fit,
                  overall_rating: review.overall_rating,
                }}
                onAnswersComplete={(answers) => {
                  // Auto-fill notes from AI-generated Q&A
                  const combinedText = Object.entries(answers)
                    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
                    .join('\n\n');
                  setReview({ ...review, notes: combinedText });
                  setAiReviewData({ type: 'ai', answers });
                }}
                onManualReviewComplete={(data) => {
                  // Auto-fill notes from manual review
                  const manualText = `Key Areas: ${data.key_areas.join(', ')}\n\n${data.description}`;
                  setReview({ ...review, notes: manualText });
                  setAiReviewData({ type: 'manual', ...data });
                }}
              />
            </>
          )}

          {/* Tab Content: Submit Review (Original Form) */}
          {activeTab === 'metrics' && (
            <>
              {/* Mandatory fields reminder */}
              {!metricsCompleted && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="text-sm font-semibold text-yellow-300 mb-1">Complete Required Fields</h4>
                      <p className="text-xs text-yellow-200">
                        Please fill all rating fields and select a recommendation (other than "Maybe") before submitting.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* AI Review Data Indicator */}
              {aiReviewData && (
                <div className={`border rounded-lg p-3 ${
                  aiReviewData.type === 'ai'
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-[#eff6ff] border-[#0070f3]/30'
                }`}>
                  <div className="flex items-center gap-2 text-sm">
                    {aiReviewData.type === 'ai' ? (
                      <>
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <span className="text-purple-300 font-medium">AI-Guided Review completed</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 text-[#0070f3]" />
                        <span className="text-orange-300 font-medium">Manual Review completed</span>
                      </>
                    )}
                    <span className="text-zinc-500 mx-2">•</span>
                    <span className="text-zinc-400">Notes auto-filled below</span>
                  </div>
                </div>
              )}

              {/* Ratings */}
              <div className="grid grid-cols-2 gap-4">
            <RatingInput
              label="Technical Skills"
              value={review.technical_skills}
              onChange={v => setReview({ ...review, technical_skills: v })}
            />
            <RatingInput
              label="Communication"
              value={review.communication}
              onChange={v => setReview({ ...review, communication: v })}
            />
            <RatingInput
              label="Problem Solving"
              value={review.problem_solving}
              onChange={v => setReview({ ...review, problem_solving: v })}
            />
            <RatingInput
              label="Cultural Fit"
              value={review.cultural_fit}
              onChange={v => setReview({ ...review, cultural_fit: v })}
            />
          </div>

          <RatingInput
            label="Overall Rating"
            value={review.overall_rating}
            onChange={v => setReview({ ...review, overall_rating: v })}
          />

          {/* Text Inputs */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Strengths</label>
            <textarea
              value={review.strengths}
              onChange={e => setReview({ ...review, strengths: e.target.value })}
              className="w-full bg-[#f4f4f5] text-[#374151] rounded-lg p-3 min-h-[80px]"
              placeholder="What did the candidate do well?"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-2">Areas for Improvement</label>
            <textarea
              value={review.areas_for_improvement}
              onChange={e => setReview({ ...review, areas_for_improvement: e.target.value })}
              className="w-full bg-[#f4f4f5] text-[#374151] rounded-lg p-3 min-h-[80px]"
              placeholder="What could the candidate improve on?"
            />
          </div>

          <div>
            <label className="text-sm text-gray-400 block mb-2">Additional Notes</label>
            <textarea
              value={review.notes}
              onChange={e => setReview({ ...review, notes: e.target.value })}
              className="w-full bg-[#f4f4f5] text-[#374151] rounded-lg p-3 min-h-[80px]"
              placeholder="Any other observations or notes..."
            />
          </div>

          {/* Recommendation */}
          <div>
            <label className="text-sm text-gray-400 block mb-2">Recommendation</label>
            <div className="grid grid-cols-5 gap-2">
              {[
                { value: 'strong_yes', label: 'Strong Yes', color: 'bg-green-600' },
                { value: 'yes', label: 'Yes', color: 'bg-green-500/50' },
                { value: 'maybe', label: 'Maybe', color: 'bg-yellow-500/50' },
                { value: 'no', label: 'No', color: 'bg-red-500/50' },
                { value: 'strong_no', label: 'Strong No', color: 'bg-red-600' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setReview({ ...review, recommendation: opt.value as any })}
                  className={`p-3 rounded-lg text-white text-sm font-medium transition-all ${
                    review.recommendation === opt.value 
                      ? `${opt.color} ring-2 ring-white` 
                      : 'bg-gray-800 hover:bg-[#e4e4e7]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
            </>
          )}
        </div>

        <div className="p-4 border-t border-[#e4e4e7] flex justify-end gap-3">
          {/* Previous tab: Continue button */}
          {activeTab === 'previous' && (
            <button
              onClick={() => setActiveTab('metrics')}
              className="px-6 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] flex items-center gap-2"
            >
              Continue to Review
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          {/* Submit Review tab: Two options OR direct submit if already in AI mode */}
          {activeTab === 'metrics' && !showAiTab && (
            <>
              <button onClick={onClose} className="px-4 py-2 bg-[#f4f4f5] text-[#374151] rounded-lg hover:bg-[#e4e4e7]">
                Cancel
              </button>

              {/* Submit without AI */}
              <button
                onClick={handleSubmitWithoutAI}
                disabled={isSubmitting || !metricsCompleted}
                className="px-6 py-2 bg-[#f4f4f5] text-[#374151] rounded-lg hover:bg-[#d4d4d8] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={!metricsCompleted ? "Please complete all mandatory fields" : ""}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-4 h-4" />
                    Submit Without AI
                  </>
                )}
              </button>

              {/* Submit with AI */}
              <button
                onClick={handleSubmitWithAI}
                disabled={!metricsCompleted}
                className="px-6 py-2 bg-gradient-to-r from-[#7c3aed] to-[#0070f3] text-white rounded-lg hover:from-purple-700 hover:to-[#0060df] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                title={!metricsCompleted ? "Please complete all mandatory fields" : ""}
              >
                <Sparkles className="w-4 h-4" />
                Submit With AI Review
              </button>
            </>
          )}

          {/* AI Review tab: Final submit button */}
          {activeTab === 'ai' && showAiTab && (
            <>
              <button
                onClick={() => setActiveTab('metrics')}
                className="px-4 py-2 bg-[#f4f4f5] text-[#374151] rounded-lg hover:bg-[#e4e4e7]"
              >
                Back to Review
              </button>
              <button
                onClick={handleFinalSubmit}
                disabled={isSubmitting || !aiReviewData}
                className="px-6 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-4 h-4" />
                    Final Submit (Manual + AI)
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Schedule Card Component with Interview Conducted button
const ScheduleCard: React.FC<{
  schedule: InterviewSchedule;
  onRespond: (scheduleId: string, action: 'accept' | 'reject') => Promise<void>;
  onViewCandidate: (candidateId: string) => void;
  onInterviewConducted: (schedule: InterviewSchedule) => void;
  onRequestReschedule: (schedule: InterviewSchedule) => void;
}> = ({ schedule, onRespond, onViewCandidate, onInterviewConducted, onRequestReschedule }) => {
  const [isResponding, setIsResponding] = useState(false);

  const getStatusInfo = () => {
    switch (schedule.status) {
      case 'confirmed':
        return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/20', label: 'Confirmed' };
      case 'declined':
        return { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/20', label: 'Declined' };
      case 'completed':
        return { icon: ClipboardCheck, color: 'text-blue-500', bg: 'bg-blue-500/20', label: 'Completed' };
      case 'reschedule_requested':
        return { icon: RefreshCw, color: 'text-[#0070f3]', bg: 'bg-[#eff6ff]', label: 'Reschedule pending' };
      default:
        return { icon: AlertCircle, color: 'text-yellow-500', bg: 'bg-yellow-500/20', label: 'Pending' };
    }
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  const handleRespond = async (action: 'accept' | 'reject') => {
    setIsResponding(true);
    await onRespond(schedule.id, action);
    setIsResponding(false);
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <button 
              onClick={() => onViewCandidate(schedule.candidate_id)}
              className="text-lg font-semibold text-white hover:text-[#0070f3] transition-colors"
            >
              {schedule.candidate?.name || schedule.candidate_name || 'Unknown Candidate'}
            </button>
            <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${status.bg} ${status.color}`}>
              <StatusIcon className="w-3 h-3" />
              {status.label}
            </span>
          </div>
          
          <div className="space-y-1 text-sm text-gray-400">
            <p>📋 {schedule.round?.round_name || `Round ${schedule.round?.round_number || 'Interview'}`}</p>
            <p>💼 {schedule.job?.title || 'Job Position'}</p>
            {schedule.scheduled_at && (
              <p>📅 {new Date(schedule.scheduled_at).toLocaleString()}</p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          {schedule.status === 'pending' && (
            <>
              <button
                onClick={() => handleRespond('accept')}
                disabled={isResponding}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 text-sm"
                data-testid={`schedule-accept-${schedule.id}`}
              >
                <ThumbsUp className="w-4 h-4" />
                Accept
              </button>
              <button
                onClick={() => handleRespond('reject')}
                disabled={isResponding}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors disabled:opacity-50 text-sm"
                data-testid={`schedule-reject-${schedule.id}`}
              >
                <ThumbsDown className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={() => onRequestReschedule(schedule)}
                disabled={isResponding}
                className="flex items-center gap-2 px-4 py-2 bg-[#eff6ff] text-orange-300 rounded-lg hover:bg-[#0060df]/30 transition-colors disabled:opacity-50 text-sm border border-[#0070f3]/30"
                data-testid={`schedule-reschedule-${schedule.id}`}
              >
                <RefreshCw className="w-4 h-4" />
                Request Reschedule
              </button>
            </>
          )}

          {schedule.status === 'confirmed' && (
            <>
              <button
                onClick={() => onInterviewConducted(schedule)}
                className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] transition-colors text-sm"
              >
                <ClipboardCheck className="w-4 h-4" />
                Interview Conducted
              </button>
              <button
                onClick={() => onRequestReschedule(schedule)}
                className="flex items-center gap-2 px-4 py-2 bg-[#eff6ff] text-orange-300 rounded-lg hover:bg-[#0060df]/30 transition-colors text-sm border border-[#0070f3]/30"
                data-testid={`schedule-reschedule-${schedule.id}`}
              >
                <RefreshCw className="w-4 h-4" />
                Request Reschedule
              </button>
            </>
          )}

          {schedule.status === 'reschedule_requested' && (
            <div className="flex flex-col items-end gap-1 text-xs text-gray-400">
              <span className="text-orange-300">⟳ Awaiting HR</span>
              {schedule.proposed_at && (
                <span>Suggested: {new Date(schedule.proposed_at).toLocaleString()}</span>
              )}
            </div>
          )}

          {schedule.status === 'completed' && (
            <div className="flex flex-col items-end gap-1">
              <span className="text-green-400 text-sm">✓ Review Submitted</span>
              {formatRecommendationLabel(schedule.review_recommendation) && (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${recommendationBadgeClass(schedule.review_recommendation)}`}>
                  {formatRecommendationLabel(schedule.review_recommendation)}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {schedule.status === 'completed' && schedule.review_overall_rating && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <span>Rating:</span>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map(star => (
              <span key={star} className={`text-sm ${star <= schedule.review_overall_rating! ? 'text-yellow-400' : 'text-gray-600'}`}>
                ★
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'hired':
        return 'bg-green-500/20 text-green-400';
      case 'applied':
        return 'bg-gray-500/20 text-gray-400';
      case 'screening':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'interview_round_1':
      case 'interview_round_2':
        return 'bg-blue-500/20 text-blue-400';
      case 'offer':
        return 'bg-purple-500/20 text-purple-400';
      case 'rejected':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-gray-500/20 text-gray-400';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusStyle(status)}`}>
      {formatStatus(status)}
    </span>
  );
};

export default InterviewerDashboard;
