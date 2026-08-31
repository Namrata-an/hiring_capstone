import { useState, useEffect } from 'react';
import { Send, Mail, MessageSquare, Loader2, CheckCircle } from 'lucide-react';
import { api } from '../apiService';

interface RejectedCandidate {
  id: string;
  name: string;
  email: string;
  phone?: string;
  job_title?: string;
  rejection_email_sent: boolean;
  updated_at: string;
}

export const RejectedCandidatesTab = () => {
  const [candidates, setCandidates] = useState<RejectedCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<RejectedCandidate | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchRejectedCandidates();
  }, []);

  const fetchRejectedCandidates = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getRejectedCandidates();
      setCandidates(data);
    } catch (err) {
      console.error('Error fetching rejected candidates:', err);
      setError('Failed to load rejected candidates');
    }
    setIsLoading(false);
  };

  const handleSelectCandidate = (candidate: RejectedCandidate) => {
    setSelectedCandidate(candidate);
    setSubject(`Application Update - ${candidate.job_title || 'Position'}`);
    setBody(`<h2>Dear ${candidate.name},</h2>

<p>Thank you for taking the time to interview for the <strong>${candidate.job_title || '[Position]'}</strong> position at our company. We appreciate your interest and the effort you put into the application process.</p>

<p>After careful consideration, we have decided to move forward with other candidates whose experience more closely matches our current needs. This was not an easy decision, as we were impressed by your background and qualifications.</p>

<h3>Next Steps:</h3>
<ul>
  <li>We will keep your resume on file for future opportunities</li>
  <li>Feel free to apply again for positions that match your skills</li>
  <li>Connect with us on LinkedIn to stay updated on new openings</li>
</ul>

<p>We wish you all the best in your job search and future career endeavors. Thank you again for your interest in joining our team.</p>

<p>Best regards,<br/>
<strong>HR Team</strong></p>`);
  };

  const handleSendRejection = async () => {
    if (!selectedCandidate) return;

    if (!confirm(`Send rejection email to ${selectedCandidate.email}?`)) return;

    setIsSending(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('candidate_id', selectedCandidate.id);
      formData.append('subject', subject);
      formData.append('body_html', body);
      formData.append('body_text', body.replace(/<[^>]*>/g, ''));

      await api.sendRejectionEmail(formData);
      alert(`Rejection email sent to ${selectedCandidate.email}`);
      setSelectedCandidate(null);
      fetchRejectedCandidates();
    } catch (err) {
      console.error('Error sending rejection:', err);
      setError('Failed to send rejection email');
    }
    setIsSending(false);
  };

  const handleAIImprove = async () => {
    if (!chatMessage.trim()) return;

    setChatLoading(true);
    try {
      const result = await api.chatImproveContent(body, chatMessage);
      setBody(result.improved_content);
      setChatMessage('');
      alert('Content improved by AI!');
    } catch (err) {
      console.error('Error improving content:', err);
      alert('Failed to improve content');
    }
    setChatLoading(false);
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
      {error && (
        <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg border border-red-500/30">
          {error}
        </div>
      )}

      {candidates.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No rejected candidates</p>
          <p className="text-gray-600 text-sm mt-2">
            Candidates marked as rejected will appear here
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {/* Candidate List */}
          <div className="col-span-1 space-y-3">
            <h3 className="text-lg font-semibold text-[#111111]">Rejected Candidates</h3>
            {candidates.map((candidate) => (
              <button
                key={candidate.id}
                onClick={() => handleSelectCandidate(candidate)}
                className={`w-full text-left glass-card p-4 hover:border-[#0070f3]/50 transition-colors ${
                  selectedCandidate?.id === candidate.id ? 'border-[#0070f3]' : ''
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[#111111] font-medium truncate">{candidate.name}</h4>
                    <p className="text-sm text-gray-400 truncate mt-1">{candidate.job_title}</p>
                    <p className="text-xs text-gray-500 mt-1">{candidate.email}</p>
                  </div>
                  {candidate.rejection_email_sent && (
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 ml-2" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Email Composer */}
          {selectedCandidate ? (
            <div className="col-span-2 space-y-4">
              <div className="glass-card p-6">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Rejection Email - {selectedCandidate.name}
                </h3>

                <div className="space-y-4">
                  {/* Subject */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                      placeholder="Email subject"
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Email Body
                    </label>
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={16}
                      className="w-full px-4 py-3 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3] font-mono text-sm"
                      placeholder="Email body (HTML supported)"
                    />
                  </div>

                  {/* AI Chat */}
                  <div className="glass-card p-4 bg-[#fafafa]">
                    <div className="flex items-center gap-2 text-[#0070f3] font-medium mb-3">
                      <MessageSquare className="w-5 h-5" />
                      AI Content Assistant
                    </div>
                    <p className="text-sm text-gray-400 mb-3">
                      Ask AI to improve or modify the rejection email
                    </p>
                    <textarea
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="e.g., Make it more empathetic, add encouragement, keep it brief..."
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white text-sm focus:outline-none focus:border-[#0070f3]"
                    />
                    <button
                      onClick={handleAIImprove}
                      disabled={chatLoading || !chatMessage.trim()}
                      className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
                    >
                      {chatLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          Improve with AI
                        </>
                      )}
                    </button>
                  </div>

                  {/* Send Button */}
                  <button
                    onClick={handleSendRejection}
                    disabled={isSending || !subject || !body}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                  >
                    {isSending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Rejection Email
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="glass-card p-4 bg-blue-500/10 border-blue-500/30">
                <p className="text-sm text-blue-400">
                  <strong>Best Practice:</strong> Keep rejection emails professional, brief, and empathetic.
                  Offer constructive feedback when appropriate and leave the door open for future opportunities.
                </p>
              </div>
            </div>
          ) : (
            <div className="col-span-2 glass-card p-12 text-center">
              <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">Select a candidate to send rejection email</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
