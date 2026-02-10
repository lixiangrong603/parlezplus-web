
import { 
  ChevronLeft, Sparkles, Languages, Music2, CheckCircle, 
  Loader2, Play, Pause, Trash2, FileText, BrainCircuit,
  Eraser, Link2, AlertTriangle, X
} from 'lucide-react';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MediaResource, TranscriptSegment, AzureWord, WordTiming, Question } from '../types';
import { useJobs } from '../contexts/JobContext';
import { useAuth } from '../contexts/AuthContext';
import ResourceTagger from './ResourceTagger';
import QuizEditor from './QuizEditor';
import { useModal } from '../contexts/ModalContext';
import { generateRandomCoverArt } from '../utils/mediaUtils';

// --- SHARED MODAL COMPONENT ---
const CustomConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "确认删除", 
  cancelText = "取消",
  type = "danger" 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string, 
  confirmText?: string, 
  cancelText?: string,
  type?: "danger" | "info"
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}>
            {type === 'danger' ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all">{cancelText}</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-[1.5] py-3 text-sm font-black text-white rounded-xl shadow-lg transition-all active:scale-95 ${type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-100 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

const getFallbackCover = (seed: string) => {
  return generateRandomCoverArt(seed || 'cover');
};

// --- CORE LOGIC: Reconcile Text Edits with Timestamps ---
const reconcileWords = (newText: string, originalWords: WordTiming[]): WordTiming[] => {
    const newTokens = newText.trim().split(/\s+/).filter(t => t.length > 0);
    const result: WordTiming[] = [];
    let searchIndex = 0;

    newTokens.forEach((token, i) => {
        let matchIndex = -1;
        for (let k = searchIndex; k < originalWords.length; k++) {
             if (originalWords[k].word === token) {
                 matchIndex = k;
                 break;
             }
        }
        if (matchIndex !== -1) {
            result.push({ ...originalWords[matchIndex] });
            searchIndex = matchIndex + 1;
        } else {
            if (i < originalWords.length && i >= searchIndex) {
                 const original = originalWords[i];
                 result.push({ ...original, word: token });
                 searchIndex = i + 1; 
            } else {
                result.push({ word: token, startTime: 0, endTime: 0 });
            }
        }
    });
    return result;
};

// Helper for auto-resizing textarea
const AutoResizeTextarea = React.forwardRef<HTMLTextAreaElement, any>(({ value, onChange, className, placeholder, readOnly, onKeyDown, onBlur }, ref) => {
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const combinedRef = (ref as any) || internalRef;

  useEffect(() => {
    if (combinedRef.current) {
      combinedRef.current.style.height = 'auto';
      combinedRef.current.style.height = combinedRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={combinedRef}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      className={className}
      placeholder={placeholder}
      readOnly={readOnly}
      rows={1}
      style={{ overflow: 'hidden', resize: 'none', minHeight: '40px' }}
    />
  );
});

interface SubtitleEditorProps {
    resource: MediaResource;
    onBack: () => void;
    onSave: (r: MediaResource) => void;
}

const SubtitleEditor: React.FC<SubtitleEditorProps> = ({ resource, onBack, onSave }) => {
  const { user } = useAuth();
  const modal = useModal();
  const [segments, setSegments] = useState<TranscriptSegment[]>(resource.transcript);
  const [rawAzureWords, setRawAzureWords] = useState<AzureWord[]>(resource.rawAzureWords || []);
  const [questions, setQuestions] = useState<Question[]>(resource.questions || []);
  const [title, setTitle] = useState(resource.title);
  const [activeSegId, setActiveSegId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'subtitle' | 'quiz'>('subtitle');
  
  const isAudioFile = useMemo(() => {
      if (!resource.videoUrl) return false;
      return /\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(resource.videoUrl);
  }, [resource.videoUrl]);

  const [isVideo, setIsVideo] = useState(!isAudioFile);
  const [backingTrackUrl, setBackingTrackUrl] = useState(resource.backingTrackUrl || '');
  
  const [difficulty, setDifficulty] = useState(resource.level);
  const [grammarTags, setGrammarTags] = useState<string[]>(resource.grammarTags || []);
  const [vocabTags, setVocabTags] = useState<string[]>(resource.vocabTags || []);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const { jobs, startAzureJob, startGeminiJob, clearJob } = useJobs(); 
  const activeJob = jobs[resource.id]; 
  
  const textInputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const backingTrackInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeJob && activeJob.status === 'completed' && activeJob.result) {
        if (activeJob.type === 'azure' && activeJob.result.segments) {
            setSegments(activeJob.result.segments);
            setRawAzureWords(activeJob.result.rawAzureWords || []);
            clearJob(resource.id);
        } else if (activeJob.type === 'gemini' && activeJob.result.segments) {
            setSegments(activeJob.result.segments);
            clearJob(resource.id);
        } else if (activeJob.type === 'quiz' && activeJob.result.questions) {
            setQuestions(prev => [...prev, ...activeJob.result!.questions!]);
            clearJob(resource.id);
        }
    }
  }, [activeJob, resource.id, clearJob]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
        const onPlay = () => setIsPlaying(true);
        const onPause = () => setIsPlaying(false);
        const onEnded = () => setIsPlaying(false);
        const onTimeUpdate = () => {
            setCurrentTime(audio.currentTime);
            if (!duration && audio.duration) setDuration(audio.duration);
        }
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('timeupdate', onTimeUpdate);
        return () => {
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('timeupdate', onTimeUpdate);
        };
    }
  }, [isVideo, resource.videoUrl, duration]); 

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
      const el = e.currentTarget;
      if (el.videoHeight === 0 || el.videoWidth === 0) setIsVideo(false);
      if (el.duration) setDuration(el.duration);
  };

  const runWorkflow = async (type: 'azure' | 'gemini') => {
    if (activeJob?.status === 'processing') return;
    
    if (!user?.id) {
      await modal.alert({ message: '请先登录' });
      return;
    }
    
    if (type === 'azure') {
       const key = localStorage.getItem(`${user.id}_azure_speech_key`);
       const region = localStorage.getItem(`${user.id}_azure_speech_region`);
       if (!key || !region) { await modal.alert({ message: '请先在设置中配置 Azure Speech Key 和 Region' }); return; }
       if (!resource.videoUrl) { await modal.alert({ message: '没有找到视频/音频源' }); return; }
       startAzureJob(resource, key, region);
    } else if (type === 'gemini') {
       const key = localStorage.getItem(`${user.id}_gemini_api_key`);
       if (!key) { await modal.alert({ message: '请先在设置中配置 Gemini API Key' }); return; }
       if (segments.length === 0) { await modal.alert({ message: '请先进行 Azure 转写以获取原文字幕。' }); return; }
       startGeminiJob(resource.id, segments, key);
    }
  };

  const handleSave = () => {
    onSave({ 
        ...resource, title, transcript: segments, rawAzureWords, questions, backingTrackUrl,
        level: difficulty as any, grammarTags, vocabTags
    });
  };

  const handleTextChange = (idx: number, newText: string) => {
     const newSegs = [...segments];
     const currentSeg = newSegs[idx];
     const updatedWords = reconcileWords(newText, currentSeg.words);
     newSegs[idx] = { ...currentSeg, text: newText, words: updatedWords };
     setSegments(newSegs);
  };
  
  const handleTranslationChange = (idx: number, newText: string) => {
     const newSegs = [...segments];
     newSegs[idx] = { ...newSegs[idx], translation: newText };
     setSegments(newSegs);
  };

  // Toggle Liaison status on the previous word (connecting to next)
  const handleLiaisonToggle = (segIdx: number, wordIdx: number) => {
     const newSegs = [...segments];
     const seg = newSegs[segIdx];
     if (!seg.words) return;
     const newWords = [...seg.words];
     // Toggle needsLiaison on the CURRENT word (which connects to the NEXT word)
     newWords[wordIdx] = { ...newWords[wordIdx], needsLiaison: !newWords[wordIdx].needsLiaison };
     newSegs[segIdx] = { ...seg, words: newWords };
     setSegments(newSegs);
  };

  // Toggle Cloze status on the word itself
  const handleClozeToggle = (segIdx: number, wordIdx: number) => {
     const newSegs = [...segments];
     const seg = newSegs[segIdx];
     if (!seg.words) return;
     const newWords = [...seg.words];
     newWords[wordIdx] = { ...newWords[wordIdx], isCloze: !newWords[wordIdx].isCloze };
     newSegs[segIdx] = { ...seg, words: newWords };
     setSegments(newSegs);
  };

  const handleSegmentKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, idx: number) => {
    const cursor = e.currentTarget.selectionStart;
    if (e.key === 'Enter') {
      e.preventDefault();
      const currentSeg = segments[idx];
      const textLeft = currentSeg.text.substring(0, cursor).trim();
      const textRight = currentSeg.text.substring(cursor).trim();
      if (!textLeft || !textRight) return;
      let charCount = 0;
      let splitWordIndex = currentSeg.words.length;
      for (let i = 0; i < currentSeg.words.length; i++) {
        const w = currentSeg.words[i];
        const wordIndexInText = currentSeg.text.indexOf(w.word, charCount);
        if (wordIndexInText === -1) { charCount += w.word.length + 1; continue; }
        if (cursor <= wordIndexInText) { splitWordIndex = i; break; }
        charCount = wordIndexInText + w.word.length;
        if (cursor < charCount) { splitWordIndex = i; break; }
      }
      const wordsLeft = currentSeg.words.slice(0, splitWordIndex);
      const wordsRight = currentSeg.words.slice(splitWordIndex);
      let splitTime = currentSeg.endTime;
      if (wordsLeft.length > 0 && wordsRight.length > 0) splitTime = (wordsLeft[wordsLeft.length - 1].endTime + wordsRight[0].startTime) / 2;
      else if (wordsLeft.length > 0) splitTime = wordsLeft[wordsLeft.length - 1].endTime;
      else if (wordsRight.length > 0) splitTime = wordsRight[0].startTime;
      const newSegId = Date.now().toString();
      const segLeft: TranscriptSegment = { ...currentSeg, text: textLeft, words: wordsLeft, endTime: parseFloat(splitTime.toFixed(3)) };
      const segRight: TranscriptSegment = { ...currentSeg, id: newSegId, text: textRight, words: wordsRight, translation: '', startTime: parseFloat(splitTime.toFixed(3)), endTime: currentSeg.endTime };
      const newSegments = [...segments];
      newSegments.splice(idx, 1, segLeft, segRight);
      setSegments(newSegments);
      setTimeout(() => { const el = textInputRefs.current[newSegId]; if (el) el.focus(); }, 0);
    }
    if (e.key === 'Backspace' && cursor === 0 && idx > 0) {
       e.preventDefault();
       const prevIdx = idx - 1;
       const prevSeg = segments[prevIdx];
       const currentSeg = segments[idx];
       const mergedText = (prevSeg.text + ' ' + currentSeg.text).trim();
       const mergedTranslation = (prevSeg.translation + ' ' + currentSeg.translation).trim();
       const mergedWords = [...prevSeg.words, ...currentSeg.words];
       const mergedSeg: TranscriptSegment = { ...prevSeg, text: mergedText, translation: mergedTranslation, words: mergedWords, endTime: currentSeg.endTime };
       const newSegments = [...segments];
       newSegments.splice(prevIdx, 2, mergedSeg);
       setSegments(newSegments);
       setTimeout(() => { const el = textInputRefs.current[prevSeg.id]; if (el) { el.focus(); const pos = prevSeg.text.length + (prevSeg.text ? 1 : 0); el.setSelectionRange(pos, pos); } }, 0);
    }
  };

  const playSegment = (start: number) => {
      const media = isVideo ? videoRef.current : audioRef.current;
      if (media) { media.currentTime = start; media.play(); }
  };

  const toggleAudioPlay = () => {
    if (audioRef.current) { if (isPlaying) audioRef.current.pause(); else audioRef.current.play(); }
  };
  
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioRef.current) { audioRef.current.currentTime = time; setCurrentTime(time); }
  };

  const handleBackingTrackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setBackingTrackUrl(URL.createObjectURL(file));
  };

  const executeDeleteSegment = () => {
    if (confirmDeleteId) {
      setSegments(prev => prev.filter(s => s.id !== confirmDeleteId));
      setConfirmDeleteId(null);
    }
  };

  const isProcessing = activeJob?.status === 'processing';
  const processingMessage = activeJob?.message;
  const fullText = useMemo(() => segments.map(s => s.text).join(' '), [segments]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden transition-colors duration-300">
      <header className="h-16 bg-white dark:bg-slate-900 border-b dark:border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 rounded-full transition hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600">
            <ChevronLeft size={20} />
          </button>
          <input value={title} onChange={e => setTitle(e.target.value)} className="text-lg font-bold text-slate-800 dark:text-slate-100 bg-transparent border-none focus:ring-0 w-64" placeholder="资源标题" disabled={isProcessing} />
          
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg ml-8">
            <button 
                onClick={() => setActiveTab('subtitle')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'subtitle' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
                <FileText size={14} /> 字幕编辑
            </button>
            <button 
                onClick={() => setActiveTab('quiz')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all ${activeTab === 'quiz' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
                <BrainCircuit size={14} /> 智能题库
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab === 'subtitle' && (
            <>
                <button onClick={() => runWorkflow('azure')} disabled={isProcessing} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition ${isProcessing ? 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-800 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-200'}`}>
                    {isProcessing && activeJob?.type === 'azure' ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Azure 转写
                </button>
                <button onClick={() => runWorkflow('gemini')} disabled={isProcessing} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition ${isProcessing ? 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-800 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-200'}`}>
                    {isProcessing && activeJob?.type === 'gemini' ? <Loader2 size={14} className="animate-spin" /> : <Languages size={14} />} Gemini 翻译
                </button>
                
                <input type="file" ref={backingTrackInputRef} className="hidden" accept="audio/*" onChange={handleBackingTrackChange} />
                <button onClick={() => backingTrackInputRef.current?.click()} disabled={isProcessing} className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg border transition ${isProcessing ? 'bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 border-slate-100 dark:border-slate-800 cursor-not-allowed' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-200'} ${backingTrackUrl ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800' : ''}`}>
                    <Music2 size={14} /> {backingTrackUrl ? '更换背景音' : '上传背景音'}
                </button>
                <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 mx-2"></div>
            </>
          )}

          <button onClick={handleSave} disabled={isProcessing} className={`px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-lg shadow-indigo-100 dark:shadow-none hover:bg-indigo-700 transition flex items-center gap-2 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}>
             <CheckCircle size={16} /> 保存并返回
          </button>
        </div>
      </header>
      
      {activeTab === 'subtitle' ? (
        <div className="flex-1 flex overflow-hidden bg-slate-50 dark:bg-slate-950">
            <div className="w-1/3 border-r dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col p-6 space-y-6 shrink-0">
            
            <div className="aspect-video bg-black rounded-2xl shadow-lg flex items-center justify-center relative overflow-hidden shrink-0 group">
                {resource.videoUrl ? (
                    isVideo ? (
                        <video ref={videoRef} src={resource.videoUrl} className="w-full h-full object-contain" controls onLoadedMetadata={handleLoadedMetadata} />
                    ) : (
                        <div className="w-full h-full flex flex-col relative bg-slate-900 overflow-hidden group/vinyl">
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950 overflow-hidden cursor-pointer" onClick={toggleAudioPlay}>
                                <div className="relative h-[85%] aspect-square shadow-2xl rounded-full z-10">
                                    <div className="w-full h-full rounded-full bg-[#111] flex items-center justify-center relative overflow-hidden ring-1 ring-white/10" style={{ animation: `spin 4s linear infinite`, animationPlayState: isPlaying ? 'running' : 'paused' }}>
                                        <div className="absolute inset-0 rounded-full opacity-80" style={{ background: `repeating-radial-gradient(#18181b 0, #18181b 2px, #27272a 3px, #27272a 4px)` }}></div>
                                        {/* GLOSS LAYER */}
                                        <div className="absolute inset-0 rounded-full opacity-40 mix-blend-screen" style={{ background: `conic-gradient(from 0deg, transparent 0%, rgba(255,255,255,0.08) 10%, transparent 20%, transparent 45%, rgba(255,255,255,0.12) 50%, transparent 55%, transparent 80%, rgba(255,255,255,0.08) 90%, transparent 100%)` }}></div>
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-30"></div>
                                        <div className="absolute w-[65%] h-[65%] rounded-full overflow-hidden border-4 border-[#18181b] z-10 bg-slate-800 shadow-md">
                                            <img src={resource.coverImage || getFallbackCover(resource.id)} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('bg-slate-700'); }} />
                                        </div>
                                        <div className="absolute w-3.5 h-3.5 bg-slate-200 rounded-full z-20 shadow-inner border border-slate-400">
                                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-black/50 rounded-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={`absolute -top-[12%] right-[5%] w-[20%] h-[75%] z-20 origin-[60%_15%] transition-transform duration-1000 ease-in-out ${isPlaying ? 'rotate-[25deg]' : '-rotate-[30deg]'}`} style={{ filter: 'drop-shadow(2px 4px 4px rgba(0,0,0,0.5))' }}>
                                <svg viewBox="0 0 100 300" className="w-full h-full overflow-visible">
                                    <circle cx="60" cy="40" r="24" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
                                    <circle cx="60" cy="40" r="8" fill="#1e293b" />
                                    <path d="M60 40 L60 200 Q60 250 20 260" fill="none" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />
                                    <g transform="translate(5, 250) rotate(15)">
                                        <rect x="0" y="0" width="28" height="42" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
                                        <path d="M24 10 L34 8 Q40 6 42 12" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                                        <rect x="10" y="32" width="8" height="12" fill="#334155" rx="1" />
                                    </g>
                                </svg>
                            </div>
                            <audio ref={audioRef} src={resource.videoUrl} className="hidden" onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)} />
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/60 backdrop-blur-sm z-30 transition-opacity duration-300 opacity-0 group-hover/vinyl:opacity-100 flex items-center gap-3">
                                <button onClick={toggleAudioPlay} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-black hover:scale-105 transition-transform">
                                    {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                                </button>
                                <span className="text-[10px] text-white font-mono w-8 text-right tabular-nums">
                                    {Math.floor(currentTime / 60)}:{Math.floor(currentTime % 60).toString().padStart(2, '0')}
                                </span>
                                <input type="range" min="0" max={duration || 100} step="0.1" value={currentTime} onChange={handleSeek} className="flex-1 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-1.5 transition-all" />
                                <span className="text-[10px] text-white/70 font-mono w-8 tabular-nums">
                                    {Math.floor(duration / 60)}:{Math.floor(duration % 60).toString().padStart(2, '0')}
                                </span>
                            </div>
                            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        </div>
                    )
                ) : ( <div className="text-slate-700 dark:text-slate-300 font-mono text-xs">NO SOURCE</div> )}
            </div>

            <div className="bg-slate-900 dark:bg-slate-950 rounded-2xl p-5 text-white flex-1 flex flex-col overflow-hidden">
                <h4 className="text-[10px] font-bold tracking-widest text-slate-500 uppercase mb-4 shrink-0">时间轴对齐</h4>
                <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
                    {segments.map((seg, i) => (
                    <div key={seg.id} onClick={() => { setActiveSegId(seg.id); playSegment(seg.startTime); }} className={`p-3 rounded-xl border transition-all cursor-pointer ${activeSegId === seg.id ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-800 dark:bg-slate-900 border-slate-700 dark:border-slate-800 hover:border-slate-600'}`}>
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">第 {i+1} 句</span>
                            <span className="text-[10px] font-mono text-indigo-300">{seg.startTime}s - {seg.endTime}s</span>
                        </div>
                        <p className="text-xs truncate opacity-70">{seg.text}</p>
                    </div>
                    ))}
                </div>
            </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar pb-32">
            
            <ResourceTagger 
                difficulty={difficulty}
                setDifficulty={setDifficulty}
                grammarTags={grammarTags}
                setGrammarTags={setGrammarTags}
                vocabTags={vocabTags}
                setVocabTags={setVocabTags}
            />

            {isProcessing && activeJob?.type !== 'quiz' && (
                <div className="flex items-center gap-3 bg-indigo-600 text-white p-4 rounded-2xl shadow-xl animate-bounce mb-4">
                <Loader2 className="animate-spin" />
                <span className="font-bold">{processingMessage || '后台任务处理中...'}</span>
                </div>
            )}
            
            {segments.length === 0 && !isProcessing && (
              <div className="h-64 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
                <Sparkles size={32} className="mb-2 opacity-10" />
                <p className="text-sm">尚未进行 ASR 转写，请点击上方按钮开始</p>
              </div>
            )}

            {segments.map((seg, idx) => (
                <div key={seg.id} onFocus={() => setActiveSegId(seg.id)} className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border transition-all ${activeSegId === seg.id ? 'border-indigo-400 dark:border-indigo-600 shadow-xl scale-[1.01]' : 'border-slate-100 dark:border-slate-800'}`}>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400 dark:text-slate-500">{idx+1}</span>
                        
                        <div className="flex gap-2 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-slate-800 cursor-default select-none">
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                开始 <span className="w-12 text-slate-700 dark:text-slate-300 text-center font-mono">{seg.startTime.toFixed(2)}</span>
                            </div>
                            <div className="w-[1px] bg-slate-200 dark:bg-slate-800 h-3 self-center"></div>
                            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1">
                                结束 <span className="w-12 text-slate-700 dark:text-slate-300 text-center font-mono">{seg.endTime.toFixed(2)}</span>
                            </div>
                        </div>

                        <button onClick={() => playSegment(seg.startTime)} className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded hover:bg-indigo-100 dark:hover:bg-indigo-800 transition" title="播放片段"><Play size={14} fill="currentColor" /></button>
                    </div>
                    <button onClick={() => setConfirmDeleteId(seg.id)} className="p-2 text-slate-300 dark:text-slate-700 hover:text-red-500 transition-colors" title="删除行"><Trash2 size={16} /></button>
                </div>
                
                <div className="flex flex-col gap-3">
                    <div className="relative group/field">
                        <span className="absolute right-3 top-2 text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider pointer-events-none group-focus-within/field:text-indigo-300">原文</span>
                        <AutoResizeTextarea 
                            ref={(el: HTMLTextAreaElement | null) => { textInputRefs.current[seg.id] = el; }}
                            className="w-full p-3 bg-indigo-50/50 dark:bg-indigo-900/10 border border-transparent focus:border-indigo-200 dark:focus:border-indigo-800 rounded-xl text-lg font-medium outline-none transition-all dark:text-slate-100" 
                            value={seg.text} 
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleTextChange(idx, e.target.value)} 
                            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => handleSegmentKeyDown(e, idx)}
                        />
                    </div>
                    
                    <div className="relative group/field">
                        <span className="absolute right-3 top-2 text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-wider pointer-events-none group-focus-within/field:text-slate-400">译文</span>
                        <AutoResizeTextarea 
                            className="w-full p-3 bg-slate-50 dark:bg-slate-950 border border-transparent focus:border-slate-200 dark:focus:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-400 outline-none transition-all" 
                            value={seg.translation} 
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleTranslationChange(idx, e.target.value)} 
                            placeholder="输入中文译文..."
                        />
                    </div>

                    <div className="bg-slate-50/30 dark:bg-slate-950/30 p-2 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider self-center flex items-center gap-1">
                                <Link2 size={12} /> 连诵与挖空标记
                            </span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-600 flex items-center gap-2">
                                <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-400 rounded-full"></span>点亮单词挖空</span>
                                <span className="flex items-center gap-1"><span className="w-2 h-2 text-indigo-500 font-bold border rounded-full flex items-center justify-center text-[6px]">‿</span>点亮符号连诵</span>
                            </span>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-y-2 gap-x-0.5">
                            {seg.words && seg.words.map((word, wIdx) => (
                                <React.Fragment key={wIdx}>
                                    <button
                                        onClick={() => handleClozeToggle(idx, wIdx)}
                                        className={`px-2 py-1 rounded-md text-sm border transition-all ${
                                            word.isCloze 
                                            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-bold shadow-sm' 
                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}
                                        title="点击标记为填空词 (Cloze)"
                                    >
                                        {word.word}
                                    </button>
                                    
                                    {wIdx < seg.words.length - 1 && (
                                        <button
                                            onClick={() => handleLiaisonToggle(idx, wIdx)}
                                            className={`mx-0.5 w-5 h-5 flex items-center justify-center rounded-full transition-all ${
                                                word.needsLiaison 
                                                ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20' 
                                                : 'text-slate-300 dark:text-slate-600 hover:text-slate-400 dark:hover:text-slate-500'
                                            }`}
                                            title="点击标记连诵 (Liaison)"
                                        >
                                            {word.needsLiaison ? (
                                                <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
                                                    <path d="M1 1 Q7 10 13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                                </svg>
                                            ) : (
                                                <span className="text-[10px]">•</span>
                                            )}
                                        </button>
                                    )}
                                </React.Fragment>
                            ))}
                            {(!seg.words || seg.words.length === 0) && (
                                <span className="text-xs text-slate-400 dark:text-slate-600 italic">暂无单词数据</span>
                            )}
                        </div>
                    </div>
                </div>
                </div>
            ))}
            </div>
            
            <CustomConfirmModal 
              isOpen={!!confirmDeleteId}
              onClose={() => setConfirmDeleteId(null)}
              onConfirm={executeDeleteSegment}
              title="删除字幕行"
              message="确定要删除这行字幕吗？相关的时间戳和单词标记也将一并丢失。"
            />
        </div>
      ) : (
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-8 no-scrollbar">
              {isProcessing && activeJob?.type === 'quiz' && (
                <div className="flex items-center gap-3 bg-indigo-600 text-white p-4 rounded-2xl shadow-xl animate-bounce mb-8 max-w-4xl mx-auto">
                    <Loader2 className="animate-spin" />
                    <span className="font-bold">{processingMessage || '正在智能生成题库...'}</span>
                </div>
              )}

              <QuizEditor 
                  questions={questions}
                  onChange={setQuestions}
                  fullText={fullText}
                  geminiKey={user?.id ? localStorage.getItem(`${user.id}_gemini_api_key`) || '' : ''}
                  onOpenSettings={() => void modal.alert({ message: '请先在设置中配置 Gemini API Key' })}
                  resourceId={resource.id}
              />
          </div>
      )}
    </div>
  );
};

export default SubtitleEditor;
