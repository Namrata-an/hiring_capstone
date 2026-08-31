import React, { useEffect, useMemo, useState } from 'react';
import {
    Search, Filter, X, Briefcase, ClipboardCheck, Eye, Star,
    User as UserIcon, Calendar,
} from 'lucide-react';

import { api } from '../apiService';
import type {
    Job,
    TalentMemoryCandidateSummary,
    TalentMemoryRole,
} from '../apiService';
import { CandidateTimeline } from './CandidateTimeline';

type Scope = 'mine' | 'all';

const STATUS_LABELS: Record<string, string> = {
    applied: 'Applied',
    screening: 'Screening',
    interview_round_1: 'Interview Round 1',
    interview_round_2: 'Interview Round 2',
    offer: 'Offer',
    hired: 'Hired',
    rejected: 'Rejected',
};

const STATUS_PILL_CLASS: Record<string, string> = {
    applied: 'bg-zinc-500/15 text-zinc-300',
    screening: 'bg-yellow-500/15 text-yellow-300',
    interview_round_1: 'bg-blue-500/15 text-blue-300',
    interview_round_2: 'bg-blue-500/15 text-blue-300',
    offer: 'bg-purple-500/15 text-purple-300',
    hired: 'bg-emerald-500/15 text-emerald-300',
    rejected: 'bg-rose-500/15 text-rose-300',
};

const ROLE_PILL: Record<TalentMemoryRole, { label: string; cls: string }> = {
    interviewed: { label: 'Interviewed', cls: 'bg-[#eff6ff] text-orange-300 ring-1 ring-orange-400/30' },
    assigned:    { label: 'Assigned',    cls: 'bg-blue-500/15 text-blue-300 ring-1 ring-blue-400/30' },
    none:        { label: 'Not assigned', cls: 'bg-zinc-700/40 text-zinc-400 ring-1 ring-zinc-600/40' },
};

