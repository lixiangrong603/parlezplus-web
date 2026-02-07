
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TranscriptSegment, RecorderState, Submission } from '../types';
import { 
  RotateCcw, Play, Square, CheckCircle2, Send, 
  AlertTriangle, Sparkles, MessageSquare, BarChart3, Star 
} from 'lucide-react';

interface TranscriptProps {
  segments: TranscriptSegment[];
  currentTime: number;
  onSegmentClick: (startTime: number) => void;
  isBlindMode: boolean;
  showTranslation: boolean;
  playMode: 'full' | 'single';
  recorderState?: RecorderState;
  
  // Full Mode Actions
  userAudioUrl?: string | null;
  isUserAudioPlaying?: boolean;
  onRetry?: (e: React.MouseEvent) => void;
  onTogglePlayback?: (e: React.MouseEvent) => void;
  
  // Single Mode Data & Actions
  segmentRecordings?: Record<string, { blob: Blob, url: string }>;
  playingSegmentId?: string | null;
  onSegmentPlayback?: (e: React.MouseEvent, id: string) => void;
  onSegmentRetry?: (e: React.MouseEvent, id: string) => void;
  
  // Submission
  onSubmit?: () => void;
  canSubmit?: boolean;
  submission?: Submission;
}

/**
 * Renders text with support for special French markings wrapped in asterisks
 * Example: "bon*j*our" displays the 'j' with muted styling if desired
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
 * Individual metric bar for the Evaluation Report Card
 */
const ScoreMetric: React.FC<{ label: string, value: number, color: string }> = ({ label, value, color }) => (
  <div className="flex flex-col">
    <div className="flex justify-between text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1 px-1">
      <span>{label}</span>
      <span className="text-slate-700 dark:text-slate-300 font-black">{value}%</span>
    </div>
    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-white dark:border-slate-700">
      <div 
        className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} 
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

/**
 * Svg curve representing a French Liaison between words
 */
const LiaisonCurve = () => (
  <span className="absolute left-full top-[85%] w-2.5 -ml-0.5 h-2 pointer-events-none z-10">
    <svg className="w-full h-full text-orange-500 opacity-80" viewBox="0 0 10 5" preserveAspectRatio="none">
      <path d="M0,0 Q5,4 10,0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  </span>
);

