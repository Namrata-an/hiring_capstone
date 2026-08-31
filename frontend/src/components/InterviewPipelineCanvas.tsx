/**
 * InterviewPipelineCanvas - Main drag-drop canvas for interview pipeline management
 */
import { useState, useEffect, useCallback } from 'react';
import {
    DndContext,
    DragOverlay,
    pointerWithin,
    useSensor,
    useSensors,
    PointerSensor,
    useDraggable,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { 
    Plus, ChevronRight, Users, Briefcase, AlertCircle, 
    User, CheckCircle2, RefreshCw 
} from 'lucide-react';
import { InterviewRoundCard } from './InterviewRoundCard';
import { ScheduleInviteModal } from './ScheduleInviteModal';
import RescheduleModal from './RescheduleModal';
import { ToastContainer, useToast } from './Toast';
import { api } from '../apiService';
import type {
    Job,
    Candidate,
    PipelineResponse,
    InterviewerInfo,
    InterviewRound,
    InterviewSchedule,
} from '../apiService';

interface InterviewPipelineCanvasProps {
    jobs: Job[];
}

// Draggable Interviewer Component
interface DraggableInterviewerProps {
    interviewer: InterviewerInfo;
}

function DraggableInterviewer({ interviewer }: DraggableInterviewerProps) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `interviewer-${interviewer.id}`,
        data: {
            type: 'interviewer',
            interviewer,
        },
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`
                flex items-center gap-3 p-3 bg-[#fafafa] border border-[#e4e4e7] rounded-lg 
                cursor-grab active:cursor-grabbing hover:border-[#0070f3]/50 transition-all min-w-[200px]
                ${isDragging ? 'opacity-50 scale-105 shadow-xl shadow-blue-500/10' : ''}
            `}
        >
            <div className="w-10 h-10 rounded-full bg-[#0070f3] flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-[#111111]" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-[#111111] truncate">{interviewer.name}</p>
                <p className="text-xs text-[#71717a] truncate">{interviewer.email}</p>
            </div>
        </div>
    );
}

