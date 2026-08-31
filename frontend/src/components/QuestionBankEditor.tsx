import React, { useState, useEffect, useRef } from 'react';
import type { 
  QuestionBank, 
  QuestionWithAnswer, 
  PreviousReview,
  Candidate 
} from '../apiService';
import { api } from '../apiService';
import { 
  Sparkles, Download, MessageSquare, Edit3, Trash2, Plus, 
  Send, ChevronDown, ChevronUp, ExternalLink, Code, 
  CheckCircle, AlertCircle, History, Save, X,
  FileText, Brain
} from 'lucide-react';
import { jsPDF } from 'jspdf';

interface QuestionBankEditorProps {
  candidate: Candidate;
  onClose?: () => void;
}

type QuestionCategory = 'jd_based' | 'fundamental' | 'resume' | 'behavioral' | 'insights_based' | 'red_flag_probes';

const CATEGORY_CONFIG: Record<QuestionCategory, { title: string; emoji: string; color: string; colorClass: string }> = {
  jd_based: { title: 'Job Description Questions', emoji: '📋', color: '#f97316', colorClass: 'orange' },
  fundamental: { title: 'Technical Fundamentals', emoji: '🧠', color: '#3b82f6', colorClass: 'blue' },
  resume: { title: 'Resume-Specific Questions', emoji: '📄', color: '#a855f7', colorClass: 'purple' },
  behavioral: { title: 'Behavioral/Startup Mindset', emoji: '💭', color: '#22c55e', colorClass: 'green' },
  insights_based: { title: 'Insights-Based Questions', emoji: '🔍', color: '#eab308', colorClass: 'yellow' },
  red_flag_probes: { title: 'Red Flag Probes', emoji: '⚠️', color: '#ef4444', colorClass: 'red' },
};

