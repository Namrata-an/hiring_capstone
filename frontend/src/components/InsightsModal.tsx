import { useState, useEffect } from 'react';
import { X, Loader2, Sparkles, Target, Brain, Briefcase, AlertTriangle, CheckCircle, HelpCircle, TrendingUp, Award, Users } from 'lucide-react';
import { api } from '../apiService';
import type { Candidate, CandidateInsights } from '../apiService';

interface InsightsModalProps {
    candidate: Candidate;
    onClose: () => void;
    onInsightsGenerated?: () => void;
    mode: 'generate' | 'view';
}

const ScoreBar = ({ score, label, color = 'orange' }: { score: number | null; label: string; color?: string }) => {
    const colorClasses: Record<string, string> = {
        orange: 'bg-[#0070f3]',
        green: 'bg-green-500',
        blue: 'bg-blue-500',
        purple: 'bg-purple-500',
        yellow: 'bg-yellow-500',
    };

    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-green-400';
        if (s >= 60) return 'text-yellow-400';
        return 'text-red-400';
    };

    return (
        <div className="mb-3">
            <div className="flex justify-between items-center mb-1">
                <span className="text-sm text-gray-400">{label}</span>
                <span className={`text-sm font-semibold ${score !== null ? getScoreColor(score) : 'text-gray-500'}`}>
                    {score !== null ? `${score}/100` : 'N/A'}
                </span>
            </div>
            <div className="h-2 bg-[#f4f4f5] rounded-full overflow-hidden">
                <div
                    className={`h-full ${colorClasses[color]} transition-all duration-500`}
                    style={{ width: score !== null ? `${score}%` : '0%' }}
                />
            </div>
        </div>
    );
};

