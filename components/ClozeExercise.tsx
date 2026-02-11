
import React, { useState, useEffect, useRef } from 'react';
import { TranscriptSegment } from '../types';
import { CheckCircle2, ArrowRight, HelpCircle, RefreshCcw, Lock, Edit3 } from 'lucide-react';

interface ClozeExerciseProps {
    segments: TranscriptSegment[];
    onComplete: () => void;
    currentTime: number;
    onSegmentClick: (startTime: number) => void;
    initialAnswers?: Record<string, string>;
    initialAttempts?: number; // ADDED
    isReadOnly?: boolean;
    onSaveProgress?: (answers: Record<string, string>, score: { correct: number, total: number, attempts?: number }) => void;
    showTranslation: boolean;
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
    onSaveProgress,
    showTranslation,
    initialAttempts = 0
}) => {
    const [inputs, setInputs] = useState<Record<string, string>>(initialAnswers || {});
    const [attempts, setAttempts] = useState(initialAttempts); 
    const [isSubmitted, setIsSubmitted] = useState(isReadOnly || attempts > 0);
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

        // Save attempts along with score
        if (onSaveProgress) {
            onSaveProgress(inputs, { ...currentScore, attempts: newAttempts });
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
        <div className="flex flex-col h-[100dvh] bg-white dark:bg-slate-950 overflow-hidden">
           {/* Header - Unified with QuizTaker */}
           <div className="sticky top-0 z-10 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shadow-sm px-3 py-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <h1 className={`font-bold text-base font-serif shrink-0 ${isSubmitted ? 'text-indigo-800 dark:text-indigo-200' : 'text-slate-800 dark:text-slate-100'}`}>
                        {isFinalState ? <span className="flex items-center gap-1.5"><Lock size={16} /> <span className="hidden xs:inline">完形填空</span><span className="xs:hidden">完形</span></span> : (isSubmitted ? <span className="flex items-center gap-1.5"><Edit3 size={16} /> <span className="hidden xs:inline">发现错误</span><span className="xs:hidden">纠错</span></span> : "听写填空")}
                    </h1>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                    {isSubmitted ? (
                        <div className="flex items-center gap-1.5">
                            <div className={`text-xs font-black px-2 py-1 rounded-lg ${score.correct === score.total ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400'}`}>
                                {score.correct}/{score.total}
                            </div>
                            
                            {!isFinalState && (
                                <button
                                    onClick={handleRetry}
                                    className="px-2.5 py-1.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg font-bold text-xs hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all font-serif flex items-center gap-1"
                                >
                                    <RefreshCcw size={14} /> <span className="hidden xxs:inline">修改</span>
                                </button>
                            )}

                            <button
                                onClick={onComplete}
                                className={`px-2.5 py-1.5 rounded-lg font-bold text-xs transition-all font-serif flex items-center gap-1 ${
                                    !isFinalState 
                                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700' 
                                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                                }`}
                            >
                                <span className="hidden xxs:inline">{isFinalState ? "完成" : "跳过"}</span> <ArrowRight size={14} />
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5">
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                                {filledCount}/{clozeItems.length}
                            </div>
                            <button
                                onClick={handleCheck}
                                disabled={!isAllFilled}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95 font-serif ${
                                    isAllFilled 
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-80'
                                }`}
                            >
                                <CheckCircle2 size={14} /> <span className="hidden xxs:inline">{attempts === 1 ? '再查' : '提交'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div 
                ref={scrollContainerRef}
                className="flex-1 overflow-y-auto no-scrollbar py-2"
            >
            {/* Embedded Header for Context - REMOVED */}
            
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
                        <div className={`text-lg leading-snug font-serif ${isActive ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
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
                                                className={`border-b-2 outline-none text-center font-bold px-1 min-w-[3em] transition-colors h-[1.4em] align-middle font-serif ${
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
                                                <span className="ml-1 text-sm font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in inline-block align-middle font-serif">
                                                    {word.word}
                                                </span>
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
                        
                        <div className={`mt-0.5 text-sm tracking-wide leading-tight transition-all duration-300 font-serif ${isActive ? 'text-indigo-600/80 dark:text-indigo-400/80 font-medium' : 'text-slate-400 dark:text-slate-600'}`}>
                            <span className={`transition-all cursor-help select-none ${showTranslation ? '' : 'blur-[6px] hover:blur-0'}`}>{seg.translation}</span>
                        </div>
                    </div>
                );
            })}

            {/* Submit Button - REMOVED (Moved to Header) */}

            {/* After Submission Actions - REMOVED (Move to Header) */}
            
            <div className="h-24" />
        </div>
      </div>
    );
};

export default ClozeExercise;
