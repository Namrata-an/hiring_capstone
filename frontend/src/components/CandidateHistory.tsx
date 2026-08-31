import React, { useState, useEffect } from 'react';
import {
  X, User, Clock, Mail, Star,
  ChevronDown, ChevronUp, UserPlus, Briefcase, GraduationCap, Calendar
} from 'lucide-react';
import { api } from '../apiService';
import type { CandidateHistory as CandidateHistoryType } from '../apiService';
import { CandidateTimeline } from './CandidateTimeline';

interface CandidateHistoryProps {
  candidateId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CandidateHistoryModal: React.FC<CandidateHistoryProps> = ({ candidateId, isOpen, onClose }) => {
  const [history, setHistory] = useState<CandidateHistoryType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['timeline']));

  useEffect(() => {
    if (isOpen && candidateId) {
      fetchHistory();
    }
  }, [isOpen, candidateId]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const data = await api.getCandidateHistory(candidateId);
      setHistory(data);
    } catch (error) {
      console.error('Failed to fetch candidate history:', error);
    }
    setIsLoading(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };

  const handleReengage = async () => {
    try {
      await api.markForReengagement(candidateId);
      alert('✅ Candidate marked for re-engagement');
    } catch (error: any) {
      alert(`❌ Failed: ${error.response?.data?.detail || 'Unknown error'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" data-testid="candidate-history">
      <div className="bg-[#0a0a0a] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-[#e4e4e7] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-[#e4e4e7] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#eff6ff] flex items-center justify-center">
              <User className="w-5 h-5 text-[#0070f3]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#111111]">
                {isLoading ? 'Loading...' : history?.candidate.name || 'Candidate History'}
              </h2>
              <p className="text-sm text-gray-400">Complete interaction history</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-[#111111] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-4 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : history ? (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="glass-card p-4 text-center">
                  <p className="text-2xl font-bold text-[#0070f3]">{history.interviews.length}</p>
                  <p className="text-sm text-gray-400">Interviews</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-2xl font-bold text-yellow-500">{history.reviews.length}</p>
                  <p className="text-sm text-gray-400">Reviews</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className="text-2xl font-bold text-blue-500">
                    {history.reviews.length > 0
                      ? (history.reviews.reduce((acc, r) => acc + (r.overall_rating || 0), 0) / history.reviews.length).toFixed(1)
                      : '-'}
                  </p>
                  <p className="text-sm text-gray-400">Avg Rating</p>
                </div>
                <div className="glass-card p-4 text-center">
                  <p className={`text-2xl font-bold ${
                    history.candidate.status === 'hired' ? 'text-green-500' :
                    history.candidate.status === 'rejected' ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {history.candidate.status.replace(/_/g, ' ')}
                  </p>
                  <p className="text-sm text-gray-400">Status</p>
                </div>
              </div>

              {/* Candidate Info */}
              <div className="glass-card p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-gray-300">
                    <Mail className="w-4 h-4 text-gray-500" />
                    {history.candidate.email || 'No email'}
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Briefcase className="w-4 h-4 text-gray-500" />
                    {history.candidate.current_position || 'No position'}
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <Clock className="w-4 h-4 text-gray-500" />
                    {history.candidate.experience_years || '0'} years experience
                  </div>
                  <div className="flex items-center gap-2 text-gray-300">
                    <GraduationCap className="w-4 h-4 text-gray-500" />
                    {history.candidate.education?.[0]?.institution || 'No education info'}
                  </div>
                </div>
              </div>

              {/* Timeline Section — Phase 7 merged interview timeline */}
              <div className="glass-card overflow-hidden">
                <button
                  onClick={() => toggleSection('timeline')}
                  className="w-full p-4 flex items-center justify-between text-white hover:bg-[#f4f4f5] transition-colors"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Clock className="w-5 h-5 text-[#0070f3]" />
                    Interview Timeline
                  </span>
                  {expandedSections.has('timeline') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {expandedSections.has('timeline') && (
                  <div className="border-t border-[#e4e4e7] p-4">
                    <CandidateTimeline candidateId={candidateId} />
                  </div>
                )}
              </div>

              {/* Interviews Section */}
              <div className="glass-card overflow-hidden">
                <button
                  onClick={() => toggleSection('interviews')}
                  className="w-full p-4 flex items-center justify-between text-white hover:bg-[#f4f4f5] transition-colors"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Calendar className="w-5 h-5 text-blue-500" />
                    Interviews ({history.interviews.length})
                  </span>
                  {expandedSections.has('interviews') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {expandedSections.has('interviews') && (
                  <div className="border-t border-[#e4e4e7] p-4">
                    {history.interviews.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No interviews recorded</p>
                    ) : (
                      <div className="space-y-3">
                        {history.interviews.map(interview => (
                          <div key={interview.id} className="p-3 bg-[#fafafa] rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-[#111111] font-medium">
                                  Round {interview.round?.round_number || '?'}: {interview.round?.round_name || 'Interview'}
                                </p>
                                <p className="text-sm text-gray-400">
                                  With: {interview.interviewer_name || 'Unknown'}
                                </p>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                interview.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                interview.status === 'confirmed' ? 'bg-blue-500/20 text-blue-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>
                                {interview.status}
                              </span>
                            </div>
                            {interview.scheduled_at && (
                              <p className="text-xs text-gray-500 mt-2">
                                Scheduled: {new Date(interview.scheduled_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Reviews Section */}
              <div className="glass-card overflow-hidden">
                <button
                  onClick={() => toggleSection('reviews')}
                  className="w-full p-4 flex items-center justify-between text-white hover:bg-[#f4f4f5] transition-colors"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Reviews ({history.reviews.length})
                  </span>
                  {expandedSections.has('reviews') ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                </button>
                {expandedSections.has('reviews') && (
                  <div className="border-t border-[#e4e4e7] p-4">
                    {history.reviews.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">No reviews submitted</p>
                    ) : (
                      <div className="space-y-4">
                        {history.reviews.map(review => (
                          <div key={review.id} className="p-4 bg-[#fafafa] rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                {[1, 2, 3, 4, 5].map(star => (
                                  <Star
                                    key={star}
                                    className={`w-4 h-4 ${
                                      star <= (review.overall_rating || 0) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-600'
                                    }`}
                                  />
                                ))}
                                <span className="text-gray-400 text-sm ml-2">
                                  {review.overall_rating || 0}/5
                                </span>
                              </div>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                review.recommendation === 'strong_yes' ? 'bg-emerald-600 text-white' :
                                review.recommendation === 'yes' ? 'bg-green-500/30 text-green-300' :
                                review.recommendation === 'maybe' ? 'bg-yellow-500/30 text-yellow-200' :
                                review.recommendation === 'no' ? 'bg-red-500/30 text-red-200' :
                                'bg-red-700 text-white'
                              }`}>
                                {review.recommendation?.replace(/_/g, ' ') || 'No recommendation'}
                              </span>
                            </div>
                            {review.strengths && (
                              <div className="mb-2">
                                <p className="text-xs text-green-400 uppercase tracking-wide">Strengths</p>
                                <p className="text-gray-300 text-sm">{review.strengths}</p>
                              </div>
                            )}
                            {review.areas_for_improvement && (
                              <div>
                                <p className="text-xs text-yellow-400 uppercase tracking-wide">Areas for Improvement</p>
                                <p className="text-gray-300 text-sm">{review.areas_for_improvement}</p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400">Failed to load candidate history</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {history && history.candidate.status === 'rejected' && (
          <div className="p-4 border-t border-[#e4e4e7] flex justify-end gap-3 flex-shrink-0">
            <button onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-[#e4e4e7] transition-colors">
              Close
            </button>
            <button
              onClick={handleReengage}
              className="px-4 py-2 bg-[#0070f3] text-black font-medium rounded-lg hover:bg-orange-400 transition-colors flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Re-engage Candidate
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
