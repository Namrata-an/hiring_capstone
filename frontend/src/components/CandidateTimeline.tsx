import React, { useEffect, useState } from 'react';
import {
    Calendar, CheckCircle, XCircle, RotateCcw, Mail, Star, UserPlus,
    Send, Sparkles, Clock, AlertCircle, ClipboardList,
} from 'lucide-react';

import { api } from '../apiService';
import type { CandidateTimeline as CandidateTimelineType, TimelineEvent } from '../apiService';
import { QuestionsAskedModal } from './QuestionsAskedModal';

interface CandidateTimelineProps {
    candidateId: string;
}

interface KindStyle {
    icon: React.ComponentType<{ className?: string }>;
    iconColor: string;
    medallionBg: string;
    medallionRing: string;
}

const KIND_STYLES: Record<string, KindStyle> = {
    applied:               { icon: UserPlus,    iconColor: 'text-emerald-300', medallionBg: 'bg-emerald-500/15', medallionRing: 'ring-emerald-400/30' },
    status_changed:        { icon: Sparkles,    iconColor: 'text-blue-300',    medallionBg: 'bg-blue-500/15',    medallionRing: 'ring-blue-400/30' },
    interview_assigned:    { icon: Calendar,    iconColor: 'text-orange-300',  medallionBg: 'bg-[#0070f3]/15',  medallionRing: 'ring-orange-400/40' },
    invite_sent:           { icon: Send,        iconColor: 'text-orange-200',  medallionBg: 'bg-[#eff6ff]',  medallionRing: 'ring-orange-300/30' },
    interview_confirmed:   { icon: CheckCircle, iconColor: 'text-emerald-300', medallionBg: 'bg-emerald-500/15', medallionRing: 'ring-emerald-400/30' },
    interview_declined:    { icon: XCircle,     iconColor: 'text-rose-300',    medallionBg: 'bg-rose-500/15',    medallionRing: 'ring-rose-400/30' },
    reschedule_requested:  { icon: RotateCcw,   iconColor: 'text-amber-300',   medallionBg: 'bg-amber-500/15',   medallionRing: 'ring-amber-400/30' },
    reschedule_processed:  { icon: RotateCcw,   iconColor: 'text-orange-300',  medallionBg: 'bg-[#0070f3]/15',  medallionRing: 'ring-orange-400/30' },
    interview_completed:   { icon: CheckCircle, iconColor: 'text-blue-300',    medallionBg: 'bg-blue-500/15',    medallionRing: 'ring-blue-400/30' },
    review_submitted:      { icon: Star,        iconColor: 'text-yellow-300',  medallionBg: 'bg-yellow-500/15',  medallionRing: 'ring-yellow-400/30' },
    email_sent:            { icon: Mail,        iconColor: 'text-purple-300',  medallionBg: 'bg-purple-500/15',  medallionRing: 'ring-purple-400/30' },
};

const DEFAULT_STYLE: KindStyle = {
    icon: AlertCircle,
    iconColor: 'text-zinc-300',
    medallionBg: 'bg-zinc-500/15',
    medallionRing: 'ring-zinc-400/30',
};

const META_LABELS: Record<string, string> = {
    job_title: 'Position',
    from: 'From',
    to: 'To',
    round: 'Round',
    interviewer: 'Interviewer',
    scheduled_at: 'Scheduled for',
    proposed_at: 'Proposed time',
    reschedule_count: 'Reschedule attempts',
    overall_rating: 'Overall rating',
    recommendation: 'Recommendation',
    to_name: 'To',
    status: 'Delivery',
};

