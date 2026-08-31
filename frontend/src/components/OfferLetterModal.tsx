import React, { useState, useRef } from 'react';
import { X, Send, Upload, FileText, Bot, Loader2, Sparkles } from 'lucide-react';
import { api } from '../apiService';
import type { Candidate, Job } from '../apiService';

interface OfferLetterModalProps {
  candidate: Candidate;
  job?: Job;
  onClose: () => void;
  onSent: () => void;
}

export const OfferLetterModal: React.FC<OfferLetterModalProps> = ({ candidate, job, onClose, onSent }) => {
  const [activeTab, setActiveTab] = useState<'compose' | 'upload'>('compose');
  const [subject, setSubject] = useState(`Offer Letter - ${job?.title || 'Position'} at Our Company`);
  const [bodyHtml, setBodyHtml] = useState(getDefaultOfferTemplate(candidate, job));
  const [attachmentBase64, setAttachmentBase64] = useState<string | null>(null);
  const [attachmentFilename, setAttachmentFilename] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setAttachmentBase64(base64);
      setAttachmentFilename(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if (!subject.trim() || !bodyHtml.trim()) {
      alert('Please fill in subject and body');
      return;
    }

    setIsSending(true);
    try {
      await api.sendOfferLetterOld(candidate.id, {
        subject,
        body_html: bodyHtml,
        body_text: bodyHtml.replace(/<[^>]*>/g, ''),
        attachment_base64: attachmentBase64 || undefined,
        attachment_filename: attachmentFilename || undefined,
      });
      alert('Offer letter sent successfully!');
      onSent();
    } catch (error: any) {
      console.error('Error sending offer letter:', error);
      alert(`Failed to send: ${error.response?.data?.detail || 'Unknown error'}`);
    }
    setIsSending(false);
  };

  const handleAiImprove = async () => {
    if (!chatInput.trim()) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsAiLoading(true);

    try {
      const result = await api.chatImproveContent(bodyHtml, userMsg);
      setBodyHtml(result.improved_content);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Content updated based on your instructions.' }]);
    } catch (error) {
      console.error('AI improve error:', error);
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, could not process that request. Try again.' }]);
    }
    setIsAiLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#e4e4e7] w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#e4e4e7]">
          <div>
            <h3 className="text-xl font-bold text-[#111111]">Send Offer Letter</h3>
            <p className="text-gray-400 text-sm mt-1">
              To: {candidate.name} ({candidate.email || 'No email'}) - {job?.title || 'Unknown Position'}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-[#111111]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-6 pt-4">
          <button
            onClick={() => setActiveTab('compose')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'compose' ? 'bg-[#0070f3] text-white' : 'text-gray-400 hover:text-[#111111] hover:bg-[#f4f4f5]'
            }`}
          >
            <FileText className="w-4 h-4 inline mr-2" />
            Compose
          </button>
          <button
            onClick={() => setActiveTab('upload')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'upload' ? 'bg-[#0070f3] text-white' : 'text-gray-400 hover:text-[#111111] hover:bg-[#f4f4f5]'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Upload PDF
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
            />
          </div>

          {activeTab === 'compose' && (
            <>
              {/* Rich Text Editor (textarea for MVP) */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Email Body</label>
                <textarea
                  value={bodyHtml}
                  onChange={e => setBodyHtml(e.target.value)}
                  className="w-full px-4 py-3 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3] h-64 font-mono text-sm"
                  data-testid="offer-letter-body"
                />
              </div>

              {/* AI Chat Assistant */}
              <div className="bg-gray-800 rounded-lg p-4 border border-[#e4e4e7]">
                <h4 className="text-sm font-semibold text-[#0070f3] mb-3 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  AI Content Assistant
                </h4>

                {/* Chat History */}
                {chatMessages.length > 0 && (
                  <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                    {chatMessages.map((msg, i) => (
                      <div
                        key={i}
                        className={`text-sm p-2 rounded ${
                          msg.role === 'user'
                            ? 'bg-gray-700 text-white ml-8'
                            : 'bg-[#eff6ff] text-orange-300 mr-8'
                        }`}
                      >
                        {msg.content}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAiImprove()}
                    placeholder="e.g., Make it more formal, add salary details, mention benefits..."
                    className="flex-1 px-3 py-2 bg-black border border-[#d4d4d8] rounded-lg text-white text-sm focus:outline-none focus:border-[#0070f3]"
                    disabled={isAiLoading}
                    data-testid="ai-chat-input"
                  />
                  <button
                    onClick={handleAiImprove}
                    disabled={isAiLoading || !chatInput.trim()}
                    className="px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg text-sm disabled:opacity-50 flex items-center gap-2"
                  >
                    {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                    Improve
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Ask the AI to modify the offer letter content - make it more formal, add specific details, adjust tone, etc.
                </p>
              </div>
            </>
          )}

          {activeTab === 'upload' && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-[#d4d4d8] rounded-lg p-8 text-center cursor-pointer hover:border-[#0070f3] transition-colors"
              >
                <Upload className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-[#111111] font-medium">Click to upload offer letter PDF</p>
                <p className="text-gray-500 text-sm mt-1">PDF files only</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {attachmentFilename && (
                <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
                  <FileText className="w-5 h-5 text-[#0070f3]" />
                  <span className="text-[#111111] text-sm">{attachmentFilename}</span>
                  <button
                    onClick={() => { setAttachmentBase64(null); setAttachmentFilename(''); }}
                    className="ml-auto text-gray-400 hover:text-red-400"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Email body for the cover email */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Cover Email Body</label>
                <textarea
                  value={bodyHtml}
                  onChange={e => setBodyHtml(e.target.value)}
                  className="w-full px-4 py-3 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3] h-32 font-mono text-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-[#e4e4e7]">
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-[#e4e4e7]">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !candidate.email}
            className="flex items-center gap-2 px-6 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg disabled:opacity-50"
            data-testid="send-offer-button"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Offer Letter
          </button>
        </div>
      </div>
    </div>
  );
};

function getDefaultOfferTemplate(candidate: Candidate, job?: Job): string {
  return `Dear ${candidate.name},

We are pleased to extend an offer for the position of ${job?.title || '[Position]'} at our company.

After careful consideration of your qualifications, experience, and our discussions during the interview process, we believe you would be an excellent addition to our team.

Position Details:
- Title: ${job?.title || '[Position]'}
- Start Date: [Start Date]
- Compensation: [Salary/Package Details]
- Benefits: [Benefits Package]

Please review the attached offer details and let us know your decision by [Response Deadline].

We look forward to welcoming you to our team!

Best regards,
[HR Team]`;
}
