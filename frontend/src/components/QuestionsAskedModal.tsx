import React, { useEffect, useState } from 'react';
import { X, ClipboardList, AlertCircle, Edit3, Bot } from 'lucide-react';

import { api } from '../apiService';
import type { InterviewQuestionsSnapshot, InterviewQuestionItem } from '../apiService';

interface Props {
    scheduleId: string;
    onClose: () => void;
}

const CATEGORY_LABELS: Array<[keyof InterviewQuestionsSnapshot, string]> = [
    ['jd_based_questions', 'Job-description specific'],
    ['fundamental_questions', 'Fundamentals'],
    ['resume_questions', 'Resume-specific'],
    ['behavioral_questions', 'Behavioural / startup mindset'],
    ['insights_based_questions', 'Insights-based'],
    ['red_flag_probes', 'Red-flag probes'],
    ['leetcode_questions', 'LeetCode'],
    ['follow_up_topics', 'Follow-up topics'],
];

function isQuestionItem(v: unknown): v is InterviewQuestionItem {
    return !!v && typeof v === 'object' && typeof (v as InterviewQuestionItem).question === 'string';
}

const CategoryBlock: React.FC<{ title: string; items: any[] }> = ({ title, items }) => {
    if (!items || items.length === 0) return null;
    return (
        <section className="rounded-xl border border-[#f4f4f5] bg-zinc-900/40 px-4 py-3">
            <header className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
                <span className="text-[11px] text-zinc-500">{items.length}</span>
            </header>
            <ol className="space-y-2 list-decimal pl-5 marker:text-zinc-600 text-sm">
                {items.map((item, idx) => (
                    <li key={idx}>
                        {isQuestionItem(item) ? (
                            <details className="text-zinc-200 group">
                                <summary className="cursor-pointer marker:text-[#0070f3] outline-none focus:outline-none">
                                    {item.question}
                                </summary>
                                {item.suggested_answer && (
                                    <p className="mt-2 ml-1 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap border-l border-[#e4e4e7]/60 pl-3">
                                        <span className="block text-[10px] uppercase tracking-wide text-zinc-500 mb-1">Suggested answer</span>
                                        {item.suggested_answer}
                                    </p>
                                )}
                            </details>
                        ) : (
                            <span className="text-zinc-200">{String(item)}</span>
                        )}
                    </li>
                ))}
            </ol>
        </section>
    );
};

export const QuestionsAskedModal: React.FC<Props> = ({ scheduleId, onClose }) => {
    const [snap, setSnap] = useState<InterviewQuestionsSnapshot | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        api.getInterviewQuestionsAsked(scheduleId)
            .then(s => { if (!cancelled) setSnap(s); })
            .catch(err => {
                if (!cancelled) setError(err?.response?.data?.detail || 'Could not load the question snapshot');
            })
            .finally(() => { if (!cancelled) setIsLoading(false); });
        return () => { cancelled = true; };
    }, [scheduleId]);

    const total = snap
        ? CATEGORY_LABELS.reduce((sum, [k]) => sum + ((snap[k] as any[] | undefined)?.length ?? 0), 0)
        : 0;

    return (
        <div
            className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4"
            onClick={onClose}
            data-testid="questions-asked-modal"
        >
            <div
                className="bg-zinc-950 border border-[#f4f4f5] rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <header className="px-6 py-4 border-b border-[#f4f4f5] flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <ClipboardList className="w-5 h-5 text-orange-300" />
                            <h2 className="text-lg font-semibold text-zinc-100 truncate">Questions asked</h2>
                            {snap && (
                                <span
                                    className={`px-2 py-0.5 text-[11px] rounded-full inline-flex items-center gap-1 ${
                                        snap.modified_by_interviewer
                                            ? 'bg-[#0070f3]/15 text-orange-300 ring-1 ring-orange-400/30'
                                            : 'bg-zinc-700/40 text-zinc-300 ring-1 ring-zinc-600/40'
                                    }`}
                                    title={snap.modified_by_interviewer ? 'Interviewer edited the LLM output' : 'Used the LLM output as-generated'}
                                >
                                    {snap.modified_by_interviewer ? <><Edit3 className="w-3 h-3" /> Edited</> : <><Bot className="w-3 h-3" /> AI baseline</>}
                                </span>
                            )}
                        </div>
                        {snap && (
                            <p className="text-xs text-zinc-500 mt-1 truncate">
                                {snap.candidate_name}{snap.round_label ? ` · ${snap.round_label}` : ''}
                                {snap.interviewer_name ? ` · by ${snap.interviewer_name}` : ''}
                                {` · ${total} question${total === 1 ? '' : 's'}`}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-zinc-400 hover:text-[#111111]"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>
                <div className="px-6 py-4 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                    {isLoading && (
                        <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-[#0070f3] border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                    {error && (
                        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-6 text-center">
                            <AlertCircle className="w-5 h-5 text-rose-300 mx-auto mb-2" />
                            <p className="text-sm text-rose-200">{error}</p>
                        </div>
                    )}
                    {snap && total === 0 && (
                        <p className="text-sm text-zinc-400 text-center py-6">
                            No questions were captured at the time this interview was marked conducted.
                        </p>
                    )}
                    {snap && CATEGORY_LABELS.map(([key, label]) => (
                        <CategoryBlock
                            key={key as string}
                            title={label}
                            items={(snap[key] as any[] | undefined) ?? []}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default QuestionsAskedModal;
