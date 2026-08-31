import { Briefcase, GraduationCap, Calendar, Sparkles, Eye, TrendingUp } from 'lucide-react';
import type { Candidate } from '../apiService';

interface CandidateCardProps {
    candidate: Candidate;
    onClick: () => void;
    onGenerateInsights: (candidate: Candidate) => void;
    onViewInsights: (candidate: Candidate) => void;
}

const StatusBadge = ({ status }: { status: string }) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
        applied:           { color: 'bg-[#f4f4f5] text-[#71717a] border-[#e4e4e7]',         label: 'Applied' },
        screening:         { color: 'bg-amber-50 text-amber-700 border-amber-200',            label: 'Screening' },
        interview_round_1: { color: 'bg-blue-50 text-blue-700 border-blue-200',               label: 'Interview R1' },
        interview_round_2: { color: 'bg-blue-50 text-blue-700 border-blue-200',               label: 'Interview R2' },
        offer:             { color: 'bg-purple-50 text-purple-700 border-purple-200',         label: 'Offer' },
        hired:             { color: 'bg-emerald-50 text-emerald-700 border-emerald-200',      label: 'Hired' },
        rejected:          { color: 'bg-red-50 text-red-600 border-red-200',                  label: 'Rejected' },
        onboarded:         { color: 'bg-emerald-50 text-emerald-700 border-emerald-200',      label: 'Onboarded' },
        offer_rejected:    { color: 'bg-red-50 text-red-600 border-red-200',                  label: 'Offer Rejected' },
    };
    const config = statusConfig[status] || statusConfig.applied;
    return (
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${config.color}`}>
            {config.label}
        </span>
    );
};

export const CandidateCard = ({ candidate, onClick, onGenerateInsights, onViewInsights }: CandidateCardProps) => {
    const formatDate = (dateString: string) =>
        new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

    const hasExperience = candidate.experience_years && candidate.experience_years !== '0';
    const hasInsights = candidate.has_insights;
    const overallScore = candidate.overall_score;

    const getScoreBadgeColor = (score: number) => {
        if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (score >= 65) return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-[#f4f4f5] text-[#71717a] border-[#e4e4e7]';
    };

    const handleInsightsClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (hasInsights) onViewInsights(candidate);
        else onGenerateInsights(candidate);
    };

    return (
        <div
            onClick={onClick}
            className="bg-white border border-[#e4e4e7] rounded-xl p-5 cursor-pointer hover:border-[#0070f3]/40 hover:shadow-sm transition-all group"
        >
            {/* Header */}
            <div className="flex items-start justify-between mb-3 pb-3 border-b border-[#f4f4f5]">
                <div className="flex items-center gap-2 text-xs text-[#71717a]">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(candidate.applied_at)}</span>
                    <span>·</span>
                    <span>{candidate.job_title || 'Position'}</span>
                </div>
                <div className="flex items-center gap-2">
                    {overallScore !== null && overallScore !== undefined && (
                        <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${getScoreBadgeColor(overallScore)}`}>
                            <TrendingUp className="w-3 h-3" />
                            <span>{overallScore}</span>
                            <span className="opacity-60">/100</span>
                        </div>
                    )}
                    <StatusBadge status={candidate.status} />
                </div>
            </div>

            {/* Name */}
            <h3 className="text-base font-semibold text-[#111111] group-hover:text-[#0070f3] transition-colors mb-3">
                {candidate.name}
            </h3>

            {/* Work Experience */}
            {hasExperience && candidate.current_position && (
                <div className="mb-3 p-2.5 rounded-lg bg-[#fafafa] border border-[#f4f4f5]">
                    <div className="flex items-start gap-2">
                        <Briefcase className="w-4 h-4 text-[#71717a] mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-[#a1a1aa] mb-0.5">Current Position</p>
                            <p className="text-sm text-[#374151] font-medium">{candidate.current_position}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Education */}
            {!hasExperience && candidate.education && candidate.education.length > 0 && (
                <div className="mb-3 p-2.5 rounded-lg bg-[#fafafa] border border-[#f4f4f5]">
                    <div className="flex items-start gap-2">
                        <GraduationCap className="w-4 h-4 text-[#71717a] mt-0.5 flex-shrink-0" />
                        <div>
                            <p className="text-xs text-[#a1a1aa] mb-0.5">Education</p>
                            {(() => {
                                const edu = candidate.education![0];
                                return (
                                    <div>
                                        <p className="text-sm text-[#374151] font-medium">
                                            {edu.degree && edu.field ? `${edu.degree} in ${edu.field}` : edu.degree || edu.field || 'Degree'}
                                        </p>
                                        {edu.institution && (
                                            <p className="text-xs text-[#71717a] mt-0.5">
                                                {edu.institution}
                                                {edu.years && <span className="ml-1.5 text-[#a1a1aa]">({edu.years})</span>}
                                            </p>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {/* Skills */}
            {candidate.skills && candidate.skills.length > 0 && (
                <div className="mb-3">
                    <p className="text-[10px] text-[#a1a1aa] font-medium uppercase tracking-wider mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                        {candidate.skills.slice(0, 8).map((skill, index) => (
                            <span
                                key={index}
                                className="px-2.5 py-1 rounded-md bg-[#f4f4f5] text-[#374151] text-xs border border-[#e4e4e7] font-medium"
                            >
                                {skill}
                            </span>
                        ))}
                        {candidate.skills.length > 8 && (
                            <span className="px-2.5 py-1 rounded-md bg-[#f4f4f5] text-[#a1a1aa] text-xs border border-[#e4e4e7]">
                                +{candidate.skills.length - 8}
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Footer */}
            <div className="pt-3 mt-1 border-t border-[#f4f4f5] flex items-center justify-between">
                <div className="text-xs text-[#a1a1aa] truncate max-w-[200px]">
                    {candidate.email || candidate.phone || ''}
                </div>
                <button
                    onClick={handleInsightsClick}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        hasInsights
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-[#eff6ff] text-[#0070f3] border border-[#0070f3]/20 hover:bg-blue-100'
                    }`}
                >
                    {hasInsights ? (
                        <><Eye className="w-3.5 h-3.5" /> View Insights</>
                    ) : (
                        <><Sparkles className="w-3.5 h-3.5" /> Generate Insights</>
                    )}
                </button>
            </div>
        </div>
    );
};