function formatRelative(iso?: string | null): string {
    if (!iso) return '—';
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return '—';
    const diff = Date.now() - t;
    if (diff < 0) return new Date(iso).toLocaleDateString();
    if (diff < 60_000) return 'just now';
    if (diff < 3600_000) return `${Math.round(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.round(diff / 3600_000)}h ago`;
    if (diff < 14 * 86_400_000) return `${Math.round(diff / 86_400_000)}d ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function prettifyKind(kind?: string | null): string {
    if (!kind) return '';
    return kind.replace(/_/g, ' ');
}


const FilterBar: React.FC<{
    q: string; onQ: (v: string) => void;
    statusFilter: string; onStatusFilter: (v: string) => void;
    jobFilter: string; onJobFilter: (v: string) => void;
    jobs: Job[];
    onClear: () => void;
    activeFilterCount: number;
}> = ({ q, onQ, statusFilter, onStatusFilter, jobFilter, onJobFilter, jobs, onClear, activeFilterCount }) => (
    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
                value={q}
                onChange={e => onQ(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-10 pr-3 py-2 bg-zinc-900/60 border border-[#f4f4f5] rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-[#0070f3]/40"
                data-testid="memory-search-input"
            />
        </div>
        <select
            value={statusFilter}
            onChange={e => onStatusFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900/60 border border-[#f4f4f5] rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-[#0070f3]/40"
            data-testid="memory-status-filter"
        >
            <option value="">Any status</option>
            {Object.entries(STATUS_LABELS).map(([v, label]) => (
                <option key={v} value={v}>{label}</option>
            ))}
        </select>
        <select
            value={jobFilter}
            onChange={e => onJobFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-900/60 border border-[#f4f4f5] rounded-lg text-sm text-zinc-200 focus:outline-none focus:border-[#0070f3]/40"
            data-testid="memory-job-filter"
        >
            <option value="">Any role</option>
            {jobs.map(j => (
                <option key={j.id} value={j.id}>{j.title}</option>
            ))}
        </select>
        {activeFilterCount > 0 && (
            <button
                onClick={onClear}
                className="px-3 py-2 text-sm text-zinc-400 hover:text-[#111111] border border-[#f4f4f5] rounded-lg flex items-center gap-2"
            >
                <Filter className="w-4 h-4" /> Clear ({activeFilterCount})
            </button>
        )}
    </div>
);


const SummaryCard: React.FC<{
    row: TalentMemoryCandidateSummary;
    onOpen: () => void;
}> = ({ row, onOpen }) => {
    const role = ROLE_PILL[row.my_role];
    const statusCls = STATUS_PILL_CLASS[row.status] ?? 'bg-zinc-700/40 text-zinc-300';

    return (
        <div
            onClick={onOpen}
            className="glass-card p-4 cursor-pointer hover:border-[#0070f3]/30 transition-colors"
            data-testid="memory-row"
            data-role={row.my_role}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-[#0070f3]/15 flex items-center justify-center flex-shrink-0">
                        <UserIcon className="w-5 h-5 text-orange-300" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-zinc-100 font-semibold truncate">{row.name}</p>
                        <p className="text-xs text-zinc-500 truncate">
                            {row.job_title || 'Unknown role'}
                            {row.email ? ` · ${row.email}` : ''}
                        </p>
                    </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs whitespace-nowrap ${role.cls}`}>{role.label}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                    <p className="text-zinc-500">Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] mt-1 ${statusCls}`}>
                        {STATUS_LABELS[row.status] || row.status}
                    </span>
                </div>
                <div>
                    <p className="text-zinc-500">Rounds</p>
                    <p className="text-zinc-300 mt-1">
                        {row.rounds_completed}/{row.rounds_total || 0} done
                    </p>
                </div>
                <div>
                    <p className="text-zinc-500">Latest</p>
                    <p className="text-zinc-300 mt-1 truncate" title={row.latest_event_kind || ''}>
                        {prettifyKind(row.latest_event_kind) || '—'}
                    </p>
                </div>
                <div>
                    <p className="text-zinc-500">When</p>
                    <p className="text-zinc-300 mt-1">{formatRelative(row.latest_event_at)}</p>
                </div>
            </div>
            {row.skills && row.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                    {row.skills.slice(0, 6).map((s, i) => (
                        <span key={i} className="px-2 py-0.5 text-[11px] rounded-full bg-[#eff6ff] text-orange-300/90">
                            {s}
                        </span>
                    ))}
                    {row.skills.length > 6 && (
                        <span className="text-[11px] text-zinc-500 self-center">+{row.skills.length - 6} more</span>
                    )}
                </div>
            )}
        </div>
    );
};


const DetailModal: React.FC<{
    candidate: TalentMemoryCandidateSummary;
    onClose: () => void;
}> = ({ candidate, onClose }) => {
    const role = ROLE_PILL[candidate.my_role];
    return (
        <div
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4"
            onClick={onClose}
            data-testid="memory-detail-modal"
        >
            <div
                className="bg-zinc-950 border border-[#f4f4f5] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-[#f4f4f5] flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-semibold text-zinc-100 truncate">{candidate.name}</h2>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] ${role.cls}`}>{role.label}</span>
                        </div>
                        <p className="text-sm text-zinc-500 mt-1 truncate">
                            {candidate.job_title || 'Unknown role'}
                            {candidate.current_position ? ` · ${candidate.current_position}` : ''}
                            {candidate.experience_years ? ` · ${candidate.experience_years}y exp` : ''}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-zinc-400 hover:text-[#111111]">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="px-6 py-4 overflow-y-auto custom-scrollbar flex-1">
                    <CandidateTimeline candidateId={candidate.candidate_id} />
                </div>
            </div>
        </div>
    );
};


interface InterviewerTalentMemoryProps {
    /** Optional preloaded job list. If omitted, the component fetches them. */
    jobs?: Job[];
}

