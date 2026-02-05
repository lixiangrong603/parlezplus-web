
import React, { useState, useEffect, useRef } from 'react';
import { TranscriptSegment } from '../types';
import { CheckCircle2, ArrowRight, HelpCircle, RefreshCcw, Lock, Edit3 } from 'lucide-react';

interface ClozeExerciseProps {
    segments: TranscriptSegment[];
    onComplete: () => void;
    currentTime: number;
    onSegmentClick: (startTime: number) => void;
    initialAnswers?: Record<string, string>;
    isReadOnly?: boolean;
    onSaveProgress?: (answers: Record<string, string>, score: { correct: number, total: number }) => void;
}

const normalize = (str: string) => str.toLowerCase().replace(/[.,!?;:"«»()]/g, '').trim();

/**
 * Text renderer helper to support French special markings if any (copy from Transcript logic)
 */
const FrenchTextRenderer: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('*') && part.endsWith('*')) {
          return (
            <span 
              key={i} 
              className="text-slate-300 dark:text-slate-600 decoration-slate-300 dark:decoration-slate-600 decoration-2"
            >
              {part.slice(1, -1)}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
};

/**
 * Liaison curve (copy from Transcript logic)
 */
const LiaisonCurve = () => (
  <span className="absolute left-full top-[85%] w-2.5 -ml-0.5 h-2 pointer-events-none z-10">
    <svg className="w-full h-full text-orange-500 opacity-80" viewBox="0 0 10 5" preserveAspectRatio="none">
      <path d="M0,0 Q5,4 10,0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </span>
);

const ClozeExercise: React.FC<ClozeExerciseProps> = ({ 
    segments, 
    onComplete, 
    currentTime, 
    onSegmentClick,
    initialAnswers,
    isReadOnly = false,
    onSaveProgress
}) => {
    const [inputs, setInputs] = useState<Record<string, string>>(initialAnswers || {});
    const [isSubmitted, setIsSubmitted] = useState(isReadOnly || !!initialAnswers);
    const [attempts, setAttempts] = useState(initialAnswers ? 2 : 0); // 0: initial, 1: first check, 2: final
    const [score, setScore] = useState({ correct: 0, total: 0 });
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const activeItemRef = useRef<HTMLDivElement>(null);

    const activeIndex = segments.findIndex(
      (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
    );

    const clozeItems = segments.flatMap((seg, sIdx) => 
        seg.words.map((word, wIdx) => ({
            key: `${sIdx}-${wIdx}`,
            word: word.word,
            isCloze: word.isCloze,
            startTime: word.startTime
        }))
    ).filter(item => item.isCloze);

    // Auto-scroll logic
    useEffect(() => {
        if (activeItemRef.current) {
            activeItemRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
        }
    }, [activeIndex]);

    // Initial setup
    useEffect(() => {
        if (clozeItems.length > 0 && !isSubmitted && attempts === 0) {
            const firstKey = clozeItems[0].key;
            inputRefs.current[firstKey]?.focus();
        }
        
        if (isSubmitted) {
            calculateScore();
        }
    }, [isSubmitted]);

    const calculateScore = () => {
        let correctCount = 0;
        clozeItems.forEach(item => {
            const userInput = inputs[item.key] || '';
            if (normalize(userInput) === normalize(item.word)) {
                correctCount++;
            }
        });
        setScore({ correct: correctCount, total: clozeItems.length });
    };

    const handleInputChange = (key: string, value: string) => {
        if (isSubmitted) return;
        setInputs(prev => ({ ...prev, [key]: value }));
    };

    const handleCheck = () => {
        let correctCount = 0;
        clozeItems.forEach(item => {
            const userInput = inputs[item.key] || '';
            if (normalize(userInput) === normalize(item.word)) {
                correctCount++;
            }
        });
        const currentScore = { correct: correctCount, total: clozeItems.length };
        setScore(currentScore);
        setIsSubmitted(true);
        const newAttempts = attempts + 1;
        setAttempts(newAttempts);

        // Save progress immediately on every check to ensure data persistence
        if (onSaveProgress) {
            onSaveProgress(inputs, currentScore);
        }
    };

    const handleRetry = () => {
        if (isReadOnly || attempts >= 2) return;
        setIsSubmitted(false);
        // We keep existing inputs for correction as requested by "redo opportunity"
        if (clozeItems.length > 0) {
            // Find first incorrect one to focus
            const firstWrong = clozeItems.find(item => normalize(inputs[item.key] || '') !== normalize(item.word));
            setTimeout(() => {
                if (firstWrong) inputRefs.current[firstWrong.key]?.focus();
                else inputRefs.current[clozeItems[0].key]?.focus();
            }, 100);
        }
    };

    const filledCount = clozeItems.filter(item => (inputs[item.key] || '').trim().length > 0).length;
    const isAllFilled = filledCount === clozeItems.length;
    const isFinalState = isReadOnly || attempts >= 2 || (isSubmitted && score.correct === score.total);

    return (
        <div 
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto no-scrollbar py-2"
        >
            {/* Embedded Header for Context */}
            <div className="px-6 mb-4 animate-fade-in">
                <div className={`rounded-xl p-3 border flex items-center justify-between transition-colors ${isSubmitted ? 'bg-indigo-50 dark:bg-indigo-900/10 border-indigo-100 dark:border-indigo-900/30' : 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30'}`}>
                    <div>
                        <h2 className={`text-sm font-black flex items-center gap-2 ${isSubmitted ? 'text-indigo-800 dark:text-indigo-200' : 'text-amber-800 dark:text-amber-200'}`}>
                            {isFinalState ? <Lock size={16} /> : (isSubmitted ? <Edit3 size={16} /> : <HelpCircle size={16} />)} 
                            {isFinalState ? "填空练习已完成" : (isSubmitted ? "发现错误，请订正" : "听写填空")}
                        </h2>
                        <p className={`text-[10px] mt-0.5 font-bold ${isSubmitted ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>
                            {isFinalState ? "查看您的作答详情" : (isSubmitted ? "您还有一次修改机会" : "请补全高亮缺失的单词")}
                        </p>
                    </div>
                    {isSubmitted ? (
                        <div className={`text-sm font-black px-3 py-1 rounded-lg ${score.correct === score.total ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'}`}>
                            {score.correct} / {score.total}
                        </div>
                    ) : (
                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border border-amber-200 dark:border-amber-900/50">
                            进度 {filledCount}/{clozeItems.length}
                        </div>
                    )}
                </div>
            </div>

            {/* Transcript-style List */}
            {segments.map((seg, sIdx) => {
                const isActive = sIdx === activeIndex;
                return (
                    <div
                        key={seg.id}
                        ref={isActive ? activeItemRef : null}
                        onClick={() => onSegmentClick(seg.startTime)}
                        className={`transition-all duration-200 py-2.5 px-4 border-l-4 relative cursor-pointer ${
                            isActive 
                                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10' 
                                : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-900/30'
                        }`}
                    >
                        <div className={`text-lg leading-snug ${isActive ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
                            {seg.words.map((word, wIdx) => {
                                const key = `${sIdx}-${wIdx}`;
                                const isWordActive = currentTime >= word.startTime && currentTime <= word.endTime;

                                if (word.isCloze) {
                                    const val = inputs[key] || '';
                                    const isCorrect = isSubmitted && normalize(val) === normalize(word.word);
                                    
                                    return (
                                        <div key={wIdx} className="inline-block relative mr-1.5 align-baseline" onClick={(e) => e.stopPropagation()}>
                                            <input 
                                                ref={el => { inputRefs.current[key] = el; }}
                                                type="text" 
                                                value={val}
                                                onChange={(e) => handleInputChange(key, e.target.value)}
                                                disabled={isSubmitted}
                                                className={`border-b-2 outline-none text-center font-bold px-1 min-w-[3em] transition-colors h-[1.4em] align-middle ${
                                                    isSubmitted 
                                                    ? (isCorrect 
                                                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-t' 
                                                        : 'border-red-500 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-t line-through') 
                                                    : 'border-amber-300 dark:border-amber-600 focus:border-indigo-500 dark:focus:border-indigo-400 bg-amber-50 dark:bg-amber-900/20 text-slate-900 dark:text-slate-100 rounded-t focus:bg-indigo-50 dark:focus:bg-indigo-900/20'
                                                }`}
                                                style={{ width: `${Math.max(2.5, word.word.length * 0.7)}em` }}
                                                autoComplete="off"
                                                autoCorrect="off"
                                            />
                                            {isSubmitted && !isCorrect && isFinalState && (
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 text-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 animate-fade-in bg-white dark:bg-slate-950 px-1 rounded shadow-sm z-20 border border-emerald-100 dark:border-emerald-900">
                                                    {word.word}
                                                </div>
                                            )}
                                            {word.needsLiaison && wIdx < seg.words.length - 1 && <LiaisonCurve />}
                                        </div>
                                    );
                                }

                                return (
                                    <div 
                                        key={wIdx} 
                                        className="inline-block relative group mr-1.5 align-baseline"
                                    >
                                        <span 
                                            className={`inline-block px-0.5 rounded transition-all duration-200 relative ${
                                                isWordActive 
                                                ? 'bg-indigo-600/10 dark:bg-indigo-400/20 rounded-md text-indigo-700 dark:text-indigo-300 font-bold' 
                                                : ''
                                            }`}
                                        >
                                            <FrenchTextRenderer text={word.word} />
                                        </span>
                                        {word.needsLiaison && wIdx < seg.words.length - 1 && <LiaisonCurve />}
                                    </div>
                                );
                            })}
                        </div>
                        
                        <div className={`mt-0.5 text-sm tracking-wide leading-tight transition-all duration-300 ${isActive ? 'text-indigo-600/80 dark:text-indigo-400/80 font-medium' : 'text-slate-400 dark:text-slate-600'}`}>
                            <span className="blur-[6px] hover:blur-0 transition-all cursor-help select-none">{seg.translation}</span>
                        </div>
                    </div>
                );
            })}

            {/* Bottom Actions Area */}
            <div className="mt-8 mb-12 px-6 animate-fade-in-up">
                {!isSubmitted ? (
                    <button
                        onClick={handleCheck}
                        disabled={!isAllFilled}
                        className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-black shadow-xl transition-all active:scale-95 ${
                            isAllFilled 
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200 dark:shadow-none' 
                            : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-80'
                        }`}
                    >
                        <CheckCircle2 size={20} /> {attempts === 1 ? '再次提交检查' : '提交检查'}
                    </button>
                ) : (
                    <div className="flex gap-4">
                        {!isFinalState && (
                            <button
                                onClick={handleRetry}
                                className="flex-1 py-4 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-2xl font-bold text-base hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all flex items-center justify-center gap-2"
                            >
                                <RefreshCcw size={20} /> 修改错误
                            </button>
                        )}
                        <button
                            onClick={onComplete}
                            className={`py-4 rounded-2xl font-black text-base shadow-xl transition-all flex items-center justify-center gap-2 ${!isFinalState ? 'flex-[1] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300' : 'w-full bg-emerald-600 text-white shadow-emerald-200'}`}
                        >
                            {score.correct === score.total ? "完美通过！" : (isFinalState ? "练习已存档，进入跟读" : "跳过修改")} <ArrowRight size={20} />
                        </button>
                    </div>
                )}
            </div>
            
            <div className="h-24" />
        </div>
    );
};

export default ClozeExercise;
