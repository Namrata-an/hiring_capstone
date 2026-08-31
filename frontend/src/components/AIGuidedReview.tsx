/**
 * AIGuidedReview - AI-powered review assistant
 * Analyzes QB and metrics to generate guided review questions
 * Allows opt-out to manual mode for custom question banks
 */
import { useState } from 'react';
import { Sparkles, Send, Loader2, CheckCircle, AlertCircle, MessageSquare, FileEdit, ChevronRight } from 'lucide-react';

export interface GuidedQuestion {
    question: string;
    purpose: string;
}

export interface ReviewGuidance {
    success: boolean;
    questions?: GuidedQuestion[];
    analysis?: string;
    key_areas?: string[];
    suggestions?: string[];
    fallback?: boolean;
}

export interface ManualReviewData {
    key_areas: string[];
    description: string;
}

interface AIGuidedReviewProps {
    scheduleId: string;
    basicMetrics: {
        technical_skills?: number;
        communication?: number;
        problem_solving?: number;
        cultural_fit?: number;
        overall_rating?: number;
    };
    onAnswersComplete?: (answers: Record<string, string>) => void;
    onManualReviewComplete?: (data: ManualReviewData) => void;
}

export function AIGuidedReview({ scheduleId, basicMetrics, onAnswersComplete, onManualReviewComplete }: AIGuidedReviewProps) {
    const [mode, setMode] = useState<'choice' | 'ai' | 'manual'>('choice');
    const [guidance, setGuidance] = useState<ReviewGuidance | null>(null);
    const [loading, setLoading] = useState(false);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [chatMessages, setChatMessages] = useState<Array<{ role: string; content: string }>>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatMode, setChatMode] = useState(false);
    const [sendingChat, setSendingChat] = useState(false);

    // Manual mode state
    const [manualKeyAreas, setManualKeyAreas] = useState<string[]>(['']);
    const [manualDescription, setManualDescription] = useState('');

    // Don't auto-fetch on mount - wait for user choice
    const handleChooseAI = () => {
        setMode('ai');
        fetchGuidance();
    };

    const handleChooseManual = () => {
        setMode('manual');
    };

    const fetchGuidance = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

            const response = await fetch(`${API_BASE_URL}/api/v1/interviewer/schedule/${scheduleId}/review-assistant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    schedule_id: scheduleId,
                    basic_metrics: basicMetrics,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                setGuidance(data);
            } else {
                // Fallback guidance with full structure
                console.warn('AI service unavailable, using fallback questions');
                setGuidance({
                    success: true,
                    questions: [
                        {
                            question: 'Can you describe specific examples of the candidate\'s technical strengths?',
                            purpose: 'Gather concrete evidence for strengths',
                        },
                        {
                            question: 'What areas should the candidate improve before taking on this role?',
                            purpose: 'Provide actionable feedback',
                        },
                        {
                            question: 'How did the candidate approach problem-solving during the interview?',
                            purpose: 'Assess analytical thinking',
                        },
                        {
                            question: 'Did the candidate demonstrate good communication and collaboration skills?',
                            purpose: 'Evaluate soft skills',
                        },
                        {
                            question: 'Would you want this candidate on your team? Why or why not?',
                            purpose: 'Get overall recommendation context',
                        },
                    ],
                    analysis: 'Based on your ratings, the candidate shows promise in several areas. Focus on providing specific examples and actionable feedback.',
                    key_areas: ['Technical competency', 'Communication skills', 'Problem-solving approach', 'Cultural fit'],
                    suggestions: [
                        'Reference specific questions or scenarios from the interview',
                        'Provide concrete examples rather than general statements',
                        'Include both strengths and areas for growth',
                    ],
                    fallback: true,
                });
            }
        } catch (error) {
            console.error('Failed to fetch review guidance:', error);
            // Still provide fallback questions even on network error
            setGuidance({
                success: true,
                questions: [
                    {
                        question: 'Can you describe specific examples of the candidate\'s technical strengths?',
                        purpose: 'Gather concrete evidence for strengths',
                    },
                    {
                        question: 'What areas should the candidate improve before taking on this role?',
                        purpose: 'Provide actionable feedback',
                    },
                    {
                        question: 'How did the candidate approach problem-solving during the interview?',
                        purpose: 'Assess analytical thinking',
                    },
                    {
                        question: 'Did the candidate demonstrate good communication and collaboration skills?',
                        purpose: 'Evaluate soft skills',
                    },
                    {
                        question: 'Would you want this candidate on your team? Why or why not?',
                        purpose: 'Get overall recommendation context',
                    },
                ],
                analysis: 'Based on your ratings, the candidate shows promise in several areas. Focus on providing specific examples and actionable feedback.',
                key_areas: ['Technical competency', 'Communication skills', 'Problem-solving approach', 'Cultural fit'],
                suggestions: [
                    'Reference specific questions or scenarios from the interview',
                    'Provide concrete examples rather than general statements',
                    'Include both strengths and areas for growth',
                ],
                fallback: true,
            });
        } finally {
            setLoading(false);
        }
    };

    const handleAnswerChange = (index: number, value: string) => {
        setAnswers({ ...answers, [index]: value });

        // Notify parent if all questions answered
        if (guidance?.questions && Object.keys({ ...answers, [index]: value }).length === guidance.questions.length) {
            const answersObj: Record<string, string> = {};
            guidance.questions.forEach((q, i) => {
                answersObj[q.question] = ({ ...answers, [index]: value })[i] || '';
            });
            onAnswersComplete?.(answersObj);
        }
    };

    const handleAddKeyArea = () => {
        setManualKeyAreas([...manualKeyAreas, '']);
    };

    const handleRemoveKeyArea = (index: number) => {
        setManualKeyAreas(manualKeyAreas.filter((_, i) => i !== index));
    };

    const handleKeyAreaChange = (index: number, value: string) => {
        const updated = [...manualKeyAreas];
        updated[index] = value;
        setManualKeyAreas(updated);
    };

    const handleManualComplete = () => {
        const validKeyAreas = manualKeyAreas.filter(ka => ka.trim() !== '');
        if (validKeyAreas.length === 0 || !manualDescription.trim()) {
            alert('Please provide at least one key area and a description');
            return;
        }

        onManualReviewComplete?.({
            key_areas: validKeyAreas,
            description: manualDescription,
        });
    };

    const sendChatMessage = async () => {
        if (!chatInput.trim()) return;

        const userMessage = { role: 'user', content: chatInput };
        const newHistory = [...chatMessages, userMessage];
        setChatMessages(newHistory);
        setChatInput('');
        setSendingChat(true);

        try {
            const token = localStorage.getItem('token');
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:8000';

            const response = await fetch(`${API_BASE_URL}/api/v1/interviewer/schedule/${scheduleId}/review-chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: chatInput,
                    conversation_history: newHistory,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setChatMessages([...newHistory, { role: 'assistant', content: data.message }]);
                } else {
                    // Show error message in chat
                    setChatMessages([...newHistory, {
                        role: 'assistant',
                        content: 'Sorry, I\'m unable to respond right now. The AI service is temporarily unavailable.'
                    }]);
                }
            } else {
                // Show error message in chat
                setChatMessages([...newHistory, {
                    role: 'assistant',
                    content: 'Sorry, I\'m unable to respond right now. The AI service is temporarily unavailable.'
                }]);
            }
        } catch (error) {
            console.error('Failed to send chat message:', error);
            // Show error message in chat
            setChatMessages([...newHistory, {
                role: 'assistant',
                content: 'Sorry, I\'m unable to respond right now. Please check your connection and try again.'
            }]);
        } finally {
            setSendingChat(false);
        }
    };

    // Choice screen
    if (mode === 'choice') {
        return (
            <div className="space-y-6">
                <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <Sparkles className="w-6 h-6 text-purple-400 mt-1 flex-shrink-0" />
                        <div>
                            <h3 className="text-lg font-semibold text-white mb-2">Choose Review Approach</h3>
                            <p className="text-sm text-zinc-400">
                                Select how you'd like to structure your review feedback.
                            </p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        {/* AI-Guided Option */}
                        <button
                            onClick={handleChooseAI}
                            className="group bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-purple-500/30 hover:border-purple-500/50 rounded-xl p-6 text-left transition-all hover:scale-[1.02]"
                        >
                            <div className="flex items-start gap-3 mb-3">
                                <Sparkles className="w-5 h-5 text-purple-400 mt-0.5" />
                                <div>
                                    <h4 className="text-[#111111] font-semibold mb-1">AI-Guided Review</h4>
                                    <p className="text-sm text-zinc-400">
                                        Get AI-generated questions based on QB snapshot and metrics
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-purple-400 text-sm font-medium">
                                <span>Start AI Review</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>

                        {/* Manual Option */}
                        <button
                            onClick={handleChooseManual}
                            className="group bg-gradient-to-br from-orange-500/10 to-yellow-500/10 border border-[#0070f3]/30 hover:border-[#0070f3]/50 rounded-xl p-6 text-left transition-all hover:scale-[1.02]"
                        >
                            <div className="flex items-start gap-3 mb-3">
                                <FileEdit className="w-5 h-5 text-[#0070f3] mt-0.5" />
                                <div>
                                    <h4 className="text-[#111111] font-semibold mb-1">Manual Review</h4>
                                    <p className="text-sm text-zinc-400">
                                        Provide your own key areas and description (for custom QBs)
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-[#0070f3] text-sm font-medium">
                                <span>Enter Manual Review</span>
                                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>
                    </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">
                        💡 About Baton Passing:
                    </h4>
                    <p className="text-sm text-blue-300">
                        Either mode will pass context to the next interviewer. AI mode analyzes your QB and generates targeted questions. Manual mode lets you define your own review structure if you used custom questions.
                    </p>
                </div>
            </div>
        );
    }

    // Manual mode
    if (mode === 'manual') {
        return (
            <div className="space-y-6">
                <div className="bg-[#eff6ff] border border-[#0070f3]/30 rounded-xl p-4 flex items-start gap-3">
                    <FileEdit className="w-5 h-5 text-[#0070f3] mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="text-[#111111] font-semibold mb-1">Manual Review Mode</h3>
                        <p className="text-sm text-orange-300">
                            Provide key areas you focused on and your overall description. This will be passed to the next interviewer.
                        </p>
                    </div>
                    <button
                        onClick={() => setMode('choice')}
                        className="text-[#0070f3] hover:text-orange-300 text-sm font-medium"
                    >
                        ← Back
                    </button>
                </div>

                {/* Key Areas */}
                <div>
                    <label className="text-sm font-semibold text-zinc-300 block mb-3">
                        Key Areas Assessed
                        <span className="text-xs text-zinc-500 ml-2 font-normal">(e.g., "System Design", "React Hooks", "API Design")</span>
                    </label>
                    <div className="space-y-2">
                        {manualKeyAreas.map((area, index) => (
                            <div key={index} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={area}
                                    onChange={(e) => handleKeyAreaChange(index, e.target.value)}
                                    placeholder={`Key area ${index + 1}...`}
                                    className="flex-1 bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-[#0070f3] focus:outline-none"
                                />
                                {manualKeyAreas.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveKeyArea(index)}
                                        className="px-3 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 text-sm"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                        ))}
                        <button
                            onClick={handleAddKeyArea}
                            className="text-sm text-[#0070f3] hover:text-orange-300 font-medium"
                        >
                            + Add Key Area
                        </button>
                    </div>
                </div>

                {/* Description */}
                <div>
                    <label className="text-sm font-semibold text-zinc-300 block mb-3">
                        Interview Description
                        <span className="text-xs text-zinc-500 ml-2 font-normal">(What you covered, how candidate performed)</span>
                    </label>
                    <textarea
                        value={manualDescription}
                        onChange={(e) => setManualDescription(e.target.value)}
                        placeholder="Describe what you covered in this interview, the questions you asked, and your observations about the candidate's performance..."
                        className="w-full bg-zinc-800 text-white rounded-lg p-4 text-sm min-h-[200px] focus:ring-2 focus:ring-[#0070f3] focus:outline-none"
                    />
                </div>

                {/* Complete Button */}
                <div className="flex justify-end">
                    <button
                        onClick={handleManualComplete}
                        className="px-6 py-3 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] transition-colors flex items-center gap-2 font-medium"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Complete Manual Review
                    </button>
                </div>
            </div>
        );
    }

    // AI mode - loading
    if (loading) {
        return (
            <div className="bg-[#fafafa] border border-[#e4e4e7] rounded-xl p-8">
                <div className="flex flex-col items-center justify-center gap-4">
                    <Loader2 className="w-12 h-12 text-[#0070f3] animate-spin" />
                    <p className="text-zinc-400">Analyzing interview and generating guidance...</p>
                </div>
            </div>
        );
    }

    // AI mode - error
    if (!guidance || !guidance.success) {
        return (
            <div className="space-y-4">
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                        <h3 className="text-lg font-semibold text-red-400">Unable to Load AI Guidance</h3>
                    </div>
                    <p className="text-sm text-red-300">{guidance?.analysis || 'An error occurred. Please proceed with manual review.'}</p>
                </div>
                <button
                    onClick={() => setMode('choice')}
                    className="text-[#0070f3] hover:text-orange-300 text-sm font-medium"
                >
                    ← Back to mode selection
                </button>
            </div>
        );
    }

    // AI mode - success
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-purple-400" />
                    <span className="text-sm font-medium text-zinc-400">AI-Guided Mode</span>
                </div>
                <button
                    onClick={() => setMode('choice')}
                    className="text-[#0070f3] hover:text-orange-300 text-sm font-medium"
                >
                    ← Back
                </button>
            </div>
            {/* Header with Analysis */}
            <div className="bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <Sparkles className="w-6 h-6 text-purple-400 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">AI Analysis</h3>
                        <p className="text-sm text-purple-200">{guidance.analysis}</p>

                        {guidance.key_areas && guidance.key_areas.length > 0 && (
                            <div className="mt-3">
                                <h4 className="text-xs font-semibold text-purple-300 uppercase tracking-wide mb-2">
                                    Focus Areas:
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                    {guidance.key_areas.map((area, idx) => (
                                        <span
                                            key={idx}
                                            className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs border border-purple-500/30"
                                        >
                                            {area}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Fallback Warning */}
            {guidance.fallback && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-sm text-yellow-300">
                        <AlertCircle className="w-4 h-4" />
                        <span>Using fallback questions (AI service unavailable)</span>
                    </div>
                </div>
            )}

            {/* Guided Questions */}
            {guidance.questions && guidance.questions.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide">Guided Questions</h3>

                    {guidance.questions.map((q, index) => (
                        <div key={index} className="bg-[#fafafa] border border-[#e4e4e7] rounded-lg p-4">
                            <div className="flex items-start gap-3 mb-3">
                                <div className="flex items-center justify-center w-6 h-6 bg-[#eff6ff] rounded-full border border-[#0070f3]/30 flex-shrink-0">
                                    <span className="text-xs font-bold text-[#0070f3]">{index + 1}</span>
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-semibold text-white mb-1">{q.question}</h4>
                                    <p className="text-xs text-zinc-500 italic">{q.purpose}</p>
                                </div>
                            </div>

                            <textarea
                                value={answers[index] || ''}
                                onChange={(e) => handleAnswerChange(index, e.target.value)}
                                placeholder="Type your answer here..."
                                className="w-full bg-zinc-800 text-white rounded-lg p-3 text-sm min-h-[100px] focus:ring-2 focus:ring-[#0070f3] focus:outline-none"
                            />

                            {answers[index] && answers[index].trim() && (
                                <div className="flex items-center gap-2 mt-2 text-xs text-green-400">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Answer recorded</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Suggestions */}
            {guidance.suggestions && guidance.suggestions.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wide mb-2">
                        💡 Tips for Better Reviews:
                    </h4>
                    <ul className="space-y-1">
                        {guidance.suggestions.map((suggestion, idx) => (
                            <li key={idx} className="text-sm text-blue-300 flex items-start gap-2">
                                <span className="text-blue-500 mt-0.5">•</span>
                                <span>{suggestion}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Chat Assistant (Optional) */}
            <div className="border-t border-[#e4e4e7] pt-4">
                <button
                    onClick={() => setChatMode(!chatMode)}
                    className="flex items-center gap-2 text-sm text-zinc-400 hover:text-[#111111] transition-colors"
                >
                    <MessageSquare className="w-4 h-4" />
                    <span>{chatMode ? 'Hide' : 'Show'} AI Chat Assistant</span>
                </button>

                {chatMode && (
                    <div className="mt-4 bg-[#fafafa] border border-[#e4e4e7] rounded-lg p-4">
                        <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                            {chatMessages.length === 0 && (
                                <p className="text-sm text-zinc-500 italic">
                                    Ask the AI assistant for help refining your answers...
                                </p>
                            )}
                            {chatMessages.map((msg, idx) => (
                                <div
                                    key={idx}
                                    className={`p-3 rounded-lg text-sm ${
                                        msg.role === 'user'
                                            ? 'bg-[#eff6ff] text-orange-200 ml-8'
                                            : 'bg-zinc-800 text-zinc-300 mr-8'
                                    }`}
                                >
                                    {msg.content}
                                </div>
                            ))}
                            {sendingChat && (
                                <div className="flex items-center gap-2 text-sm text-zinc-500">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>AI is thinking...</span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()}
                                placeholder="Ask for help or clarification..."
                                className="flex-1 bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-[#0070f3] focus:outline-none"
                                disabled={sendingChat}
                            />
                            <button
                                onClick={sendChatMessage}
                                disabled={!chatInput.trim() || sendingChat}
                                className="px-4 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
