/**
 * PreviousReviewsPanel - Displays previous interview round reviews
 * Shows gold areas (strengths) and grey areas (weaknesses) from earlier rounds
 * Used for baton passing context
 */
import { useState } from 'react';
import { ChevronDown, ChevronUp, Award, AlertTriangle, User, Star, TrendingUp, Sparkles, FileEdit } from 'lucide-react';

export interface PreviousReview {
    round_number: number;
    round_name?: string;
    interviewer_name?: string;
    overall_rating?: number;
    gold_areas: string[];
    grey_areas: string[];
    recommendation?: string;
    technical_skills?: number;
    communication?: number;
    problem_solving?: number;
    cultural_fit?: number;
    strengths?: string;
    areas_for_improvement?: string;
    notes?: string;
    llm_generated_feedback?: {
        type?: 'ai' | 'manual';
        key_areas?: string[];
        description?: string;
        answers?: Record<string, string>;
    };
    created_at?: string;
}

export interface PreviousReviewsData {
    candidate_id: string;
    candidate_name: string;
    current_round_number?: number;
    total_visible_reviews: number;
    reviews: PreviousReview[];
    aggregated_gold_areas: string[];
    aggregated_grey_areas: string[];
}

interface PreviousReviewsPanelProps {
    data: PreviousReviewsData | null;
    isLoading?: boolean;
}

function RatingBadge({ label, value }: { label: string; value?: number }) {
    if (value === undefined || value === null) return null;

    const colorClass =
        value >= 4
            ? 'bg-green-500/20 text-green-400 border-green-500/30'
            : value === 3
            ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            : 'bg-red-500/20 text-red-400 border-red-500/30';

    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClass}`}>
            <span className="text-xs font-medium">{label}</span>
            <span className="text-sm font-bold">{value}/5</span>
        </div>
    );
}

function RecommendationBadge({ recommendation }: { recommendation?: string }) {
    if (!recommendation) return null;

    const badges: Record<string, { label: string; className: string }> = {
        strong_yes: { label: 'Strong Yes', className: 'bg-emerald-600 text-white' },
        yes: { label: 'Yes', className: 'bg-green-500/50 text-green-200' },
        maybe: { label: 'Maybe', className: 'bg-yellow-500/50 text-yellow-200' },
        no: { label: 'No', className: 'bg-red-500/50 text-red-200' },
        strong_no: { label: 'Strong No', className: 'bg-red-600 text-white' },
    };

    const badge = badges[recommendation] || { label: recommendation, className: 'bg-zinc-500/50 text-zinc-200' };

    return (
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${badge.className}`}>
            {badge.label}
        </span>
    );
}

