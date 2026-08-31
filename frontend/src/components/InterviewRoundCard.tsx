/**
 * InterviewRoundCard - Visual card for each interview round
 * Supports dropping interviewers onto it and expanding to show details
 */
import { useDroppable } from '@dnd-kit/core';
import {
    User, Trash2, Send, CheckCircle, XCircle, Clock,
    MoreVertical, Plus, AlertTriangle, ChevronDown, ChevronUp, Calendar,
    RefreshCw, Award, Star
} from 'lucide-react';
import type { InterviewRound, InterviewSchedule, InterviewStatus, InterviewerInfo } from '../apiService';
import { useState } from 'react';

interface PendingAssignment {
    tempId: string;
    roundId: string;
    interviewer: InterviewerInfo;
    candidateId: string;
}

interface InterviewRoundCardProps {
    round: InterviewRound;
    selectedCandidateId: string | null;
    onRemoveAssignment: (scheduleId: string) => void;
    onSendInvite: (scheduleId: string) => void;
    onDeleteRound: (roundId: string) => void;
    onMarkFinalRound?: (roundId: string, isFinal: boolean) => void;
    onReschedule?: (scheduleId: string) => void;
    onProcessReschedule?: (schedule: InterviewSchedule) => void;
    isOver?: boolean;
    pendingAssignments?: PendingAssignment[];
    isDeleting?: boolean;
    hasFinalRound?: boolean; // Whether ANY round in the pipeline is marked as final
}

function getStatusIcon(status: InterviewStatus) {
    switch (status) {
        case 'confirmed':
            return <CheckCircle className="w-4 h-4 text-green-500" />;
        case 'declined':
            return <XCircle className="w-4 h-4 text-red-500" />;
        case 'completed':
            return <Award className="w-4 h-4 text-blue-500" />;
        case 'reschedule_requested':
            return <RefreshCw className="w-4 h-4 text-[#0070f3]" />;
        default:
            return <Clock className="w-4 h-4 text-yellow-500" />;
    }
}

function getStatusBadge(status: InterviewStatus) {
    const styles: Record<InterviewStatus, string> = {
        pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
        confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
        declined: 'bg-red-500/20 text-red-400 border-red-500/30',
        completed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        reschedule_requested: 'bg-[#eff6ff] text-orange-300 border-[#0070f3]/30',
    };
    return styles[status] || styles.pending;
}

