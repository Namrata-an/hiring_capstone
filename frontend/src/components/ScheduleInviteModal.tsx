/**
 * ScheduleInviteModal - Modal for scheduling interview time before sending invite
 */
import { useEffect, useRef, useState } from 'react';
import { X, Calendar, Clock, Send, AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';

interface ScheduleInviteModalProps {
    candidateName: string;
    interviewerName: string;
    roundName: string;
    onSend: (scheduledAt: string | null, customMessage: string) => Promise<void>;
    onClose: () => void;
}

interface WheelColumnProps {
    title: string;
    options: string[];
    selectedValue: string;
    onSelect: (value: string) => void;
}

function WheelColumn({ title, options, selectedValue, onSelect }: WheelColumnProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const selected = containerRef.current?.querySelector(
            `[data-value="${selectedValue}"]`
        ) as HTMLElement | null;
        selected?.scrollIntoView({ block: 'center' });
    }, [selectedValue]);

    return (
        <div>
            <span className="text-xs text-zinc-500 block mb-2 text-center">{title}</span>
            <div
                ref={containerRef}
                className="h-44 overflow-y-auto rounded-lg border border-[#e4e4e7] bg-zinc-900/70 p-1 space-y-1 snap-y snap-mandatory"
            >
                {options.map(option => {
                    const isSelected = option === selectedValue;
                    return (
                        <button
                            key={option}
                            type="button"
                            data-value={option}
                            onClick={() => onSelect(option)}
                            className={`w-full h-9 rounded-md text-sm font-medium transition-colors snap-center ${
                                isSelected
                                    ? 'bg-[#0070f3] text-white'
                                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                            }`}
                        >
                            {option}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

// Custom time picker component
function TimePicker({ value, onChange }: { value: string; onChange: (time: string) => void }) {
    const [hour, minute] = value.split(':').map(Number);
    const isPM = hour >= 12;
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    
    const hours = Array.from({ length: 12 }, (_, i) => String(i + 1));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
    const periods = ['AM', 'PM'];
    
    const handleHourChange = (newHourValue: string) => {
        const newHour = Number(newHourValue);
        const hour24 = isPM ? (newHour === 12 ? 12 : newHour + 12) : (newHour === 12 ? 0 : newHour);
        onChange(`${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    };
    
    const handleMinuteChange = (newMinute: string) => {
        onChange(`${hour.toString().padStart(2, '0')}:${newMinute}`);
    };
    
    const handlePeriodChange = (period: string) => {
        const newIsPM = period === 'PM';
        let newHour = hour;
        if (newIsPM && hour < 12) {
            newHour = hour + 12;
        } else if (!newIsPM && hour >= 12) {
            newHour = hour - 12;
        }
        onChange(`${newHour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    };
    
    return (
        <div className="bg-zinc-800 border border-[#e4e4e7] rounded-lg p-4">
            <div className="grid grid-cols-3 gap-3">
                <WheelColumn
                    title="Hour"
                    options={hours}
                    selectedValue={String(displayHour)}
                    onSelect={handleHourChange}
                />
                <WheelColumn
                    title="Minute"
                    options={minutes}
                    selectedValue={minute.toString().padStart(2, '0')}
                    onSelect={handleMinuteChange}
                />
                <WheelColumn
                    title="Period"
                    options={periods}
                    selectedValue={isPM ? 'PM' : 'AM'}
                    onSelect={handlePeriodChange}
                />
            </div>
            
            {/* Display selected time */}
            <div className="mt-3 text-center">
                <span className="text-lg font-semibold text-[#111111]">
                    {displayHour}:{minute.toString().padStart(2, '0')} {isPM ? 'PM' : 'AM'}
                </span>
            </div>
            <p className="mt-1 text-center text-xs text-zinc-500">
                Scroll and click to pick any time
            </p>
        </div>
    );
}

export function ScheduleInviteModal({
    candidateName,
    interviewerName,
    roundName,
    onSend,
    onClose
}: ScheduleInviteModalProps) {
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [time, setTime] = useState('10:00');
    const [customMessage, setCustomMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showTimePicker, setShowTimePicker] = useState(false);

    // Format time for display
    const formatTimeDisplay = (timeStr: string) => {
        const [hour, minute] = timeStr.split(':').map(Number);
        const isPM = hour >= 12;
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        return `${displayHour}:${minute.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
    };

    const handleSend = async () => {
        setIsSending(true);
        setError(null);

        try {
            let scheduledAt: string | null = null;
            if (selectedDate && time) {
                // Combine date and time into ISO string
                const [hours, minutes] = time.split(':').map(Number);
                const dateTime = new Date(selectedDate);
                dateTime.setHours(hours, minutes, 0, 0);
                scheduledAt = dateTime.toISOString();
            }
            await onSend(scheduledAt, customMessage);
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to send invite');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-lg border border-[#e4e4e7] p-6 w-full max-w-lg border border-[#e4e4e7] max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#eff6ff] flex items-center justify-center">
                            <Calendar className="w-5 h-5 text-[#0070f3]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-[#111111]">Schedule Interview</h3>
                            <p className="text-sm text-zinc-400">{roundName}</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="text-zinc-400 hover:text-[#111111] transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Info */}
                <div className="bg-[#f4f4f5] rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-zinc-500">Candidate</span>
                            <p className="text-[#111111] font-medium">{candidateName}</p>
                        </div>
                        <div>
                            <span className="text-zinc-500">Interviewer</span>
                            <p className="text-[#111111] font-medium">{interviewerName}</p>
                        </div>
                    </div>
                </div>

                {/* Date Picker */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Proposed Date
                    </label>
                    <div className="datepicker-dark">
                        <DatePicker
                            selected={selectedDate}
                            onChange={(date: Date | null) => setSelectedDate(date)}
                            minDate={new Date()}
                            inline
                            calendarClassName="bg-zinc-800 border-[#e4e4e7] text-[#111111]"
                            dayClassName={(date) => 
                                date.toDateString() === selectedDate?.toDateString()
                                    ? 'bg-[#0070f3] text-white rounded-full'
                                    : 'text-white hover:bg-zinc-700 rounded-full'
                            }
                            renderCustomHeader={({
                                date,
                                decreaseMonth,
                                increaseMonth,
                                prevMonthButtonDisabled,
                                nextMonthButtonDisabled,
                            }) => (
                                <div className="flex items-center justify-between px-2 py-2 bg-zinc-800">
                                    <button
                                        onClick={decreaseMonth}
                                        disabled={prevMonthButtonDisabled}
                                        className="p-1 hover:bg-zinc-700 rounded disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-5 h-5 text-zinc-300" />
                                    </button>
                                    <span className="text-[#111111] font-semibold">
                                        {date.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                    </span>
                                    <button
                                        onClick={increaseMonth}
                                        disabled={nextMonthButtonDisabled}
                                        className="p-1 hover:bg-zinc-700 rounded disabled:opacity-50"
                                    >
                                        <ChevronRight className="w-5 h-5 text-zinc-300" />
                                    </button>
                                </div>
                            )}
                        />
                    </div>
                </div>

                {/* Time Picker */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                        <Clock className="w-4 h-4 inline mr-2" />
                        Proposed Time
                    </label>
                    
                    {/* Toggle button to show/hide time picker */}
                    <button
                        onClick={() => setShowTimePicker(!showTimePicker)}
                        className="w-full px-4 py-3 bg-zinc-800 border border-[#e4e4e7] rounded-lg text-white text-left flex items-center justify-between hover:border-[#0070f3] transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#0070f3]" />
                            {formatTimeDisplay(time)}
                        </span>
                        <span className="text-xs text-zinc-500">Click to change</span>
                    </button>
                    
                    {showTimePicker && (
                        <div className="mt-2">
                            <TimePicker value={time} onChange={setTime} />
                        </div>
                    )}
                </div>

                {/* Custom Message */}
                <div className="mb-6">
                    <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Custom Message (Optional)
                    </label>
                    <textarea
                        value={customMessage}
                        onChange={(e) => setCustomMessage(e.target.value)}
                        placeholder="Add any notes or context for the interviewer..."
                        rows={3}
                        className="w-full px-4 py-3 bg-zinc-800 border border-[#e4e4e7] rounded-lg text-white focus:border-[#0070f3] focus:outline-none resize-none"
                    />
                </div>

                {/* Info note about calendar */}
                {selectedDate && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-6">
                        <p className="text-blue-400 text-sm flex items-start gap-2">
                            <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                            A calendar invite (.ics file) will be attached to the email for easy import into Google Calendar, Outlook, etc.
                        </p>
                    </div>
                )}

                {/* Warning if no date */}
                {!selectedDate && (
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-6">
                        <p className="text-yellow-400 text-sm flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                            No date selected. The invite will be sent without a proposed time.
                        </p>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-6">
                        <p className="text-red-400 text-sm">{error}</p>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={isSending}
                        className="flex-1 px-4 py-3 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSending ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                Send Invite
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