function ReviewCard({ review, isExpanded, onToggle }: { review: PreviousReview; isExpanded: boolean; onToggle: () => void }) {
    const formattedDate = review.created_at
        ? new Date(review.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : null;

    return (
        <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-lg overflow-hidden">
            {/* Header */}
            <button
                onClick={onToggle}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-[#f4f4f5] transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-[#eff6ff] rounded-full border border-[#0070f3]/30">
                        <span className="text-sm font-bold text-[#0070f3]">{review.round_number}</span>
                    </div>
                    <div className="text-left">
                        <h4 className="text-sm font-semibold text-[#111111]">
                            {review.round_name || `Round ${review.round_number}`}
                        </h4>
                        {review.interviewer_name && (
                            <div className="flex items-center gap-1 text-xs text-zinc-400 mt-0.5">
                                <User className="w-3 h-3" />
                                <span>{review.interviewer_name}</span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {review.overall_rating && (
                        <div className="flex items-center gap-1 px-2 py-1 bg-zinc-800 rounded-md">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-xs font-semibold text-[#111111]">{review.overall_rating}/5</span>
                        </div>
                    )}
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                </div>
            </button>

            {/* Expanded Content */}
            {isExpanded && (
                <div className="px-4 pb-4 space-y-4">
                    {/* Ratings Grid */}
                    {(review.technical_skills || review.communication || review.problem_solving || review.cultural_fit) && (
                        <div className="flex flex-wrap gap-2">
                            <RatingBadge label="Technical" value={review.technical_skills} />
                            <RatingBadge label="Communication" value={review.communication} />
                            <RatingBadge label="Problem Solving" value={review.problem_solving} />
                            <RatingBadge label="Cultural Fit" value={review.cultural_fit} />
                        </div>
                    )}

                    {/* Gold Areas (Strengths) */}
                    {review.gold_areas.length > 0 && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <Award className="w-4 h-4 text-green-400" />
                                <h5 className="text-xs font-semibold text-green-400 uppercase tracking-wide">
                                    Gold Areas (Strengths)
                                </h5>
                            </div>
                            <ul className="space-y-1">
                                {review.gold_areas.map((area, idx) => (
                                    <li key={idx} className="text-sm text-green-300 flex items-start gap-2">
                                        <span className="text-green-500 mt-1">✓</span>
                                        <span>{area}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Grey Areas (Weaknesses) */}
                    {review.grey_areas.length > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                <h5 className="text-xs font-semibold text-yellow-400 uppercase tracking-wide">
                                    Grey Areas (Areas to Probe)
                                </h5>
                            </div>
                            <ul className="space-y-1">
                                {review.grey_areas.map((area, idx) => (
                                    <li key={idx} className="text-sm text-yellow-300 flex items-start gap-2">
                                        <span className="text-yellow-500 mt-1">⚠</span>
                                        <span>{area}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Strengths Text */}
                    {review.strengths && (
                        <div>
                            <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                                Detailed Strengths
                            </h5>
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{review.strengths}</p>
                        </div>
                    )}

                    {/* Areas for Improvement */}
                    {review.areas_for_improvement && (
                        <div>
                            <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                                Areas for Improvement
                            </h5>
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{review.areas_for_improvement}</p>
                        </div>
                    )}

                    {/* Notes */}
                    {review.notes && (
                        <div>
                            <h5 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">
                                Additional Notes
                            </h5>
                            <p className="text-sm text-zinc-300 whitespace-pre-wrap">{review.notes}</p>
                        </div>
                    )}

                    {/* LLM-Generated Feedback / Manual Review Data */}
                    {review.llm_generated_feedback && (
                        <div className={`border rounded-lg p-3 ${
                            review.llm_generated_feedback.type === 'ai'
                                ? 'bg-purple-500/10 border-purple-500/30'
                                : 'bg-[#eff6ff] border-[#0070f3]/30'
                        }`}>
                            <div className="flex items-center gap-2 mb-2">
                                {review.llm_generated_feedback.type === 'ai' ? (
                                    <>
                                        <Sparkles className="w-4 h-4 text-purple-400" />
                                        <h5 className="text-xs font-semibold text-purple-400 uppercase tracking-wide">
                                            AI-Guided Review Context
                                        </h5>
                                    </>
                                ) : (
                                    <>
                                        <FileEdit className="w-4 h-4 text-[#0070f3]" />
                                        <h5 className="text-xs font-semibold text-[#0070f3] uppercase tracking-wide">
                                            Manual Review Context
                                        </h5>
                                    </>
                                )}
                            </div>

                            {/* Manual Mode: Key Areas + Description */}
                            {review.llm_generated_feedback.type === 'manual' && (
                                <>
                                    {review.llm_generated_feedback.key_areas && review.llm_generated_feedback.key_areas.length > 0 && (
                                        <div className="mb-2">
                                            <span className="text-xs text-orange-300 font-medium">Key Areas: </span>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {review.llm_generated_feedback.key_areas.map((area, idx) => (
                                                    <span key={idx} className="px-2 py-0.5 bg-[#eff6ff] text-orange-300 rounded text-xs">
                                                        {area}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {review.llm_generated_feedback.description && (
                                        <p className="text-sm text-orange-200 mt-2">
                                            {review.llm_generated_feedback.description}
                                        </p>
                                    )}
                                </>
                            )}

                            {/* AI Mode: Q&A Answers */}
                            {review.llm_generated_feedback.type === 'ai' && review.llm_generated_feedback.answers && (
                                <div className="space-y-2 text-xs">
                                    {Object.entries(review.llm_generated_feedback.answers).slice(0, 2).map(([question, answer], idx) => (
                                        <div key={idx}>
                                            <p className="text-purple-300 font-medium mb-0.5">{question}</p>
                                            <p className="text-purple-200/80">{answer}</p>
                                        </div>
                                    ))}
                                    {Object.keys(review.llm_generated_feedback.answers).length > 2 && (
                                        <p className="text-purple-400 italic text-xs">
                                            +{Object.keys(review.llm_generated_feedback.answers).length - 2} more answers
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#e4e4e7]">
                        <RecommendationBadge recommendation={review.recommendation} />
                        {formattedDate && <span className="text-xs text-zinc-500">{formattedDate}</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

export function PreviousReviewsPanel({ data, isLoading }: PreviousReviewsPanelProps) {
    const [expandedReviews, setExpandedReviews] = useState<Set<number>>(new Set([0])); // Expand first by default

    const toggleReview = (index: number) => {
        setExpandedReviews((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    };

    if (isLoading) {
        return (
            <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-8">
                <div className="flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-zinc-400">Loading previous reviews...</p>
                </div>
            </div>
        );
    }

    if (!data || data.total_visible_reviews === 0) {
        return (
            <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-8">
                <div className="text-center">
                    <TrendingUp className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-zinc-400 mb-2">No Previous Rounds</h3>
                    <p className="text-sm text-zinc-500">
                        This is the first interview round for this candidate. No previous context available.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border border-[#0070f3]/30 rounded-xl p-4">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-lg font-semibold text-white mb-1">Previous Round Reviews</h3>
                        <p className="text-sm text-orange-200">
                            Review context from earlier rounds to inform your interview
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-[#0070f3]">{data.total_visible_reviews}</div>
                        <div className="text-xs text-orange-300">
                            Round{data.total_visible_reviews !== 1 ? 's' : ''} Completed
                        </div>
                    </div>
                </div>
            </div>

            {/* Aggregated Summary */}
            {(data.aggregated_gold_areas.length > 0 || data.aggregated_grey_areas.length > 0) && (
                <div className="grid md:grid-cols-2 gap-4">
                    {/* Aggregated Gold Areas */}
                    {data.aggregated_gold_areas.length > 0 && (
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Award className="w-5 h-5 text-green-400" />
                                <h4 className="text-sm font-semibold text-green-400 uppercase tracking-wide">
                                    Validated Strengths
                                </h4>
                            </div>
                            <ul className="space-y-2">
                                {data.aggregated_gold_areas.slice(0, 5).map((area, idx) => (
                                    <li key={idx} className="text-sm text-green-300 flex items-start gap-2">
                                        <span className="text-green-500 font-bold mt-0.5">✓</span>
                                        <span>{area}</span>
                                    </li>
                                ))}
                            </ul>
                            {data.aggregated_gold_areas.length > 5 && (
                                <p className="text-xs text-green-400 mt-2">
                                    +{data.aggregated_gold_areas.length - 5} more strengths
                                </p>
                            )}
                        </div>
                    )}

                    {/* Aggregated Grey Areas */}
                    {data.aggregated_grey_areas.length > 0 && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                <h4 className="text-sm font-semibold text-yellow-400 uppercase tracking-wide">
                                    Areas to Probe Further
                                </h4>
                            </div>
                            <ul className="space-y-2">
                                {data.aggregated_grey_areas.slice(0, 5).map((area, idx) => (
                                    <li key={idx} className="text-sm text-yellow-300 flex items-start gap-2">
                                        <span className="text-yellow-500 font-bold mt-0.5">⚠</span>
                                        <span>{area}</span>
                                    </li>
                                ))}
                            </ul>
                            {data.aggregated_grey_areas.length > 5 && (
                                <p className="text-xs text-yellow-400 mt-2">
                                    +{data.aggregated_grey_areas.length - 5} more areas
                                </p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Individual Round Reviews */}
            <div className="space-y-3">
                <h4 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Round-by-Round Details</h4>
                {data.reviews.map((review, index) => (
                    <ReviewCard
                        key={index}
                        review={review}
                        isExpanded={expandedReviews.has(index)}
                        onToggle={() => toggleReview(index)}
                    />
                ))}
            </div>
        </div>
    );
}
