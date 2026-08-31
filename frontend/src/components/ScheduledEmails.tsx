import { useState, useEffect } from 'react';
import { Clock, Calendar, Send, X, User, Mail, CheckCircle } from 'lucide-react';
import { api } from '../apiService';
import type { ScheduledEmail } from '../apiService';

export const ScheduledEmails = () => {
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('pending');

  const fetchScheduledEmails = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await api.getScheduledEmails();
      setScheduledEmails(data);
    } catch (err) {
      console.error('Error fetching scheduled emails:', err);
      setError('Failed to load scheduled emails');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchScheduledEmails();
  }, []);

  const handleCancel = async (id: number) => {
    if (!confirm('Are you sure you want to cancel this scheduled email?')) return;
    try {
      await api.cancelScheduledEmail(id);
      fetchScheduledEmails();
    } catch (err) {
      console.error('Error cancelling email:', err);
      alert('Failed to cancel scheduled email');
    }
  };

  const handleSendNow = async (id: number) => {
    if (!confirm('Send this email now?')) return;
    try {
      await api.sendScheduledEmailNow(id);
      fetchScheduledEmails();
    } catch (err) {
      console.error('Error sending email:', err);
      alert('Failed to send email');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getTimeUntil = (dateString: string) => {
    const now = new Date();
    const scheduled = new Date(dateString);
    const diffMs = scheduled.getTime() - now.getTime();
    
    if (diffMs < 0) return 'Overdue';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `In ${diffDays} day${diffDays > 1 ? 's' : ''}`;
    if (diffHours > 0) return `In ${diffHours} hour${diffHours > 1 ? 's' : ''}`;
    
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `In ${diffMinutes} minute${diffMinutes > 1 ? 's' : ''}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"><Clock className="w-3 h-3" /> Pending</span>;
      case 'sent':
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400 border border-green-500/30"><CheckCircle className="w-3 h-3" /> Sent</span>;
      case 'cancelled':
        return <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400 border border-red-500/30"><X className="w-3 h-3" /> Cancelled</span>;
      default:
        return null;
    }
  };

  const filteredEmails = scheduledEmails.filter(e => {
    if (filterStatus && e.status !== filterStatus) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="scheduled-emails-list">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Clock className="w-6 h-6 text-[#0070f3]" />
          <h2 className="text-xl font-bold text-[#111111]">Scheduled Emails</h2>
          <span className="text-sm text-gray-400">({scheduledEmails.filter(e => e.status === 'pending').length} pending)</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg border border-red-500/30">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-4 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Scheduled Emails List */}
      {filteredEmails.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No scheduled emails</p>
          <p className="text-gray-600 text-sm mt-2">Schedule an email to send it at a specific time</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredEmails.map((email) => (
            <div key={email.id} className="glass-card p-4" data-testid="scheduled-email">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusBadge(email.status)}
                    {email.status === 'pending' && (
                      <span className="text-sm text-[#0070f3] font-medium">
                        {getTimeUntil(email.scheduled_for)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex items-center gap-2 text-[#111111]">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{email.candidate_name || `Candidate #${email.candidate_id}`}</span>
                    </div>
                    {email.candidate_email && (
                      <div className="flex items-center gap-2 text-gray-400 text-sm">
                        <Mail className="w-4 h-4" />
                        <span>{email.candidate_email}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    <span className="text-gray-500">Template:</span> {email.template_name || `Template #${email.template_id}`}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    Scheduled for: {formatDate(email.scheduled_for)}
                  </p>
                </div>
                
                {email.status === 'pending' && (
                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => handleSendNow(email.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-colors"
                      title="Send Now"
                    >
                      <Send className="w-4 h-4" />
                      Send Now
                    </button>
                    <button
                      onClick={() => handleCancel(email.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors"
                      title="Cancel"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