function getStatusLabel(status: InterviewStatus): string {
    switch (status) {
        case 'completed': return 'Conducted';
        case 'declined': return 'Declined';
        case 'reschedule_requested': return 'Reschedule pending';
        default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
}

function getRecommendationBadge(recommendation: string): { label: string; className: string } {
    const badges: Record<string, { label: string; className: string }> = {
        'strong_yes': { label: 'Strong Yes', className: 'bg-emerald-600 text-white' },
        'yes': { label: 'Yes', className: 'bg-green-500/50 text-green-200' },
        'maybe': { label: 'Maybe', className: 'bg-yellow-500/50 text-yellow-200' },
        'no': { label: 'No', className: 'bg-red-500/50 text-red-200' },
        'strong_no': { label: 'Strong No', className: 'bg-red-600 text-white' },
    };
    return badges[recommendation] || { label: recommendation, className: 'bg-[#f4f4f5] text-[#71717a]' };
}

interface AssignedInterviewerProps {
    schedule: InterviewSchedule;
    onRemove: () => void;
    onSendInvite: () => void;
    onReschedule?: () => void;
    onProcessReschedule?: () => void;
    isExpanded: boolean;
    showCandidateName?: boolean;
}

function formatDateTime(dateString: string | null | undefined): string {
    if (!dateString) return 'Not scheduled';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

// Component for pending (assigning) interviewer
interface PendingInterviewerProps {
    interviewer: InterviewerInfo;
}

function PendingInterviewer({ interviewer }: PendingInterviewerProps) {
    return (
        <div className="flex flex-col gap-1 p-3 rounded-lg border bg-[#f0f9ff] border-[#0070f3]/30 animate-pulse">
            <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-[#0070f3]">
                    <User className="w-4 h-4 text-[#111111]" />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#111111] truncate">
                        {interviewer.name}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <div className="w-3 h-3 border-2 border-[#0070f3] border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-xs px-1.5 py-0.5 rounded border bg-[#eff6ff] text-orange-300 border-[#0070f3]/40">
                            Assigning...
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function AssignedInterviewer({ schedule, onRemove, onSendInvite, onReschedule, onProcessReschedule, isExpanded, showCandidateName }: AssignedInterviewerProps) {
    const [showMenu, setShowMenu] = useState(false);
    const isCompleted = schedule.status === 'completed';
    const isDeclined = schedule.status === 'declined';
    const isRescheduleRequested = schedule.status === 'reschedule_requested';
    const recommendation = schedule.review_recommendation;

    return (
        <div className={`flex flex-col gap-1 p-3 rounded-lg border group ${
            isCompleted
                ? 'bg-blue-500/10 border-blue-500/30'
                : isDeclined
                    ? 'bg-red-500/10 border-red-500/30'
                    : isRescheduleRequested
                        ? 'bg-[#eff6ff] border-[#0070f3]/40'
                        : 'bg-[#f4f4f5] border-[#e4e4e7]'
        }`}>
            <div className="flex items-center gap-2">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isCompleted 
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                        : isDeclined
                            ? 'bg-gradient-to-br from-red-500 to-red-600'
                            : 'bg-[#0070f3]'
                }`}>
                    <User className="w-4 h-4 text-[#111111]" />
                </div>
                
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#111111] truncate">
                        {schedule.interviewer_name || 'Unknown'}
                    </p>
                    {showCandidateName && schedule.candidate_name && (
                        <p className="text-xs text-zinc-400 truncate">for {schedule.candidate_name}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {getStatusIcon(schedule.status)}
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${getStatusBadge(schedule.status)}`}>
                            {getStatusLabel(schedule.status)}
                        </span>
                        {/* Show recommendation badge prominently if interview is completed */}
                        {isCompleted && recommendation && (
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${getRecommendationBadge(recommendation).className}`}>
                                {getRecommendationBadge(recommendation).label}
                            </span>
                        )}
                    </div>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-1 hover:bg-[#f4f4f5] rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <MoreVertical className="w-4 h-4 text-zinc-400" />
                    </button>
                    
                    {showMenu && (
                        <>
                            <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setShowMenu(false)} 
                            />
                            <div className="absolute right-0 top-8 z-20 bg-white border border-[#e4e4e7] rounded-lg shadow-xl py-1 min-w-[160px]">
                                {schedule.status === 'pending' && (
                                    <button
                                        onClick={() => {
                                            onSendInvite();
                                            setShowMenu(false);
                                        }}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#374151] hover:bg-[#f4f4f5]"
                                    >
                                        <Send className="w-4 h-4" />
                                        Send Invite
                                    </button>
                                )}
                                {isDeclined && onReschedule && (
                                    <button
                                        onClick={() => {
                                            onReschedule();
                                            setShowMenu(false);
                                        }}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#0070f3] hover:bg-[#eff6ff]"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Reschedule
                                    </button>
                                )}
                                {isRescheduleRequested && onProcessReschedule && (
                                    <button
                                        onClick={() => {
                                            onProcessReschedule();
                                            setShowMenu(false);
                                        }}
                                        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-amber-600 hover:bg-amber-50"
                                        data-testid={`process-reschedule-${schedule.id}`}
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Process Reschedule
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        onRemove();
                                        setShowMenu(false);
                                    }}
                                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Remove
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Show overall rating stars if completed */}
            {isCompleted && schedule.review_overall_rating && (
                <div className="flex items-center gap-1 mt-1 ml-11">
                    <span className="text-xs text-zinc-400">Rating:</span>
                    <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(star => (
                            <span 
                                key={star}
                                className={`text-sm ${star <= schedule.review_overall_rating! ? 'text-yellow-400' : 'text-zinc-600'}`}
                            >
                                ★
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Expanded Details */}
            {isExpanded && (
                <div className="mt-2 pt-2 border-t border-[#e4e4e7] space-y-1 text-xs">
                    {schedule.scheduled_at && (
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Calendar className="w-3 h-3" />
                            <span>{formatDateTime(schedule.scheduled_at)}</span>
                        </div>
                    )}
                    {schedule.interviewer_email && (
                        <div className="flex items-center gap-2 text-zinc-400">
                            <span className="font-mono text-xs truncate">{schedule.interviewer_email}</span>
                        </div>
                    )}
                    {schedule.invite_sent_at && (
                        <div className="text-zinc-500">
                            Invited: {formatDateTime(schedule.invite_sent_at)}
                        </div>
                    )}
                    {schedule.confirmed_at && (
                        <div className="text-zinc-500">
                            Responded: {formatDateTime(schedule.confirmed_at)}
                        </div>
                    )}
                    {isRescheduleRequested && (
                        <>
                            {schedule.proposed_at && (
                                <div className="text-orange-300">
                                    ⟳ Proposed: {formatDateTime(schedule.proposed_at)}
                                </div>
                            )}
                            {schedule.reschedule_reason && (
                                <div className="text-zinc-400 italic">"{schedule.reschedule_reason}"</div>
                            )}
                            {schedule.reschedule_count != null && schedule.reschedule_count > 0 && (
                                <div className="text-zinc-500">Attempts: {schedule.reschedule_count}</div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export function InterviewRoundCard({
    round,
    selectedCandidateId,
    onRemoveAssignment,
    onSendInvite,
    onDeleteRound,
    onMarkFinalRound,
    onReschedule,
    onProcessReschedule,
    isOver,
    pendingAssignments = [],
    isDeleting = false,
    hasFinalRound = false,
}: InterviewRoundCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const { setNodeRef } = useDroppable({
        id: `round-${round.id}`,
        data: {
            type: 'round',
            round,
        },
    });

    // Filter schedules for selected candidate
    const candidateSchedules = selectedCandidateId
        ? round.schedules.filter(s => s.candidate_id === selectedCandidateId)
        : round.schedules;
    const isCandidateSelected = Boolean(selectedCandidateId);

    // Check for different statuses
    const hasDeclined = candidateSchedules.some(s => s.status === 'declined');
    const hasPending = candidateSchedules.some(s => s.status === 'pending');
    const hasCompleted = candidateSchedules.some(s => s.status === 'completed');
    const firstDeclinedSchedule = candidateSchedules.find(s => s.status === 'declined');
    
    // Get scheduled time if available
    const scheduledTime = candidateSchedules[0]?.scheduled_at;

    return (
        <div
            ref={setNodeRef}
            className={`
                relative bg-white border-2 rounded-xl p-5 min-w-[340px] max-w-[400px]
                transition-all duration-200
                ${isOver
                    ? 'border-[#0070f3] shadow-lg shadow-blue-500/10 scale-[1.02]'
                    : hasCompleted
                        ? 'border-blue-500/50'
                        : 'border-[#e4e4e7] hover:border-zinc-600'
                }
            `}
        >
            {/* Deleting Overlay */}
            {isDeleting && (
                <div className="absolute inset-0 bg-red-900/80  rounded-xl z-20 flex items-center justify-center">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-red-400 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                        <p className="text-red-200 font-semibold text-lg">Deleting...</p>
                    </div>
                </div>
            )}

            {/* Header with Expand Button */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h4 className="text-lg font-semibold text-[#111111]">
                            {round.round_name || `Round ${round.round_number}`}
                        </h4>
                        {/* Final Round Star Indicator - Only show button if this round is final OR no other round is final */}
                        {onMarkFinalRound && (round.is_final_round || !hasFinalRound) ? (
                            <button
                                onClick={() => onMarkFinalRound(round.id, !round.is_final_round)}
                                className={`p-1 rounded transition-all ${
                                    round.is_final_round
                                        ? 'bg-yellow-500/20 hover:bg-yellow-500/30'
                                        : 'hover:bg-[#f4f4f5]'
                                }`}
                                title={round.is_final_round ? "Unmark as final round" : "Mark as final round"}
                            >
                                <Star
                                    className={`w-4 h-4 transition-all ${
                                        round.is_final_round
                                            ? 'text-yellow-400 fill-yellow-400'
                                            : 'text-zinc-500'
                                    }`}
                                />
                            </button>
                        ) : (
                            !onMarkFinalRound && round.is_final_round && (
                                <span className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">
                                    <Star className="w-3 h-3 fill-yellow-400" />
                                    Final Round
                                </span>
                            )
                        )}
                        {candidateSchedules.length > 0 && (
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="p-1 hover:bg-[#f4f4f5] rounded transition-colors"
                                title={isExpanded ? "Collapse" : "Expand"}
                            >
                                {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-zinc-400" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-zinc-400" />
                                )}
                            </button>
                        )}
                    </div>
                    {round.description && (
                        <p className="text-sm text-zinc-400 mt-1">{round.description}</p>
                    )}
                    {/* Show scheduled time prominently */}
                    {scheduledTime && (
                        <div className="flex items-center gap-1 mt-2 text-sm text-[#0070f3]">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDateTime(scheduledTime)}</span>
                        </div>
                    )}
                </div>
                <button
                    onClick={() => onDeleteRound(round.id)}
                    disabled={!selectedCandidateId}
                    className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors group disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    title={selectedCandidateId ? "Delete round" : "Select a candidate first"}
                >
                    <Trash2 className="w-4 h-4 text-zinc-500 group-hover:text-red-400" />
                </button>
            </div>

            {/* Warning badges */}
            {(hasDeclined) && (
                <div className="mb-4 space-y-2">
                    {hasDeclined && (
                        <div className="flex flex-col gap-2 text-sm text-red-400 bg-red-500/10 px-3 py-3 rounded-lg border border-red-500/30">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span className="font-medium">Interviewer Declined</span>
                            </div>
                            <p className="text-xs text-red-300 ml-6">
                                Use the menu (⋮) to reschedule with a new time, or remove and assign a different interviewer.
                            </p>
                            {onReschedule && firstDeclinedSchedule && (
                                <button
                                    onClick={() => onReschedule(firstDeclinedSchedule.id)}
                                    className="ml-6 mt-1 w-fit px-3 py-1.5 rounded-md text-xs font-medium bg-[#eff6ff] text-orange-300 hover:bg-[#0060df]/30 transition-colors"
                                >
                                    Reschedule with New Time
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Assigned Interviewers */}
            <div className="space-y-3 min-h-[70px]">
                {/* Show pending assignments first */}
                {pendingAssignments
                    .filter(pa => !selectedCandidateId || pa.candidateId === selectedCandidateId)
                    .map(pa => (
                        <PendingInterviewer
                            key={pa.tempId}
                            interviewer={pa.interviewer}
                        />
                    ))}

                {/* Then show actual schedules */}
                {candidateSchedules.length > 0 ? (
                    candidateSchedules.map(schedule => (
                        <AssignedInterviewer
                            key={schedule.id}
                            schedule={schedule}
                            onRemove={() => onRemoveAssignment(schedule.id)}
                            onSendInvite={() => onSendInvite(schedule.id)}
                            onReschedule={onReschedule ? () => onReschedule(schedule.id) : undefined}
                            onProcessReschedule={onProcessReschedule ? () => onProcessReschedule(schedule) : undefined}
                            isExpanded={isExpanded}
                            showCandidateName={!isCandidateSelected}
                        />
                    ))
                ) : pendingAssignments.length === 0 && (
                    <div className={`
                        flex items-center justify-center gap-2 p-5 rounded-lg border-2 border-dashed
                        ${isOver ? 'border-[#0070f3] bg-[#eff6ff]' : 'border-[#e4e4e7]'}
                        transition-colors
                    `}>
                        <Plus className={`w-6 h-6 ${isOver ? 'text-[#0070f3]' : 'text-zinc-500'}`} />
                        <span className={`text-sm ${isOver ? 'text-[#0070f3]' : 'text-zinc-500'}`}>
                            {isOver ? 'Drop to assign' : 'Drop interviewer here'}
                        </span>
                    </div>
                )}
            </div>

            {/* Quick actions */}
            {candidateSchedules.length > 0 && hasPending && (
                <button
                    onClick={() => {
                        candidateSchedules
                            .filter(s => s.status === 'pending')
                            .forEach(s => onSendInvite(s.id));
                    }}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#eff6ff] hover:bg-[#0060df]/30 text-[#0070f3] rounded-lg transition-colors text-sm font-medium"
                >
                    <Send className="w-4 h-4" />
                    Send All Invites
                </button>
            )}
        </div>
    );
}