export const QuestionBankEditor: React.FC<QuestionBankEditorProps> = ({ candidate, onClose }) => {
  const [questionBank, setQuestionBank] = useState<QuestionBank | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'chat' | 'leetcode' | 'context'>('questions');
  const [roundNumber, setRoundNumber] = useState(1);
  
  // Chat state
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Edit state
  const [editingQuestion, setEditingQuestion] = useState<{ category: QuestionCategory; index: number } | null>(null);
  const [editForm, setEditForm] = useState({ question: '', suggested_answer: '' });
  const [isAddingQuestion, setIsAddingQuestion] = useState<QuestionCategory | null>(null);
  const [addForm, setAddForm] = useState({ question: '', suggested_answer: '' });
  
  // Previous reviews context
  const [previousReviews, setPreviousReviews] = useState<PreviousReview[]>([]);
  const [goldAreas, setGoldAreas] = useState<string[]>([]);
  const [greyAreas, setGreyAreas] = useState<string[]>([]);

  useEffect(() => {
    fetchQuestionBank();
    fetchPreviousReviews();
  }, [candidate.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [questionBank?.chat_history]);

  const fetchQuestionBank = async () => {
    setIsLoading(true);
    try {
      const qb = await api.getQuestionBank(candidate.id);
      setQuestionBank(qb);
      if (qb.round_number) setRoundNumber(qb.round_number);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Error fetching QB:', error);
      }
    }
    setIsLoading(false);
  };

  const fetchPreviousReviews = async () => {
    try {
      const data = await api.getPreviousReviews(candidate.id);
      setPreviousReviews(data.reviews);
      setGoldAreas(data.gold_areas);
      setGreyAreas(data.grey_areas);
      if (data.total_rounds_completed > 0) {
        setRoundNumber(data.total_rounds_completed + 1);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const qb = await api.generateQuestionBank(candidate.id, undefined, roundNumber);
      setQuestionBank(qb);
    } catch (error) {
      console.error('Error generating QB:', error);
      alert('Failed to generate question bank');
    }
    setIsGenerating(false);
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    
    setIsChatLoading(true);
    const message = chatInput;
    setChatInput('');
    
    try {
      const response = await api.chatModifyQuestionBank(candidate.id, message);
      if (response.success) {
        setQuestionBank(response.question_bank);
      } else {
        alert(response.message);
      }
    } catch (error) {
      console.error('Error in chat:', error);
      alert('Failed to process your request');
    }
    setIsChatLoading(false);
  };

  const handleAddQuestion = async (category: QuestionCategory) => {
    if (!addForm.question.trim()) return;
    
    try {
      await api.addQuestion(candidate.id, category, addForm.question, addForm.suggested_answer);
      await fetchQuestionBank();
      setIsAddingQuestion(null);
      setAddForm({ question: '', suggested_answer: '' });
    } catch (error) {
      console.error('Error adding question:', error);
      alert('Failed to add question');
    }
  };

  const handleUpdateQuestion = async () => {
    if (!editingQuestion || !editForm.question.trim()) return;
    
    try {
      await api.updateQuestion(
        candidate.id, 
        editingQuestion.category, 
        editingQuestion.index,
        editForm.question,
        editForm.suggested_answer
      );
      await fetchQuestionBank();
      setEditingQuestion(null);
      setEditForm({ question: '', suggested_answer: '' });
    } catch (error) {
      console.error('Error updating question:', error);
      alert('Failed to update question');
    }
  };

  const handleDeleteQuestion = async (category: QuestionCategory, index: number) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
      await api.deleteQuestion(candidate.id, category, index);
      await fetchQuestionBank();
    } catch (error) {
      console.error('Error deleting question:', error);
      alert('Failed to delete question');
    }
  };

  const startEdit = (category: QuestionCategory, index: number, q: QuestionWithAnswer | string) => {
    const question = typeof q === 'string' ? q : q.question;
    const answer = typeof q === 'string' ? '' : q.suggested_answer;
    setEditingQuestion({ category, index });
    setEditForm({ question, suggested_answer: answer });
  };

  const handleDownloadPDF = () => {
    if (!questionBank) return;
    
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;
    
    const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
      doc.setFontSize(fontSize);
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      const lines = doc.splitTextToSize(text, contentWidth);
      
      if (y + lines.length * 5 > doc.internal.pageSize.getHeight() - 20) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(lines, margin, y);
      y += lines.length * 5 + 2;
    };
    
    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(249, 115, 22);
    doc.text(`Question Bank: ${candidate.name}`, margin, y);
    y += 10;
    
    // Metadata
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, margin, y);
    y += 5;
    doc.text(`Round: ${questionBank.round_number || 1}`, margin, y);
    y += 10;
    
    doc.setTextColor(0);
    
    // Add question sections
    const sections: [string, (QuestionWithAnswer | string)[] | undefined, string][] = [
      ['📋 Job Description Questions', questionBank.jd_based_questions, '#f97316'],
      ['🧠 Technical Fundamentals', questionBank.fundamental_questions, '#3b82f6'],
      ['📄 Resume-Specific Questions', questionBank.resume_questions, '#a855f7'],
      ['💭 Behavioral/Startup Mindset', questionBank.behavioral_questions, '#22c55e'],
      ['🔍 Insights-Based Questions', questionBank.insights_based_questions, '#eab308'],
      ['⚠️ Red Flag Probes', questionBank.red_flag_probes, '#ef4444'],
    ];
    
    sections.forEach(([title, questions]) => {
      if (!questions || questions.length === 0) return;
      
      y += 5;
      addText(title, 12, true);
      y += 3;
      
      questions.forEach((q, i) => {
        const question = typeof q === 'string' ? q : q.question;
        const answer = typeof q === 'string' ? '' : q.suggested_answer;
        
        addText(`${i + 1}. ${question}`, 10, false);
        
        if (answer) {
          doc.setTextColor(34, 197, 94);
          addText(`   ✓ Expected: ${answer}`, 9, false);
          doc.setTextColor(0);
        }
        y += 2;
      });
    });
    
    // Add LeetCode section
    if (questionBank.leetcode_questions && questionBank.leetcode_questions.length > 0) {
      y += 10;
      addText('💻 LeetCode Practice Questions', 12, true);
      y += 3;
      
      questionBank.leetcode_questions.forEach((lc, i) => {
        addText(`${i + 1}. ${lc.title} (${lc.difficulty})`, 10, false);
        doc.setTextColor(59, 130, 246);
        addText(`   Link: ${lc.url}`, 9, false);
        doc.setTextColor(0);
        if (lc.solution_hint) {
          addText(`   Hint: ${lc.solution_hint}`, 9, false);
        }
        y += 2;
      });
    }
    
    doc.save(`${candidate.name.replace(/\s+/g, '_')}_question_bank.pdf`);
  };

  const getQuestionsByCategory = (category: QuestionCategory): (QuestionWithAnswer | string)[] => {
    if (!questionBank) return [];
    const map: Record<QuestionCategory, (QuestionWithAnswer | string)[] | undefined> = {
      jd_based: questionBank.jd_based_questions,
      fundamental: questionBank.fundamental_questions,
      resume: questionBank.resume_questions,
      behavioral: questionBank.behavioral_questions,
      insights_based: questionBank.insights_based_questions,
      red_flag_probes: questionBank.red_flag_probes,
    };
    return map[category] || [];
  };

  // Render question section with edit capability
  const renderQuestionSection = (category: QuestionCategory) => {
    const config = CATEGORY_CONFIG[category];
    const questions = getQuestionsByCategory(category);
    const [isExpanded, setIsExpanded] = useState(true);
    
    const colorClasses: Record<string, string> = {
      orange: 'bg-[#eff6ff] border-[#0070f3]/20 text-[#0070f3]',
      blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
      green: 'bg-green-500/10 border-green-500/20 text-green-400',
      yellow: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
      red: 'bg-red-500/10 border-red-500/20 text-red-400',
    };

    return (
      <div key={category} className={`border rounded-lg mb-4 ${colorClasses[config.colorClass]}`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between p-4"
        >
          <span className="font-medium">{config.emoji} {config.title} ({questions.length})</span>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setIsAddingQuestion(category); }}
              className="p-1 hover:bg-[#f4f4f5] rounded"
              title="Add question"
            >
              <Plus className="w-4 h-4" />
            </button>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>
        
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3">
            {/* Add form */}
            {isAddingQuestion === category && (
              <div className="bg-black/30 rounded-lg p-4 space-y-3">
                <input
                  type="text"
                  value={addForm.question}
                  onChange={(e) => setAddForm({ ...addForm, question: e.target.value })}
                  placeholder="Enter question..."
                  className="w-full bg-gray-800 text-white rounded-lg p-2 text-sm"
                />
                <textarea
                  value={addForm.suggested_answer}
                  onChange={(e) => setAddForm({ ...addForm, suggested_answer: e.target.value })}
                  placeholder="Suggested answer / what to look for..."
                  className="w-full bg-gray-800 text-white rounded-lg p-2 text-sm min-h-[60px]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddQuestion(category)}
                    className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => { setIsAddingQuestion(null); setAddForm({ question: '', suggested_answer: '' }); }}
                    className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-[#d4d4d8]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            
            {questions.map((q, i) => {
              const isEditing = editingQuestion?.category === category && editingQuestion?.index === i;
              const question = typeof q === 'string' ? q : q.question;
              const answer = typeof q === 'string' ? '' : q.suggested_answer;
              
              if (isEditing) {
                return (
                  <div key={i} className="bg-black/30 rounded-lg p-4 space-y-3">
                    <input
                      type="text"
                      value={editForm.question}
                      onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                      className="w-full bg-gray-800 text-white rounded-lg p-2 text-sm"
                    />
                    <textarea
                      value={editForm.suggested_answer}
                      onChange={(e) => setEditForm({ ...editForm, suggested_answer: e.target.value })}
                      className="w-full bg-gray-800 text-white rounded-lg p-2 text-sm min-h-[60px]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateQuestion}
                        className="px-3 py-1 bg-emerald-600 text-white rounded text-sm hover:bg-green-700"
                      >
                        <Save className="w-3 h-3 inline mr-1" /> Save
                      </button>
                      <button
                        onClick={() => setEditingQuestion(null)}
                        className="px-3 py-1 bg-gray-700 text-white rounded text-sm hover:bg-[#d4d4d8]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }
              
              return (
                <div key={i} className="bg-black/30 rounded-lg overflow-hidden group">
                  <div className="flex items-start gap-3 p-3">
                    <span className="text-gray-500 font-mono text-sm">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-gray-200 text-sm">{question}</p>
                      {answer && (
                        <div className="mt-2 bg-green-500/10 border border-green-500/20 p-2 rounded">
                          <p className="text-green-400 text-xs font-medium mb-1">✓ What to look for:</p>
                          <p className="text-gray-300 text-sm">{answer}</p>
                        </div>
                      )}
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <button
                        onClick={() => startEdit(category, i, q)}
                        className="p-1 hover:bg-[#f4f4f5] rounded text-gray-400 hover:text-[#111111]"
                        title="Edit"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteQuestion(category, i)}
                        className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {questions.length === 0 && !isAddingQuestion && (
              <p className="text-gray-500 text-sm text-center py-4">No questions in this category</p>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-[#e4e4e7] overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-[#e4e4e7] flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#0070f3]" />
            Question Bank
          </h2>
          <p className="text-gray-400 text-sm">
            {candidate.name} • Round {roundNumber}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={roundNumber}
            onChange={(e) => setRoundNumber(parseInt(e.target.value))}
            className="bg-gray-800 text-white rounded-lg px-3 py-2 text-sm"
          >
            {[1, 2, 3, 4, 5].map(n => (
              <option key={n} value={n}>Round {n}</option>
            ))}
          </select>
          {questionBank && (
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-lg hover:bg-[#d4d4d8] text-sm"
            >
              <Download className="w-4 h-4" />
              PDF
            </button>
          )}
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="flex items-center gap-2 px-4 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] disabled:opacity-50 text-sm"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {questionBank ? 'Regenerate' : 'Generate'}
              </>
            )}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-[#111111]">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex border-b border-[#e4e4e7]">
        {[
          { id: 'questions', label: 'Questions', icon: FileText },
          { id: 'chat', label: 'AI Assistant', icon: MessageSquare },
          { id: 'leetcode', label: 'LeetCode', icon: Code },
          { id: 'context', label: 'Previous Rounds', icon: History },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-[#0070f3] border-b-2 border-[#0070f3]'
                : 'text-gray-400 hover:text-[#111111]'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#0070f3] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : activeTab === 'questions' ? (
          questionBank ? (
            <div>
              {(['jd_based', 'fundamental', 'resume', 'behavioral', 'insights_based', 'red_flag_probes'] as QuestionCategory[]).map(category => 
                renderQuestionSection(category)
              )}
            </div>
          ) : (
            <div className="text-center py-16">
              <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No question bank generated yet</p>
              <p className="text-gray-500 text-sm mt-2">Click "Generate" to create a tailored question bank</p>
            </div>
          )
        ) : activeTab === 'chat' ? (
          <div className="flex flex-col h-full">
            {/* Chat history */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-4">
              {!questionBank && (
                <div className="text-center py-8">
                  <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Generate a question bank first to use the chat</p>
                </div>
              )}
              
              {questionBank && (!questionBank.chat_history || questionBank.chat_history.length === 0) && (
                <div className="bg-[#f4f4f5] rounded-lg p-4">
                  <p className="text-gray-300 text-sm mb-3">💡 You can ask me to modify the question bank. Try:</p>
                  <ul className="space-y-2 text-gray-400 text-sm">
                    <li>"Add more system design questions"</li>
                    <li>"Add a question about their AWS experience"</li>
                    <li>"Make the behavioral questions more startup-focused"</li>
                    <li>"Remove questions about React"</li>
                    <li>"Add follow-up questions about their leadership experience"</li>
                  </ul>
                </div>
              )}
              
              {questionBank?.chat_history?.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.role === 'user'
                        ? 'bg-[#eff6ff] text-orange-100'
                        : 'bg-gray-800 text-gray-200'
                    }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            {/* Chat input */}
            {questionBank && (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                  placeholder="Ask me to modify the question bank..."
                  className="flex-1 bg-gray-800 text-white rounded-lg px-4 py-2 text-sm"
                  disabled={isChatLoading}
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={isChatLoading || !chatInput.trim()}
                  className="px-4 py-2 bg-[#0070f3] text-white rounded-lg hover:bg-[#0060df] disabled:opacity-50"
                >
                  {isChatLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </div>
        ) : activeTab === 'leetcode' ? (
          <div className="space-y-4">
            <div className="bg-[#f4f4f5] rounded-lg p-4 mb-6">
              <h3 className="text-[#111111] font-medium flex items-center gap-2 mb-2">
                <Code className="w-5 h-5 text-[#0070f3]" />
                LeetCode Practice Questions
              </h3>
              <p className="text-gray-400 text-sm">
                Curated questions based on the candidate's skills: {candidate.skills?.join(', ') || 'N/A'}
              </p>
            </div>
            
            {questionBank?.leetcode_questions && questionBank.leetcode_questions.length > 0 ? (
              <div className="space-y-3">
                {questionBank.leetcode_questions.map((lc, i) => (
                  <div key={i} className="bg-[#f4f4f5] rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[#111111] font-medium">{lc.title}</h4>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        lc.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' :
                        lc.difficulty === 'Medium' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {lc.difficulty}
                      </span>
                    </div>
                    <a
                      href={lc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 text-sm hover:underline flex items-center gap-1 mb-2"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Open on LeetCode
                    </a>
                    {lc.solution_hint && (
                      <div className="bg-[#fafafa] rounded p-2 mt-2">
                        <p className="text-gray-400 text-xs font-medium mb-1">💡 Solution Hint:</p>
                        <p className="text-gray-300 text-sm">{lc.solution_hint}</p>
                      </div>
                    )}
                    {lc.category && (
                      <p className="text-gray-500 text-xs mt-2">Category: {lc.category}</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Code className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">No LeetCode questions available</p>
                <p className="text-gray-500 text-sm mt-2">Generate a question bank to get skill-based recommendations</p>
              </div>
            )}
          </div>
        ) : activeTab === 'context' ? (
          <div className="space-y-6">
            {/* Gold and Grey Areas Summary */}
            {(goldAreas.length > 0 || greyAreas.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4">
                {goldAreas.length > 0 && (
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                    <h3 className="text-green-400 font-medium flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5" />
                      Gold Areas (Validated Strengths)
                    </h3>
                    <ul className="space-y-2">
                      {goldAreas.map((area, i) => (
                        <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                          <span className="text-green-500">✓</span>
                          {area}
                        </li>
                      ))}
                    </ul>
                    <p className="text-gray-500 text-xs mt-3 italic">
                      ℹ️ Skip or only briefly verify these areas - they've been validated
                    </p>
                  </div>
                )}
                
                {greyAreas.length > 0 && (
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                    <h3 className="text-yellow-400 font-medium flex items-center gap-2 mb-3">
                      <AlertCircle className="w-5 h-5" />
                      Grey Areas (Need Probing)
                    </h3>
                    <ul className="space-y-2">
                      {greyAreas.map((area, i) => (
                        <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                          <span className="text-yellow-500">⚠</span>
                          {area}
                        </li>
                      ))}
                    </ul>
                    <p className="text-gray-500 text-xs mt-3 italic">
                      ℹ️ Focus your questions here - these need deeper exploration
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Previous Reviews */}
            <div>
              <h3 className="text-[#111111] font-medium flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-[#0070f3]" />
                Previous Interview Reviews
              </h3>
              
              {previousReviews.length === 0 ? (
                <div className="text-center py-12 bg-[#f4f4f5] rounded-lg">
                  <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">No previous interviews completed</p>
                  <p className="text-gray-500 text-sm mt-2">This appears to be the first round</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {previousReviews.map((review, i) => (
                    <div key={i} className="bg-[#f4f4f5] rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[#111111] font-medium">Round {review.round_number}</h4>
                        {review.recommendation && (
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            review.recommendation.includes('yes') ? 'bg-green-500/20 text-green-400' :
                            review.recommendation === 'maybe' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                          }`}>
                            {review.recommendation.replace(/_/g, ' ').toUpperCase()}
                          </span>
                        )}
                      </div>
                      
                      {/* Ratings */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-3">
                        {[
                          { label: 'Technical', value: review.technical_skills },
                          { label: 'Communication', value: review.communication },
                          { label: 'Problem Solving', value: review.problem_solving },
                          { label: 'Cultural Fit', value: review.cultural_fit },
                          { label: 'Overall', value: review.overall_rating },
                        ].map((rating, j) => rating.value && (
                          <div key={j} className="bg-[#fafafa] rounded p-2 text-center">
                            <p className="text-gray-500 text-xs">{rating.label}</p>
                            <p className="text-[#111111] font-bold">{rating.value}/5</p>
                          </div>
                        ))}
                      </div>
                      
                      {review.strengths && (
                        <div className="mb-2">
                          <p className="text-green-400 text-xs font-medium">Strengths:</p>
                          <p className="text-gray-300 text-sm">{review.strengths}</p>
                        </div>
                      )}
                      
                      {review.areas_for_improvement && (
                        <div className="mb-2">
                          <p className="text-yellow-400 text-xs font-medium">Areas for Improvement:</p>
                          <p className="text-gray-300 text-sm">{review.areas_for_improvement}</p>
                        </div>
                      )}
                      
                      {review.notes && (
                        <div>
                          <p className="text-gray-500 text-xs font-medium">Notes:</p>
                          <p className="text-gray-400 text-sm">{review.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default QuestionBankEditor;
