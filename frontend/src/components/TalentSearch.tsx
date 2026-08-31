import React, { useState, useEffect } from 'react';
import { Search, Filter, X, Users, Calendar, Star, UserPlus, History } from 'lucide-react';
import { api } from '../apiService';
import type { TalentSearchResult, TalentSearchParams, Job } from '../apiService';
import { CandidateTimeline } from './CandidateTimeline';

interface TalentSearchProps {
  onViewHistory?: (candidateId: string) => void;
}

export const TalentSearch: React.FC<TalentSearchProps> = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [minScore, setMinScore] = useState<number>(0);
  const [roundsCompleted, setRoundsCompleted] = useState<number | undefined>(undefined);

  const [results, setResults] = useState<TalentSearchResult[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<'relevance' | 'date' | 'score'>('relevance');
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  // Common skills for dropdown
  const commonSkills = ['JavaScript', 'TypeScript', 'Python', 'React', 'Node.js', 'AWS', 'Java', 'Go', 'SQL', 'Docker', 'Kubernetes'];

  useEffect(() => {
    // Fetch jobs for filter dropdown
    api.listJobs().then(res => setJobs(res.jobs)).catch(console.error);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery || selectedSkills.length > 0 || dateFrom || dateTo || selectedJobId || minScore > 0) {
        handleSearch();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedSkills, dateFrom, dateTo, selectedJobId, minScore, roundsCompleted]);

  const handleSearch = async () => {
    setIsLoading(true);
    try {
      const params: TalentSearchParams = {};
      if (searchQuery) params.query = searchQuery;
      if (selectedSkills.length > 0) params.skills = selectedSkills;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (selectedJobId) params.jobId = parseInt(selectedJobId);
      if (minScore > 0) params.minScore = minScore;
      if (roundsCompleted !== undefined) params.roundsCompleted = roundsCompleted;

      const data = await api.searchTalent(params);
      
      // Sort results
      let sorted = [...data];
      if (sortBy === 'date') {
        sorted.sort((a, b) => new Date(b.lastInteraction).getTime() - new Date(a.lastInteraction).getTime());
      } else if (sortBy === 'score') {
        sorted.sort((a, b) => b.averageScore - a.averageScore);
      }
      // relevance is default from API
      
      setResults(sorted);
    } catch (error) {
      console.error('Search failed:', error);
    }
    setIsLoading(false);
  };

  const handleMarkForReengagement = async (candidateId: string) => {
    try {
      await api.markForReengagement(candidateId);
      alert('✅ Candidate marked for re-engagement');
    } catch (error: any) {
      alert(`❌ Failed: ${error.response?.data?.detail || 'Unknown error'}`);
    }
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedSkills([]);
    setDateFrom('');
    setDateTo('');
    setSelectedJobId('');
    setMinScore(0);
    setRoundsCompleted(undefined);
    setResults([]);
  };

  const activeFilterCount = [
    selectedSkills.length > 0,
    dateFrom,
    dateTo,
    selectedJobId,
    minScore > 0,
    roundsCompleted !== undefined
  ].filter(Boolean).length;

  return (
    <div className="space-y-6" data-testid="talent-search">
      {/* Search Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#111111]">Talent Search</h2>
          <p className="text-gray-400 mt-1">Search your candidate database for re-engagement opportunities</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, skills, or keywords..."
              className="w-full pl-10 pr-4 py-3 bg-black border border-[#e4e4e7] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#0070f3]"
              data-testid="talent-search-input"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-lg flex items-center gap-2 transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'bg-[#eff6ff] text-[#0070f3] border border-[#0070f3]/50'
                : 'bg-[#f4f4f5] text-[#374151] hover:bg-[#e4e4e7]'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="px-2 py-0.5 bg-[#0070f3] text-black text-xs font-bold rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-4 py-3 bg-gray-800 border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
          >
            <option value="relevance">Sort by Relevance</option>
            <option value="date">Sort by Date</option>
            <option value="score">Sort by Score</option>
          </select>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-[#e4e4e7] space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Skills Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Skills</label>
                <div className="flex flex-wrap gap-2">
                  {commonSkills.map(skill => (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedSkills.includes(skill)
                          ? 'bg-[#0070f3] text-black font-medium'
                          : 'bg-[#f4f4f5] text-[#374151] hover:bg-[#e4e4e7]'
                      }`}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Range */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Date Range</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="flex-1 px-3 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                  />
                  <span className="text-gray-500 py-2">to</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="flex-1 px-3 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                  />
                </div>
              </div>

              {/* Job Filter */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Job Position</label>
                <select
                  value={selectedJobId}
                  onChange={e => setSelectedJobId(e.target.value)}
                  className="w-full px-3 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                >
                  <option value="">All Jobs</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>{job.title}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Min Score */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Minimum Score: {minScore > 0 ? minScore : 'Any'}
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={minScore}
                  onChange={e => setMinScore(parseInt(e.target.value))}
                  className="w-full accent-orange-500"
                />
              </div>

              {/* Rounds Completed */}
              <div>
                <label className="block text-sm text-gray-400 mb-2">Rounds Completed</label>
                <select
                  value={roundsCompleted ?? ''}
                  onChange={e => setRoundsCompleted(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-3 py-2 bg-black border border-[#e4e4e7] rounded-lg text-white focus:outline-none focus:border-[#0070f3]"
                >
                  <option value="">Any</option>
                  <option value="1">At least 1</option>
                  <option value="2">At least 2</option>
                  <option value="3">At least 3</option>
                </select>
              </div>

              {/* Clear Filters */}
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-gray-400 hover:text-[#111111] transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Active Filter Chips */}
        {activeFilterCount > 0 && !showFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {selectedSkills.map(skill => (
              <span key={skill} className="px-3 py-1 bg-[#eff6ff] text-[#0070f3] rounded-full text-sm flex items-center gap-1">
                {skill}
                <button onClick={() => toggleSkill(skill)} className="hover:text-orange-200">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {dateFrom && (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm flex items-center gap-1">
                From: {dateFrom}
                <button onClick={() => setDateFrom('')} className="hover:text-blue-200">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {dateTo && (
              <span className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm flex items-center gap-1">
                To: {dateTo}
                <button onClick={() => setDateTo('')} className="hover:text-blue-200">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedJobId && (
              <span className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-full text-sm flex items-center gap-1">
                Job: {jobs.find(j => j.id === selectedJobId)?.title}
                <button onClick={() => setSelectedJobId('')} className="hover:text-purple-200">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {minScore > 0 && (
              <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm flex items-center gap-1">
                Min Score: {minScore}
                <button onClick={() => setMinScore(0)} className="hover:text-green-200">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <div data-testid="search-results">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : results.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery || activeFilterCount > 0 ? 'No Results Found' : 'Start Your Search'}
            </h3>
            <p className="text-gray-400">
              {searchQuery || activeFilterCount > 0
                ? 'Try adjusting your filters or search terms'
                : 'Use the search bar above to find candidates in your talent pool'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">{results.length} candidates found</p>
            {results.map(result => (
              <div
                key={result.candidate.id}
                className="glass-card p-4 hover:border-[#0070f3]/50 transition-colors"
                data-testid="candidate-card"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-[#111111]">{result.candidate.name}</h3>
                      <span className="px-2 py-1 bg-[#eff6ff] text-[#0070f3] rounded-full text-xs font-medium">
                        {Math.round(result.matchScore)}% match
                      </span>
                      {result.roundsCompleted > 0 && (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">
                          {result.roundsCompleted} rounds completed
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm mb-2">{result.candidate.current_position}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Last: {new Date(result.lastInteraction).toLocaleDateString()}
                      </span>
                      {result.averageScore > 0 && (
                        <span className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-yellow-500" />
                          Avg Score: {result.averageScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                    {result.candidate.skills && result.candidate.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {result.candidate.skills.slice(0, 5).map(skill => (
                          <span key={skill} className="px-2 py-0.5 bg-[#f4f4f5] text-[#374151] rounded text-xs">
                            {skill}
                          </span>
                        ))}
                        {result.candidate.skills.length > 5 && (
                          <span className="px-2 py-0.5 bg-gray-800 text-gray-500 rounded text-xs">
                            +{result.candidate.skills.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedCandidateId(result.candidate.id)}
                      className="px-3 py-2 bg-[#f4f4f5] text-[#374151] rounded-lg hover:bg-[#e4e4e7] transition-colors flex items-center gap-1"
                    >
                      <History className="w-4 h-4" />
                      History
                    </button>
                    <button
                      onClick={() => handleMarkForReengagement(result.candidate.id)}
                      className="px-3 py-2 bg-[#eff6ff] text-[#0070f3] rounded-lg hover:bg-[#0060df]/30 transition-colors flex items-center gap-1"
                    >
                      <UserPlus className="w-4 h-4" />
                      Re-engage
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline Modal */}
      {selectedCandidateId && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCandidateId(null)}
          data-testid="timeline-modal"
        >
          <div
            className="bg-zinc-950 border border-[#f4f4f5] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-[#f4f4f5] flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-100">Candidate Timeline</h2>
              <button onClick={() => setSelectedCandidateId(null)} className="p-2 text-zinc-400 hover:text-[#111111]">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto custom-scrollbar flex-1">
              <CandidateTimeline candidateId={selectedCandidateId} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
