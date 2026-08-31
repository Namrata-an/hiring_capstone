import { useState } from 'react';
import { Mail, UserCheck, UserX } from 'lucide-react';
import { HiredCandidatesTab } from './HiredCandidatesTab';
import { RejectedCandidatesTab } from './RejectedCandidatesTab';

export const CommunicationsTab = () => {
  const [activeTab, setActiveTab] = useState<'hired' | 'rejected'>('hired');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Mail className="w-6 h-6 text-[#0070f3]" />
          <h2 className="text-2xl font-bold text-[#111111]">HR Communications</h2>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[#e4e4e7]">
        <button
          onClick={() => setActiveTab('hired')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'hired'
              ? 'text-green-400 border-green-400'
              : 'text-gray-500 border-transparent hover:text-[#374151]'
          }`}
        >
          <UserCheck className="w-5 h-5" />
          Hired Candidates
        </button>
        <button
          onClick={() => setActiveTab('rejected')}
          className={`flex items-center gap-2 px-6 py-3 font-semibold transition-colors border-b-2 ${
            activeTab === 'rejected'
              ? 'text-red-400 border-red-400'
              : 'text-gray-500 border-transparent hover:text-[#374151]'
          }`}
        >
          <UserX className="w-5 h-5" />
          Rejected Candidates
        </button>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'hired' ? <HiredCandidatesTab /> : <RejectedCandidatesTab />}
      </div>
    </div>
  );
};
