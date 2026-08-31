import React, { useState, useEffect, useCallback } from 'react';
import type { Job, Candidate, User as InterviewerUser } from '../apiService';
import { api } from '../apiService';
import { useAuth } from '../contexts/AuthContext';
import {
  Briefcase, LogOut, Users, FileText,
  Plus, User, ChevronRight, X, Upload, Trash2, Edit2,
  Clock, UserCheck, GitBranch, Mail,
  CheckCircle, XCircle, Send, Award, Search
} from 'lucide-react';
import { CandidateCard } from '../components/CandidateCard';
import { UploadResumeModal as NewUploadResumeModal } from '../components/UploadResumeModal';
import { InsightsModal } from '../components/InsightsModal';
import { InterviewPipelineCanvas } from '../components/InterviewPipelineCanvas';
import { SwitchUserDropdown } from '../components/SwitchUserDropdown';
import { OfferLetterModal } from '../components/OfferLetterModal';
import { TalentSearch } from '../components/TalentSearch';
import { ReengagementList } from '../components/ReengagementList';
import { CandidateTimeline } from '../components/CandidateTimeline';
import { CommunicationsTab } from '../components/CommunicationsTab';

const HRDashboard: React.FC = () => {
  const { user, logout, token, switchUserRole } = useAuth();
  const [activeView, setActiveView] = useState<'overview' | 'candidates' | 'jobs' | 'pipeline' | 'communications' | 'hired' | 'talent'>('overview');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [_interviewers, setInterviewers] = useState<InterviewerUser[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [jobsRes, candidatesRes, interviewersRes] = await Promise.all([
        api.listJobs(),
        api.listCandidates(),
        api.listInterviewers().catch(() => [])
      ]);
      setJobs(jobsRes.jobs);
      setCandidates(candidatesRes.candidates);
      setInterviewers(interviewersRes);
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

  const stats = {
    totalCandidates: candidates.length,
    activeJobs: jobs.filter(j => j.status === 'active').length,
    inScreening: candidates.filter(c => c.status === 'screening').length,
    inInterview: candidates.filter(c => c.status.startsWith('interview')).length,
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Top Navigation */}
      <nav className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-[#e4e4e7] z-50">
        <div className="flex items-center justify-between h-full px-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0070f3]/10 flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-[#0070f3]" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[#111111]">Hiring Co-Pilot</h1>
              <p className="text-[10px] text-[#71717a]">HR Admin</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <SwitchUserDropdown 
              currentRole={user?.role || 'hr_admin'} 
              onRoleSwitch={switchUserRole}
            />
            <div className="flex items-center gap-2.5 pl-3 border-l border-[#e4e4e7]">
              <div className="w-7 h-7 rounded-full bg-[#f4f4f5] flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-[#71717a]" />
              </div>
              <span className="text-sm text-[#374151]">{user?.name}</span>
              <button onClick={logout} className="p-1.5 text-[#a1a1aa] hover:text-[#ef4444] transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <aside className="fixed left-0 top-14 bottom-0 w-56 bg-white border-r border-[#e4e4e7] p-3">
        <nav className="space-y-0.5">
          {[
            { id: 'overview', icon: Users, label: 'Overview' },
            { id: 'jobs', icon: FileText, label: 'Jobs' },
            { id: 'candidates', icon: Users, label: 'Candidates' },
            { id: 'pipeline', icon: GitBranch, label: 'Interview Pipeline' },
            { id: 'hired', icon: Award, label: 'Hired / Offers' },
            { id: 'talent', icon: Search, label: 'Talent Memory' },
            { id: 'communications', icon: Mail, label: 'Communications' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as any)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeView === item.id 
                  ? 'bg-[#eff6ff] text-[#0070f3] font-medium' 
                  : 'text-[#71717a] hover:bg-[#f4f4f5] hover:text-[#111111]'
              }`}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="ml-56 pt-14 p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-6 h-6 border-2 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {activeView === 'overview' && (
              <OverviewSection stats={stats} candidates={candidates} jobs={jobs} onViewCandidates={() => setActiveView('candidates')} />
            )}
            {activeView === 'jobs' && (
              <JobsSection jobs={jobs} onRefresh={fetchData} />
            )}
            {activeView === 'candidates' && (
              <CandidatesSection 
                candidates={candidates} 
                jobs={jobs}
                onSelectCandidate={setSelectedCandidate}
                onRefresh={fetchData}
              />
            )}
            {activeView === 'pipeline' && (
              <div className="h-[calc(100vh-8rem)]">
                <InterviewPipelineCanvas jobs={jobs} />
              </div>
            )}
            {activeView === 'hired' && (
              <HiredSection
                candidates={candidates}
                jobs={jobs}
                onRefresh={fetchData}
              />
            )}
            {activeView === 'talent' && (
              <TalentMemorySection />
            )}
            {activeView === 'communications' && (
              <CommunicationsTab />
            )}
          </>
        )}
      </main>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <CandidateDetailModal 
          candidate={selectedCandidate} 
          jobs={jobs}
          onClose={() => setSelectedCandidate(null)}
          onRefresh={fetchData}
        />
      )}
    </div>
  );
};

// Overview Section
const OverviewSection: React.FC<{ 
  stats: any; 
  candidates: Candidate[]; 
  jobs: Job[];
  onViewCandidates: () => void;
}> = ({ stats, candidates, jobs, onViewCandidates }) => (
  <div className="space-y-5">
    <h2 className="text-xl font-semibold text-[#111111]">Overview</h2>
    
    {/* Stats Grid */}
    <div className="grid grid-cols-4 gap-4">
      {[
        { label: 'Total Candidates', value: stats.totalCandidates, icon: Users, color: 'text-[#0070f3]', bg: 'bg-[#eff6ff]' },
        { label: 'Active Jobs', value: stats.activeJobs, icon: FileText, color: 'text-[#7c3aed]', bg: 'bg-purple-50' },
        { label: 'In Screening', value: stats.inScreening, icon: Clock, color: 'text-[#d97706]', bg: 'bg-amber-50' },
        { label: 'In Interview', value: stats.inInterview, icon: UserCheck, color: 'text-[#059669]', bg: 'bg-emerald-50' },
      ].map((stat, i) => (
        <div key={i} className="bg-white border border-[#e4e4e7] rounded-xl p-5">
          <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center mb-3`}>
            <stat.icon className={`w-4 h-4 ${stat.color}`} />
          </div>
          <p className="text-2xl font-semibold text-[#111111]">{stat.value}</p>
          <p className="text-sm text-[#71717a] mt-0.5">{stat.label}</p>
        </div>
      ))}
    </div>

    {/* Recent Candidates */}
    <div className="bg-white border border-[#e4e4e7] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#111111]">Recent Candidates</h3>
        <button onClick={onViewCandidates} className="text-xs text-[#0070f3] hover:underline">View All</button>
      </div>
      <div className="space-y-2">
        {candidates.slice(0, 5).map(candidate => {
          const job = jobs.find(j => j.id === candidate.job_id);
          return (
            <div key={candidate.id} className="flex items-center justify-between p-3 bg-[#fafafa] rounded-lg border border-[#f4f4f5]">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#f4f4f5] flex items-center justify-center">
                  <User className="w-4 h-4 text-[#71717a]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#111111]">{candidate.name}</p>
                  <p className="text-xs text-[#71717a]">{job?.title || 'Unknown Job'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={candidate.status} />
                <ChevronRight className="w-4 h-4 text-[#d4d4d8]" />
              </div>
            </div>
          );
        })}
        {candidates.length === 0 && (
          <p className="text-center text-[#a1a1aa] text-sm py-6">No candidates yet. Create a job and upload resumes to get started.</p>
        )}
      </div>
    </div>

    {/* Active Jobs */}
    <div className="bg-white border border-[#e4e4e7] rounded-xl p-5">
      <h3 className="text-sm font-semibold text-[#111111] mb-4">Active Jobs</h3>
      <div className="space-y-2">
        {jobs.filter(j => j.status === 'active').slice(0, 5).map(job => (
          <div key={job.id} className="flex items-center justify-between p-3 bg-[#fafafa] rounded-lg border border-[#f4f4f5]">
            <div>
              <p className="text-sm font-medium text-[#111111]">{job.title}</p>
              <p className="text-xs text-[#71717a]">{job.candidate_count} candidates</p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full text-xs font-medium">Active</span>
          </div>
        ))}
        {jobs.filter(j => j.status === 'active').length === 0 && (
          <p className="text-center text-[#a1a1aa] text-sm py-4">No active jobs. Create one to start hiring.</p>
        )}
      </div>
    </div>
  </div>
);

// Jobs Section
const JobsSection: React.FC<{ jobs: Job[]; onRefresh: () => void }> = ({ jobs, onRefresh }) => {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-[#111111]">Job Postings</h2>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3.5 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Job
        </button>
      </div>

      <div className="grid gap-3">
        {jobs.map(job => (
          <div key={job.id} className="bg-white border border-[#e4e4e7] rounded-xl p-5 flex items-center justify-between hover:border-[#d4d4d8] transition-colors">
            <div>
              <h3 className="text-sm font-semibold text-[#111111]">{job.title}</h3>
              <p className="text-xs text-[#71717a] mt-1">{job.description?.slice(0, 100) || 'No description'}</p>
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs text-[#a1a1aa]">{job.candidate_count} candidates</span>
                <StatusBadge status={job.status} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setEditingJob(job)}
                className="p-2 text-[#a1a1aa] hover:text-[#111111] transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
        {jobs.length === 0 && (
          <div className="bg-white border border-[#e4e4e7] rounded-xl p-10 text-center">
            <FileText className="w-10 h-10 text-[#d4d4d8] mx-auto mb-3" />
            <p className="text-sm text-[#71717a]">No jobs yet. Create your first job posting.</p>
          </div>
        )}
      </div>

      {showCreateModal && (
        <JobModal onClose={() => setShowCreateModal(false)} onSuccess={() => { setShowCreateModal(false); onRefresh(); }} />
      )}
      {editingJob && (
        <JobModal job={editingJob} onClose={() => setEditingJob(null)} onSuccess={() => { setEditingJob(null); onRefresh(); }} />
      )}
    </div>
  );
};

// Job Modal (Create/Edit)
const JobModal: React.FC<{ job?: Job; onClose: () => void; onSuccess: () => void }> = ({ job, onClose, onSuccess }) => {
  const [title, setTitle] = useState(job?.title || '');
  const [description, setDescription] = useState(job?.description || '');
  const [status, setStatus] = useState<'draft' | 'active' | 'closed'>(job?.status || 'draft');
  const [skills, setSkills] = useState(job?.requirements?.skills?.join(', ') || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const data = {
        title,
        description,
        status,
        requirements: {
          skills: skills.split(',').map(s => s.trim()).filter(Boolean),
          nice_to_have: []
        }
      };
      if (job) {
        await api.updateJob(job.id, data);
      } else {
        await api.createJob(data);
      }
      onSuccess();
    } catch (error) {
      console.error('Error saving job:', error);
      alert('Failed to save job');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#e4e4e7] p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-[#111111]">{job ? 'Edit Job' : 'Create Job'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-[#111111]">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Job Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
              placeholder="e.g., Senior Backend Engineer"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3] h-32"
              placeholder="Job description..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Required Skills (comma-separated)</label>
            <input
              type="text"
              value={skills}
              onChange={e => setSkills(e.target.value)}
              className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
              placeholder="e.g., Python, FastAPI, PostgreSQL"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Status</label>
            <select
              value={status}
              onChange={e => setStatus(e.target.value as any)}
              className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-[#e4e4e7]">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="flex-1 px-4 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] disabled:opacity-50">
              {isSubmitting ? 'Saving...' : (job ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CandidatesSection: React.FC<{
  candidates: Candidate[];
  jobs: Job[];
  onSelectCandidate: (c: Candidate) => void;
  onRefresh: () => void;
}> = ({ candidates, jobs, onSelectCandidate, onRefresh }) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filterJobId, setFilterJobId] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [insightsCandidate, setInsightsCandidate] = useState<Candidate | null>(null);
  const [insightsMode, setInsightsMode] = useState<'generate' | 'view'>('view');

  const filteredCandidates = candidates.filter(c => {
    if (filterJobId && c.job_id !== filterJobId) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    return true;
  });

  const handleGenerateInsights = (candidate: Candidate) => {
    setInsightsCandidate(candidate);
    setInsightsMode('generate');
  };

  const handleViewInsights = (candidate: Candidate) => {
    setInsightsCandidate(candidate);
    setInsightsMode('view');
  };

  const handleInsightsGenerated = () => {
    // Refresh to update has_insights flag
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-[#111111]">Candidates</h2>
        <button 
          onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          Upload Resume
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterJobId}
          onChange={e => setFilterJobId(e.target.value)}
          className="px-4 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
        >
          <option value="">All Jobs</option>
          {jobs.map(job => (
            <option key={job.id} value={job.id}>{job.title}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
        >
          <option value="">All Status</option>
          <option value="applied">Applied</option>
          <option value="screening">Screening</option>
          <option value="interview_round_1">Interview Round 1</option>
          <option value="interview_round_2">Interview Round 2</option>
          <option value="offer">Offer</option>
          <option value="hired">Hired</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Candidates Card Grid */}
      {filteredCandidates.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No candidates found.</p>
          <p className="text-gray-600 text-sm mt-2">Upload resumes to add candidates.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredCandidates.map(candidate => {
            const job = jobs.find(j => j.id === candidate.job_id);
            return (
              <CandidateCard
                key={candidate.id}
                candidate={{...candidate, job_title: job?.title}}
                onClick={() => onSelectCandidate(candidate)}
                onGenerateInsights={handleGenerateInsights}
                onViewInsights={handleViewInsights}
              />
            );
          })}
        </div>
      )}

      {showUploadModal && (
        <NewUploadResumeModal 
          jobs={jobs} 
          onClose={() => setShowUploadModal(false)} 
          onSuccess={() => { setShowUploadModal(false); onRefresh(); }}
        />
      )}

      {insightsCandidate && (
        <InsightsModal
          candidate={insightsCandidate}
          onClose={() => setInsightsCandidate(null)}
          onInsightsGenerated={handleInsightsGenerated}
          mode={insightsMode}
        />
      )}
    </div>
  );
};


// Old UploadResumeModal removed - now using /components/UploadResumeModal.tsx


// Candidate Detail Modal
const CandidateDetailModal: React.FC<{ 
  candidate: Candidate; 
  jobs: Job[];
  onClose: () => void;
  onRefresh: () => void;
}> = ({ candidate: initialCandidate, jobs, onClose, onRefresh }) => {
  const [candidate, setCandidate] = useState(initialCandidate);
  const [status, setStatus] = useState(initialCandidate.status);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showResumeText, setShowResumeText] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');
  const { token } = useAuth();
  const job = jobs.find(j => j.id === candidate.job_id);

  // Fetch full candidate details including resume_text
  useEffect(() => {
    const fetchDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const fullCandidate = await api.getCandidate(initialCandidate.id);
        setCandidate(fullCandidate);
      } catch (error) {
        console.error('Error fetching candidate details:', error);
      }
      setIsLoadingDetails(false);
    };
    fetchDetails();
  }, [initialCandidate.id]);

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      await api.updateCandidateStatus(candidate.id, newStatus);
      setStatus(newStatus as any);
      onRefresh();
    } catch (error) {
      console.error('Error updating status:', error);
    }
    setIsUpdating(false);
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this candidate?')) return;
    try {
      await api.deleteCandidate(candidate.id);
      onRefresh();
      onClose();
    } catch (error) {
      console.error('Error deleting candidate:', error);
    }
  };

  const handleViewActualResume = async () => {
    // Fetch PDF with auth and open in new tab
    try {
      const resumeUrl = api.getResumeUrl(candidate.id);
      const response = await fetch(resumeUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        alert('Failed to load resume PDF');
      }
    } catch (error) {
      console.error('Error viewing resume:', error);
      alert('Failed to load resume');
    }
  };

  // Format resume text nicely
  const formatResumeText = (text: string) => {
    // Split into sections and format
    const lines = text.split('\n').filter(line => line.trim());
    return lines;
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#e4e4e7] p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-[#111111]">{candidate.name}</h3>
            <p className="text-gray-400">{job?.title || 'Unknown Job'}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-[#111111]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 bg-[#f4f4f5] rounded-lg w-fit">
          {[
            { id: 'details', label: 'Details' },
            { id: 'timeline', label: 'Timeline' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as 'details' | 'timeline')}
              data-testid={`candidate-detail-tab-${t.id}`}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'bg-[#0070f3] text-black'
                  : 'text-gray-400 hover:text-[#111111]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'timeline' ? (
          <div className="space-y-6">
            <CandidateTimeline candidateId={candidate.id} />
          </div>
        ) : (
        <div className="space-y-6">
          {/* Contact Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">Email</label>
              <p className="text-[#111111]">{candidate.email || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Phone</label>
              <p className="text-[#111111]">{candidate.phone || '-'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Applied</label>
              <p className="text-[#111111]">{new Date(candidate.applied_at).toLocaleDateString()}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <select
                value={status}
                onChange={e => handleStatusChange(e.target.value)}
                disabled={isUpdating}
                className="w-full mt-1 px-3 py-1 bg-black border border-[#e4e4e7] rounded text-white focus:outline-none focus:border-[#0070f3]"
              >
                <option value="applied">Applied</option>
                <option value="screening">Screening</option>
                <option value="interview_round_1">Interview Round 1</option>
                <option value="interview_round_2">Interview Round 2</option>
                <option value="offer">Offer</option>
                <option value="hired">Hired</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>

          {/* Skills */}
          {candidate.skills && candidate.skills.length > 0 && (
            <div>
              <label className="text-sm text-gray-500 block mb-2">Skills</label>
              <div className="flex flex-wrap gap-2">
                {candidate.skills.map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-[#eff6ff] text-[#0070f3] rounded-full text-sm"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Resume Buttons */}
          {(candidate.resume_path || candidate.resume_text) && (
            <div className="flex gap-3 flex-wrap">
              {candidate.resume_path && (
                <button
                  onClick={handleViewActualResume}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  <FileText className="w-4 h-4" />
                  View Actual Resume
                </button>
              )}
              {candidate.resume_text && (
                <button
                  onClick={() => setShowResumeText(!showResumeText)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
                >
                  <FileText className="w-4 h-4" />
                  {showResumeText ? 'Hide Resume' : 'Show Resume'}
                </button>
              )}
              {isLoadingDetails && (
                <span className="text-gray-400 text-sm flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                  Loading details...
                </span>
              )}
            </div>
          )}

          {/* Resume Text Content - Formatted */}
          {showResumeText && candidate.resume_text && (
            <div className="bg-gray-800 rounded-lg p-5 border border-[#e4e4e7]">
              <h4 className="text-lg font-semibold text-[#0070f3] mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Resume Content
              </h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {formatResumeText(candidate.resume_text).map((line, index) => {
                  // Detect section headers (all caps or ending with :)
                  const isHeader = /^[A-Z\s]+$/.test(line.trim()) || 
                                   /^[A-Z][A-Za-z\s]+:$/.test(line.trim()) ||
                                   line.trim().toUpperCase() === line.trim();
                  
                  if (isHeader && line.trim().length > 2 && line.trim().length < 50) {
                    return (
                      <h5 key={index} className="text-[#0070f3] font-semibold mt-4 mb-2 text-sm uppercase tracking-wide border-b border-[#e4e4e7] pb-1">
                        {line.trim()}
                      </h5>
                    );
                  }
                  return (
                    <p key={index} className="text-gray-300 text-sm leading-relaxed">
                      {line}
                    </p>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Actions Bar - show for any candidate not already hired/rejected */}
          {candidate.status !== 'hired' && candidate.status !== 'rejected' && (
            <div className="flex gap-2 p-3 bg-gray-800 rounded-lg">
              {candidate.status !== 'offer' && (
                <>
                  <button
                    onClick={async () => {
                      try { await api.acceptCandidate(candidate.id); onRefresh(); onClose(); }
                      catch { alert('Failed to accept'); }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                  >
                    <CheckCircle className="w-4 h-4" /> Accept (Move to Offer)
                  </button>
                  <button
                    onClick={async () => {
                      const reason = prompt('Reason for rejection (optional):');
                      try { await api.rejectCandidate(candidate.id, reason || undefined); onRefresh(); onClose(); }
                      catch { alert('Failed to reject'); }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </>
              )}
              {candidate.status === 'offer' && (
                <>
                  <button
                    onClick={async () => {
                      try { await api.hireCandidate(candidate.id); onRefresh(); onClose(); }
                      catch { alert('Failed to mark as hired'); }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                  >
                    <Award className="w-4 h-4" /> Mark as Hired
                  </button>
                  <button
                    onClick={async () => {
                      const reason = prompt('Reason for rejection (optional):');
                      try { await api.rejectCandidate(candidate.id, reason || undefined); onRefresh(); onClose(); }
                      catch { alert('Failed to reject'); }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-[#e4e4e7]">
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4" />
              Delete Candidate
            </button>
            <button onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-[#e4e4e7]">
              Close
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

// Hired Section - Shows candidates with offer/hired status
const HiredSection: React.FC<{
  candidates: Candidate[];
  jobs: Job[];
  onRefresh: () => void;
}> = ({ candidates, jobs, onRefresh }) => {
  const [offerLetterCandidate, setOfferLetterCandidate] = useState<Candidate | null>(null);
  const [hiredTab, setHiredTab] = useState<'offer' | 'hired' | 'onboarded' | 'rejected'>('offer');

  const offerCandidates = candidates.filter(c => c.status === 'offer');
  const hiredCandidates = candidates.filter(c => c.status === 'hired');
  const onboardedCandidates = candidates.filter(c => c.status === 'onboarded');
  const rejectedCandidates = candidates.filter(c => c.status === 'rejected');

  const displayCandidates =
    hiredTab === 'offer' ? offerCandidates :
    hiredTab === 'hired' ? hiredCandidates :
    hiredTab === 'onboarded' ? onboardedCandidates :
    rejectedCandidates;

  const handleAccept = async (candidate: Candidate) => {
    try {
      await api.acceptCandidate(candidate.id);
      onRefresh();
    } catch (error: any) {
      alert(`Failed: ${error.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleHire = async (candidate: Candidate) => {
    try {
      await api.hireCandidate(candidate.id);
      onRefresh();
    } catch (error: any) {
      alert(`Failed: ${error.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleReject = async (candidate: Candidate) => {
    const reason = prompt('Reason for rejection (optional):');
    try {
      await api.rejectCandidate(candidate.id, reason || undefined);
      onRefresh();
    } catch (error: any) {
      alert(`Failed: ${error.response?.data?.detail || 'Unknown error'}`);
    }
  };

  return (
    <div className="space-y-6" data-testid="hired-section">
      <h2 className="text-2xl font-bold text-[#111111]">Hired / Offers</h2>

      {/* Sub tabs */}
      <div className="flex gap-2 p-1 bg-[#fafafa] rounded-lg w-fit">
        {[
          { id: 'offer', label: `Offers (${offerCandidates.length})`, color: 'purple' },
          { id: 'hired', label: `Hired (${hiredCandidates.length})`, color: 'green' },
          { id: 'onboarded', label: `Onboarded (${onboardedCandidates.length})`, color: 'emerald' },
          { id: 'rejected', label: `Rejected (${rejectedCandidates.length})`, color: 'red' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setHiredTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              hiredTab === tab.id ? 'bg-[#0070f3] text-white' : 'text-gray-400 hover:text-[#111111] hover:bg-[#f4f4f5]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Pipeline candidates that can be accepted/rejected */}
      {hiredTab === 'offer' && (
        <div className="glass-card p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-400 mb-3">Quick Actions - Active Candidates</h3>
          <div className="space-y-2">
            {candidates
              .filter(c => c.status !== 'offer' && c.status !== 'hired' && c.status !== 'rejected')
              .map(candidate => {
                const job = jobs.find(j => j.id === candidate.job_id);
                return (
                  <div key={candidate.id} className="flex items-center justify-between p-3 bg-[#f4f4f5] rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <User className="w-4 h-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-[#111111] text-sm font-medium">{candidate.name}</p>
                        <p className="text-gray-500 text-xs">{job?.title} - <StatusBadge status={candidate.status} /></p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(candidate)}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs flex items-center gap-1"
                        data-testid={`accept-candidate-${candidate.id}`}
                      >
                        <CheckCircle className="w-3 h-3" /> Accept
                      </button>
                      <button
                        onClick={() => handleReject(candidate)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs flex items-center gap-1"
                        data-testid={`reject-candidate-${candidate.id}`}
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            {candidates.filter(c => c.status !== 'offer' && c.status !== 'hired' && c.status !== 'rejected').length === 0 && (
              <p className="text-gray-500 text-sm text-center py-2">No active candidates to act on.</p>
            )}
          </div>
        </div>
      )}

      {/* Display candidates */}
      <div className="space-y-3">
        {displayCandidates.map(candidate => {
          const job = jobs.find(j => j.id === candidate.job_id);
          return (
            <div key={candidate.id} className="glass-card p-5 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#eff6ff] flex items-center justify-center">
                  <User className="w-6 h-6 text-[#0070f3]" />
                </div>
                <div>
                  <p className="text-[#111111] font-semibold">{candidate.name}</p>
                  <p className="text-gray-400 text-sm">{job?.title || 'Unknown Job'}</p>
                  <p className="text-gray-500 text-xs">{candidate.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={candidate.status} />
                {candidate.status === 'offer' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setOfferLetterCandidate(candidate)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg text-sm"
                      data-testid={`send-offer-${candidate.id}`}
                    >
                      <Send className="w-4 h-4" />
                      Send Offer Letter
                    </button>
                    <button
                      onClick={() => handleHire(candidate)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
                      data-testid={`hire-candidate-${candidate.id}`}
                    >
                      <Award className="w-4 h-4" />
                      Mark as Hired
                    </button>
                  </div>
                )}
                {candidate.status === 'hired' && (
                  <span className="text-green-400 text-sm font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Hired
                  </span>
                )}
                {candidate.status === 'onboarded' && (
                  <span className="text-emerald-400 text-sm font-medium flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Successfully Onboarded
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {displayCandidates.length === 0 && (
          <div className="glass-card p-8 text-center">
            <Award className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No candidates in this category yet.</p>
          </div>
        )}
      </div>

      {offerLetterCandidate && (
        <OfferLetterModal
          candidate={offerLetterCandidate}
          job={jobs.find(j => j.id === offerLetterCandidate.job_id)}
          onClose={() => setOfferLetterCandidate(null)}
          onSent={() => { setOfferLetterCandidate(null); onRefresh(); }}
        />
      )}
    </div>
  );
};

// Talent Memory Section
const TalentMemorySection: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<'search' | 'reengagement'>('search');

  return (
    <div className="space-y-6" data-testid="talent-memory-section">
      <h2 className="text-2xl font-bold text-[#111111]">Talent Memory</h2>

      <div className="flex gap-2 p-1 bg-[#fafafa] rounded-lg w-fit">
        <button
          onClick={() => setActiveSubTab('search')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSubTab === 'search' ? 'bg-[#0070f3] text-white' : 'text-gray-400 hover:text-[#111111] hover:bg-[#f4f4f5]'
          }`}
        >
          <Search className="w-4 h-4" />
          Search Talent
        </button>
        <button
          onClick={() => setActiveSubTab('reengagement')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeSubTab === 'reengagement' ? 'bg-[#0070f3] text-white' : 'text-gray-400 hover:text-[#111111] hover:bg-[#f4f4f5]'
          }`}
        >
          <Users className="w-4 h-4" />
          Re-engagement
        </button>
      </div>

      <div>
        {activeSubTab === 'search' && <TalentSearch />}
        {activeSubTab === 'reengagement' && <ReengagementList />}
      </div>
    </div>
  );
};

// Status Badge Component
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'active':
      case 'hired':
        return 'bg-green-500/20 text-green-400';
      case 'applied':
      case 'draft':
        return 'bg-gray-500/20 text-gray-400';
      case 'screening':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'interview_round_1':
      case 'interview_round_2':
        return 'bg-blue-500/20 text-blue-400';
      case 'offer':
        return 'bg-purple-500/20 text-purple-400';
      case 'rejected':
      case 'closed':
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

export default HRDashboard;
