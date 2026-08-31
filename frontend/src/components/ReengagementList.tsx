import React, { useState, useEffect } from 'react';
import {
  UserPlus, Mail, Briefcase, Clock, CheckCircle, MessageSquare, Filter, Star
} from 'lucide-react';
import { api } from '../apiService';
import type { Job, CloseRejectedCandidate } from '../apiService';
import { ReengagementEmailComposer } from './ReengagementEmailComposer';

interface ReengagementListProps {
  onViewHistory?: (candidateId: string) => void;
}

export const ReengagementList: React.FC<ReengagementListProps> = () => {
  const [candidates, setCandidates] = useState<CloseRejectedCandidate[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [minRating, setMinRating] = useState<number>(3.5);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [emailComposerOpen, setEmailComposerOpen] = useState<{ candidateId: string; name: string; email?: string } | null>(null);

  useEffect(() => {
    fetchData();
  }, [minRating]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [candidatesData, jobsData] = await Promise.all([
        api.getCloseRejectedCandidates(minRating, 4),
        api.listJobs()
      ]);
      setCandidates(candidatesData);
      setJobs(jobsData.jobs.filter(j => j.status === 'active'));
    } catch (error) {
      console.error('Failed to fetch re-engagement candidates:', error);
    }
    setIsLoading(false);
  };

  const handleAssignToJob = async (candidateId: string, jobId: string) => {
    try {
      await api.markForReengagement(candidateId, jobId);
      alert('✅ Candidate assigned to new job');
      fetchData();
    } catch (error: any) {
      alert(`❌ Failed: ${error.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const handleBulkContact = async () => {
    if (selectedCandidates.size === 0) {
      alert('Please select candidates to contact');
      return;
    }
    // In a real implementation, this would send bulk emails
    alert(`📧 Contact emails would be sent to ${selectedCandidates.size} candidates`);
    setSelectedCandidates(new Set());
  };

  const toggleSelectCandidate = (candidateId: string) => {
    setSelectedCandidates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(candidateId)) {
        newSet.delete(candidateId);
      } else {
        newSet.add(candidateId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedCandidates.size === candidates.length) {
      setSelectedCandidates(new Set());
    } else {
      setSelectedCandidates(new Set(candidates.map(c => c.candidate_id)));
    }
  };

  return (
    <div className="space-y-6" data-testid="reengagement-list">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#111111]">Re-engagement Candidates</h2>
          <p className="text-gray-400 mt-1">Previously rejected candidates who may be a good fit for new roles</p>
        </div>
        {selectedCandidates.size > 0 && (
          <button
            onClick={handleBulkContact}
            className="px-4 py-2 bg-[#0070f3] text-black font-medium rounded-lg hover:bg-orange-400 transition-colors flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            Contact Selected ({selectedCandidates.size})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="glass-card p-4">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-gray-400" />
          <span className="text-gray-400">Minimum average rating:</span>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="1"
              max="5"
              step="0.5"
              value={minRating}
              onChange={(e) => setMinRating(parseFloat(e.target.value))}
              className="w-32 accent-orange-500"
            />
            <span className="text-[#111111] font-medium">{minRating.toFixed(1)}+ ⭐</span>
          </div>
          <span className="text-gray-500 text-sm ml-auto">
            Showing candidates with strong interview performance
          </span>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : candidates.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <UserPlus className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Re-engagement Candidates</h3>
          <p className="text-gray-400">
            No rejected candidates found with rating {minRating}+ stars. Try lowering the minimum rating.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select All */}
          <div className="flex items-center gap-3 px-4">
            <input
              type="checkbox"
              checked={selectedCandidates.size === candidates.length && candidates.length > 0}
              onChange={toggleSelectAll}
              className="w-4 h-4 rounded border-[#d4d4d8] text-[#0070f3] focus:ring-[#0070f3] focus:ring-offset-0 bg-gray-800"
            />
            <span className="text-gray-400 text-sm">
              Select all ({candidates.length})
            </span>
          </div>

          {candidates.map(item => (
              <div
                key={item.candidate_id}
                className="glass-card p-4 hover:border-[#0070f3]/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <input
                    type="checkbox"
                    checked={selectedCandidates.has(item.candidate_id)}
                    onChange={() => toggleSelectCandidate(item.candidate_id)}
                    className="mt-1 w-4 h-4 rounded border-[#d4d4d8] text-[#0070f3] focus:ring-[#0070f3] focus:ring-offset-0 bg-gray-800"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-[#111111]">{item.name}</h3>
                      <span className="px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 bg-[#eff6ff] text-[#0070f3]">
                        <Star className="w-3 h-3 fill-current" />
                        {item.average_rating.toFixed(1)} avg · {item.highest_rating} highest
                      </span>
                      {item.already_marked_for_reengagement && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          <CheckCircle className="w-3 h-3 inline mr-1" />
                          Already marked
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-400 mb-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4" />
                        Original: {item.original_job_title}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Rounds: {item.rounds_completed}
                      </div>
                      {item.rejection_reason && (
                        <div className="col-span-2 flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          Reason: {item.rejection_reason}
                        </div>
                      )}
                    </div>

                    {/* Skills */}
                    {item.skills && item.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {item.skills.slice(0, 5).map((skill, i) => (
                          <span key={i} className="px-2 py-0.5 bg-[#f4f4f5] text-[#374151] rounded text-xs">
                            {skill}
                          </span>
                        ))}
                        {item.skills.length > 5 && (
                          <span className="text-xs text-gray-500">+{item.skills.length - 5} more</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setEmailComposerOpen({
                        candidateId: item.candidate_id,
                        name: item.name,
                        email: item.email
                      })}
                      className="px-3 py-2 bg-[#0070f3] text-black font-medium rounded-lg hover:bg-orange-400 transition-colors text-sm flex items-center gap-1"
                    >
                      <Mail className="w-4 h-4" />
                      Contact
                    </button>
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAssignToJob(item.candidate_id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                      className="px-3 py-2 bg-gray-800 border border-[#e4e4e7] rounded-lg text-gray-300 text-sm focus:outline-none focus:border-[#0070f3]"
                      defaultValue=""
                    >
                      <option value="" disabled>Assign to Job...</option>
                      {jobs.map(job => (
                        <option key={job.id} value={job.id}>{job.title}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Email Composer Modal */}
      {emailComposerOpen && (
        <ReengagementEmailComposer
          candidateId={emailComposerOpen.candidateId}
          candidateName={emailComposerOpen.name}
          candidateEmail={emailComposerOpen.email}
          onClose={() => setEmailComposerOpen(null)}
          onSent={() => {
            fetchData(); // Refresh data after sending
          }}
        />
      )}
    </div>
  );
};
