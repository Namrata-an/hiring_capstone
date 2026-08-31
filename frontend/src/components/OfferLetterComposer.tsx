import { useState, useEffect } from 'react';
import { ArrowLeft, Send, FileText, Upload, MessageSquare, Loader2, Download } from 'lucide-react';
import { api } from '../apiService';

interface OfferLetterComposerProps {
  candidate: {
    id: string;
    name: string;
    email: string;
    job_title?: string;
  };
  onBack: () => void;
}

export const OfferLetterComposer = ({ candidate, onBack }: OfferLetterComposerProps) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [existingPdf, setExistingPdf] = useState<string | null>(null);
  const [offerId, setOfferId] = useState<string | null>(null);
  const [offerStatus, setOfferStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadExistingOffer();
  }, [candidate.id]);

  const loadExistingOffer = async () => {
    setIsLoading(true);
    try {
      const offer = await api.getCandidateOfferLetter(candidate.id);
      setSubject(offer.subject);
      setBody(offer.body_html);
      setExistingPdf(offer.pdf_filename);
      setOfferId(offer.id);
      setOfferStatus(offer.status);
    } catch (err: any) {
      if (err.response?.status !== 404) {
        console.error('Error loading offer:', err);
      }
      // Initialize with default template
      setSubject(`Offer Letter - ${candidate.job_title || 'Position'}`);
      setBody(`<h2>Dear ${candidate.name},</h2>

<p>We are delighted to offer you the position of <strong>${candidate.job_title || '[Position]'}</strong> at our company.</p>

<p>This offer letter outlines the terms and conditions of your employment:</p>

<h3>Position Details:</h3>
<ul>
  <li><strong>Job Title:</strong> ${candidate.job_title || '[Position]'}</li>
  <li><strong>Start Date:</strong> [Date]</li>
  <li><strong>Location:</strong> [Location/Remote]</li>
</ul>

<h3>Compensation & Benefits:</h3>
<ul>
  <li><strong>Annual Salary:</strong> [Amount]</li>
  <li><strong>Benefits:</strong> Health insurance, PTO, [other benefits]</li>
</ul>

<p>Please review the attached offer letter PDF for complete details. We're excited to have you join our team!</p>

<p>Best regards,<br/>
<strong>HR Team</strong></p>`);
    }
    setIsLoading(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/pdf') {
        setPdfFile(file);
      } else {
        alert('Please upload a PDF file');
      }
    }
  };

  const handleSaveDraft = async () => {
    setIsSaving(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('candidate_id', candidate.id);
      formData.append('subject', subject);
      formData.append('body_html', body);
      formData.append('body_text', body.replace(/<[^>]*>/g, ''));

      if (pdfFile) {
        formData.append('pdf_file', pdfFile);
      }

      const result = await api.createOfferLetter(formData);
      setOfferId(result.id);
      setOfferStatus(result.status);
      setExistingPdf(result.pdf_filename);
      alert('Offer letter saved as draft');
    } catch (err) {
      console.error('Error saving offer:', err);
      setError('Failed to save offer letter');
    }
    setIsSaving(false);
  };

  const handleSendOffer = async () => {
    if (!offerId) {
      await handleSaveDraft();
      return;
    }

    if (!confirm(`Send offer letter to ${candidate.email}?`)) return;

    setIsSending(true);
    setError('');
    try {
      await api.sendOfferLetter(offerId);
      alert(`Offer letter sent to ${candidate.email}!`);
      setOfferStatus('sent');
      onBack();
    } catch (err) {
      console.error('Error sending offer:', err);
      setError('Failed to send offer letter');
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

  const handleDownloadPDF = async () => {
    if (!offerId) return;

    try {
      const blob = await api.downloadOfferLetterPDF(offerId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = existingPdf || 'offer_letter.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error downloading PDF:', err);
      alert('Failed to download PDF');
    }
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-[#111111] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-[#111111]">Offer Letter</h2>
            <p className="text-gray-400 mt-1">
              {candidate.name} - {candidate.email}
            </p>
          </div>
        </div>

        {offerStatus && (
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            offerStatus === 'sent' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
            'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
          }`}>
            {offerStatus === 'sent' ? 'Sent' : 'Draft'}
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg border border-red-500/30">
          {error}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        {/* Main Editor */}
        <div className="col-span-2 space-y-4">
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
              placeholder="Offer Letter Subject"
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
              rows={20}
              className="w-full px-4 py-3 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3] font-mono text-sm"
              placeholder="Email body (HTML supported)"
            />
          </div>

          {/* PDF Upload */}
          <div className="glass-card p-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Offer Letter PDF (Attachment)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-[#e4e4e7] text-white rounded-lg cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                {pdfFile ? pdfFile.name : 'Upload PDF'}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {existingPdf && !pdfFile && (
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {existingPdf}
                </button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-[#d4d4d8] text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  Save Draft
                </>
              )}
            </button>
            <button
              onClick={handleSendOffer}
              disabled={isSending || !subject || !body}
              className="flex items-center gap-2 px-6 py-3 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg transition-colors font-medium disabled:opacity-50"
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Send Offer
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI Chat Sidebar */}
        <div className="glass-card p-4">
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="flex items-center gap-2 text-[#0070f3] font-medium mb-4"
          >
            <MessageSquare className="w-5 h-5" />
            AI Content Assistant
          </button>

          {chatOpen && (
            <div className="space-y-3">
              <p className="text-sm text-gray-400">
                Ask AI to improve or modify the offer letter content
              </p>
              <textarea
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="e.g., Make it more formal, add benefits section, improve greeting..."
                rows={4}
                className="w-full px-3 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white text-sm focus:outline-none focus:border-[#0070f3]"
              />
              <button
                onClick={handleAIImprove}
                disabled={chatLoading || !chatMessage.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
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
          )}

          <div className="mt-6 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-blue-400">
              <strong>Tip:</strong> Upload a PDF with detailed terms, and use the email body to summarize key points.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