const Transcript: React.FC<TranscriptProps> = ({ 
  segments, 
  currentTime, 
  onSegmentClick, 
  isBlindMode, 
  showTranslation,
  playMode,
  recorderState,
  userAudioUrl,
  isUserAudioPlaying,
  onRetry,
  onTogglePlayback,
  segmentRecordings = {},
  playingSegmentId,
  onSegmentPlayback,
  onSegmentRetry,
  onSubmit,
  canSubmit = false,
  submission
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);
  const [hoveredWord, setHoveredWord] = useState<{ segId: string; wordIdx: number } | null>(null);

  const activeIndex = segments.findIndex(
    (seg) => currentTime >= seg.startTime && currentTime <= seg.endTime
  );

  const isGraded = submission?.status === 'graded';
  const isSubmitted = !!submission;

  // Handle auto-scrolling when active segment changes
  useEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [activeIndex]);

  // Handle scroll stability during UI state changes (recording transitions)
  useLayoutEffect(() => {
    if (activeItemRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'auto',
        block: 'center',
      });
    }
  }, [recorderState, segmentRecordings]); 

  /**
   * Finds scoring data for a specific word in the graded submission
   */
  const getWordScoreInfo = (word: string) => {
    if (!isGraded || !submission?.aiScore?.words) return null;
    const cleanTarget = word.toLowerCase().replace(/[.,!?;:"«»()]/g, '').trim();
    return submission.aiScore.words.find(w => {
      const cleanSource = w.word.toLowerCase().replace(/[.,!?;:"«»()]/g, '').trim();
      return cleanSource.includes(cleanTarget) || cleanTarget.includes(cleanSource);
    });
  };

  const getWordColorClass = (score: number) => {
    if (score >= 90) return 'text-emerald-500 font-bold';
    if (score >= 75) return 'text-amber-500 font-bold';
    return 'text-red-500 font-bold';
  };

  return (
    <div 
      ref={scrollContainerRef}
      className="flex-1 overflow-y-auto no-scrollbar py-2"
    >
      {segments.map((seg, index) => {
        const isActive = index === activeIndex;
        const isRecording = recorderState === RecorderState.RECORDING;
        const hasRecording = !!segmentRecordings[seg.id];
        const isThisSegmentPlaying = playingSegmentId === seg.id;
        const showInlineActions = playMode === 'single' && hasRecording; 

        return (
          <div
            key={seg.id}
            ref={isActive ? activeItemRef : null}
            onClick={isRecording ? undefined : () => onSegmentClick(seg.startTime)}
            className={`transition-all duration-200 py-1.5 px-4 border-l-4 relative ${
              isRecording ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
            } ${
              isActive 
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/10' 
                : `border-transparent ${!isRecording ? 'hover:bg-slate-50 dark:hover:bg-slate-900/30' : ''}`
            }`}
          >
            {/* Main Segment Text - Keeping text-lg but tighter leading */}
            <div className={`text-lg leading-snug font-serif ${isActive ? 'text-slate-900 dark:text-slate-100 font-medium' : 'text-slate-600 dark:text-slate-400'}`}>
              {seg.words.map((word, wIdx) => {
                const isWordActive = currentTime >= word.startTime && currentTime <= word.endTime;
                const scoreInfo = getWordScoreInfo(word.word);
                
                let wordColorClass = 'text-inherit';
                if (scoreInfo) {
                    wordColorClass = getWordColorClass(scoreInfo.score);
                } else if (isWordActive) {
                    wordColorClass = 'text-indigo-700 dark:text-indigo-300 font-bold';
                }

                return (
                  <div 
                    key={`${seg.id}-w-${wIdx}`} 
                    className={`inline-block relative group mr-1.5 align-baseline ${isRecording ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    onMouseEnter={() => isGraded && setHoveredWord({ segId: seg.id, wordIdx: wIdx })}
                    onMouseLeave={() => setHoveredWord(null)}
                    onClick={(e) => {
                      if (isRecording) {
                        e.stopPropagation();
                        return;
                      }
                      e.stopPropagation();
                      onSegmentClick(word.startTime);
                    }}
                  >
                    <span 
                      className={`inline-block px-0.5 rounded transition-all duration-200 relative ${
                        isWordActive 
                          ? 'bg-indigo-600/10 dark:bg-indigo-400/20 rounded-md' 
                          : ''
                      } ${wordColorClass}`}
                    >
                      <span className={`transition-all duration-500 block ${isBlindMode ? 'blur-[6px] select-none opacity-80' : 'blur-0'}`}>
                        <FrenchTextRenderer text={word.word} />
                      </span>
                    </span>

                    {/* Liaison Visualization */}
                    {word.needsLiaison && wIdx < seg.words.length - 1 && <LiaisonCurve />}

                    {/* Word-specific Score Tooltip (Only when Graded) */}
                    {isGraded && hoveredWord?.segId === seg.id && hoveredWord?.wordIdx === wIdx && scoreInfo && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded shadow-xl z-50 pointer-events-none animate-fade-in-up whitespace-nowrap">
                        <span className="font-bold">{Math.round(scoreInfo.score)}</span>
                        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Subtitle Translation - Reduced margin and tighter leading */}
            {showTranslation && (
              <div className={`mt-0.5 text-sm tracking-wide leading-tight transition-all duration-300 font-serif ${
                isActive 
                  ? 'text-indigo-600/80 dark:text-indigo-400/80 font-medium' 
                  : 'text-slate-400 dark:text-slate-600'
                } ${isBlindMode ? 'blur-[4px] opacity-50 select-none' : ''}`}>
                {seg.translation}
              </div>
            )}

            {/* Single Mode Inline Actions (Retry / Playback) - Reduced top margin */}
            {showInlineActions && (
              <div className="mt-1 flex items-center gap-3 animate-fade-in">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded font-serif">
                   <CheckCircle2 size={10} /> 已录制
                </div>

                {!isSubmitted && onSegmentRetry && (
                  <button 
                    onClick={(e) => onSegmentRetry(e, seg.id)}
                    className="flex items-center gap-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all text-[10px] font-bold font-serif"
                  >
                    <RotateCcw size={10} /> 重录
                  </button>
                )}
                
                {onSegmentPlayback && (
                  <button 
                    onClick={(e) => onSegmentPlayback(e, seg.id)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all text-[10px] font-bold font-serif ${
                      isThisSegmentPlaying 
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' 
                        : 'text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                    }`}
                  >
                    {isThisSegmentPlaying ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />} 回放
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* --- Graded Report Card --- */}
      {isGraded && submission?.aiScore && (
        <div className="mt-8 mb-8 px-6 animate-fade-in-up">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-indigo-100 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="bg-indigo-600 text-white p-6 flex justify-between items-center">
              <div>
                <h3 className="text-xl font-black flex items-center gap-2 font-serif">
                  <Star className="fill-white text-white" /> 最终得分
                </h3>
                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mt-1 font-serif">Evaluation Report</p>
              </div>
              <div className="text-5xl font-black tracking-tighter font-serif">
                {submission.aiScore.overallScore}
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Multidimensional Analysis - Removed Prosody Metric */}
              <div>
                <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2 font-serif">
                  <BarChart3 size={14} /> AI 维度分析
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <ScoreMetric label="准确度" value={submission.aiScore.correctness} color="bg-indigo-500" />
                  <ScoreMetric label="完整度" value={submission.aiScore.completeness} color="bg-emerald-500" />
                  <ScoreMetric label="流利度" value={submission.aiScore.fluency} color="bg-blue-500" />
                </div>
              </div>

              {/* Feedback Content */}
              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2 mb-2 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] uppercase tracking-wider font-serif">
                    <Sparkles size={14} /> AI 智能点评
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed italic font-serif">
                    "{submission.aiScore.generalFeedback}"
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-xl border border-amber-100 dark:border-amber-900/30">
                  <div className="flex items-center gap-2 mb-2 text-amber-600 dark:text-amber-400 font-bold text-[10px] uppercase tracking-wider font-serif">
                    <MessageSquare size={14} /> 教师评语
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-medium font-serif">
                    {submission.teacherFeedback || "老师暂未留下文字评语。"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Full Mode Review Box (Before Submission) --- */}
      {playMode === 'full' && recorderState === RecorderState.REVIEWING_AUDIO && !submission && (
        <div className="px-6 mt-4 mb-2 animate-fade-in-up">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-lg border border-indigo-200 dark:border-indigo-900 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-bold text-slate-800 dark:text-slate-100 font-serif">全篇录制已就绪</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-serif">请进行最后回放确认</span>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <button 
                onClick={onRetry}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-all text-xs font-bold font-serif"
              >
                <RotateCcw size={16} /> 重录
              </button>
              <button 
                onClick={onTogglePlayback}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-xs font-bold font-serif ${
                  isUserAudioPlaying 
                    ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {isUserAudioPlaying ? <Square size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />} 回放
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Final Submission Action --- */}
      {onSubmit && !isGraded && (
        <div className="mt-8 mb-12 px-6 animate-fade-in-up">
          <button 
            onClick={isSubmitted ? undefined : onSubmit}
            disabled={!canSubmit || isSubmitted}
            className={`w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-base font-black shadow-xl transition-all active:scale-95 font-serif ${
              canSubmit && !isSubmitted
                ? 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none' 
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-80'
            }`}
          >
            {isSubmitted ? <CheckCircle2 size={20} /> : (canSubmit ? <Send size={20} /> : <AlertTriangle size={20} />)}
            {isSubmitted ? "作业已提交" : (canSubmit ? "提交作业" : "完成所有练习后提交")}
          </button>
        </div>
      )}
      
      {/* Bottom Padding for scroll space */}
      <div className="h-24" />
    </div>
  );
};

export default Transcript;