function relativeTime(iso: string): string {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const diffSec = Math.round((now - then) / 1000);
    if (Number.isNaN(diffSec)) return '';
    const abs = Math.abs(diffSec);
    if (abs < 60) return diffSec >= 0 ? 'just now' : 'in a moment';
    if (abs < 3600) {
        const m = Math.round(abs / 60);
        return diffSec >= 0 ? `${m} min${m === 1 ? '' : 's'} ago` : `in ${m} min${m === 1 ? '' : 's'}`;
    }
    if (abs < 86400) {
        const h = Math.round(abs / 3600);
        return diffSec >= 0 ? `${h} hour${h === 1 ? '' : 's'} ago` : `in ${h} hour${h === 1 ? '' : 's'}`;
    }
    if (abs < 86400 * 14) {
        const d = Math.round(abs / 86400);
        return diffSec >= 0 ? `${d} day${d === 1 ? '' : 's'} ago` : `in ${d} day${d === 1 ? '' : 's'}`;
    }
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatMetaValue(key: string, value: any): string {
    if (value === null || value === undefined || value === '') return '—';
    if (key === 'scheduled_at' || key === 'proposed_at') {
        try {
            return new Date(value).toLocaleString(undefined, {
                weekday: 'short', month: 'short', day: 'numeric',
                hour: 'numeric', minute: '2-digit',
            });
        } catch { return String(value); }
    }
    if (typeof value === 'string') return value.replace(/_/g, ' ');
    return String(value);
}

// Meta keys that drive UI affordances (e.g. snapshot link), not the read-only
// key/value grid. They render as buttons instead.
const META_AFFORDANCE_KEYS = new Set([
    'questions_snapshot_id',
    'questions_asked_count',
    'schedule_id',
]);

function relevantMetaEntries(event: TimelineEvent): Array<[string, any]> {
    if (!event.meta) return [];
    return Object.entries(event.meta).filter(
        ([k, v]) => v !== null && v !== undefined && v !== '' && !META_AFFORDANCE_KEYS.has(k),
    );
}

const TimelineCard: React.FC<{
    event: TimelineEvent;
    isLast: boolean;
    onOpenSnapshot: (scheduleOrSnapshotId: string) => void;
}> = ({ event, isLast, onOpenSnapshot }) => {
    const style = KIND_STYLES[event.kind] || DEFAULT_STYLE;
    const Icon = style.icon;
    const absoluteTime = new Date(event.at).toLocaleString();
    const metaEntries = relevantMetaEntries(event);
    const snapshotId = event.meta?.questions_snapshot_id as string | undefined;
    const askedCount = event.meta?.questions_asked_count as number | undefined;
    const scheduleId = event.meta?.schedule_id as string | undefined;

    return (
        <div className="relative pl-14 pb-6" data-testid="timeline-event" data-kind={event.kind}>
            {/* Vertical orange rail */}
            {!isLast && (
                <div
                    className="absolute left-[20px] top-10 bottom-0 w-px bg-gradient-to-b from-orange-500/40 via-orange-500/20 to-orange-500/0"
                    aria-hidden
                />
            )}
            {/* Medallion */}
            <div
                className={`absolute left-0 top-0 w-10 h-10 rounded-full flex items-center justify-center ring-1 ${style.medallionBg} ${style.medallionRing} shadow-lg shadow-black/40`}
                aria-hidden
            >
                <Icon className={`w-4 h-4 ${style.iconColor}`} />
            </div>
            {/* Card */}
            <div className="rounded-xl border border-[#f4f4f5] bg-zinc-900/60  px-4 py-3 hover:border-[#0070f3]/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-100 leading-snug">{event.title}</p>
                        {event.actor?.name && (
                            <p className="text-xs text-zinc-500 mt-0.5">
                                by <span className="text-zinc-400">{event.actor.name}</span>
                                {event.actor.role && (
                                    <span className="text-zinc-600"> · {event.actor.role.replace(/_/g, ' ')}</span>
                                )}
                            </p>
                        )}
                    </div>
                    <span
                        className="flex-shrink-0 text-xs text-zinc-500 cursor-help whitespace-nowrap"
                        title={absoluteTime}
                    >
                        {relativeTime(event.at)}
                    </span>
                </div>
                {event.body && (
                    <p className="mt-2 text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">
                        {event.body}
                    </p>
                )}
                {metaEntries.length > 0 && (
                    <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {metaEntries.map(([key, value]) => (
                            <React.Fragment key={key}>
                                <dt className="text-zinc-500">{META_LABELS[key] || key.replace(/_/g, ' ')}</dt>
                                <dd className="text-zinc-300 truncate" title={formatMetaValue(key, value)}>
                                    {formatMetaValue(key, value)}
                                </dd>
                            </React.Fragment>
                        ))}
                    </dl>
                )}
                {snapshotId && scheduleId && (
                    <button
                        onClick={() => onOpenSnapshot(scheduleId)}
                        data-testid="open-questions-asked"
                        className="mt-3 inline-flex items-center gap-1.5 text-xs text-orange-300 hover:text-orange-200 px-2.5 py-1 rounded-md border border-[#0070f3]/20 hover:border-orange-400/40 bg-[#f0f9ff] hover:bg-[#eff6ff] transition-colors"
                    >
                        <ClipboardList className="w-3.5 h-3.5" />
                        View questions asked
                        {typeof askedCount === 'number' && askedCount > 0 && (
                            <span className="text-orange-200/70">({askedCount})</span>
                        )}
                    </button>
                )}
            </div>
        </div>
    );
};

export const CandidateTimeline: React.FC<CandidateTimelineProps> = ({ candidateId }) => {
    const [data, setData] = useState<CandidateTimelineType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openScheduleId, setOpenScheduleId] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        api.getInterviewTimeline(candidateId)
            .then(t => { if (!cancelled) setData(t); })
            .catch(err => {
                if (!cancelled) setError(err?.response?.data?.detail || 'Failed to load timeline');
            })
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
    }, [candidateId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12" data-testid="timeline-loading">
                <div className="w-6 h-6 border-2 border-[#0070f3] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-6 text-center">
                <AlertCircle className="w-5 h-5 text-rose-300 mx-auto mb-2" />
                <p className="text-sm text-rose-200">{error}</p>
            </div>
        );
    }

    if (!data || data.events.length === 0) {
        return (
            <div className="rounded-xl border border-[#f4f4f5] bg-zinc-900/40 px-4 py-10 text-center">
                <Clock className="w-6 h-6 text-zinc-600 mx-auto mb-2" />
                <p className="text-sm text-zinc-400">No timeline events yet.</p>
            </div>
        );
    }

    return (
        <div data-testid="candidate-timeline" className="relative">
            {data.events.map((event, idx) => (
                <TimelineCard
                    key={`${event.kind}-${event.at}-${idx}`}
                    event={event}
                    isLast={idx === data.events.length - 1}
                    onOpenSnapshot={(scheduleId) => setOpenScheduleId(scheduleId)}
                />
            ))}
            {openScheduleId && (
                <QuestionsAskedModal
                    scheduleId={openScheduleId}
                    onClose={() => setOpenScheduleId(null)}
                />
            )}
        </div>
    );
};

export default CandidateTimeline;
