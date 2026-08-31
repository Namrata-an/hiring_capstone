import { useState, useEffect } from 'react';
import { FileText, Calendar, CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { api } from '../apiService';
import { OfferLetterComposer } from './OfferLetterComposer';
import { NoticePeriodTracker } from './NoticePeriodTracker';

interface HiredCandidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  job_title?: string;
  status: string; // 'hired' or 'onboarded'
  has_offer_letter: boolean;
  offer_letter_status?: string;
  has_notice_period: boolean;
  notice_period_end_date?: string;
}

export const HiredCandidatesTab = () => {
  const [candidates, setCandidates] = useState<HiredCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<HiredCandidate | null>(null);
  const [view, setView] = useState<'list' | 'offer' | 'notice'>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchHiredCandidates();
  }, []);

  const fetchHiredCandidates = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getHiredCandidates();
      setCandidates(data);
    } catch (err) {
      console.error('Error fetching hired candidates:', err);
      setError('Failed to load hired candidates');
    }
    setIsLoading(false);
  };

  const handleMarkOnboarded = async (candidateId: string, candidateName: string) => {
    if (!confirm(`Mark ${candidateName} as successfully onboarded?`)) return;

    setActionLoading(candidateId);
    try {
      await api.markCandidateOnboarded(candidateId);
      alert(`${candidateName} has been marked as onboarded!`);
      fetchHiredCandidates();
    } catch (err) {
      console.error('Error marking onboarded:', err);
      alert('Failed to mark candidate as onboarded');
    }
    setActionLoading(null);
  };

  const handleMarkOfferRejected = async (candidateId: string, candidateName: string) => {
    const reason = prompt(`Why did ${candidateName} reject the offer?`);
    if (reason === null) return;

    setActionLoading(candidateId);
    try {
      const formData = new FormData();
      if (reason) formData.append('reason', reason);

      await api.markOfferRejected(candidateId, formData);
      alert(`${candidateName} has been marked as offer rejected`);
      fetchHiredCandidates();
    } catch (err) {
      console.error('Error marking offer rejected:', err);
      alert('Failed to mark offer as rejected');
    }
    setActionLoading(null);
  };

  const handleOpenOfferLetter = (candidate: HiredCandidate) => {
    setSelectedCandidate(candidate);
    setView('offer');
  };

  const handleOpenNoticePeriod = (candidate: HiredCandidate) => {
    setSelectedCandidate(candidate);
    setView('notice');
  };

  const handleBack = () => {
    setView('list');
    setSelectedCandidate(null);
    fetchHiredCandidates();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#0070f3] animate-spin" />
      </div>
    );
  }

  if (view === 'offer' && selectedCandidate) {
    return <OfferLetterComposer candidate={selectedCandidate} onBack={handleBack} />;
  }

  if (view === 'notice' && selectedCandidate) {
    return <NoticePeriodTracker candidate={selectedCandidate} onBack={handleBack} />;
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg border border-red-500/30">
          {error}
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No hired candidates yet</p>
          <p className="text-gray-600 text-sm mt-2">
            Candidates marked as hired will appear here
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {candidates.map((candidate) => (
            <div
              key={candidate.id}
              className="glass-card p-6 hover:border-[#0070f3]/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-[#111111]">{candidate.name}</h3>
                  <p className="text-gray-400 mt-1">{candidate.job_title}</p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                    <span>{candidate.email}</span>
                    {candidate.phone && <span>{candidate.phone}</span>}
                  </div>

                  {/* Status indicators */}
                  <div className="flex items-center gap-3 mt-4">
                    {/* Main Status Badge */}
                    <span className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border ${
                      candidate.status === 'onboarded'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                    }`}>
                      <CheckCircle className="w-3 h-3" />
                      {candidate.status === 'onboarded' ? 'Onboarded' : 'Hired'}
                    </span>

                    {candidate.has_offer_letter ? (
                      <span className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs border border-green-500/30">
                        <CheckCircle className="w-3 h-3" />
                        Offer {candidate.offer_letter_status}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 px-3 py-1 bg-yellow-500/20 text-yellow-400 rounded-full text-xs border border-yellow-500/30">
                        <FileText className="w-3 h-3" />
                        No offer letter
                      </span>
                    )}
                    {candidate.has_notice_period && (
                      <span className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs border border-blue-500/30">
                        <Calendar className="w-3 h-3" />
                        Notice period tracked
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 ml-4">
                  {candidate.status === 'onboarded' ? (
                    // Show completion message for onboarded candidates
                    <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                      <p className="text-emerald-400 text-sm font-medium flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Successfully Onboarded
                      </p>
                      <p className="text-emerald-400/70 text-xs mt-1">Process complete</p>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => handleOpenOfferLetter(candidate)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        <FileText className="w-4 h-4" />
                        {candidate.has_offer_letter ? 'View Offer' : 'Create Offer'}
                      </button>

                      {candidate.has_offer_letter && candidate.offer_letter_status === 'sent' && (
                        <button
                          onClick={() => handleOpenNoticePeriod(candidate)}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          <Calendar className="w-4 h-4" />
                          {candidate.has_notice_period ? 'View Schedule' : 'Set Notice Period'}
                        </button>
                      )}

                      {candidate.has_notice_period && (
                        <>
                          <button
                            onClick={() => handleMarkOnboarded(candidate.id, candidate.name)}
                            disabled={actionLoading === candidate.id}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-green-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {actionLoading === candidate.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Mark Onboarded
                              </>
                            )}
                          </button>

                          <button
                            onClick={() => handleMarkOfferRejected(candidate.id, candidate.name)}
                            disabled={actionLoading === candidate.id}
                            className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                          >
                            {actionLoading === candidate.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <XCircle className="w-4 h-4" />
                                Offer Rejected
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
