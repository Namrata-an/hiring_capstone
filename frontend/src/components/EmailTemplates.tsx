import { useState, useEffect } from 'react';
import { Mail, Plus, Edit2, Trash2, Copy, Eye, Search } from 'lucide-react';
import { api } from '../apiService';
import type { EmailTemplate } from '../apiService';
import { TemplateEditor } from './TemplateEditor';

interface EmailTemplatesProps {
  onSelectTemplate?: (template: EmailTemplate) => void;
}

export const EmailTemplates = (_props: EmailTemplatesProps = {}) => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTrigger, setFilterTrigger] = useState<string>('');
  const [filterActive, setFilterActive] = useState<string>('');
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);

  const fetchTemplates = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getEmailTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Failed to load templates');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await api.deleteEmailTemplate(id);
      fetchTemplates();
    } catch (err) {
      console.error('Error deleting template:', err);
      alert('Failed to delete template');
    }
  };

  const handleDuplicate = async (template: EmailTemplate) => {
    try {
      await api.createEmailTemplate({
        name: `${template.name} (Copy)`,
        subject: template.subject,
        body_html: template.body_html,
        body_text: template.body_text,
        trigger_type: template.trigger_type,
        trigger_condition: template.trigger_condition,
        is_active: false,
      });
      fetchTemplates();
    } catch (err) {
      console.error('Error duplicating template:', err);
      alert('Failed to duplicate template');
    }
  };

  const filteredTemplates = templates.filter(t => {
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !t.subject.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterTrigger && t.trigger_type !== filterTrigger) return false;
    if (filterActive === 'active' && !t.is_active) return false;
    if (filterActive === 'inactive' && t.is_active) return false;
    return true;
  });

  const triggerTypeLabel = (type?: string) => {
    const labels: Record<string, string> = {
      manual: 'Manual',
      status_change: 'Status Change',
      scheduled: 'Scheduled',
      interview_scheduled: 'Interview Scheduled',
    };
    return labels[type || ''] || 'Manual';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="templates-loading">
        <div className="w-8 h-8 border-4 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="templates-list">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-[#0070f3]" />
          <h2 className="text-xl font-bold text-[#111111]">Email Templates</h2>
          <span className="text-sm text-gray-400">({templates.length} templates)</span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg transition-colors"
          data-testid="create-template-btn"
        >
          <Plus className="w-4 h-4" />
          Create Template
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg border border-red-500/30">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
          />
        </div>
        <select
          value={filterTrigger}
          onChange={(e) => setFilterTrigger(e.target.value)}
          className="px-4 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
        >
          <option value="">All Triggers</option>
          <option value="manual">Manual</option>
          <option value="status_change">Status Change</option>
          <option value="scheduled">Scheduled</option>
          <option value="interview_scheduled">Interview Scheduled</option>
        </select>
        <select
          value={filterActive}
          onChange={(e) => setFilterActive(e.target.value)}
          className="px-4 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No templates found</p>
          <p className="text-gray-600 text-sm mt-2">Create your first email template to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredTemplates.map((template) => (
            <div
              key={template.id}
              className="glass-card p-5 flex items-center justify-between"
              data-testid={`template-${template.id}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-lg font-semibold text-white truncate">{template.name}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${
                    template.is_active 
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                      : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {template.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    {triggerTypeLabel(template.trigger_type)}
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate">{template.subject}</p>
                {template.variables && template.variables.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {template.variables.slice(0, 5).map((v, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 bg-[#eff6ff] text-[#0070f3] rounded">
                        {`{{${v}}}`}
                      </span>
                    ))}
                    {template.variables.length > 5 && (
                      <span className="text-xs text-gray-500">+{template.variables.length - 5} more</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <button
                  onClick={() => setPreviewTemplate(template)}
                  className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                  title="Preview"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingTemplate(template)}
                  className="p-2 text-gray-400 hover:text-[#0070f3] transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDuplicate(template)}
                  className="p-2 text-gray-400 hover:text-purple-400 transition-colors"
                  title="Duplicate"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingTemplate) && (
        <TemplateEditor
          template={editingTemplate || undefined}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingTemplate(null);
            fetchTemplates();
          }}
        />
      )}

      {/* Preview Modal */}
      {previewTemplate && (
        <TemplatePreviewModal
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </div>
  );
};

// Template Preview Modal
const TemplatePreviewModal = ({ template, onClose }: { template: EmailTemplate; onClose: () => void }) => {
  const [preview, setPreview] = useState<{ subject: string; body_html: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPreview = async () => {
      try {
        const data = await api.previewTemplate(template.id, {
          candidate_name: 'John Doe',
          candidate_email: 'john.doe@example.com',
          job_title: 'Software Engineer',
          company_name: 'Acme Corp',
          interview_date: 'January 15, 2025',
          interview_time: '2:00 PM',
          interviewer_name: 'Jane Smith',
          portal_link: 'https://portal.example.com',
        });
        setPreview(data);
      } catch (err) {
        setPreview({ subject: template.subject, body_html: template.body_html });
      }
      setIsLoading(false);
    };
    loadPreview();
  }, [template]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" data-testid="template-preview">
      <div className="bg-white rounded-xl shadow-lg border border-[#e4e4e7] w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#e4e4e7]">
          <h3 className="text-lg font-semibold text-[#111111]">Preview: {template.name}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-[#111111]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : preview && (
            <>
              <div className="mb-4">
                <label className="text-sm text-gray-500">Subject</label>
                <p className="text-[#111111] bg-gray-800 p-3 rounded-lg mt-1">{preview.subject}</p>
              </div>
              <div>
                <label className="text-sm text-gray-500">Body</label>
                <div 
                  className="bg-white text-gray-900 p-4 rounded-lg mt-1 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: preview.body_html }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
