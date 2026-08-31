import React, { useState } from 'react';
import { X, Sparkles, Send } from 'lucide-react';
import { api } from '../apiService';

interface ReengagementEmailComposerProps {
  candidateId: string;
  candidateName: string;
  candidateEmail?: string;
  onClose: () => void;
  onSent?: () => void;
}

export const ReengagementEmailComposer: React.FC<ReengagementEmailComposerProps> = ({
  candidateName,
  candidateEmail,
  onClose,
  onSent,
}) => {
  const [subject, setSubject] = useState(`New Opportunity at [Company Name]`);
  const [body, setBody] = useState(
    `Hi ${candidateName},\n\nI hope this message finds you well. We were impressed by your interview performance with us previously, and I wanted to reach out regarding a new opportunity that has opened up.\n\nWe believe your skills and experience would be a great fit for this role. Would you be interested in discussing this further?\n\nBest regards,\n[Your Name]`
  );
  const [isSending, setIsSending] = useState(false);
  const [isImproving, setIsImproving] = useState(false);

  const handleImprove = async () => {
    if (!body.trim()) {
      alert('Please write some content first');
      return;
    }

    setIsImproving(true);
    try {
      // Use the AI content improvement endpoint
      const improved = await api.improveEmailContent(body);
      setBody(improved.improved_content);
    } catch (error: any) {
      console.error('Failed to improve content:', error);
      alert(`Failed to improve content: ${error.response?.data?.detail || 'Unknown error'}`);
    }
    setIsImproving(false);
  };

  const handleSend = async () => {
    if (!candidateEmail) {
      alert('Candidate has no email address');
      return;
    }

    if (!subject.trim() || !body.trim()) {
      alert('Please fill in both subject and body');
      return;
    }

    setIsSending(true);
    try {
      // Send email via the communications API
      await api.sendCustomEmail({
        to_email: candidateEmail,
        to_name: candidateName,
        subject: subject,
        body: body,
      });

      alert('✅ Re-engagement email sent successfully!');
      onSent?.();
      onClose();
    } catch (error: any) {
      console.error('Failed to send email:', error);
      alert(`Failed to send email: ${error.response?.data?.detail || 'Unknown error'}`);
    }
    setIsSending(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      data-testid="reengagement-email-composer"
    >
      <div
        className="bg-zinc-950 border border-[#f4f4f5] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#f4f4f5] flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-zinc-100">Compose Re-engagement Email</h2>
            <p className="text-sm text-zinc-500 mt-1">
              To: {candidateName} {candidateEmail && `(${candidateEmail})`}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-[#111111]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-900/60 border border-[#f4f4f5] rounded-lg text-zinc-100 focus:outline-none focus:border-[#0070f3]/40"
              placeholder="Email subject"
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-zinc-300">
                Message
              </label>
              <button
                onClick={handleImprove}
                disabled={isImproving}
                className="px-3 py-1 text-xs bg-purple-500/20 text-purple-300 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
              >
                <Sparkles className="w-3 h-3" />
                {isImproving ? 'Improving...' : 'AI Improve'}
              </button>
            </div>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 bg-zinc-900/60 border border-[#f4f4f5] rounded-lg text-zinc-100 focus:outline-none focus:border-[#0070f3]/40 font-mono text-sm"
              placeholder="Write your re-engagement message here..."
            />
            <p className="text-xs text-zinc-500 mt-2">
              Tip: Be warm and specific about why you're reaching out. Mention what impressed you about their previous interview.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#f4f4f5] flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-400 hover:text-[#111111] transition-colors"
          >
            Cancel
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleSend}
              disabled={isSending || !candidateEmail}
              className="px-5 py-2 bg-[#0070f3] text-black font-medium rounded-lg hover:bg-orange-400 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