const VerdictBadge = ({ verdict }: { verdict: string | null }) => {
    const verdictConfig: Record<string, { color: string; label: string; icon: typeof CheckCircle }> = {
        strong_yes: { color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Strong Yes', icon: CheckCircle },
        yes: { color: 'bg-green-500/20 text-green-300 border-green-500/30', label: 'Yes', icon: CheckCircle },
        maybe: { color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Maybe', icon: HelpCircle },
        no: { color: 'bg-red-500/20 text-red-300 border-red-500/30', label: 'No', icon: AlertTriangle },
        strong_no: { color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Strong No', icon: AlertTriangle },
    };

    const config = verdictConfig[verdict || 'maybe'] || verdictConfig.maybe;
    const Icon = config.icon;

    return (
        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${config.color} font-semibold`}>
            <Icon className="w-4 h-4" />
            {config.label}
        </span>
    );
};

const StartupFitBadge = ({ fit, level }: { fit: boolean | null; level: string | null }) => {
    if (fit === null) return null;

    const levelConfig: Record<string, string> = {
        high: 'bg-green-500/20 text-green-400 border-green-500/30',
        medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        low: 'bg-red-500/20 text-red-400 border-red-500/30',
    };

    const colorClass = levelConfig[level || 'medium'] || levelConfig.medium;

    return (
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-sm ${colorClass}`}>
            <Sparkles className="w-3 h-3" />
            Startup Fit: {(level || 'unknown').charAt(0).toUpperCase() + (level || 'unknown').slice(1)}
        </span>
    );
};

export const InsightsModal = ({ candidate, onClose, onInsightsGenerated, mode }: InsightsModalProps) => {
    const [insights, setInsights] = useState<CandidateInsights | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (mode === 'view') {
            loadInsights();
        } else {
            generateInsights();
        }
    }, [mode, candidate.id]);

    const loadInsights = async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await api.getInsights(candidate.id);
            setInsights(data);
        } catch (err: any) {
            if (err.response?.status === 404) {
                // No insights exist, generate them
                generateInsights();
            } else {
                setError('Failed to load insights');
            }
        }
        setIsLoading(false);
    };

    const generateInsights = async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await api.generateInsights(candidate.id);
            setInsights(data);
            onInsightsGenerated?.();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to generate insights');
        }
        setIsLoading(false);
    };

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-[#0a0a0a] rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-[#e4e4e7] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-[#e4e4e7] flex items-center justify-between flex-shrink-0">
                    <div>
                        <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                            <Sparkles className="w-6 h-6 text-purple-400" />
                            AI Insights
                        </h3>
                        <p className="text-gray-400 mt-1">{candidate.name} • {candidate.current_position || 'Candidate'}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-[#111111] p-2">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
                            <p className="text-[#111111] font-semibold text-lg">Analyzing Resume...</p>
                            <p className="text-gray-400 text-sm mt-2">Generating deep insights with AI</p>
                        </div>
                    ) : error ? (
                        <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-center">
                            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                            {error}
                            <button
                                onClick={generateInsights}
                                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-sm"
                            >
                                Try Again
                            </button>
                        </div>
                    ) : insights ? (
                        <div className="space-y-6">
                            {/* Summary Section */}
                            <div className="bg-[#fafafa] rounded-xl p-6 border border-[#e4e4e7]">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h4 className="text-lg font-semibold text-white mb-2">
                                            {insights.summary.headline || 'Candidate Analysis'}
                                        </h4>
                                        <div className="flex items-center gap-3">
                                            <VerdictBadge verdict={insights.summary.quick_verdict} />
                                            <StartupFitBadge
                                                fit={insights.mindset.startup_fit}
                                                level={insights.mindset.fit_level}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-3xl font-bold text-[#0070f3]">
                                            {insights.scores.overall_score ?? '—'}
                                        </div>
                                        <div className="text-sm text-gray-400">Overall Score</div>
                                    </div>
                                </div>

                                {/* Quick Stats Grid */}
                                <div className="grid grid-cols-3 gap-4 mt-6">
                                    <ScoreBar score={insights.scores.technical_depth} label="Technical Depth" color="blue" />
                                    <ScoreBar score={insights.scores.startup_mindset} label="Startup Mindset" color="purple" />
                                    <ScoreBar score={insights.scores.experience_relevance} label="Experience Relevance" color="green" />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <ScoreBar score={insights.scores.education_quality} label="Education" color="yellow" />
                                    <ScoreBar score={insights.scores.communication_signals} label="Communication" color="orange" />
                                    <div /> {/* Empty cell for alignment */}
                                </div>
                            </div>

                            {/* Two Column Layout */}
                            <div className="grid grid-cols-2 gap-6">
                                {/* Left Column: Strengths & Concerns */}
                                <div className="space-y-6">
                                    {/* Top Strengths */}
                                    <div className="bg-green-500/5 rounded-xl p-5 border border-green-500/20">
                                        <h4 className="text-[#111111] font-semibold mb-3 flex items-center gap-2">
                                            <Award className="w-5 h-5 text-green-400" />
                                            Top Strengths
                                        </h4>
                                        <ul className="space-y-2">
                                            {insights.summary.top_strengths.map((strength, i) => (
                                                <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                                    <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                                                    {strength}
                                                </li>
                                            ))}
                                            {insights.summary.top_strengths.length === 0 && (
                                                <li className="text-gray-500 text-sm">No specific strengths identified</li>
                                            )}
                                        </ul>
                                    </div>

                                    {/* Key Concerns */}
                                    <div className="bg-red-500/5 rounded-xl p-5 border border-red-500/20">
                                        <h4 className="text-[#111111] font-semibold mb-3 flex items-center gap-2">
                                            <AlertTriangle className="w-5 h-5 text-red-400" />
                                            Key Concerns
                                        </h4>
                                        <ul className="space-y-2">
                                            {insights.summary.key_concerns.map((concern, i) => (
                                                <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                                                    {concern}
                                                </li>
                                            ))}
                                            {insights.summary.key_concerns.length === 0 && (
                                                <li className="text-gray-500 text-sm">No major concerns identified</li>
                                            )}
                                        </ul>
                                    </div>

                                    {/* Experience Highlights */}
                                    {insights.experience.highlights.length > 0 && (
                                        <div className="bg-blue-500/5 rounded-xl p-5 border border-blue-500/20">
                                            <h4 className="text-[#111111] font-semibold mb-3 flex items-center gap-2">
                                                <Briefcase className="w-5 h-5 text-blue-400" />
                                                Experience Highlights
                                            </h4>
                                            <ul className="space-y-2">
                                                {insights.experience.highlights.map((highlight, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                                        <TrendingUp className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                                                        {highlight}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Right Column: Technical & Mindset */}
                                <div className="space-y-6">
                                    {/* Startup Mindset Signals */}
                                    <div className="bg-purple-500/5 rounded-xl p-5 border border-purple-500/20">
                                        <h4 className="text-[#111111] font-semibold mb-3 flex items-center gap-2">
                                            <Brain className="w-5 h-5 text-purple-400" />
                                            Startup Mindset Signals
                                        </h4>
                                        {insights.mindset.positive_signals.length > 0 ? (
                                            <ul className="space-y-2">
                                                {insights.mindset.positive_signals.map((signal, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                                        <Sparkles className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                                                        {signal}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-gray-500 text-sm">No specific startup signals identified</p>
                                        )}
                                        
                                        {insights.mindset.concerns.length > 0 && (
                                            <div className="mt-4 pt-4 border-t border-purple-500/20">
                                                <p className="text-xs text-gray-400 uppercase mb-2">Mindset Concerns</p>
                                                <ul className="space-y-1">
                                                    {insights.mindset.concerns.map((concern, i) => (
                                                        <li key={i} className="text-gray-400 text-sm">• {concern}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    {/* Technical Analysis */}
                                    <div className="bg-cyan-500/5 rounded-xl p-5 border border-cyan-500/20">
                                        <h4 className="text-[#111111] font-semibold mb-3 flex items-center gap-2">
                                            <Target className="w-5 h-5 text-cyan-400" />
                                            Technical Analysis
                                        </h4>
                                        
                                        {insights.technical.primary_skills.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-xs text-gray-400 uppercase mb-2">Primary Skills</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {insights.technical.primary_skills.map((skill, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-300 text-xs"
                                                        >
                                                            {skill}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {insights.technical.tech_trajectory && (
                                            <div className="mb-4">
                                                <p className="text-xs text-gray-400 uppercase mb-1">Tech Trajectory</p>
                                                <p className="text-gray-300 text-sm">{insights.technical.tech_trajectory}</p>
                                            </div>
                                        )}

                                        {insights.technical.standout_technical && (
                                            <div className="mb-4">
                                                <p className="text-xs text-gray-400 uppercase mb-1">What Stands Out</p>
                                                <p className="text-gray-300 text-sm">{insights.technical.standout_technical}</p>
                                            </div>
                                        )}

                                        {insights.technical.missing_skills.length > 0 && (
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase mb-2">Potentially Missing</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {insights.technical.missing_skills.map((skill, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-2 py-1 rounded bg-gray-500/20 text-gray-400 text-xs"
                                                        >
                                                            {skill}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Leadership Signals */}
                                    {insights.experience.leadership_signals.length > 0 && (
                                        <div className="bg-yellow-500/5 rounded-xl p-5 border border-yellow-500/20">
                                            <h4 className="text-[#111111] font-semibold mb-3 flex items-center gap-2">
                                                <Users className="w-5 h-5 text-yellow-400" />
                                                Leadership Signals
                                            </h4>
                                            <ul className="space-y-2">
                                                {insights.experience.leadership_signals.map((signal, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                                        <CheckCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                                                        {signal}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Job Match Analysis */}
                            {insights.job_match && (
                                <div className="bg-blue-500/5 rounded-xl p-5 border border-blue-500/20">
                                    <h4 className="text-[#111111] font-semibold mb-4 flex items-center gap-2">
                                        <Target className="w-5 h-5 text-blue-400" />
                                        Job Match Analysis
                                    </h4>
                                    
                                    <div className="space-y-4">
                                        {/* Match Percentage */}
                                        {insights.job_match.match_percentage !== null && (
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-sm text-gray-400">Skills Match</span>
                                                    <span className={`text-lg font-bold ${
                                                        insights.job_match.match_percentage >= 70 ? 'text-green-400' :
                                                        insights.job_match.match_percentage >= 50 ? 'text-yellow-400' :
                                                        'text-red-400'
                                                    }`}>
                                                        {insights.job_match.match_percentage}%
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-[#f4f4f5] rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${
                                                            insights.job_match.match_percentage >= 70 ? 'bg-green-500' :
                                                            insights.job_match.match_percentage >= 50 ? 'bg-yellow-500' :
                                                            'bg-red-500'
                                                        }`}
                                                        style={{ width: `${insights.job_match.match_percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Overall Fit */}
                                        {insights.job_match.overall_fit_for_role && (
                                            <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                                                <p className="text-xs text-gray-400 uppercase mb-1">Overall Fit</p>
                                                <p className="text-[#111111] font-semibold">{insights.job_match.overall_fit_for_role}</p>
                                            </div>
                                        )}

                                        {/* Skills Match */}
                                        {insights.job_match.required_skills_match.length > 0 && (
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase mb-2">✓ Required Skills Present</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {insights.job_match.required_skills_match.map((skill, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs border border-green-500/30"
                                                        >
                                                            {skill}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Missing Skills */}
                                        {insights.job_match.required_skills_missing.length > 0 && (
                                            <div>
                                                <p className="text-xs text-gray-400 uppercase mb-2">✗ Required Skills Missing</p>
                                                <div className="flex flex-wrap gap-2">
                                                    {insights.job_match.required_skills_missing.map((skill, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-xs border border-red-500/30"
                                                        >
                                                            {skill}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Experience Gap */}
                                        {insights.job_match.experience_gap && (
                                            <div className="p-3 bg-[#eff6ff] rounded-lg border border-[#0070f3]/30">
                                                <p className="text-xs text-gray-400 uppercase mb-1">Experience Assessment</p>
                                                <p className="text-gray-300 text-sm">{insights.job_match.experience_gap}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Areas to Probe */}
                            {insights.summary.areas_to_probe.length > 0 && (
                                <div className="bg-[#f0f9ff] rounded-xl p-5 border border-[#0070f3]/20">
                                    <h4 className="text-[#111111] font-semibold mb-3 flex items-center gap-2">
                                        <HelpCircle className="w-5 h-5 text-[#0070f3]" />
                                        Areas to Probe in Interview
                                    </h4>
                                    <div className="grid grid-cols-2 gap-3">
                                        {insights.summary.areas_to_probe.map((area, i) => (
                                            <div
                                                key={i}
                                                className="flex items-start gap-2 p-3 bg-[#eff6ff] rounded-lg border border-[#0070f3]/20"
                                            >
                                                <span className="text-[#0070f3] font-semibold">{i + 1}.</span>
                                                <span className="text-gray-300 text-sm">{area}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Red Flags */}
                            {insights.experience.red_flags.length > 0 && (
                                <div className="bg-red-500/5 rounded-xl p-5 border border-red-500/20">
                                    <h4 className="text-[#111111] font-semibold mb-3 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-red-400" />
                                        Red Flags
                                    </h4>
                                    <ul className="space-y-2">
                                        {insights.experience.red_flags.map((flag, i) => (
                                            <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                                                {flag}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[#e4e4e7] flex justify-between items-center flex-shrink-0">
                    <p className="text-xs text-gray-500">
                        {insights?.generated_at && (
                            <>Generated: {new Date(insights.generated_at).toLocaleString()}</>
                        )}
                    </p>
                    <div className="flex gap-3">
                        {insights && (
                            <button
                                onClick={generateInsights}
                                disabled={isLoading}
                                className="px-4 py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 text-sm font-medium disabled:opacity-50"
                            >
                                Regenerate
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-[#e4e4e7] text-sm font-medium"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