export function InterviewPipelineCanvas({ jobs }: InterviewPipelineCanvasProps) {
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
    const [pipeline, setPipeline] = useState<PipelineResponse | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeInterviewer, setActiveInterviewer] = useState<InterviewerInfo | null>(null);
    const [activeRoundId, setActiveRoundId] = useState<string | null>(null);

    // Toast notifications
    const { toasts, success, error: showError, warning, closeToast } = useToast();
    
    // New round form
    const [showNewRoundForm, setShowNewRoundForm] = useState(false);
    const [newRoundName, setNewRoundName] = useState('');
    const [newRoundDescription, setNewRoundDescription] = useState('');
    const [isCreatingRound, setIsCreatingRound] = useState(false);
    
    // Schedule invite modal
    const [scheduleModalData, setScheduleModalData] = useState<{
        scheduleId: string;
        candidateName: string;
        interviewerName: string;
        roundName: string;
    } | null>(null);

    // Process-reschedule modal data
    const [rescheduleTarget, setRescheduleTarget] = useState<InterviewSchedule | null>(null);

    // Optimistic UI: Track assignments in progress
    const [pendingAssignments, setPendingAssignments] = useState<Map<string, {
        roundId: string;
        interviewer: InterviewerInfo;
        candidateId: string;
    }>>(new Map());

    // Track rounds being deleted
    const [deletingRoundIds, setDeletingRoundIds] = useState<Set<string>>(new Set());

    // DnD sensors
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8,
            },
        })
    );

    // Fetch pipeline and candidates when job changes
    useEffect(() => {
        if (selectedJobId) {
            fetchPipeline(selectedJobId);
            fetchCandidates(selectedJobId);
        } else {
            setPipeline(null);
            setCandidates([]);
            setSelectedCandidateId(null);
        }
    }, [selectedJobId]);

    // Auto-refresh pipeline every 10 seconds to catch status updates (e.g., interviewer confirmations)
    useEffect(() => {
        if (!selectedJobId) return;

        const intervalId = setInterval(() => {
            fetchPipeline(selectedJobId);
        }, 10000); // 10 seconds

        return () => clearInterval(intervalId);
    }, [selectedJobId]);

    const fetchPipeline = async (jobId: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await api.getJobPipeline(jobId);
            setPipeline(data);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to load pipeline');
            console.error('Pipeline fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchCandidates = async (jobId: string) => {
        try {
            const { candidates } = await api.listCandidates(jobId);
            setCandidates(candidates);
        } catch (err) {
            console.error('Failed to fetch candidates:', err);
        }
    };

    const handleCreateRound = async () => {
        if (!selectedJobId || !pipeline) return;

        const nextRoundNumber = pipeline.rounds.length + 1;
        const roundName = newRoundName || `Round ${nextRoundNumber}`;

        setIsCreatingRound(true);
        try {
            await api.createInterviewRound(selectedJobId, {
                round_number: nextRoundNumber,
                round_name: roundName,
                description: newRoundDescription || undefined,
            });
            setShowNewRoundForm(false);
            setNewRoundName('');
            setNewRoundDescription('');
            await fetchPipeline(selectedJobId);
            success('Round Created', `"${roundName}" has been added to the pipeline`);
        } catch (err: any) {
            showError('Failed to Create Round', err.response?.data?.detail || 'An error occurred');
        } finally {
            setIsCreatingRound(false);
        }
    };

    const handleDeleteRound = async (roundId: string) => {
        if (!selectedCandidateId) {
            warning('Select a Candidate', 'Please select a candidate before deleting rounds');
            return;
        }
        if (!selectedJobId) return;

        // Find round name for better feedback
        const round = pipeline?.rounds.find(r => r.id === roundId);
        const roundName = round?.round_name || `Round ${round?.round_number || ''}`;

        if (!confirm(`Delete "${roundName}" and all its assignments?`)) return;

        // Mark round as deleting
        setDeletingRoundIds(prev => new Set(prev).add(roundId));

        try {
            await api.deleteInterviewRound(selectedJobId, roundId);
            await fetchPipeline(selectedJobId);
            success('Round Deleted', `"${roundName}" has been removed from the pipeline`);
        } catch (err: any) {
            showError('Failed to Delete Round', err.response?.data?.detail || 'An error occurred');
        } finally {
            // Remove from deleting set
            setDeletingRoundIds(prev => {
                const newSet = new Set(prev);
                newSet.delete(roundId);
                return newSet;
            });
        }
    };

    const handleMarkFinalRound = async (roundId: string, isFinal: boolean) => {
        if (!selectedJobId) return;

        // Find round name for better feedback
        const round = pipeline?.rounds.find(r => r.id === roundId);
        const roundName = round?.round_name || `Round ${round?.round_number || ''}`;

        try {
            await api.markRoundAsFinal(selectedJobId, roundId, isFinal);
            await fetchPipeline(selectedJobId);
            success(
                isFinal ? 'Final Round Marked' : 'Final Round Unmarked',
                isFinal
                    ? `"${roundName}" is now marked as the final interview round`
                    : `"${roundName}" is no longer the final round`
            );
        } catch (err: any) {
            showError('Failed to Update Round', err.response?.data?.detail || 'An error occurred');
        }
    };

    const handleRemoveAssignment = async (scheduleId: string) => {
        if (!selectedJobId) return;

        try {
            await api.removeInterviewAssignment(scheduleId);
            await fetchPipeline(selectedJobId);
            success('Assignment Removed', 'Interviewer has been unassigned from this round');
        } catch (err: any) {
            showError('Failed to Remove Assignment', err.response?.data?.detail || 'An error occurred');
        }
    };

    const handleSendInvite = (scheduleId: string) => {
        // Find the schedule details for the modal
        if (!pipeline) return;
        
        let schedule: InterviewSchedule | null = null;
        let roundName = '';
        
        for (const round of pipeline.rounds) {
            const found = round.schedules.find(s => s.id === scheduleId);
            if (found) {
                schedule = found;
                roundName = round.round_name || `Round ${round.round_number}`;
                break;
            }
        }
        
        if (!schedule) {
            setError('Schedule not found');
            return;
        }
        
        const candidate = candidates.find(c => c.id === schedule!.candidate_id);
        
        setScheduleModalData({
            scheduleId,
            candidateName: schedule.candidate_name || candidate?.name || 'Unknown Candidate',
            interviewerName: schedule.interviewer_name || 'Unknown Interviewer',
            roundName
        });
    };

    const handleSendInviteConfirm = async (scheduledAt: string | null, customMessage: string) => {
        if (!scheduleModalData) return;

        try {
            const result = await api.sendInterviewInvite(
                scheduleModalData.scheduleId,
                customMessage || undefined,
                scheduledAt || undefined
            );

            // Show success message
            const timeNote = scheduledAt
                ? ` Scheduled for ${new Date(scheduledAt).toLocaleString()}`
                : '';
            success(
                'Interview Invite Sent',
                `Invitation sent to ${result.sent_to}.${timeNote}`
            );

            if (selectedJobId) await fetchPipeline(selectedJobId);
        } catch (err: any) {
            throw err; // Let the modal handle the error
        }
    };

    const handleProcessReschedule = (schedule: InterviewSchedule) => {
        setRescheduleTarget(schedule);
    };

    const handleProcessRescheduleSubmit = async (
        newScheduledAt: string,
        customMessage: string,
        notify: boolean,
    ) => {
        if (!rescheduleTarget) return;

        try {
            await api.processReschedule(rescheduleTarget.id, {
                new_scheduled_at: newScheduledAt,
                notify_interviewer: notify,
                custom_message: customMessage || undefined,
            });

            success(
                'Interview Rescheduled',
                `New time: ${new Date(newScheduledAt).toLocaleString()}`
            );

            if (selectedJobId) await fetchPipeline(selectedJobId);
        } catch (err: any) {
            showError('Failed to Reschedule', err.response?.data?.detail || 'An error occurred');
        }
    };

    // DnD handlers
    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current?.type === 'interviewer') {
            setActiveInterviewer(active.data.current.interviewer);
        }
    };

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveInterviewer(null);
        setActiveRoundId(null);

        if (!over || !selectedCandidateId) return;

        const draggedData = active.data.current;
        const dropTarget = over.data.current;

        // Check if we dropped an interviewer on a round
        if (
            draggedData?.type === 'interviewer' &&
            dropTarget?.type === 'round'
        ) {
            const interviewer = draggedData.interviewer as InterviewerInfo;
            const round = dropTarget.round as InterviewRound;

            // Generate a temporary ID for optimistic UI
            const tempId = `temp-${Date.now()}-${interviewer.id}`;

            // Optimistic UI: Immediately show the assignment with "assigning" state
            setPendingAssignments(prev => {
                const newMap = new Map(prev);
                newMap.set(tempId, {
                    roundId: round.id,
                    interviewer: interviewer,
                    candidateId: selectedCandidateId,
                });
                return newMap;
            });

            try {
                await api.assignInterviewer({
                    interview_round_id: round.id,
                    candidate_id: selectedCandidateId,
                    interviewer_id: interviewer.id,
                });

                // IMPORTANT: Fetch the real data FIRST, then remove pending
                // This ensures smooth transition with no gap
                if (selectedJobId) await fetchPipeline(selectedJobId);

                // Now remove from pending after real data is loaded
                setPendingAssignments(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(tempId);
                    return newMap;
                });

                success(
                    'Interviewer Assigned',
                    `${interviewer.name} assigned to ${round.round_name || `Round ${round.round_number}`}`
                );
            } catch (err: any) {
                // Remove from pending on error
                setPendingAssignments(prev => {
                    const newMap = new Map(prev);
                    newMap.delete(tempId);
                    return newMap;
                });
                showError('Failed to Assign Interviewer', err.response?.data?.detail || 'An error occurred');
            }
        }
    }, [selectedCandidateId, selectedJobId]);

    const handleDragOver = (event: any) => {
        const { over } = event;
        if (over?.data.current?.type === 'round') {
            setActiveRoundId(over.data.current.round.id);
        } else {
            setActiveRoundId(null);
        }
    };

    // Active jobs only
    const activeJobs = jobs.filter(j => j.status === 'active');

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
        >
            <div className="h-full flex flex-col gap-4">
                {/* Header with Job Selector */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-semibold text-[#111111] flex items-center gap-2">
                            <Briefcase className="w-5 h-5 text-[#0070f3]" />
                            Interview Pipeline
                        </h2>
                        
                        {/* Job Selector */}
                        <select
                            value={selectedJobId || ''}
                            onChange={(e) => setSelectedJobId(e.target.value || null)}
                            className="px-3 py-2 bg-white border border-[#e4e4e7] rounded-lg text-[#111111] focus:border-[#0070f3] focus:outline-none min-w-[200px] text-sm"
                        >
                            <option value="">Select a job...</option>
                            {activeJobs.map(job => (
                                <option key={job.id} value={job.id}>
                                    {job.title} ({job.candidate_count} candidates)
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedJobId && (
                        <button
                            onClick={() => fetchPipeline(selectedJobId)}
                            className="flex items-center gap-2 px-3 py-2 text-sm text-[#71717a] hover:text-[#111111] transition-colors"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Refresh
                        </button>
                    )}
                </div>

                {/* Error message */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{error}</span>
                        <button 
                            onClick={() => setError(null)}
                            className="ml-auto text-red-500 hover:text-[#111111]"
                        >
                            ×
                        </button>
                    </div>
                )}

                {/* No job selected state */}
                {!selectedJobId && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center p-8">
                            <Briefcase className="w-16 h-16 text-[#d4d4d8] mx-auto mb-4" />
                            <h3 className="text-xl font-semibold text-[#71717a] mb-2">
                                Select a Job to Manage Pipeline
                            </h3>
                            <p className="text-[#a1a1aa] max-w-md">
                                Choose a job from the dropdown above to view and manage its interview rounds and interviewer assignments.
                            </p>
                        </div>
                    </div>
                )}

                {/* Pipeline Content */}
                {selectedJobId && pipeline && (
                    <div className="flex-1 flex flex-col gap-6 overflow-hidden">
                        {/* Main Pipeline Area */}
                        <div className="flex-1 overflow-auto">
                            {/* Candidate Selector */}
                            <div className="mb-6 p-4 bg-[#fafafa] border border-[#e4e4e7] rounded-xl">
                                <div className="flex items-center gap-3 mb-3">
                                    <Users className="w-5 h-5 text-[#0070f3]" />
                                    <span className="font-medium text-[#111111]">Select Candidate</span>
                                </div>
                                
                                {candidates.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {candidates.map(candidate => (
                                            <button
                                                key={candidate.id}
                                                onClick={() => setSelectedCandidateId(
                                                    selectedCandidateId === candidate.id ? null : candidate.id
                                                )}
                                                className={`
                                                    flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all
                                                    ${selectedCandidateId === candidate.id
                                                        ? 'bg-[#0070f3] text-white'
                                                        : 'bg-[#f4f4f5] text-[#71717a] hover:bg-[#e4e4e7]'
                                                    }
                                                `}
                                            >
                                                <User className="w-4 h-4" />
                                                {candidate.name}
                                                {selectedCandidateId === candidate.id && (
                                                    <CheckCircle2 className="w-4 h-4" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[#a1a1aa] text-sm">
                                        No candidates for this job yet. Upload resumes first.
                                    </p>
                                )}
                            </div>

                            {/* Pipeline Rounds - Full Width */}
                            <div className="relative flex items-start gap-4 pb-4 overflow-x-auto">
                                {/* Overlay when no candidate is selected */}
                                {!selectedCandidateId && (
                                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-lg">
                                        <div className="text-center px-6 py-8 bg-[#fafafa]/90 border-2 border-[#0070f3]/30 rounded-xl">
                                            <Users className="w-12 h-12 text-[#0070f3] mx-auto mb-3" />
                                            <p className="text-[#111111] font-semibold text-lg mb-1">Select a Candidate First</p>
                                            <p className="text-[#71717a] text-sm">
                                                Choose a candidate from above to manage their interview pipeline
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {pipeline.rounds.map((round, index) => {
                                    // Get pending assignments for this round
                                    const roundPendingAssignments = Array.from(pendingAssignments.entries())
                                        .filter(([_, data]) => data.roundId === round.id)
                                        .map(([tempId, data]) => ({ tempId, ...data }));

                                    const isDeleting = deletingRoundIds.has(round.id);
                                    // Check if any round (not just this one) is marked as final
                                    const hasFinalRound = pipeline.rounds.some(r => r.is_final_round);

                                    return (
                                        <div key={round.id} className="flex items-center gap-2">
                                            <InterviewRoundCard
                                                round={round}
                                                selectedCandidateId={selectedCandidateId}
                                                onRemoveAssignment={handleRemoveAssignment}
                                                onSendInvite={handleSendInvite}
                                                onDeleteRound={handleDeleteRound}
                                                onMarkFinalRound={handleMarkFinalRound}
                                                onReschedule={handleSendInvite}
                                                onProcessReschedule={handleProcessReschedule}
                                                isOver={activeRoundId === round.id}
                                                pendingAssignments={roundPendingAssignments}
                                                isDeleting={isDeleting}
                                                hasFinalRound={hasFinalRound}
                                            />
                                            {index < pipeline.rounds.length - 1 && (
                                                <ChevronRight className="w-6 h-6 text-[#d4d4d8] shrink-0" />
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Add Round Button - Full Width Style */}
                                {showNewRoundForm ? (
                                    <div className="bg-[#fafafa]/80 border-2 border-[#0070f3]/50 rounded-xl p-4 min-w-[320px]">
                                        <h4 className="font-semibold text-[#111111] mb-3">New Round</h4>
                                        <input
                                            type="text"
                                            placeholder="Round name (e.g., Technical)"
                                            value={newRoundName}
                                            onChange={(e) => setNewRoundName(e.target.value)}
                                            disabled={isCreatingRound}
                                            className="w-full px-3 py-2 bg-white border border-[#e4e4e7] rounded-lg text-[#111111] mb-2 focus:border-[#0070f3] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <textarea
                                            placeholder="Description (optional)"
                                            value={newRoundDescription}
                                            onChange={(e) => setNewRoundDescription(e.target.value)}
                                            disabled={isCreatingRound}
                                            className="w-full px-3 py-2 bg-white border border-[#e4e4e7] rounded-lg text-[#111111] mb-3 focus:border-[#0070f3] focus:outline-none resize-none h-20 disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleCreateRound}
                                                disabled={isCreatingRound}
                                                className="flex-1 px-3 py-2 bg-[#0070f3] hover:bg-[#0060df] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                            >
                                                {isCreatingRound ? (
                                                    <>
                                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                                        Creating...
                                                    </>
                                                ) : (
                                                    'Create'
                                                )}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setShowNewRoundForm(false);
                                                    setNewRoundName('');
                                                    setNewRoundDescription('');
                                                }}
                                                disabled={isCreatingRound}
                                                className="px-3 py-2 bg-[#f4f4f5] hover:bg-[#e4e4e7] text-[#374151] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowNewRoundForm(true)}
                                        disabled={!selectedCandidateId}
                                        className="flex flex-col items-center justify-center gap-2 p-6 min-w-[200px] h-[200px] border-2 border-dashed border-[#e4e4e7] hover:border-[#0070f3]/50 rounded-xl transition-colors group disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-[#e4e4e7]"
                                        title={!selectedCandidateId ? 'Select a candidate first' : 'Add a new round'}
                                    >
                                        <Plus className="w-8 h-8 text-[#a1a1aa] group-hover:text-[#0070f3] transition-colors" />
                                        <span className="text-sm text-[#a1a1aa] group-hover:text-[#0070f3] transition-colors">
                                            Add Round
                                        </span>
                                    </button>
                                )}

                                {/* Final Stage Indicator */}
                                {pipeline.rounds.length > 0 && (
                                    <>
                                        <ChevronRight className="w-6 h-6 text-[#d4d4d8] shrink-0" />
                                        <div className="flex flex-col gap-2 min-w-[140px]">
                                            <div className="p-4 bg-green-500/20 border-2 border-green-500/30 rounded-xl text-center">
                                                <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                                                <span className="text-sm font-medium text-green-400">Hired</span>
                                            </div>
                                            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-center">
                                                <span className="text-sm font-medium text-red-600">Rejected</span>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Available Interviewers - Moved to Bottom */}
                        <div className="border-t border-[#e4e4e7] pt-4">
                            <div className="flex items-center gap-3 mb-3 px-2">
                                <Users className="w-5 h-5 text-[#0070f3]" />
                                <h3 className="font-semibold text-[#111111]">Available Interviewers</h3>
                                <span className="text-sm text-[#a1a1aa]">({pipeline.interviewers.length})</span>
                            </div>
                            <p className="text-xs text-[#a1a1aa] mb-3 px-2">
                                Drag interviewers to assign them to rounds
                            </p>
                            <div className="overflow-x-auto">
                                <div className="flex gap-3 pb-2">
                                    {pipeline.interviewers.map(interviewer => (
                                        <DraggableInterviewer 
                                            key={interviewer.id}
                                            interviewer={interviewer}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading state */}
                {isLoading && !pipeline && (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0070f3]"></div>
                    </div>
                )}
            </div>

            {/* Drag Overlay */}
            <DragOverlay>
                {activeInterviewer && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white border-2 border-[#0070f3] shadow-xl shadow-blue-500/10">
                        <div className="w-10 h-10 rounded-full bg-[#0070f3] flex items-center justify-center">
                            <User className="w-5 h-5 text-[#111111]" />
                        </div>
                        <div>
                            <p className="font-medium text-[#111111]">{activeInterviewer.name}</p>
                            <p className="text-xs text-[#71717a]">{activeInterviewer.email}</p>
                        </div>
                    </div>
                )}
            </DragOverlay>

            {/* Schedule Invite Modal */}
            {scheduleModalData && (
                <ScheduleInviteModal
                    candidateName={scheduleModalData.candidateName}
                    interviewerName={scheduleModalData.interviewerName}
                    roundName={scheduleModalData.roundName}
                    onSend={handleSendInviteConfirm}
                    onClose={() => setScheduleModalData(null)}
                />
            )}

            {/* Process Reschedule Modal — HR finalizes a new time */}
            {rescheduleTarget && (
                <RescheduleModal
                    mode="process"
                    candidateName={
                        rescheduleTarget.candidate?.name ||
                        rescheduleTarget.candidate_name ||
                        candidates.find(c => c.id === rescheduleTarget.candidate_id)?.name ||
                        'Candidate'
                    }
                    interviewerName={rescheduleTarget.interviewer_name || 'Interviewer'}
                    roundName={
                        rescheduleTarget.round?.round_name ||
                        rescheduleTarget.round_name ||
                        (rescheduleTarget.round_number != null
                            ? `Round ${rescheduleTarget.round_number}`
                            : 'Interview')
                    }
                    interviewerProposedAt={rescheduleTarget.proposed_at}
                    interviewerReason={rescheduleTarget.reschedule_reason}
                    rescheduleCount={rescheduleTarget.reschedule_count}
                    onSubmit={handleProcessRescheduleSubmit}
                    onClose={() => setRescheduleTarget(null)}
                />
            )}

            {/* Toast Notifications */}
            <ToastContainer toasts={toasts} onClose={closeToast} />
        </DndContext>
    );
}
