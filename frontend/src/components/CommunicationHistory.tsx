import { useState, useEffect } from 'react';
import { History, Mail, CheckCircle, Send, Eye, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../apiService';
import type { CommunicationLog } from '../apiService';

interface CommunicationHistoryProps {
  candidateId?: number | null;
  showAll?: boolean;
}

export const CommunicationHistory = ({ candidateId, showAll = false }: CommunicationHistoryProps) => {
  const [communications, setCommunications] = useState<CommunicationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' });

  const fetchCommunications = async () => {
    setIsLoading(true);
    setError('');
    try {
      let data: CommunicationLog[];
      if (candidateId) {
        data = await api.getCandidateCommunications(candidateId);
      } else {
        data = await api.getAllCommunications();
      }
      setCommunications(data);
    } catch (err) {
      console.error('Error fetching communications:', err);
      setError('Failed to load communication history');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCommunications();
  }, [candidateId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Send className="w-4 h-4 text-blue-400" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'opened':
        return <Eye className="w-4 h-4 text-purple-400" />;
      case 'clicked':
        return <CheckCircle className="w-4 h-4 text-[#0070f3]" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'delivered':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'opened':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'clicked':
        return 'bg-[#eff6ff] text-[#0070f3] border-[#0070f3]/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const filteredCommunications = communications.filter(c => {
    if (filterStatus && c.status !== filterStatus) return false;
    if (dateRange.from && new Date(c.sent_at) < new Date(dateRange.from)) return false;
    if (dateRange.to && new Date(c.sent_at) > new Date(dateRange.to + 'T23:59:59')) return false;
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
    <div className="space-y-6" data-testid="communication-history">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-[#0070f3]" />
          <h2 className="text-xl font-bold text-[#111111]">Communication History</h2>
          <span className="text-sm text-gray-400">({communications.length} emails)</span>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 text-red-400 px-4 py-3 rounded-lg border border-red-500/30">
          {error}
        </div>
      )}

      {/* Filters */}
      {showAll && (
        <div className="flex gap-4 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
          >
            <option value="">All Status</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="opened">Opened</option>
            <option value="clicked">Clicked</option>
            <option value="failed">Failed</option>
          </select>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
            className="px-4 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
            placeholder="From date"
          />
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
            className="px-4 py-2 bg-gray-900 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
            placeholder="To date"
          />
        </div>
      )}

      {/* Timeline */}
      {filteredCommunications.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Mail className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No communications found</p>
          <p className="text-gray-600 text-sm mt-2">Sent emails will appear here</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-gray-800"></div>
          
          <div className="space-y-4">
            {filteredCommunications.map((comm) => (
              <div key={comm.id} className="relative pl-10">
                {/* Timeline dot */}
                <div className={`absolute left-2 top-4 w-4 h-4 rounded-full border-2 ${
                  comm.status === 'failed' ? 'bg-red-500 border-red-400' :
                  comm.status === 'delivered' || comm.status === 'opened' ? 'bg-green-500 border-green-400' :
                  'bg-blue-500 border-blue-400'
                }`}></div>

                <div className="glass-card p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${getStatusColor(comm.status)}`}>
                          {getStatusIcon(comm.status)}
                          {comm.status.charAt(0).toUpperCase() + comm.status.slice(1)}
                        </span>
                        <span className="text-sm text-gray-400">{formatDate(comm.sent_at)}</span>
                        {comm.template_name && (
                          <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
                            {comm.template_name}
                          </span>
                        )}
                      </div>
                      <h4 className="text-[#111111] font-medium truncate">{comm.subject}</h4>
                      <p className="text-sm text-gray-400 mt-1">To: {comm.recipient_email}</p>
                      {showAll && comm.candidate_name && (
                        <p className="text-sm text-gray-500">Candidate: {comm.candidate_name}</p>
                      )}
                    </div>
                    <button
                      onClick={() => setExpandedId(expandedId === comm.id ? null : comm.id)}
                      className="p-2 text-gray-400 hover:text-[#111111] transition-colors"
                    >
                      {expandedId === comm.id ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>

                  {/* Expanded content */}
                  {expandedId === comm.id && (
                    <div className="mt-4 pt-4 border-t border-[#e4e4e7]">
                      <div 
                        className="bg-white text-gray-900 p-4 rounded-lg prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: comm.body }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
