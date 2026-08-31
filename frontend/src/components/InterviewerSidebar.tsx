import { useDraggable } from '@dnd-kit/core';
import { User } from 'lucide-react';
import type { InterviewerInfo } from '../apiService';

function DraggableInterviewer({ interviewer }: { interviewer: InterviewerInfo }) {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `interviewer-${interviewer.id}`,
        data: { type: 'interviewer', interviewer },
    });

    const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...listeners}
            {...attributes}
            className={`flex items-center gap-3 p-3 rounded-lg cursor-grab active:cursor-grabbing bg-white border border-[#e4e4e7] hover:border-[#0070f3]/40 transition-all ${isDragging ? 'opacity-50 shadow-md' : ''}`}
        >
            <div className="w-8 h-8 rounded-full bg-[#eff6ff] flex items-center justify-center">
                <User className="w-4 h-4 text-[#0070f3]" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#111111] truncate">{interviewer.name}</p>
                <p className="text-xs text-[#71717a] truncate">{interviewer.email}</p>
            </div>
        </div>
    );
}

export function InterviewerSidebar({ interviewers, isLoading }: { interviewers: InterviewerInfo[]; isLoading?: boolean }) {
    if (isLoading) {
        return (
            <div className="bg-white border border-[#e4e4e7] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-[#111111] mb-3">Available Interviewers</h3>
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-lg bg-[#f4f4f5]">
                            <div className="w-8 h-8 rounded-full bg-[#e4e4e7]" />
                            <div className="flex-1">
                                <div className="h-3 bg-[#e4e4e7] rounded w-24 mb-1.5" />
                                <div className="h-2.5 bg-[#e4e4e7] rounded w-32" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border border-[#e4e4e7] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-[#111111] mb-3">
                Available Interviewers
                <span className="ml-1.5 text-xs font-normal text-[#71717a]">({interviewers.length})</span>
            </h3>
            {interviewers.length === 0 ? (
                <p className="text-[#a1a1aa] text-sm py-3 text-center">No interviewers registered yet</p>
            ) : (
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                    {interviewers.map(interviewer => (
                        <DraggableInterviewer key={interviewer.id} interviewer={interviewer} />
                    ))}
                </div>
            )}
            <p className="text-[10px] text-[#a1a1aa] mt-3 text-center">Drag to assign to rounds</p>
        </div>
    );
}
