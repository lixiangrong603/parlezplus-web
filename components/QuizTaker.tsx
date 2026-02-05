
import React, { useState, useMemo, useEffect } from 'react';
import { Question } from '../types';
import { CheckCircle, XCircle, AlertCircle, ArrowRight, Trophy, HelpCircle, Type, BookOpen, Keyboard } from 'lucide-react';
import { saveStudentProgress } from '../utils/storage';
import { CURRENT_USER_ID } from '../constants';
import { useAuth } from '../contexts/AuthContext';

interface QuizTakerProps {
    questions: Question[];
    resourceId: string;
    onComplete: () => void;
    initialAnswers?: Record<string, string>;
    initialScore?: { score: number; total: number };
}

const QuizTaker: React.FC<QuizTakerProps> = ({ 
    questions, 
    resourceId, 
    onComplete, 
    initialAnswers, 
    initialScore 
}) => {
    const { user } = useAuth();
    const currentUserId = user?.id || CURRENT_USER_ID;
    
    // For MCQ, stores optionId. For Fill-in, stores user input text.
    const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {}); 
    const [isSubmitted, setIsSubmitted] = useState(!!initialScore);
    const [textSizeLevel, setTextSizeLevel] = useState<0 | 1 | 2>(0);

    // If initial data is present, sync state on mount
    useEffect(() => {
        if (initialAnswers) setAnswers(initialAnswers);
        if (initialScore) setIsSubmitted(true);
    }, [initialAnswers, initialScore]);

    const handleSelect = (qId: string, value: string) => {
        if (isSubmitted) return;
        setAnswers(prev => ({ ...prev, [qId]: value }));
    };

    const calculateCorrectness = (q: Question): boolean => {
        const userAns = answers[q.id];
        if (q.type === 'fill-in-the-blank') {
            const correctText = q.options[0]?.text || "";
            return !!(userAns && userAns.trim().toLowerCase() === correctText.trim().toLowerCase());
        } else {
            return userAns === q.correctOptionId;
        }
    };

    const { score, total, percentage } = useMemo(() => {
        let correctCount = 0;
        let questionCount = 0;

        const processQuestion = (q: Question) => {
            if (q.subQuestions && q.subQuestions.length > 0) {
                q.subQuestions.forEach(processQuestion);
            } else {
                questionCount++;
                if (calculateCorrectness(q)) {
                    correctCount++;
                }
            }
        };

        questions.forEach(processQuestion);

        return {
            score: correctCount,
            total: questionCount,
            percentage: questionCount > 0 ? Math.round((correctCount / questionCount) * 100) : 0
        };
    }, [questions, answers, isSubmitted]);

    const handleSubmit = () => {
        setIsSubmitted(true);
        saveStudentProgress({
            userId: currentUserId,
            resourceId: resourceId,
            quizAnswers: answers,
            quizScore: { score, total },
            lastUpdated: Date.now()
        });
    };

    const toggleTextSize = () => {
        setTextSizeLevel(prev => (prev + 1) % 3 as 0 | 1 | 2);
    };

    // Calculate total flat questions for "All Answered" check
    const totalFlatQuestions = useMemo(() => {
        let count = 0;
        const countQ = (q: Question) => {
            if (q.subQuestions && q.subQuestions.length > 0) {
                q.subQuestions.forEach(countQ);
            } else {
                count++;
            }
        };
        questions.forEach(countQ);
        return count;
    }, [questions]);

    const isAllAnswered = Object.keys(answers).length === totalFlatQuestions;

    // Dynamic classes based on text size level
    const questionClass = textSizeLevel === 0 ? 'text-base' : textSizeLevel === 1 ? 'text-lg' : 'text-xl';
    const optionClass = textSizeLevel === 0 ? 'text-sm' : textSizeLevel === 1 ? 'text-base' : 'text-lg';
    const passageClass = textSizeLevel === 0 ? 'text-base' : textSizeLevel === 1 ? 'text-lg' : 'text-xl';

    // Rendering Helper for Compound Fill
    const renderCompoundFillPassage = (q: Question) => {
        const parts = q.readingPassage?.split(/(\(\d+\))/g) || [];
        
        return (
            <div className={`font-medium text-slate-700 dark:text-slate-200 leading-loose ${passageClass}`}>
                {parts.map((part, i) => {
                    const match = part.match(/\((\d+)\)/);
                    if (match) {
                        // The index logic assumes subQuestions are in order matching the (1), (2) sequence
                        // But finding by index is safer if provided
                        const gapIndex = parseInt(match[1]) - 1; 
                        const subQ = q.subQuestions?.[gapIndex];
                        
                        if (!subQ) return <span key={i}>{part}</span>;

                        const userAnswer = answers[subQ.id] || '';
                        const isCorrect = isSubmitted && calculateCorrectness(subQ);
                        const correctAns = subQ.options[0]?.text;

                        return (
                            <span key={i} className="mx-1 inline-block">
                                <span className="font-bold text-xs text-slate-400 mr-1">({gapIndex + 1})</span>
                                <input
                                    type="text"
                                    value={userAnswer}
                                    onChange={(e) => handleSelect(subQ.id, e.target.value)}
                                    disabled={isSubmitted}
                                    className={`border-b-2 outline-none px-1 py-0.5 text-center font-bold bg-transparent min-w-[80px] transition-colors ${
                                        isSubmitted 
                                        ? (isCorrect 
                                            ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50/50' 
                                            : 'border-red-500 text-red-600 dark:text-red-400 bg-red-50/50')
                                        : 'border-slate-300 dark:border-slate-600 focus:border-indigo-500 dark:focus:border-indigo-400 focus:bg-indigo-50/30'
                                    }`}
                                    style={{ width: `${Math.max(80, userAnswer.length * 10)}px` }}
                                    autoComplete="off"
                                />
                                {isSubmitted && !isCorrect && (
                                    <span className="text-xs font-bold text-emerald-500 ml-1">
                                        {correctAns}
                                    </span>
                                )}
                            </span>
                        );
                    }
                    return <span key={i}>{part}</span>;
                })}
            </div>
        );
    };

    const renderQuestionBlock = (q: Question, idx: number, isSub = false) => {
        // Handle Compound Fill
        if (q.type === 'compound-fill') {
            return (
                <div key={q.id} className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-6 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-4 text-emerald-600 dark:text-emerald-400 text-xs font-black uppercase tracking-widest">
                            <Keyboard size={14} /> 复合填空 (Compound Fill)
                        </div>
                        {renderCompoundFillPassage(q)}
                    </div>
                    
                    {/* Solution Grid (Only visible after submission) */}
                    {isSubmitted && (
                        <div className="p-6 bg-slate-50 dark:bg-slate-950">
                            <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4">GAP SOLUTIONS</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {q.subQuestions?.map((subQ, sIdx) => {
                                    const isCorrect = calculateCorrectness(subQ);
                                    return (
                                        <div key={subQ.id} className={`p-3 rounded-xl border ${isCorrect ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800' : 'bg-red-50 dark:bg-red-900/10 border-red-100 dark:border-red-900/30'}`}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-xs font-bold text-slate-400">Gap {sIdx + 1}</span>
                                                {isCorrect ? <CheckCircle size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-red-500" />}
                                            </div>
                                            <div className="font-bold text-indigo-700 dark:text-indigo-300 text-lg mb-1">
                                                {subQ.options[0]?.text}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                                                {subQ.explanation || "暂无解析"}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            );
        }

        // Handle Reading Comprehension / Cloze Selection Container
        if (q.subQuestions && q.subQuestions.length > 0) {
            return (
                <div key={q.id} className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-50 dark:border-slate-800 overflow-hidden shadow-sm">
                    <div className="p-6 bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-3 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest">
                            <BookOpen size={14} /> 
                            {q.type === 'cloze-test' ? '完型选择' : '阅读理解'}
                        </div>
                        <div className={`font-medium text-slate-700 dark:text-slate-200 leading-relaxed ${passageClass} whitespace-pre-wrap`}>
                            {q.readingPassage}
                        </div>
                    </div>
                    <div className="p-4 space-y-4 bg-white dark:bg-slate-900">
                        {q.subQuestions.map((subQ, sIdx) => renderQuestionBlock(subQ, sIdx, true))}
                    </div>
                </div>
            );
        }

        const userAnswer = answers[q.id];
        const isCorrect = isSubmitted && calculateCorrectness(q);
        const correctText = q.type === 'fill-in-the-blank' ? q.options[0]?.text || "" : "";

        return (
            <div key={q.id} className={`bg-white dark:bg-slate-900 rounded-2xl border-2 overflow-hidden transition-all ${isSubmitted ? (isCorrect ? 'border-emerald-100 dark:border-emerald-900/40' : 'border-red-100 dark:border-red-900/40') : (isSub ? 'border-slate-100 dark:border-slate-800' : 'border-transparent dark:border-slate-800 shadow-sm')}`}>
                <div className="p-6 border-b border-slate-50 dark:border-slate-800">
                    <div className="flex items-start gap-4">
                        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm mt-1 font-bold ${isSub ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'}`}>
                            {isSub ? idx + 1 : idx + 1}
                        </span>
                        <div className="flex-1">
                            <h3 className={`${questionClass} font-bold text-slate-800 dark:text-slate-100 leading-relaxed mb-3 transition-all`}>{q.text}</h3>
                            {q.imageUrl && (
                                <img 
                                    src={q.imageUrl} 
                                    alt="Question" 
                                    className="w-full h-auto max-h-[500px] object-contain rounded-xl mb-4 border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950" 
                                />
                            )}
                        </div>
                    </div>
                </div>

                {q.type === 'fill-in-the-blank' ? (
                    <div className="p-6 pt-4 pb-6 bg-slate-50/30 dark:bg-slate-950/30">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">请输入答案：</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                value={userAnswer || ''}
                                onChange={(e) => handleSelect(q.id, e.target.value)}
                                disabled={isSubmitted}
                                className={`w-full p-4 rounded-xl border-2 outline-none text-lg font-bold transition-all ${
                                    isSubmitted 
                                    ? (isCorrect 
                                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' 
                                        : 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300')
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:text-white'
                                }`}
                                placeholder="Type your answer here..."
                                autoComplete="off"
                            />
                            {isSubmitted && (
                                <div className="absolute right-4 top-1/2 -translate-x-1/2 pointer-events-none">
                                    {isCorrect ? <CheckCircle size={24} className="text-emerald-500" /> : <XCircle size={24} className="text-red-500" />}
                                </div>
                            )}
                        </div>
                        {isSubmitted && !isCorrect && (
                            <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-100 dark:border-emerald-900/30 text-sm font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-2 animate-fade-in">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                正确答案: <span className="underline decoration-2 underline-offset-2">{correctText}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="p-4 bg-slate-50/50 dark:bg-slate-950/50 space-y-2">
                        {q.options.map((opt) => {
                            const isSelected = userAnswer === opt.id;
                            const isThisCorrect = q.correctOptionId === opt.id;
                            
                            let btnClass = "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-white dark:hover:bg-slate-800";
                            let icon = null;

                            if (isSubmitted) {
                                if (isThisCorrect) {
                                    btnClass = "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500";
                                    icon = <CheckCircle size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0" />;
                                } else if (isSelected && !isThisCorrect) {
                                    btnClass = "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400";
                                    icon = <XCircle size={16} className="text-red-500 dark:text-red-400 shrink-0" />;
                                } else {
                                    btnClass = "border-slate-200 dark:border-slate-800 opacity-50";
                                }
                            } else {
                                if (isSelected) {
                                    btnClass = "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-600 dark:border-indigo-500 text-indigo-700 dark:text-indigo-300 ring-1 ring-indigo-600";
                                }
                            }

                            return (
                                <button
                                    key={opt.id}
                                    onClick={() => handleSelect(q.id, opt.id)}
                                    disabled={isSubmitted}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${btnClass}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${isSelected || (isSubmitted && isThisCorrect) ? 'border-current' : 'border-slate-300 dark:border-slate-700'}`}>
                                            {isSelected && <div className="w-2 h-2 rounded-full bg-current" />}
                                        </div>
                                        <span className={`font-medium ${optionClass} transition-all dark:text-slate-200`}>{opt.text}</span>
                                    </div>
                                    {opt.imageUrl && <img src={opt.imageUrl} className="h-10 w-10 object-cover rounded ml-2" />}
                                    {icon}
                                </button>
                            );
                        })}
                    </div>
                )}

                {isSubmitted && q.explanation && (
                    <div className="p-4 bg-indigo-50/30 dark:bg-indigo-900/10 border-t border-indigo-50 dark:border-indigo-900 flex gap-3 text-sm text-indigo-900 dark:text-indigo-200">
                        <HelpCircle size={18} className="shrink-0 text-indigo-500 dark:text-indigo-400 mt-0.5" />
                        <div>
                            <span className="font-bold block text-xs uppercase tracking-wider text-indigo-400 dark:text-indigo-500 mb-1">解析</span>
                            {q.explanation}
                        </div>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 no-scrollbar pb-32 transition-colors duration-300">
            <div className="max-w-3xl mx-auto space-y-6">
                
                {/* Header Section */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">
                            {isSubmitted ? "测试结果" : "综合能力测试"}
                        </h2>
                        <button 
                            onClick={toggleTextSize}
                            className={`p-1.5 rounded-lg transition-all flex items-center gap-1 ${textSizeLevel > 0 ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500'}`}
                            title="调整字号 (小/中/大)"
                        >
                            <Type size={18} />
                            {textSizeLevel > 0 && <span className="text-[10px] font-bold">+{textSizeLevel}</span>}
                        </button>
                    </div>
                    
                    {isSubmitted ? (
                        <div className={`text-lg font-black px-4 py-1 rounded-xl ${percentage >= 80 ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : percentage >= 60 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}`}>
                            {score} / {total}
                        </div>
                    ) : (
                        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full">
                            共 {totalFlatQuestions} 题
                        </div>
                    )}
                </div>

                {/* Questions List */}
                <div className="space-y-6">
                    {questions.map((q, idx) => renderQuestionBlock(q, idx))}
                </div>

                {/* Footer Action */}
                <div className="pt-4 pb-12">
                    {!isSubmitted ? (
                        <button
                            onClick={handleSubmit}
                            disabled={!isAllAnswered}
                            className={`w-full py-4 rounded-2xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
                                isAllAnswered 
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none hover:-translate-y-1' 
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                            }`}
                        >
                            <CheckCircle size={20} /> 提交答案
                        </button>
                    ) : (
                        <button
                            onClick={onComplete}
                            className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-200 dark:shadow-none hover:bg-emerald-700 transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
                        >
                            <Trophy size={20} /> 完成测试，开始跟读
                            <ArrowRight size={20} />
                        </button>
                    )}
                </div>

            </div>
        </div>
    );
};

export default QuizTaker;
