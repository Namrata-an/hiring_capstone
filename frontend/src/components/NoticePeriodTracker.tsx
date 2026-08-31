import { useState, useEffect } from 'react';
import { ArrowLeft, Calendar, Send, MessageSquare, Loader2, CheckCircle, Clock } from 'lucide-react';
import { api } from '../apiService';

interface NoticePeriodTrackerProps {
  candidate: {
    id: string;
    name: string;
    email: string;
  };
  onBack: () => void;
}

interface FollowUp {
  id: string;
  scheduled_date: string;
  follow_up_number: number;
  status: string;
  sent_at?: string;
}

export const NoticePeriodTracker = ({ candidate, onBack }: NoticePeriodTrackerProps) => {
  const [noticePeriod, setNoticePeriod] = useState<any>(null);
  const [endDate, setEndDate] = useState('');
  const [frequencyDays, setFrequencyDays] = useState(7);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUp | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadNoticePeriod();
  }, [candidate.id]);

  const loadNoticePeriod = async () => {
    setIsLoading(true);
    try {
      const data = await api.getNoticePeriod(candidate.id);
      setNoticePeriod(data);
      setEndDate(data.notice_period_end_date.split('T')[0]);
      setFrequencyDays(data.follow_up_frequency_days);
      setNotes(data.notes || '');
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Error loading notice period:', err);
      }
      // Initialize with defaults
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      setEndDate(futureDate.toISOString().split('T')[0]);
    }
    setIsLoading(false);
  };

  const handleSaveSchedule = async () => {
    if (!endDate) {
      alert('Please set notice period end date');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      const data = {
        candidate_id: candidate.id,
        notice_period_end_date: new Date(endDate).toISOString(),
        follow_up_frequency_days: frequencyDays,
        notes: notes,
      };

      const result = await api.createNoticePeriod(data);
      setNoticePeriod(result);
      alert('Notice period schedule created!');
    } catch (err) {
      console.error('Error saving schedule:', err);
      setError('Failed to save notice period schedule');
    }
    setIsSaving(false);
  };

  const handleSelectFollowUp = (followUp: FollowUp) => {
    setSelectedFollowUp(followUp);
    setEmailSubject(`Check-in #${followUp.follow_up_number} - ${candidate.name}`);
    setEmailBody(`<h2>Hi ${candidate.name},</h2>

<p>We hope you're doing well! We wanted to check in on your notice period progress.</p>

<p>This is follow-up #${followUp.follow_up_number}. We're looking forward to having you join our team soon!</p>

<h3>Next Steps:</h3>
<ul>
  <li>Confirm your last working day at your current company</li>
  <li>Let us know if you need any support during the transition</li>
  <li>Share your onboarding preferences</li>
</ul>

<p>Please reply to this email if you have any questions or concerns.</p>

<p>Best regards,<br/>
<strong>HR Team</strong></p>`);
  };

  const handleSendFollowUp = async () => {
    if (!selectedFollowUp) return;

    if (!confirm(`Send follow-up email to ${candidate.email}?`)) return;

    setSendingFollowUp(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('subject', emailSubject);
      formData.append('body_html', emailBody);
      formData.append('body_text', emailBody.replace(/<[^>]*>/g, ''));

      await api.sendFollowUpEmail(selectedFollowUp.id, formData);
      alert('Follow-up email sent!');
      setSelectedFollowUp(null);
      loadNoticePeriod();
    } catch (err) {
      console.error('Error sending follow-up:', err);
      setError('Failed to send follow-up email');
    }
    setSendingFollowUp(false);
  };

  const handleAIImprove = async () => {
    if (!chatMessage.trim()) return;

    setChatLoading(true);
    try {
      const result = await api.chatImproveContent(emailBody, chatMessage);
      setEmailBody(result.improved_content);
      setChatMessage('');
      alert('Email improved by AI!');
    } catch (err) {
      console.error('Error improving content:', err);
      alert('Failed to improve content');
    }
    setChatLoading(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getDaysUntil = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[#0070f3] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-[#111111] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-[#111111]">Notice Period Tracking</h2>
          <p className="text-gray-400 mt-1">{candidate.name} - {candidate.email}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg border border-red-500/30">
          {error}
        </div>
      )}

      {/* Setup or View Schedule */}
      {!noticePeriod ? (
        <div className="glass-card p-6 space-y-4">
          <h3 className="text-lg font-semibold text-[#111111]">Set Notice Period</h3>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Expected Join Date (Last day of notice period)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Follow-up Frequency (days)
            </label>
            <select
              value={frequencyDays}
              onChange={(e) => setFrequencyDays(parseInt(e.target.value))}
              className="w-full px-4 py-3 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
            >
              <option value={3}>Every 3 days</option>
              <option value={7}>Weekly</option>
              <option value={14}>Bi-weekly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any special notes about this candidate's notice period..."
              className="w-full px-4 py-3 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
            />
          </div>

          <button
            onClick={handleSaveSchedule}
            disabled={isSaving || !endDate}
            className="flex items-center gap-2 px-6 py-3 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg transition-colors font-medium disabled:opacity-50"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Calendar className="w-5 h-5" />
                Create Schedule
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* Follow-up Schedule */}
          <div className="col-span-2 space-y-4">
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Schedule Overview</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">Expected Join Date:</span>
                  <p className="text-[#111111] font-medium mt-1">
                    {formatDate(noticePeriod.notice_period_end_date)}
                  </p>
                  <p className="text-[#0070f3] text-xs mt-1">
                    {getDaysUntil(noticePeriod.notice_period_end_date)} days remaining
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Follow-up Frequency:</span>
                  <p className="text-[#111111] font-medium mt-1">
                    Every {noticePeriod.follow_up_frequency_days} days
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-[#111111]">Follow-up Schedule</h3>
              {noticePeriod.follow_ups.length === 0 ? (
                <div className="glass-card p-6 text-center text-gray-500">
                  No follow-ups scheduled
                </div>
              ) : (
                noticePeriod.follow_ups.map((followUp: FollowUp) => (
                  <div
                    key={followUp.id}
                    className={`glass-card p-4 flex items-center justify-between ${
                      selectedFollowUp?.id === followUp.id ? 'border-[#0070f3]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        followUp.status === 'sent' ? 'bg-green-500/20 text-green-400' :
                        followUp.status === 'pending' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {followUp.status === 'sent' ? (
                          <CheckCircle className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-[#111111] font-medium">
                          Follow-up #{followUp.follow_up_number}
                        </p>
                        <p className="text-sm text-gray-400">
                          {formatDate(followUp.scheduled_date)}
                          {followUp.sent_at && ` • Sent ${formatDate(followUp.sent_at)}`}
                        </p>
                      </div>
                    </div>
                    {followUp.status === 'pending' && (
                      <button
                        onClick={() => handleSelectFollowUp(followUp)}
                        className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        <Send className="w-4 h-4" />
                        Send Now
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Email Composer Sidebar */}
          {selectedFollowUp && (
            <div className="glass-card p-4 space-y-4">
              <h3 className="text-lg font-semibold text-[#111111]">Email Preview</h3>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white text-sm focus:outline-none focus:border-[#0070f3]"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">Body</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white text-sm font-mono focus:outline-none focus:border-[#0070f3]"
                />
              </div>

              {/* AI Chat */}
              <div className="border-t border-[#e4e4e7] pt-4">
                <label className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <MessageSquare className="w-4 h-4" />
                  AI Assistant
                </label>
                <textarea
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="e.g., Make it more warm, add urgency..."
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white text-xs focus:outline-none focus:border-[#0070f3]"
                />
                <button
                  onClick={handleAIImprove}
                  disabled={chatLoading || !chatMessage.trim()}
                  className="w-full mt-2 flex items-center justify-center gap-2 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-xs font-medium disabled:opacity-50"
                >
                  {chatLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    'Improve with AI'
                  )}
                </button>
              </div>

              <button
                onClick={handleSendFollowUp}
                disabled={sendingFollowUp}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg transition-colors font-medium disabled:opacity-50"
              >
                {sendingFollowUp ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Email
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
