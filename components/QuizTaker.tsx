import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Question } from '../types';
import { CheckCircle, XCircle, ArrowLeft, Type, AlertCircle } from 'lucide-react';
import { saveStudentProgress } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { getOptionGridColumns } from '../utils/optionLayout';

interface QuizTakerProps {
    questions: Question[];
    resourceId: string;
    onComplete: () => void;
    initialAnswers?: Record<string, string>;
    initialScore?: { score: number; total: number };
}

const serifFont = 'font-serif';

const QuizTaker: React.FC<QuizTakerProps> = ({ 
    questions, 
    resourceId, 
    onComplete, 
    initialAnswers, 
    initialScore 
}) => {
    const { user } = useAuth();
    const currentUserId = user?.id;
    
    // Filter for single-choice only as requested (defaults to 'multiple-choice' if undefined)
    const validQuestions = useMemo(() => {
        return questions.filter(q => !q.type || q.type === 'multiple-choice');
    }, [questions]);

    const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers || {}); 
    const [isSubmitted, setIsSubmitted] = useState(!!initialScore);
    const [textSizeLevel, setTextSizeLevel] = useState<0 | 1 | 2>(0);

    // If initial data is present, sync state on mount
    useEffect(() => {
        if (initialAnswers) {
            setAnswers(initialAnswers);
        }
        if (initialScore) {
            setIsSubmitted(true);
        }
    }, [initialAnswers, initialScore]);

    const handleSelect = (qId: string, optionId: string) => {
        if (isSubmitted) return;
        setAnswers(prev => ({ ...prev, [qId]: optionId }));
    };

    const calculateCorrectness = (q: Question): boolean => {
        const userAns = answers[q.id];
        return userAns === q.correctOptionId;
    };

    const { score, total, percentage } = useMemo(() => {
        let correctCount = 0;
        const totalCount = validQuestions.length;

        validQuestions.forEach(q => {
            if (calculateCorrectness(q)) {
                correctCount++;
            }
        });

        return {
            score: correctCount,
            total: totalCount,
            percentage: totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0
        };
    }, [validQuestions, answers, isSubmitted]);

    const handleSubmit = () => {
        setIsSubmitted(true);
        if (!currentUserId) return;
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

    // Style classes based on text size
    const questionClass = textSizeLevel === 0 ? 'text-base' : textSizeLevel === 1 ? 'text-lg' : 'text-xl';
    const optionClass = textSizeLevel === 0 ? 'text-sm' : textSizeLevel === 1 ? 'text-base' : 'text-lg';

    if (validQuestions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center bg-white dark:bg-slate-900 rounded-lg shadow-sm">
                <AlertCircle size={48} className="text-slate-300 mb-4" />
                <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">暂无支持的题目</h3>
                <p className="text-slate-500 max-w-md">
                    当前测验模式仅支持单选题。所选资源包含 {questions.length} 道题目，但没有单选题。
                </p>
                <button 
                    onClick={onComplete}
                    className="mt-6 px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                    返回
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-white dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <h1 className="font-bold text-slate-800 dark:text-slate-100 text-base shrink-0">练习测验</h1>
                    {isSubmitted && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-slate-900 rounded-full min-w-0">
                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap hidden xs:inline">得分:</span>
                            <span className={`text-xs font-bold ${percentage >= 60 ? 'text-emerald-600' : 'text-red-500'} whitespace-nowrap`}>
                                {score}/{total}
                            </span>
                        </div>
                    )}
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                    <button 
                        onClick={isSubmitted ? onComplete : handleSubmit}
                        disabled={!isSubmitted && Object.keys(answers).length === 0}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 font-serif whitespace-nowrap"
                    >
                        {isSubmitted ? (
                            <><CheckCircle size={14} /> <span className="hidden xxs:inline">完成</span></>
                        ) : (
                            <><CheckCircle size={14} /> <span className="hidden xxs:inline">提交</span></>
                        )}
                    </button>
                    <button 
                        onClick={toggleTextSize}
                        className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400 shrink-0"
                        title="Change Text Size"
                    >
                        <Type size={18} />
                    </button>
                </div>
            </div>

            {/* Questions List */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 sm:p-4 md:p-6 lg:p-8 max-w-4xl mx-auto w-full">
                <div className="space-y-6 sm:space-y-8">
                    {validQuestions.map((q, idx) => {
                        const userAnswer = answers[q.id];
                        const isCorrect = isSubmitted && calculateCorrectness(q);
                        const hasOptionImages = q.options.some(o => !!o.imageUrl);
                        
                        const optionCols = getOptionGridColumns((q.options || []).map(o => o.text));
                        const gridColsClass =
                            optionCols === 4 ? 'grid-cols-2 md:grid-cols-4' :
                            optionCols === 2 ? 'grid-cols-1 md:grid-cols-2' :
                            'grid-cols-1';

                        return (
                            <div key={q.id} className="animate-fade-in">
                                <div className="flex items-start gap-1.5 sm:gap-2 mb-3">
                                    <span className={`font-bold ${questionClass} ${serifFont} min-w-[20px] sm:min-w-[24px] text-slate-400/80 select-none mt-0.5`}>
                                        {idx + 1}.
                                    </span>
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                        <h3
                                            className={`${questionClass} ${serifFont} text-slate-800 dark:text-slate-100 leading-normal mb-3 break-words`}
                                            dangerouslySetInnerHTML={{ __html: q.text }}
                                        />
                                        
                                        {q.imageUrl && (
                                            <img
                                                src={q.imageUrl}
                                                alt="Question"
                                                className="max-w-full sm:max-w-[200px] h-auto object-contain mb-4 border border-slate-200 dark:border-slate-700 rounded"
                                            />
                                        )}

                                        <div className={hasOptionImages ? 'space-y-3' : `grid gap-x-4 gap-y-2 ${gridColsClass}`}>
                                            {q.options.map((opt, optIdx) => {
                                                const isSelected = userAnswer === opt.id;
                                                const isThisCorrect = q.correctOptionId === opt.id;
                                                const optionLetter = String.fromCharCode(65 + optIdx);
                                                
                                                // Determine styles
                                                let containerClass = `w-full text-left transition-all px-2 py-1.5 rounded ${serifFont} flex items-start gap-2 group `;
                                                let letterClass = `font-bold shrink-0 ${serifFont} transition-colors `;
                                                let textClass = `${optionClass} ${serifFont} transition-colors `;

                                                if (isSubmitted) {
                                                    if (isThisCorrect) {
                                                        // Correct answer
                                                        containerClass += 'bg-emerald-50/50 dark:bg-emerald-900/10 ';
                                                        letterClass += 'text-emerald-600 dark:text-emerald-400';
                                                        textClass += 'text-emerald-800 dark:text-emerald-200 font-medium';
                                                    } else if (isSelected && !isThisCorrect) {
                                                        // Wrong selection
                                                        containerClass += 'bg-red-50/50 dark:bg-red-900/10 ';
                                                        letterClass += 'text-red-600 dark:text-red-400';
                                                        textClass += 'text-red-800 dark:text-red-200 line-through decoration-red-500/30';
                                                    } else {
                                                        // Unselected, wrong option
                                                        containerClass += 'opacity-50 grayscale ';
                                                        letterClass += 'text-slate-400 dark:text-slate-600';
                                                        textClass += 'text-slate-500 dark:text-slate-500';
                                                    }
                                                } else {
                                                    // Interactive state
                                                    if (isSelected) {
                                                        containerClass += 'bg-indigo-50 dark:bg-indigo-900/20 ';
                                                        letterClass += 'text-indigo-600 dark:text-indigo-400';
                                                        textClass += 'text-indigo-900 dark:text-indigo-100 font-medium';
                                                    } else {
                                                        containerClass += 'hover:bg-slate-50 dark:hover:bg-slate-800/50 ';
                                                        letterClass += 'text-slate-500 dark:text-slate-400 group-hover:text-indigo-500 dark:group-hover:text-indigo-400';
                                                        textClass += 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-200';
                                                    }
                                                }

                                                return (
                                                    <button
                                                        key={opt.id}
                                                        onClick={() => handleSelect(q.id, opt.id)}
                                                        disabled={isSubmitted}
                                                        className={containerClass}
                                                    >
                                                        <span className={letterClass}>{optionLetter}.</span>
                                                        <div className="flex-1 min-w-0 overflow-hidden">
                                                            <span className={`${textClass} break-words`} dangerouslySetInnerHTML={{ __html: opt.text }} />
                                                            {opt.imageUrl && (
                                                                <img 
                                                                    src={opt.imageUrl} 
                                                                    className="mt-2 max-w-full max-h-32 rounded border border-slate-200 dark:border-slate-700" 
                                                                    alt="Option"
                                                                />
                                                            )}
                                                        </div>
                                                        {isSubmitted && (
                                                            <div className="shrink-0 pt-0.5">
                                                                {isThisCorrect && <CheckCircle size={16} className="text-emerald-500" />}
                                                                {isSelected && !isThisCorrect && <XCircle size={16} className="text-red-500" />}
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        {isSubmitted && q.explanation && (
                                            <div className="mt-4 p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900 border-l-4 border-indigo-400 text-xs sm:text-sm text-slate-600 dark:text-slate-300 rounded-r">
                                                <span className="font-bold text-[9px] sm:text-xs text-indigo-500 uppercase tracking-widest block mb-1">解析</span>
                                                <div className="leading-relaxed whitespace-pre-wrap break-words">{q.explanation}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {/* Footer Padding */}
                <div className="h-32"></div>
            </div>
        </div>
    );
};

export default QuizTaker;
