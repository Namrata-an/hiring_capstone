import { useState, useEffect } from 'react';
import { Zap, Plus, Edit2, Trash2, Power, PowerOff, Clock, ArrowRight, X } from 'lucide-react';
import { api } from '../apiService';
import type { AutomationTrigger, AutomationTriggerCreate, EmailTemplate } from '../apiService';

export const AutomationTriggers = () => {
  const [triggers, setTriggers] = useState<AutomationTrigger[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState<AutomationTrigger | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      const [triggersData, templatesData] = await Promise.all([
        api.getAutomationTriggers(),
        api.getEmailTemplates(),
      ]);
      setTriggers(triggersData);
      setTemplates(templatesData);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load automation triggers');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this automation?')) return;
    try {
      await api.deleteAutomationTrigger(id);
      fetchData();
    } catch (err) {
      console.error('Error deleting trigger:', err);
      alert('Failed to delete automation');
    }
  };

  const handleToggle = async (trigger: AutomationTrigger) => {
    try {
      await api.toggleAutomationTrigger(trigger.id, !trigger.is_enabled);
      fetchData();
    } catch (err) {
      console.error('Error toggling trigger:', err);
      alert('Failed to toggle automation');
    }
  };

  const getTriggerDescription = (trigger: AutomationTrigger) => {
    switch (trigger.trigger_type) {
      case 'status_change':
        return `When status changes to "${formatStatus(trigger.trigger_condition?.to_status)}"`;
      case 'interview_scheduled':
        return 'When an interview is scheduled';
      case 'date_based':
        return `${trigger.trigger_condition?.days_after || 0} days after application`;
      default:
        return 'Unknown trigger';
    }
  };

  const formatStatus = (status?: string) => {
    if (!status) return 'Unknown';
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const formatDelay = (minutes: number) => {
    if (minutes === 0) return 'Immediately';
    if (minutes < 60) return `After ${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `After ${hours} hour${hours > 1 ? 's' : ''}`;
    const days = Math.floor(hours / 24);
    return `After ${days} day${days > 1 ? 's' : ''}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="automation-triggers">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-[#0070f3]" />
          <h2 className="text-xl font-bold text-[#111111]">Automation Rules</h2>
          <span className="text-sm text-gray-400">({triggers.filter(t => t.is_enabled).length} active)</span>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Automation
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg border border-red-500/30">
          {error}
        </div>
      )}

      {/* Triggers List */}
      {triggers.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Zap className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No automation rules yet</p>
          <p className="text-gray-600 text-sm mt-2">Create automations to send emails automatically based on triggers</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {triggers.map((trigger) => (
            <div key={trigger.id} className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-[#111111]">{trigger.name}</h3>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${
                      trigger.is_enabled
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                    }`}>
                      {trigger.is_enabled ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                      {trigger.is_enabled ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm">
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded">
                      {getTriggerDescription(trigger)}
                    </span>
                    <ArrowRight className="w-4 h-4 text-gray-500" />
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded">
                      Send "{trigger.template_name || `Template #${trigger.template_id}`}"
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatDelay(trigger.delay_minutes)}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleToggle(trigger)}
                    className={`p-2 rounded-lg transition-colors ${
                      trigger.is_enabled
                        ? 'text-green-400 hover:bg-green-500/20'
                        : 'text-gray-400 hover:bg-[#f4f4f5]'
                    }`}
                    title={trigger.is_enabled ? 'Disable' : 'Enable'}
                  >
                    {trigger.is_enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => setEditingTrigger(trigger)}
                    className="p-2 text-gray-400 hover:text-[#0070f3] transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(trigger.id)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || editingTrigger) && (
        <AutomationModal
          trigger={editingTrigger || undefined}
          templates={templates}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTrigger(null);
          }}
          onSave={() => {
            setShowCreateModal(false);
            setEditingTrigger(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

// Automation Modal Component
const AutomationModal = ({
  trigger,
  templates,
  onClose,
  onSave,
}: {
  trigger?: AutomationTrigger;
  templates: EmailTemplate[];
  onClose: () => void;
  onSave: () => void;
}) => {
  const [name, setName] = useState(trigger?.name || '');
  const [triggerType, setTriggerType] = useState<'status_change' | 'date_based' | 'interview_scheduled'>(
    trigger?.trigger_type || 'status_change'
  );
  const [triggerCondition, setTriggerCondition] = useState<Record<string, any>>(trigger?.trigger_condition || {});
  const [templateId, setTemplateId] = useState<number>(trigger?.template_id || 0);
  const [delayMinutes, setDelayMinutes] = useState(trigger?.delay_minutes || 0);
  const [isEnabled, setIsEnabled] = useState(trigger?.is_enabled ?? true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !templateId) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const data: AutomationTriggerCreate = {
        name: name.trim(),
        trigger_type: triggerType,
        trigger_condition: triggerCondition,
        template_id: templateId,
        delay_minutes: delayMinutes,
        is_enabled: isEnabled,
      };

      if (trigger) {
        await api.updateAutomationTrigger(trigger.id, data);
      } else {
        await api.createAutomationTrigger(data);
      }
      onSave();
    } catch (err) {
      console.error('Error saving automation:', err);
      alert('Failed to save automation');
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg border border-[#e4e4e7] w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[#e4e4e7]">
          <h3 className="text-xl font-bold text-[#111111]">
            {trigger ? 'Edit Automation' : 'Create Automation'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-[#111111]">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Automation Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
              placeholder="e.g., Send rejection email"
              required
            />
          </div>

          {/* Trigger Type */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Trigger Type *</label>
            <select
              value={triggerType}
              onChange={(e) => {
                setTriggerType(e.target.value as any);
                setTriggerCondition({});
              }}
              className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
            >
              <option value="status_change">Status Change</option>
              <option value="interview_scheduled">Interview Scheduled</option>
              <option value="date_based">Date Based</option>
            </select>
          </div>

          {/* Trigger Condition */}
          {triggerType === 'status_change' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">When status changes to *</label>
              <select
                value={triggerCondition.to_status || ''}
                onChange={(e) => setTriggerCondition({ to_status: e.target.value })}
                className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                required
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

          {triggerType === 'date_based' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">Days after application</label>
              <input
                type="number"
                value={triggerCondition.days_after || 0}
                onChange={(e) => setTriggerCondition({ days_after: parseInt(e.target.value) || 0 })}
                className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                min="0"
              />
            </div>
          )}

          {/* Template */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email Template *</label>
            <select
              value={templateId}
              onChange={(e) => setTemplateId(parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
              required
            >
              <option value={0}>Select template...</option>
              {templates.filter(t => t.is_active).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Delay */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">Send Delay</label>
            <select
              value={delayMinutes}
              onChange={(e) => setDelayMinutes(parseInt(e.target.value))}
              className="w-full px-4 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
            >
              <option value={0}>Immediately</option>
              <option value={15}>After 15 minutes</option>
              <option value={60}>After 1 hour</option>
              <option value={1440}>After 1 day</option>
              <option value={4320}>After 3 days</option>
              <option value={10080}>After 1 week</option>
            </select>
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="isEnabled"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-[#d4d4d8] bg-black text-[#0070f3] focus:ring-[#0070f3]"
            />
            <label htmlFor="isEnabled" className="text-sm text-gray-400">Enable this automation</label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#e4e4e7]">
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
              className="px-4 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Automation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
