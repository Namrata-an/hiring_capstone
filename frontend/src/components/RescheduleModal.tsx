/**
 * RescheduleModal — used in two distinct flows:
 *
 *   - mode="request"  Interviewer asks HR to reschedule.
 *                     Shows the current scheduled time, lets the
 *                     interviewer suggest a new time + reason.
 *
 *   - mode="process"  HR finalizes a reschedule by picking a new
 *                     time. Shows the interviewer's proposal/reason
 *                     when present so HR has context.
 */
import { useState } from 'react';
import { X, Calendar, AlertCircle, Send } from 'lucide-react';

interface BaseProps {
    onClose: () => void;
}

interface RequestModeProps extends BaseProps {
    mode: 'request';
    candidateName: string;
    roundName: string;
    currentScheduledAt?: string;
    onSubmit: (proposedAt: string | null, reason: string) => Promise<void>;
}

interface ProcessModeProps extends BaseProps {
    mode: 'process';
    candidateName: string;
    interviewerName: string;
    roundName: string;
    interviewerProposedAt?: string;
    interviewerReason?: string;
    rescheduleCount?: number;
    onSubmit: (newScheduledAt: string, customMessage: string, notify: boolean) => Promise<void>;
}

type Props = RequestModeProps | ProcessModeProps;

const formatLocal = (iso?: string) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return iso;
    }
};

// Pre-fill the datetime-local input from an ISO timestamp.
const isoToLocalInput = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}`;
};

export default function RescheduleModal(props: Props) {
    const isRequest = props.mode === 'request';

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const initialPicked = isRequest
        ? '' // interviewer has no preset preference
        : isoToLocalInput(
              props.interviewerProposedAt ?? undefined,
          );
    const [pickedTime, setPickedTime] = useState<string>(initialPicked);
    const [reason, setReason] = useState<string>('');
    const [hrMessage, setHrMessage] = useState<string>('');
    const [notify, setNotify] = useState<boolean>(true);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (props.mode === 'process' && !pickedTime) {
            setError('Please pick a new date & time.');
            return;
        }

        try {
            setSubmitting(true);
            if (props.mode === 'request') {
                // datetime-local has no timezone; treat as the user's local clock.
                const isoOrNull = pickedTime ? new Date(pickedTime).toISOString() : null;
                await props.onSubmit(isoOrNull, reason);
            } else {
                const iso = new Date(pickedTime).toISOString();
                await props.onSubmit(iso, hrMessage, notify);
            }
            props.onClose();
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Failed to submit reschedule';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/70  z-50 flex items-center justify-center p-4"
            onClick={props.onClose}
            data-testid="reschedule-modal-overlay"
        >
            <div
                className="bg-zinc-950 border border-[#e4e4e7] rounded-2xl w-full max-w-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                data-testid="reschedule-modal"
            >
                <div className="flex items-start justify-between p-6 border-b border-[#e4e4e7]">
                    <div>
                        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-[#0070f3]" />
                            {isRequest ? 'Request Reschedule' : 'Process Reschedule'}
                        </h2>
                        <p className="text-sm text-zinc-500 mt-1">
                            {isRequest
                                ? 'Ask HR to find a new time for this interview.'
                                : 'Finalize a new time and re-send the invite.'}
                        </p>
                    </div>
                    <button
                        onClick={props.onClose}
                        className="text-zinc-400 hover:text-[#111111]"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    <div className="rounded-lg bg-zinc-900/70 p-4 text-sm space-y-1">
                        <div>
                            <span className="text-zinc-500">Candidate:</span>{' '}
                            <span className="text-[#111111]">{props.candidateName}</span>
                        </div>
                        <div>
                            <span className="text-zinc-500">Round:</span>{' '}
                            <span className="text-[#111111]">{props.roundName}</span>
                        </div>
                        {isRequest && (
                            <div>
                                <span className="text-zinc-500">Currently scheduled:</span>{' '}
                                <span className="text-[#111111]">
                                    {formatLocal(props.currentScheduledAt)}
                                </span>
                            </div>
                        )}
                        {!isRequest && (
                            <>
                                <div>
                                    <span className="text-zinc-500">Interviewer:</span>{' '}
                                    <span className="text-[#111111]">{props.interviewerName}</span>
                                </div>
                                <div>
                                    <span className="text-zinc-500">Their preferred time:</span>{' '}
                                    <span className="text-[#111111]">
                                        {formatLocal(props.interviewerProposedAt)}
                                    </span>
                                </div>
                                {props.interviewerReason && (
                                    <div>
                                        <span className="text-zinc-500">Reason:</span>{' '}
                                        <span className="text-[#111111]">{props.interviewerReason}</span>
                                    </div>
                                )}
                                {props.rescheduleCount !== undefined && props.rescheduleCount > 0 && (
                                    <div className="text-amber-400 text-xs mt-1">
                                        Reschedule attempt #{props.rescheduleCount}
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <div>
                        <label
                            htmlFor="proposed-at"
                            className="block text-sm font-medium text-zinc-300 mb-1"
                        >
                            {isRequest ? 'Suggest a new time (optional)' : 'New scheduled time'}
                        </label>
                        <input
                            id="proposed-at"
                            type="datetime-local"
                            value={pickedTime}
                            onChange={(e) => setPickedTime(e.target.value)}
                            className="w-full bg-zinc-900 border border-[#e4e4e7] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0070f3]"
                            data-testid="reschedule-datetime-input"
                            required={!isRequest}
                        />
                    </div>

                    {isRequest && (
                        <div>
                            <label
                                htmlFor="reason"
                                className="block text-sm font-medium text-zinc-300 mb-1"
                            >
                                Reason (optional)
                            </label>
                            <textarea
                                id="reason"
                                rows={3}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder="e.g. Conflict with another interview"
                                className="w-full bg-zinc-900 border border-[#e4e4e7] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0070f3]"
                                data-testid="reschedule-reason-input"
                            />
                        </div>
                    )}

                    {!isRequest && (
                        <>
                            <div>
                                <label
                                    htmlFor="hr-message"
                                    className="block text-sm font-medium text-zinc-300 mb-1"
                                >
                                    Note for the interviewer (optional)
                                </label>
                                <textarea
                                    id="hr-message"
                                    rows={2}
                                    value={hrMessage}
                                    onChange={(e) => setHrMessage(e.target.value)}
                                    className="w-full bg-zinc-900 border border-[#e4e4e7] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#0070f3]"
                                    data-testid="reschedule-hr-message"
                                />
                            </div>
                            <label className="flex items-center gap-2 text-sm text-zinc-300">
                                <input
                                    type="checkbox"
                                    checked={notify}
                                    onChange={(e) => setNotify(e.target.checked)}
                                    className="accent-orange-500"
                                    data-testid="reschedule-notify-checkbox"
                                />
                                Re-send the invite email with the new time
                            </label>
                        </>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 rounded-md bg-red-500/10 border border-red-500/30 p-3 text-sm text-red-300">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <button
                            type="button"
                            onClick={props.onClose}
                            className="px-4 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#0070f3] hover:bg-[#0060df] text-white disabled:opacity-60 inline-flex items-center gap-2"
                            data-testid="reschedule-submit"
                        >
                            <Send className="w-4 h-4" />
                            {submitting
                                ? 'Sending…'
                                : isRequest
                                    ? 'Send Request'
                                    : 'Confirm New Time'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