export const InterviewerTalentMemory: React.FC<InterviewerTalentMemoryProps> = ({ jobs: jobsProp }) => {
    const [scope, setScope] = useState<Scope>('mine');
    const [q, setQ] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [jobFilter, setJobFilter] = useState('');
    const [rows, setRows] = useState<TalentMemoryCandidateSummary[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openCandidate, setOpenCandidate] = useState<TalentMemoryCandidateSummary | null>(null);
    const [jobs, setJobs] = useState<Job[]>(jobsProp ?? []);

    useEffect(() => {
        if (jobsProp) return;
        let cancelled = false;
        api.listJobs()
            .then(res => { if (!cancelled) setJobs(res.jobs); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [jobsProp]);

    // Debounce the free-text query so we don't hammer the API on every keystroke.
    useEffect(() => {
        const handle = window.setTimeout(() => {
            setIsLoading(true);
            setError(null);
            api.getInterviewerMemoryCandidates({
                scope,
                q: q.trim() || undefined,
                status: statusFilter || undefined,
                job_id: jobFilter || undefined,
            })
                .then(res => { setRows(res.candidates); setTotal(res.total); })
                .catch(err => setError(err?.response?.data?.detail || 'Failed to load talent memory'))
                .finally(() => setIsLoading(false));
        }, 250);
        return () => window.clearTimeout(handle);
    }, [scope, q, statusFilter, jobFilter]);

    const activeFilterCount = useMemo(
        () => [q, statusFilter, jobFilter].filter(Boolean).length,
        [q, statusFilter, jobFilter],
    );

    const subTabClass = (active: boolean) =>
        `px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            active ? 'bg-[#0070f3] text-black' : 'text-zinc-400 hover:text-[#111111] hover:bg-zinc-800'
        }`;

    return (
        <div className="space-y-5" data-testid="interviewer-talent-memory">
            <div>
                <h2 className="text-2xl font-bold text-[#111111]">Talent Memory</h2>
                <p className="text-zinc-400 text-sm mt-1">
                    Every interview, review and question bank — searchable forever.
                </p>
            </div>

            <div className="flex gap-2 p-1 bg-zinc-900/60 rounded-lg w-fit">
                <button
                    onClick={() => setScope('mine')}
                    className={subTabClass(scope === 'mine')}
                    data-testid="memory-scope-mine"
                >
                    <ClipboardCheck className="w-4 h-4" />
                    My Interviews
                </button>
                <button
                    onClick={() => setScope('all')}
                    className={subTabClass(scope === 'all')}
                    data-testid="memory-scope-all"
                >
                    <Briefcase className="w-4 h-4" />
                    All Candidates
                </button>
            </div>

            <FilterBar
                q={q} onQ={setQ}
                statusFilter={statusFilter} onStatusFilter={setStatusFilter}
                jobFilter={jobFilter} onJobFilter={setJobFilter}
                jobs={jobs}
                onClear={() => { setQ(''); setStatusFilter(''); setJobFilter(''); }}
                activeFilterCount={activeFilterCount}
            />

            <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>
                    {isLoading ? 'Loading…' : `${total} candidate${total === 1 ? '' : 's'}${scope === 'mine' ? ' you interviewed' : ''}`}
                </span>
            </div>

            {error && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm text-rose-200">
                    {error}
                </div>
            )}

            {!isLoading && !error && rows.length === 0 && (
                <div className="glass-card p-10 text-center">
                    {scope === 'mine' ? (
                        <>
                            <Star className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                            <p className="text-zinc-300 font-medium">No interviews yet</p>
                            <p className="text-zinc-500 text-sm mt-1">
                                Once you complete an interview and submit a review, the candidate will appear here.
                            </p>
                            <button
                                onClick={() => setScope('all')}
                                className="mt-4 inline-flex items-center gap-2 text-sm text-orange-300 hover:text-orange-200"
                            >
                                <Eye className="w-4 h-4" /> Browse all candidates instead
                            </button>
                        </>
                    ) : (
                        <>
                            <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                            <p className="text-zinc-300 font-medium">No candidates match these filters</p>
                            <p className="text-zinc-500 text-sm mt-1">Try clearing filters or expanding scope.</p>
                        </>
                    )}
                </div>
            )}

            {!isLoading && rows.length > 0 && (
                <div className="grid gap-3">
                    {rows.map(row => (
                        <SummaryCard
                            key={row.candidate_id}
                            row={row}
                            onOpen={() => setOpenCandidate(row)}
                        />
                    ))}
                </div>
            )}

            {openCandidate && (
                <DetailModal candidate={openCandidate} onClose={() => setOpenCandidate(null)} />
            )}
        </div>
    );
};

export default InterviewerTalentMemory;
