import { useState, useEffect } from 'react';
import { TrendingUp, Award, Users, BarChart3, Filter, ArrowUpDown } from 'lucide-react';
import { api, type Candidate, type CandidateRankingStats, type Job } from '../apiService';
import { CandidateCard } from './CandidateCard';

interface RankedCandidatesViewProps {
    jobs: Job[];
    onCandidateClick: (candidate: Candidate) => void;
    onGenerateInsights: (candidate: Candidate) => void;
    onViewInsights: (candidate: Candidate) => void;
}

export const RankedCandidatesView = ({
    jobs,
    onCandidateClick,
    onGenerateInsights,
    onViewInsights
}: RankedCandidatesViewProps) => {
    const [selectedJobId, setSelectedJobId] = useState<string>('');
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [stats, setStats] = useState<CandidateRankingStats | null>(null);
    const [loading, setLoading] = useState(false);
    const [minScore, setMinScore] = useState<number>(0);

    // Set first job as default when jobs load
    useEffect(() => {
        if (jobs.length > 0 && !selectedJobId) {
            setSelectedJobId(jobs[0].id);
        }
    }, [jobs]);

    // Load candidates and stats when job changes
    useEffect(() => {
        if (selectedJobId) {
            loadRankedCandidates();
            loadRankingStats();
        }
    }, [selectedJobId, minScore]);

    const loadRankedCandidates = async () => {
        setLoading(true);
        try {
            const result = await api.getRankedCandidates({
                jobId: selectedJobId,
                minScore: minScore > 0 ? minScore : undefined,
                limit: 100
            });
            setCandidates(result.candidates);
        } catch (error) {
            console.error('Failed to load ranked candidates:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRankingStats = async () => {
        try {
            const statsData = await api.getRankingStats(selectedJobId);
            setStats(statsData);
        } catch (error) {
            console.error('Failed to load ranking stats:', error);
        }
    };


    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-purple-500/20 border border-[#0070f3]/30">
                        <TrendingUp className="w-6 h-6 text-[#0070f3]" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-[#111111]">Ranked Candidates</h2>
                        <p className="text-sm text-gray-400">AI-scored candidates sorted by fit</p>
                    </div>
                </div>
            </div>

            {/* Job Selector and Filters */}
            <div className="glass-card p-6 space-y-4">
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Job Selector */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-sm text-gray-400 mb-2">Select Job</label>
                        <select
                            value={selectedJobId}
                            onChange={(e) => setSelectedJobId(e.target.value)}
                            className="w-full bg-black/30 border border-[#e4e4e7] rounded-lg px-4 py-2 text-white focus:border-[#0070f3]/50 focus:outline-none"
                        >
                            {jobs.length === 0 && (
                                <option value="">No jobs available</option>
                            )}
                            {jobs.map(job => (
                                <option key={job.id} value={job.id}>
                                    {job.title} ({job.candidate_count} candidates)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Min Score Filter */}
                    <div className="min-w-[180px]">
                        <label className="block text-sm text-gray-400 mb-2 flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Minimum Score
                        </label>
                        <select
                            value={minScore}
                            onChange={(e) => setMinScore(Number(e.target.value))}
                            className="w-full bg-black/30 border border-[#e4e4e7] rounded-lg px-4 py-2 text-white focus:border-[#0070f3]/50 focus:outline-none"
                        >
                            <option value="0">All Scores</option>
                            <option value="80">80+ (Strong)</option>
                            <option value="70">70+ (Good)</option>
                            <option value="60">60+ (Average)</option>
                        </select>
                    </div>
                </div>

                {/* Statistics Dashboard */}
                {stats && stats.candidates_with_scores > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-[#e4e4e7]">
                        {/* Total Scored */}
                        <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Users className="w-4 h-4 text-blue-400" />
                                <span className="text-xs text-gray-400 uppercase tracking-wider">Scored</span>
                            </div>
                            <div className="text-2xl font-bold text-[#111111]">
                                {stats.candidates_with_scores}
                                <span className="text-sm text-gray-400 ml-1">
                                    / {stats.total_candidates}
                                </span>
                            </div>
                        </div>

                        {/* Average Score */}
                        <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <BarChart3 className="w-4 h-4 text-purple-400" />
                                <span className="text-xs text-gray-400 uppercase tracking-wider">Average</span>
                            </div>
                            <div className="text-2xl font-bold text-[#111111]">
                                {stats.average_score?.toFixed(1)}
                                <span className="text-sm text-gray-400 ml-1">/ 100</span>
                            </div>
                        </div>

                        {/* Strong Candidates (80+) */}
                        <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div className="flex items-center gap-2 mb-2">
                                <Award className="w-4 h-4 text-green-400" />
                                <span className="text-xs text-gray-400 uppercase tracking-wider">Strong (80+)</span>
                            </div>
                            <div className="text-2xl font-bold text-[#111111]">
                                {stats.candidates_above_80}
                                <span className="text-sm text-gray-400 ml-1">
                                    ({((stats.candidates_above_80 / stats.candidates_with_scores) * 100).toFixed(0)}%)
                                </span>
                            </div>
                        </div>

                        {/* Top Candidate */}
                        <div className="p-4 rounded-lg bg-[#eff6ff] border border-[#0070f3]/20">
                            <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="w-4 h-4 text-[#0070f3]" />
                                <span className="text-xs text-gray-400 uppercase tracking-wider">Top Score</span>
                            </div>
                            <div className="text-2xl font-bold text-[#111111]">
                                {stats.top_candidate_score}
                            </div>
                            <div className="text-xs text-gray-400 mt-1 truncate">
                                {stats.top_candidate_name}
                            </div>
                        </div>
                    </div>
                )}

                {/* No Scores Message */}
                {stats && stats.candidates_with_scores === 0 && (
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-center">
                        <p className="text-yellow-400">
                            No candidates have been scored yet for this job.
                        </p>
                        <p className="text-sm text-gray-400 mt-1">
                            Generate insights for candidates to see rankings.
                        </p>
                    </div>
                )}
            </div>

            {/* Score Distribution Chart */}
            {stats && stats.candidates_with_scores > 0 && (
                <div className="glass-card p-6">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-400" />
                        Score Distribution
                    </h3>
                    <div className="space-y-3">
                        {Object.entries(stats.score_distribution).map(([range, count]) => {
                            const percentage = (count / stats.candidates_with_scores) * 100;
                            const isHighlighted = count > 0;

                            let barColor = 'bg-gray-500/30';
                            if (range === '90-100') barColor = 'bg-green-500';
                            else if (range === '80-89') barColor = 'bg-emerald-500';
                            else if (range === '70-79') barColor = 'bg-yellow-500';
                            else if (range === '60-69') barColor = 'bg-[#0070f3]';
                            else if (count > 0) barColor = 'bg-gray-500';

                            return (
                                <div key={range} className="flex items-center gap-3">
                                    <span className={`text-sm w-16 ${isHighlighted ? 'text-gray-300 font-medium' : 'text-gray-500'}`}>
                                        {range}
                                    </span>
                                    <div className="flex-1 h-8 bg-[#fafafa] rounded-lg overflow-hidden relative">
                                        <div
                                            className={`h-full ${barColor} transition-all duration-500`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                        {count > 0 && (
                                            <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-white mix-blend-difference">
                                                {count} ({percentage.toFixed(0)}%)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Ranked Candidates List */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <ArrowUpDown className="w-5 h-5 text-gray-400" />
                    <h3 className="text-lg font-semibold text-[#111111]">
                        Candidates ({candidates.length})
                    </h3>
                    <span className="text-sm text-gray-400">
                        {minScore > 0 ? `Showing scores ${minScore}+` : 'Sorted by highest score'}
                    </span>
                </div>

                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0070f3]"></div>
                        <p className="text-gray-400 mt-4">Loading ranked candidates...</p>
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="glass-card p-12 text-center">
                        <TrendingUp className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                        <p className="text-gray-400 text-lg">No scored candidates found</p>
                        <p className="text-gray-500 text-sm mt-2">
                            {minScore > 0
                                ? `Try lowering the minimum score filter or generate insights for more candidates.`
                                : `Generate AI insights for candidates to see rankings here.`
                            }
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {candidates.map((candidate, index) => (
                            <div key={candidate.id} className="relative">
                                {/* Rank Badge */}
                                <div className="absolute -left-3 top-1/2 -translate-y-1/2 z-10">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                                        index === 0 ? 'bg-yellow-500 text-black' :
                                        index === 1 ? 'bg-gray-300 text-black' :
                                        index === 2 ? 'bg-orange-600 text-white' :
                                        'bg-gray-700 text-gray-300'
                                    }`}>
                                        {index + 1}
                                    </div>
                                </div>
                                <div className="ml-6">
                                    <CandidateCard
                                        candidate={candidate}
                                        onClick={() => onCandidateClick(candidate)}
                                        onGenerateInsights={onGenerateInsights}
                                        onViewInsights={onViewInsights}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
