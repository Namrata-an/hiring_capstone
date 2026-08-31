import { useState, useRef } from 'react';
import { X, Save, Eye, Code, FileText, Zap } from 'lucide-react';
import { api } from '../apiService';
import type { EmailTemplate, EmailTemplateCreate } from '../apiService';

interface TemplateEditorProps {
  template?: EmailTemplate;
  onClose: () => void;
  onSave: () => void;
}

const AVAILABLE_VARIABLES = [
  { name: 'candidate_name', description: "Candidate's full name" },
  { name: 'candidate_email', description: "Candidate's email address" },
  { name: 'job_title', description: 'Job title being applied for' },
  { name: 'company_name', description: 'Company name' },
  { name: 'interview_date', description: 'Scheduled interview date' },
  { name: 'interview_time', description: 'Scheduled interview time' },
  { name: 'interviewer_name', description: 'Name of the interviewer' },
  { name: 'portal_link', description: 'Link to candidate portal' },
  { name: 'application_status', description: 'Current application status' },
  { name: 'next_steps', description: 'Next steps in the process' },
];

export const TemplateEditor = ({ template, onClose, onSave }: TemplateEditorProps) => {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || '');
  const [bodyText, setBodyText] = useState(template?.body_text || '');
  const [triggerType, setTriggerType] = useState<string>(template?.trigger_type || 'manual');
  const [triggerCondition, setTriggerCondition] = useState<Record<string, any>>(template?.trigger_condition || {});
  const [isActive, setIsActive] = useState(template?.is_active ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'html' | 'text'>('html');
  const [showPreview, setShowPreview] = useState(false);
  const htmlInputRef = useRef<HTMLTextAreaElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const insertVariable = (varName: string) => {
    const variable = `{{${varName}}}`;
    const activeRef = activeTab === 'html' ? htmlInputRef : textInputRef;
    const setValue = activeTab === 'html' ? setBodyHtml : setBodyText;
    const currentValue = activeTab === 'html' ? bodyHtml : bodyText;

    if (activeRef.current) {
      const start = activeRef.current.selectionStart;
      const end = activeRef.current.selectionEnd;
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      setValue(newValue);
      
      setTimeout(() => {
        if (activeRef.current) {
          activeRef.current.selectionStart = activeRef.current.selectionEnd = start + variable.length;
          activeRef.current.focus();
        }
      }, 0);
    } else {
      setValue(currentValue + variable);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: EmailTemplateCreate = {
        name: name.trim(),
        subject: subject.trim(),
        body_html: bodyHtml,
        body_text: bodyText || bodyHtml.replace(/<[^>]*>/g, ''),
        trigger_type: triggerType,
        trigger_condition: triggerCondition,
        is_active: isActive,
      };

      if (template) {
        await api.updateEmailTemplate(template.id, data);
      } else {
        await api.createEmailTemplate(data);
      }
      onSave();
    } catch (err) {
      console.error('Error saving template:', err);
      alert('Failed to save template');
    }
    setIsSubmitting(false);
  };

  const renderPreview = () => {
    let preview = bodyHtml;
    AVAILABLE_VARIABLES.forEach(v => {
      const regex = new RegExp(`{{${v.name}}}`, 'g');
      preview = preview.replace(regex, `<span class="bg-[#0070f3]/30 px-1 rounded">[${v.name}]</span>`);
    });
    return preview;
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" data-testid="template-editor">
      <div className="bg-white rounded-xl shadow-lg border border-[#e4e4e7] w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#e4e4e7]">
          <h3 className="text-xl font-bold text-[#111111]">
            {template ? 'Edit Template' : 'Create Template'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-[#111111]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-4">
            <div className="grid grid-cols-3 gap-6">
              {/* Main Editor Section */}
              <div className="col-span-2 space-y-4">
                {/* Name & Status */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-400 mb-1">Template Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                      placeholder="e.g., Interview Confirmation"
                      required
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-sm text-gray-400 mb-1">Status</label>
                    <select
                      value={isActive ? 'active' : 'inactive'}
                      onChange={(e) => setIsActive(e.target.value === 'active')}
                      className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {/* Subject */}
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Subject Line *</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                    placeholder="e.g., Your interview has been scheduled - {{job_title}}"
                    required
                  />
                </div>

                {/* Body Tabs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('html')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                          activeTab === 'html'
                            ? 'bg-[#eff6ff] text-[#0070f3] border border-[#0070f3]/30'
                            : 'text-gray-400 hover:bg-[#f4f4f5]'
                        }`}
                      >
                        <Code className="w-4 h-4" />
                        HTML
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab('text')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                          activeTab === 'text'
                            ? 'bg-[#eff6ff] text-[#0070f3] border border-[#0070f3]/30'
                            : 'text-gray-400 hover:bg-[#f4f4f5]'
                        }`}
                      >
                        <FileText className="w-4 h-4" />
                        Plain Text
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPreview(!showPreview)}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                        showPreview
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'text-gray-400 hover:bg-[#f4f4f5]'
                      }`}
                    >
                      <Eye className="w-4 h-4" />
                      Preview
                    </button>
                  </div>

                  {showPreview ? (
                    <div 
                      className="w-full h-64 p-4 bg-white text-gray-900 rounded-lg overflow-y-auto prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderPreview() }}
                    />
                  ) : activeTab === 'html' ? (
                    <textarea
                      ref={htmlInputRef}
                      value={bodyHtml}
                      onChange={(e) => setBodyHtml(e.target.value)}
                      className="w-full h-64 px-4 py-3 bg-black border border-[#e4e4e7] rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[#0070f3]"
                      placeholder="<p>Dear {{candidate_name}},</p>&#10;&#10;<p>We're pleased to inform you...</p>"
                    />
                  ) : (
                    <textarea
                      ref={textInputRef}
                      value={bodyText}
                      onChange={(e) => setBodyText(e.target.value)}
                      className="w-full h-64 px-4 py-3 bg-black border border-[#e4e4e7] rounded-lg text-white font-mono text-sm focus:outline-none focus:border-[#0070f3]"
                      placeholder="Dear {{candidate_name}},&#10;&#10;We're pleased to inform you..."
                    />
                  )}
                </div>

                {/* Trigger Configuration */}
                <div className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-[#0070f3]" />
                    <h4 className="text-sm font-semibold text-[#111111]">Trigger Configuration</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-1">Trigger Type</label>
                      <select
                        value={triggerType}
                        onChange={(e) => {
                          setTriggerType(e.target.value);
                          setTriggerCondition({});
                        }}
                        className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                      >
                        <option value="manual">Manual (Send on demand)</option>
                        <option value="status_change">Status Change</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="interview_scheduled">Interview Scheduled</option>
                      </select>
                    </div>
                    
                    {triggerType === 'status_change' && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-1">When status changes to</label>
                        <select
                          value={triggerCondition.to_status || ''}
                          onChange={(e) => setTriggerCondition({ to_status: e.target.value })}
                          className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                        >
                          <option value="">Select status...</option>
                          <option value="screening">Screening</option>
                          <option value="interview_round_1">Interview Round 1</option>
                          <option value="interview_round_2">Interview Round 2</option>
                          <option value="offer">Offer</option>
                          <option value="hired">Hired</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Variable Picker Sidebar */}
              <div className="space-y-4" data-testid="variable-picker">
                <div className="glass-card p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">Available Variables</h4>
                  <p className="text-xs text-gray-400 mb-3">Click to insert at cursor position</p>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {AVAILABLE_VARIABLES.map((v) => (
                      <button
                        key={v.name}
                        type="button"
                        onClick={() => insertVariable(v.name)}
                        className="w-full text-left p-2 rounded-lg hover:bg-[#f4f4f5] transition-colors group"
                      >
                        <code className="text-[#0070f3] text-sm">{`{{${v.name}}}`}</code>
                        <p className="text-xs text-gray-500 mt-0.5 group-hover:text-gray-400">{v.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 p-4 border-t border-[#e4e4e7]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-[#e4e4e7]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
