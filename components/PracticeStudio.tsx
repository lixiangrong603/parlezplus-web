
import React, { useState, useRef, useEffect } from 'react';
import { RecorderState, MediaResource, Submission, TranscriptSegment } from '../types';
import { fetchResourceFromCDN, saveStudentProgress, getStudentProgress, submitAssignment, getSubmissions } from '../utils/storage';
import { encodeWAV, resampleAudio, stitchAudioSegments, mixAudio, dataURLtoBlob } from '../utils/audioUtils';
import { uploadRecording } from '../services/api/client';
import Transcript from './Transcript';
import MediaPlayer from './MediaPlayer';
import QuizTaker from './QuizTaker';
import ClozeExercise from './ClozeExercise';
import { useAuth } from '../contexts/AuthContext';
import { useJobs } from '../contexts/JobContext';
import { Info, Sparkles, Mic, Play, Trash2, AlertCircle } from 'lucide-react';

// Icons specific to PracticeStudio UI
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>;
const ChevronLeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>;
const EyeIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>;
const EyeOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7c.44 0 .87-.03 1.28-.09"/><line x1="2" y1="2" x2="22" y2="22"/></svg>;
const MusicNoteIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
const TranslateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>;
const TranslateOffIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><line x1="2" x2="22" y1="2" y2="22"/></svg>;
const HeadphonesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/></svg>;
const RepeatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="m7 22-4-4 4-4"/></svg>;
const RepeatOneIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="m7 22-4-4 4-4"/><path d="M11 10h1v4"/></svg>;

// --- SHARED MODAL COMPONENT ---
const CustomConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "确认", 
  cancelText = "取消",
  type = "info" 
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
            {type === 'danger' ? <Trash2 size={32} /> : <AlertCircle size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2 font-serif">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-serif">{message}</p>
        </div>
        <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all font-serif">{cancelText}</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-[1.5] py-3 text-sm font-black text-white rounded-xl shadow-lg transition-all active:scale-95 font-serif ${type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-100 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

// --- AUDIO WORKLET CODE ---
const WORKLET_CODE = `
class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._bufferSize = 4096;
    this._buffer = new Float32Array(this._bufferSize);
    this._index = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];
      for (let i = 0; i < channelData.length; i++) {
        this._buffer[this._index++] = channelData[i];
        if (this._index >= this._bufferSize) {
          this.port.postMessage(this._buffer);
          this._index = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('audio-processor', AudioProcessor);
`;

const RECORDING_DELAY_MS = 1000;

// DEPRECATED: 不再使用 Base64 存储，改用 R2 上传
// const blobToBase64 = (blob: Blob): Promise<string> => {
//   return new Promise((resolve, reject) => {
//     const reader = new FileReader();
//     reader.onloadend = () => resolve(reader.result as string);
//     reader.onerror = reject;
//     reader.readAsDataURL(blob);
//   });
// };

// 上传录音到 R2
const uploadBlobToR2 = async (blob: Blob): Promise<string> => {
  try {
    const cdnUrl = await uploadRecording(blob);
    return cdnUrl;
  } catch (error) {
    console.error('Failed to upload recording:', error);
    // Fallback to Base64 for localStorage
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
};

interface PracticeStudioProps {
  resource: MediaResource;
  onBack: () => void;
}

const PracticeStudio: React.FC<PracticeStudioProps> = ({ resource: initialResource, onBack }) => {
  const { user } = useAuth();
  const currentUserId = user?.id || '';
  const { jobs, clearJob } = useJobs();
  
  const [resource, setResource] = useState<MediaResource>(initialResource);
  const [isLoadingCDN, setIsLoadingCDN] = useState(false);
  
  // Phase Management: Quiz -> Cloze -> Shadowing
  const [practicePhase, setPracticePhase] = useState<'quiz' | 'cloze' | 'shadowing' | 'initializing'>('initializing');

  // Persistent Data State for Quiz Restoration
  const [savedQuizData, setSavedQuizData] = useState<{answers?: Record<string, string>, score?: {score: number, total: number}}>({});
  // Persistent Data State for Cloze Restoration
  const [savedClozeData, setSavedClozeData] = useState<{answers?: Record<string, string>, score?: {correct: number, total: number}}>({});
  
  // Submission Data (Graded Result)
  const [submission, setSubmission] = useState<Submission | undefined>(undefined);

  // Confirm Modal State
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void, type?: "danger" | "info"} | null>(null);

  // Hint State
  const [hintMessage, setHintMessage] = useState<string | null>(null);

  // Determine initial phase based on content availability
  useEffect(() => {
    if (!currentUserId) return;
    
    // 1. Check Submission Status First (async)
    const checkSubmission = async () => {
      const allSubs = await getSubmissions();
      const existingSub = allSubs.find(s => s.resourceId === initialResource.id && s.studentId === currentUserId);
      setSubmission(existingSub);
    };
    checkSubmission();

    // 2. Initial State Logic
    const hasQuiz = initialResource.questions && initialResource.questions.length > 0;
    
    // Will check for cloze availability after loading transcript if needed, but initial check:
    const hasCloze = initialResource.transcript.some(seg => seg.words.some(w => w.isCloze));

    if (hasQuiz) {
        setPracticePhase('quiz');
    } else if (hasCloze) {
        setPracticePhase('cloze');
        setPlayMode('single'); // Set default to single for cloze
    } else {
        setPracticePhase('shadowing');
    }

    if (initialResource.transcriptUrl) {
      setIsLoadingCDN(true);
      fetchResourceFromCDN(initialResource.transcriptUrl).then((cdnData) => {
        if (cdnData && cdnData.transcript) {
          setResource(prev => ({ ...prev, ...cdnData }));
          // Re-evaluate phases if CDN data loads cloze words
          const loadedHasCloze = cdnData.transcript.some((seg: TranscriptSegment) => seg.words.some(w => w.isCloze));
          if (!hasQuiz && loadedHasCloze) {
              setPracticePhase('cloze');
              setPlayMode('single'); // Set default to single for cloze
          }
        }
        setIsLoadingCDN(false);
      });
    }

    // 3. Load Persisted Progress (if not fully graded, load partial work)
    const loadProgress = async () => {
      const savedData = await getStudentProgress(currentUserId, initialResource.id);
      if (savedData) {
          // Load single segment recordings
          if (savedData.segmentRecordings) {
              const loadedRecordings: Record<string, { blob: Blob, url: string }> = {};
              for (const [segId, value] of Object.entries(savedData.segmentRecordings)) {
                  if (typeof value === 'string' && value.startsWith('data:')) {
                      const blob = dataURLtoBlob(value);
                      loadedRecordings[segId] = { blob, url: URL.createObjectURL(blob) };
                  } else if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('/api/'))) {
                      // R2 CDN URL - use directly
                      loadedRecordings[segId] = { blob: new Blob(), url: value };
                  }
              }
              setSegmentRecordings(prev => ({ ...prev, ...loadedRecordings }));
          }
          // Load full recording
          if (savedData.fullRecording) {
              const isDataUrl = savedData.fullRecording.startsWith('data:');
              const blob = isDataUrl ? dataURLtoBlob(savedData.fullRecording) : new Blob();
              const url = isDataUrl ? URL.createObjectURL(blob) : savedData.fullRecording;
              setUserAudioBlob(blob);
              setUserAudioUrl(url);
              // Estimate duration
              setUserAudioDuration(blob.size / 32000); 
              setRecorderState(RecorderState.REVIEWING_AUDIO);
              setHasPerformedFullRecording(true); // A saved full recording means this step is done
          }
          
          // Load Quiz Data
          if (savedData.quizAnswers) {
              setSavedQuizData({
                  answers: savedData.quizAnswers,
                  score: savedData.quizScore
              });
          }

          // Load Cloze Data
          if (savedData.clozeAnswers) {
              setSavedClozeData({
                  answers: savedData.clozeAnswers,
                  score: savedData.clozeScore
              });
          }
      }
    };
    loadProgress();
  }, [initialResource, currentUserId]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null); 
  const userAudioRef = useRef<HTMLAudioElement | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Float32Array[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0); 
  const [recorderState, setRecorderState] = useState<RecorderState>(RecorderState.IDLE);
  
  // 锁定当前正在练习的单句 ID，防止连读
  const [lockedSegmentId, setLockedSegmentId] = useState<string | null>(null);

  // Full mode recording state
  const [userAudioBlob, setUserAudioBlob] = useState<Blob | null>(null);
  const [userAudioUrl, setUserAudioUrl] = useState<string | null>(null);
  const [userAudioDuration, setUserAudioDuration] = useState(0);
  const [isUserAudioPlaying, setIsUserAudioPlaying] = useState(false);
  const [hasPerformedFullRecording, setHasPerformedFullRecording] = useState(false);

  // Single mode recording state (Map segmentId -> { blob, url })
  const [segmentRecordings, setSegmentRecordings] = useState<Record<string, { blob: Blob, url: string }>>({});
  const [playingSegmentId, setPlayingSegmentId] = useState<string | null>(null);
  
  const lastRecordedSegmentId = useRef<string | null>(null);

  const [isBlindMode, setIsBlindMode] = useState(false); 
  const [showTranslation, setShowTranslation] = useState(false);
  
  const [isVocalEnabled, setIsVocalEnabled] = useState(true); 
  const [playbackRate, setPlaybackRate] = useState(1.0); 
  const [playMode, setPlayMode] = useState<'full' | 'single'>('full'); 

  const [recordedPlaybackRate, setRecordedPlaybackRate] = useState(1.0);
  const [recordingStartTime, setRecordingStartTime] = useState(0);
  const [isPreviewingMovie, setIsPreviewingMovie] = useState(false);
  const hasPreviewAudioTriggeredRef = useRef(false);

  const isSingleCompleted = resource.transcript.length > 0 && resource.transcript.every(seg => !!segmentRecordings[seg.id]);

  // Phase Transition Handlers
  const handleQuizComplete = () => {
      // Check if we need to do Cloze next
      const hasCloze = resource.transcript.some(seg => seg.words.some(w => w.isCloze));
      if (hasCloze) {
          setPracticePhase('cloze');
          setPlayMode('single'); // Set default to single for cloze
      } else {
          setPracticePhase('shadowing');
          // Keep full mode for shadowing - will auto-switch to single when recording starts
      }
  };

  const handleClozeComplete = () => {
      setPracticePhase('shadowing');
  };

  const handleSaveClozeProgress = (answers: Record<string, string>, score: { correct: number, total: number }) => {
      saveStudentProgress({
          userId: currentUserId,
          resourceId: resource.id,
          clozeAnswers: answers,
          clozeScore: score,
          lastUpdated: Date.now()
      });
      setSavedClozeData({ answers, score });
  };

  // --- HINT & FLOW LOGIC ---
  useEffect(() => {
      // Logic for "Click to record" hint - only shown when record button is available (Shadowing phase)
      if (practicePhase === 'shadowing' && Object.keys(segmentRecordings).length === 0 && !userAudioBlob && !submission) {
          setHintMessage("点击录音，开始单句精练");
          const timer = setTimeout(() => setHintMessage(null), 5000);
          return () => clearTimeout(timer);
      }
      
      // Cleanup: Clear shadowing hint if we leave shadowing phase (e.g. initial loading or manually switching)
      if (practicePhase !== 'shadowing' && hintMessage === "点击录音，开始单句精练") {
          setHintMessage(null);
      }
  }, [practicePhase, submission]);

  // Monitor completion but do NOT auto-switch. Instead, update hint.
  useEffect(() => {
      if (isSingleCompleted && playMode === 'single' && !userAudioBlob && !submission && practicePhase === 'shadowing') {
          setHintMessage("单句已录完！点击开启全篇挑战");
          // Keep the message longer as it is a significant milestone
          const timer = setTimeout(() => setHintMessage(null), 8000);
          return () => clearTimeout(timer);
      }
  }, [isSingleCompleted, playMode, userAudioBlob, submission, practicePhase]);

  // --- SUBMISSION LOGIC ---
  const isQuizCompleted = !resource.questions || resource.questions.length === 0 || !!savedQuizData.score;
  const isFullCompleted = hasPerformedFullRecording; 
  const canSubmit = isQuizCompleted && isSingleCompleted && isFullCompleted;
  const isReadOnly = !!submission;

  const handleSubmitAssignment = async () => {
      if (!canSubmit) return;

      const progress = await getStudentProgress(currentUserId, resource.id);
      const fullRecordingDataUrl = progress?.fullRecording;
      
      if (!fullRecordingDataUrl) return;

      const status = 'pending_review';

      const newSubmission: Submission = {
          id: `sub-${Date.now()}`,
          studentId: currentUserId,
          resourceId: resource.id,
          submittedAt: new Date().toLocaleString(),
          audioUrl: fullRecordingDataUrl, 
          status: status,
          quizResult: savedQuizData.score ? {
              score: savedQuizData.score.score,
              total: savedQuizData.score.total,
              answers: savedQuizData.answers || {}
          } : undefined,
          clozeResult: savedClozeData.score ? {
              score: savedClozeData.score.correct,
              total: savedClozeData.score.total,
              answers: savedClozeData.answers || {}
          } : undefined
      };

      submitAssignment(newSubmission);
      setSubmission(newSubmission); 
  };

  useEffect(() => {
    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.load();
      }
      if (bgmRef.current) {
        bgmRef.current.pause();
        bgmRef.current.src = "";
        bgmRef.current.load();
      }
      if (userAudioRef.current) {
        userAudioRef.current.pause();
        userAudioRef.current.src = "";
        userAudioRef.current.load();
        userAudioRef.current = null;
      }

      if (audioContextRef.current) audioContextRef.current.close();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      if (recordingTimeoutRef.current) window.clearTimeout(recordingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (playMode === 'single' && resource.transcript && resource.transcript.length > 0) {
      const allRecorded = resource.transcript.every(seg => !!segmentRecordings[seg.id]);
      
      if (allRecorded && duration > 0 && !userAudioBlob && !submission) {
        const stitchAndSetUrl = async () => {
          try {
            const stitchedBlob = await stitchAudioSegments(
                resource.transcript, 
                segmentRecordings, 
                duration, 
                RECORDING_DELAY_MS / 1000,
                recordedPlaybackRate
            );
            const url = URL.createObjectURL(stitchedBlob);
            setUserAudioBlob(stitchedBlob);
            setUserAudioUrl(url);
          } catch (error) {
            console.error("Failed to stitch audio segments:", error);
          }
        };
        stitchAndSetUrl();
      }
    }
  }, [segmentRecordings, resource.transcript, playMode, duration, recordedPlaybackRate, submission, userAudioBlob]);

  useEffect(() => {
    const video = videoRef.current;
    const bgm = bgmRef.current;
    if (video) {
      if (isVocalEnabled) {
        if (!isPreviewingMovie) {
          video.muted = false;
          if (bgm) bgm.muted = true;
        }
      } else {
        if (!isPreviewingMovie) {
          video.muted = true;
          if (bgm) {
            bgm.muted = false;
            bgm.currentTime = video.currentTime;
          }
        }
      }
    }
  }, [isVocalEnabled, isPreviewingMovie, resource.backingTrackUrl]);

  useEffect(() => {
    if (!isPreviewingMovie) {
      if (videoRef.current) videoRef.current.playbackRate = playbackRate;
      if (bgmRef.current) bgmRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, isPreviewingMovie]);

  useEffect(() => {
    let animationFrameId: number;
    const checkAudioTrigger = () => {
      if (isPreviewingMovie && isPlaying && videoRef.current && userAudioRef.current) {
        const vTime = videoRef.current.currentTime;
        if (!hasPreviewAudioTriggeredRef.current && vTime >= recordingStartTime) {
           userAudioRef.current.currentTime = vTime - recordingStartTime; 
           userAudioRef.current.play().catch(e => console.error("Audio play failed", e));
           hasPreviewAudioTriggeredRef.current = true;
        }
      }
      animationFrameId = requestAnimationFrame(checkAudioTrigger);
    };
    if (isPreviewingMovie && isPlaying) animationFrameId = requestAnimationFrame(checkAudioTrigger);
    return () => { if (animationFrameId) cancelAnimationFrame(animationFrameId); };
  }, [isPreviewingMovie, isPlaying, recordingStartTime]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      if (duration === 0 && videoRef.current.duration) setDuration(videoRef.current.duration);
      if (bgmRef.current && Math.abs(bgmRef.current.currentTime - time) > 0.3) bgmRef.current.currentTime = time;
      
      if (isPreviewingMovie && isPlaying && userAudioDuration > 0 && time >= userAudioDuration) {
          videoRef.current.pause();
          bgmRef.current?.pause();
          userAudioRef.current?.pause();
          setIsPlaying(false);
      }

      if (playMode === 'single' && isPlaying && !isPreviewingMovie && (practicePhase === 'shadowing' || practicePhase === 'cloze')) {
        const targetSeg = lockedSegmentId ? resource.transcript.find(s => s.id === lockedSegmentId) : null;
        if (targetSeg && time >= targetSeg.endTime - 0.05) { 
             videoRef.current.pause();
             if (bgmRef.current) bgmRef.current.pause();
             setIsPlaying(false);
             setLockedSegmentId(null); 
        } else if (!targetSeg) {
          const currentSeg = resource.transcript.find(s => time >= s.startTime && time <= s.endTime);
          if (currentSeg) setLockedSegmentId(currentSeg.id);
        }
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    setLockedSegmentId(null); 
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      if (bgmRef.current) bgmRef.current.currentTime = time;
    }
    
    if (isPreviewingMovie && userAudioRef.current) {
      const targetAudioTime = time - recordingStartTime;
      if (targetAudioTime >= 0) {
        userAudioRef.current.currentTime = targetAudioTime;
        hasPreviewAudioTriggeredRef.current = true;
        if (isPlaying) {
          userAudioRef.current.play().catch(e => console.error("Audio play failed during seek", e));
        }
      } else {
        userAudioRef.current.pause();
        userAudioRef.current.currentTime = 0;
        hasPreviewAudioTriggeredRef.current = false;
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        bgmRef.current?.pause(); 
        if (isPreviewingMovie && userAudioRef.current) userAudioRef.current.pause();
      } else {
        if (playMode === 'single' && !isPreviewingMovie) {
          const currentSeg = resource.transcript.find(s => videoRef.current!.currentTime >= s.startTime && videoRef.current!.currentTime <= s.endTime);
          if (currentSeg) setLockedSegmentId(currentSeg.id);
        }
        videoRef.current.play().catch(e => console.warn('Play interrupted', e));
        bgmRef.current?.play().catch(e => console.warn('BGM play interrupted', e)); 
        if (isPreviewingMovie && userAudioRef.current) {
            const vTime = videoRef.current.currentTime;
            if (vTime >= recordingStartTime) {
                userAudioRef.current.currentTime = vTime - recordingStartTime;
                userAudioRef.current.play().catch(e => console.error("Audio play failed on toggle", e));
                hasPreviewAudioTriggeredRef.current = true;
            }
        }
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rates = [1.0, 0.75, 0.5];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    setPlaybackRate(rates[nextIndex]);
  };

  const initAudioContext = async () => {
    if (!audioContextRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContextClass({ latencyHint: 'interactive' });
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      await audioContextRef.current.audioWorklet.addModule(url);
    }
    if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
  };

  const startRecording = async (targetSegmentId?: string) => {
    if (isReadOnly) return; 

    // Determine which mode to use for recording
    let recordingMode = playMode;

    // Auto-switch from full mode to single mode on first recording attempt
    if (!targetSegmentId && playMode === 'full' && !isSingleCompleted && !userAudioBlob) {
        recordingMode = 'single';
        setPlayMode('single');
    } else if (!targetSegmentId && playMode === 'single' && isSingleCompleted) {
        recordingMode = 'full';
        setPlayMode('full');
        setHintMessage("进入整篇挑战！");
    }

    if (videoRef.current) { videoRef.current.pause(); setIsPlaying(false); }
    if (bgmRef.current) { bgmRef.current.pause(); setIsPlaying(false); }
    if (userAudioRef.current) userAudioRef.current.pause();
    if (recordingTimeoutRef.current) { window.clearTimeout(recordingTimeoutRef.current); recordingTimeoutRef.current = null; }
    
    setPlayingSegmentId(null);

    try {
      await initAudioContext();
      if (!audioContextRef.current) return;
      
      let startTime;
      let segmentToRecord;

      const effectiveMode = (!targetSegmentId && recordingMode === 'single' && isSingleCompleted) ? 'full' : recordingMode;

      if (targetSegmentId) {
        segmentToRecord = resource.transcript.find(s => s.id === targetSegmentId);
      } else if (effectiveMode === 'full') {
        startTime = 0;
        segmentToRecord = resource.transcript[0];
        setCurrentTime(0);
        if (videoRef.current) videoRef.current.currentTime = 0;
        if (bgmRef.current) bgmRef.current.currentTime = 0;
      } else { 
        let currentSegment = resource.transcript.find(s => currentTime >= s.startTime && currentTime <= s.endTime) ||
                             resource.transcript.find(s => currentTime > s.endTime && currentTime < s.endTime + 1.0) ||
                             resource.transcript[0];

        let targetSegment = currentSegment;

        if (segmentRecordings[targetSegment.id]) {
            const currentIndex = resource.transcript.findIndex(s => s.id === targetSegment.id);
            if (currentIndex < resource.transcript.length - 1) {
                targetSegment = resource.transcript[currentIndex + 1];
            } else {
                return;
            }
        }
        segmentToRecord = targetSegment;
      }
      
      if (!segmentToRecord) return;

      startTime = segmentToRecord.startTime;
      setCurrentTime(startTime);
      setLockedSegmentId(segmentToRecord.id); 
      if (videoRef.current) videoRef.current.currentTime = startTime;
      if (bgmRef.current) bgmRef.current.currentTime = startTime;

      setRecordedPlaybackRate(playbackRate);
      setRecordingStartTime(startTime);
      const finalTargetSegmentId = segmentToRecord.id; 
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
      streamRef.current = stream;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      sourceNodeRef.current = source;
      const workletNode = new AudioWorkletNode(audioContextRef.current, 'audio-processor');
      workletNode.port.onmessage = (e) => { audioChunksRef.current.push(new Float32Array(e.data)); };
      workletNodeRef.current = workletNode;
      source.connect(workletNode);
      workletNode.connect(audioContextRef.current.destination);
      setRecorderState(RecorderState.RECORDING);
      lastRecordedSegmentId.current = finalTargetSegmentId;
      
      recordingTimeoutRef.current = window.setTimeout(async () => {
        if (videoRef.current) {
          videoRef.current.currentTime = startTime!;
          if (bgmRef.current) bgmRef.current.currentTime = startTime!;
          try { 
            await videoRef.current.play(); 
            bgmRef.current?.play(); 
            setIsPlaying(true); 
          } catch (e) { 
            console.error("Delayed playback failed", e); 
          }
        }
      }, RECORDING_DELAY_MS);
    } catch (err) {}
  };

  const stopRecording = () => {
    if (recordingTimeoutRef.current) { window.clearTimeout(recordingTimeoutRef.current); recordingTimeoutRef.current = null; }
    if (recorderState === RecorderState.RECORDING) {
      if (videoRef.current) { videoRef.current.pause(); bgmRef.current?.pause(); setIsPlaying(false); }
      if (sourceNodeRef.current) sourceNodeRef.current.disconnect();
      if (workletNodeRef.current) workletNodeRef.current.disconnect();
      if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
      const chunks = audioChunksRef.current;
      if (chunks.length > 0) {
          const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
          const fullAudio = new Float32Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) { fullAudio.set(chunk, offset); offset += chunk.length; }
          const context = audioContextRef.current!;
          const resampledAudio = resampleAudio(fullAudio, context.sampleRate, 16000);
          const wavBlob = encodeWAV(resampledAudio, 16000);
          const url = URL.createObjectURL(wavBlob);
          
          if (playMode === 'single' && lastRecordedSegmentId.current) {
              const segId = lastRecordedSegmentId.current;
              setSegmentRecordings(prev => ({
                  ...prev,
                  [segId]: { blob: wavBlob, url }
              }));
              setRecorderState(RecorderState.IDLE);
              
              // 上传录音到 R2
              uploadBlobToR2(wavBlob).then(urlOrBase64 => {
                  saveStudentProgress({
                      userId: currentUserId,
                      resourceId: resource.id,
                      segmentRecordings: { [segId]: urlOrBase64 },
                      lastUpdated: Date.now()
                  });
              });

              const seg = resource.transcript.find(s => s.id === segId);
              if (seg && videoRef.current) {
                videoRef.current.currentTime = seg.startTime;
                setCurrentTime(seg.startTime);
              }
          } else {
              setUserAudioBlob(wavBlob);
              setUserAudioUrl(url);
              setUserAudioDuration(resampledAudio.length / 16000);
              setRecorderState(RecorderState.REVIEWING_AUDIO);
              setHasPerformedFullRecording(true);
              
              // 上传完整录音到 R2
              uploadBlobToR2(wavBlob).then(urlOrBase64 => {
                  saveStudentProgress({
                      userId: currentUserId,
                      resourceId: resource.id,
                      fullRecording: urlOrBase64,
                      lastUpdated: Date.now()
                  });
              });
          }
      } else {
        setRecorderState(RecorderState.IDLE);
      }
      setLockedSegmentId(null);
    }
  };

  const toggleMoviePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPreviewingMovie) {
       setIsPreviewingMovie(false);
       setIsPlaying(false);
       if (userAudioRef.current) { userAudioRef.current.pause(); userAudioRef.current.currentTime = 0; }
       if (videoRef.current) { videoRef.current.pause(); videoRef.current.muted = !isVocalEnabled; videoRef.current.playbackRate = playbackRate; }
       if (bgmRef.current) { bgmRef.current.pause(); bgmRef.current.muted = isVocalEnabled; bgmRef.current.playbackRate = playbackRate; }
    } else {
       if (!userAudioUrl) return;
       setIsPreviewingMovie(true);
       setIsPlaying(true);
       if (!userAudioRef.current || userAudioRef.current.src !== userAudioUrl) {
         userAudioRef.current = new Audio(userAudioUrl);
         userAudioRef.current.onloadedmetadata = () => {
             setUserAudioDuration(userAudioRef.current!.duration);
         };
       }
       if (userAudioRef.current) {
           userAudioRef.current.onended = () => {
               toggleMoviePreview({ stopPropagation: () => {} } as React.MouseEvent);
           };
       }
       userAudioRef.current.currentTime = 0; 
       hasPreviewAudioTriggeredRef.current = false; 
       if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.playbackRate = recordedPlaybackRate; videoRef.current.muted = true; } 
       if (bgmRef.current) { bgmRef.current.currentTime = 0; bgmRef.current.playbackRate = recordedPlaybackRate; bgmRef.current.muted = false; }
       setRecordingStartTime(0);
       videoRef.current?.play(); 
       bgmRef.current?.play();
    }
  };

  const handleExport = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userAudioBlob) return;

    let finalBlob = userAudioBlob;

    if (resource.backingTrackUrl) {
      try {
        const bgmResponse = await fetch(resource.backingTrackUrl);
        const bgmBlob = await bgmResponse.blob();
        finalBlob = await mixAudio(userAudioBlob, bgmBlob);
      } catch (error) {
        console.error("Failed to mix audio with BGM:", error);
      }
    }
    
    const url = URL.createObjectURL(finalBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `${resource.title.replace(/\s/g, '_')}_dubbed_audio.wav`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const toggleUserAudioPlaying = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!userAudioRef.current && userAudioUrl) {
      userAudioRef.current = new Audio(userAudioUrl);
      userAudioRef.current.onended = () => setIsUserAudioPlaying(false);
    }
    if (userAudioRef.current) {
      if (userAudioRef.current.paused) { userAudioRef.current.play(); setIsUserAudioPlaying(true); }
      else { userAudioRef.current.pause(); setIsUserAudioPlaying(false); }
    }
  };

  const handleRetryFull = (e?: React.MouseEvent) => {
    if (isReadOnly) return;
    if (e) e.stopPropagation();
    
    setConfirmConfig({
      isOpen: true,
      title: "重录全篇",
      message: "重录将覆盖当前的整篇录音，之前的努力将消失，确定继续吗？",
      onConfirm: () => {
        if (userAudioRef.current) { userAudioRef.current.pause(); userAudioRef.current = null; }
        setIsUserAudioPlaying(false); setUserAudioBlob(null);
        setUserAudioUrl(null);
        setUserAudioDuration(0);
        setRecorderState(RecorderState.IDLE); setIsPreviewingMovie(false);
        if (videoRef.current) videoRef.current.currentTime = 0; 
        if (bgmRef.current) bgmRef.current.currentTime = 0; 
        setCurrentTime(0);
        lastRecordedSegmentId.current = null;
        setLockedSegmentId(null);
        setHasPerformedFullRecording(false);
      }
    });
  };

  const handleSegmentPlayback = (e: React.MouseEvent, segmentId: string) => {
      e.stopPropagation();
      const rec = segmentRecordings[segmentId];
      if (!rec) return;

      if (playingSegmentId === segmentId) {
          if (userAudioRef.current) {
              userAudioRef.current.pause();
              setIsUserAudioPlaying(false);
              setPlayingSegmentId(null);
          }
      } else {
          if (userAudioRef.current) { userAudioRef.current.pause(); }
          userAudioRef.current = new Audio(rec.url);
          userAudioRef.current.onended = () => {
              setIsUserAudioPlaying(false);
              setPlayingSegmentId(null);
          };
          userAudioRef.current.play();
          setIsUserAudioPlaying(true);
          setPlayingSegmentId(segmentId);
      }
  };

  const handleSegmentRetry = (e: React.MouseEvent, segmentId: string) => {
      if (isReadOnly) return;
      e.stopPropagation();

      setConfirmConfig({
        isOpen: true,
        title: "重录单句",
        message: "确定要重新录制这一句吗？原有录音将被覆盖。",
        onConfirm: () => {
          if (videoRef.current) videoRef.current.pause();
          if (bgmRef.current) bgmRef.current.pause();
          if (userAudioRef.current) userAudioRef.current.pause();
          setIsPlaying(false);

          const newMap = { ...segmentRecordings };
          delete newMap[segmentId];
          setSegmentRecordings(newMap);
          
          setUserAudioUrl(null);
          setUserAudioBlob(null);
          setUserAudioDuration(0);
          
          if (playingSegmentId === segmentId) {
              if (userAudioRef.current) { userAudioRef.current.pause(); userAudioRef.current = null; }
              setPlayingSegmentId(null);
              setIsUserAudioPlaying(false);
          }
          
          lastRecordedSegmentId.current = null;
          setLockedSegmentId(null);

          const seg = resource.transcript.find(s => s.id === segmentId);
          if (seg && videoRef.current) {
              videoRef.current.currentTime = seg.startTime;
              setCurrentTime(seg.startTime);
          }

          setTimeout(() => {
            startRecording(segmentId);
          }, 100);
        }
      });
  };

  const handleSegmentClick = (time: number) => {
    lastRecordedSegmentId.current = null; 
    
    if (isPreviewingMovie) {
        if (videoRef.current) videoRef.current.currentTime = time;
        if (bgmRef.current) bgmRef.current.currentTime = time;
        if (userAudioRef.current) {
            userAudioRef.current.currentTime = time;
            userAudioRef.current.play().catch(e => console.error("Jump play failed", e));
        }
        videoRef.current?.play();
        bgmRef.current?.play();
        setIsPlaying(true);
        hasPreviewAudioTriggeredRef.current = true;
    } else {
        setIsPreviewingMovie(false); 
        setLockedSegmentId(null); 
        if (videoRef.current) { 
          videoRef.current.currentTime = time; 
          if (bgmRef.current) bgmRef.current.currentTime = time; 
          videoRef.current.play().catch(e => console.warn('Play interrupted', e)); 
          bgmRef.current?.play().catch(e => console.warn('BGM play interrupted', e)); 
          setIsPlaying(true); 
        }
    }
  };

  const handleMediaEnded = () => {
    if (isPreviewingMovie) {
      videoRef.current?.pause();
      bgmRef.current?.pause();
      return;
    }
    if (playMode === 'full') {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(e => console.warn('Play loop interrupted', e));
      }
      if (bgmRef.current) {
        bgmRef.current.currentTime = 0;
        bgmRef.current.play().catch(e => console.warn('BGM loop interrupted', e));
      }
    } else {
      setIsPlaying(false);
      if (bgmRef.current) {
        bgmRef.current.pause();
      }
      setLockedSegmentId(null);
    }
  };

  if (isLoadingCDN || practicePhase === 'initializing') {
    return (
      <div className="flex flex-col items-center justify-center h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 text-indigo-600 dark:text-indigo-400 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin mb-4"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <p className="font-bold">正在加载资源数据...</p>
      </div>
    );
  }

  return (
      <div className="flex flex-col h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 md:max-w-6xl md:h-[90dvh] md:my-[5dvh] mx-auto md:rounded-3xl shadow-2xl overflow-hidden relative border md:border-slate-200 dark:border-slate-800 transition-colors duration-300">
        <div className="z-[100] p-4 bg-gradient-to-b from-black/70 to-transparent md:bg-white md:dark:bg-slate-900 md:border-b md:border-slate-100 md:dark:border-slate-800 flex items-center justify-between text-white md:text-slate-800 md:dark:text-slate-100 md:relative shrink-0 absolute md:static top-0 left-0 w-full pointer-events-none">
          <div className="flex items-center pointer-events-auto">
            <button onClick={onBack} className="p-2 backdrop-blur-md bg-white/20 md:bg-slate-100 md:dark:bg-slate-800 rounded-full hover:bg-white/30 md:hover:bg-slate-200 md:dark:hover:bg-slate-700 transition text-inherit cursor-pointer">
                <ChevronLeftIcon />
            </button>
            <div className="ml-4 flex flex-col">
                <span className="font-bold text-shadow md:text-shadow-none text-base leading-tight font-serif">{resource.title}</span>
                <span className="text-[10px] opacity-70 font-bold uppercase tracking-widest hidden md:block font-serif">Shadowing Studio</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <div className="w-full md:w-1/2 flex flex-col border-r border-slate-100 dark:border-slate-800 bg-black md:bg-white md:dark:bg-slate-900 shrink-0">
            <div className="flex-1 flex items-center justify-center bg-black md:bg-slate-50 md:dark:bg-slate-900">
              <MediaPlayer 
                resource={resource}
                videoRef={videoRef}
                bgmRef={bgmRef}
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={isPreviewingMovie ? userAudioDuration : duration}
                playbackRate={playbackRate}
                isPreviewingMovie={isPreviewingMovie}
                userAudioUrl={userAudioUrl}
                recorderState={recorderState}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                onEnded={handleMediaEnded}
                onTogglePlay={togglePlay}
                onSeek={handleSeek}
                onToggleSpeed={toggleSpeed}
                onExport={handleExport}
                onToggleMoviePreview={toggleMoviePreview}
              />
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden relative bg-white dark:bg-slate-900 transition-colors">
            {practicePhase === 'quiz' && resource.questions && (
                <QuizTaker 
                    questions={resource.questions} 
                    resourceId={resource.id}
                    onComplete={handleQuizComplete} 
                    initialAnswers={savedQuizData.answers}
                    initialScore={savedQuizData.score}
                />
            )}
            
            {practicePhase === 'cloze' && (
                <ClozeExercise 
                    segments={resource.transcript} 
                    onComplete={handleClozeComplete}
                    currentTime={currentTime}
                    onSegmentClick={handleSegmentClick}
                    initialAnswers={savedClozeData.answers}
                    isReadOnly={!!savedClozeData.answers || isReadOnly}
                    onSaveProgress={handleSaveClozeProgress}
                />
            )}

            {practicePhase === 'shadowing' && (
                <Transcript 
                    segments={resource.transcript} 
                    currentTime={currentTime} 
                    onSegmentClick={handleSegmentClick}
                    isBlindMode={isBlindMode}
                    showTranslation={showTranslation}
                    playMode={playMode}
                    recorderState={recorderState}
                    userAudioUrl={userAudioUrl}
                    isUserAudioPlaying={isUserAudioPlaying}
                    onRetry={handleRetryFull}
                    onTogglePlayback={toggleUserAudioPlaying}
                    segmentRecordings={segmentRecordings}
                    playingSegmentId={playingSegmentId}
                    onSegmentPlayback={handleSegmentPlayback}
                    onSegmentRetry={handleSegmentRetry}
                    onSubmit={handleSubmitAssignment}
                    canSubmit={canSubmit && !isReadOnly}
                    submission={submission} 
                />
            )}

            {recorderState === RecorderState.RECORDING && (
               <div className="absolute top-4 right-4 z-30 pointer-events-none">
                  <div className="bg-red-500/90 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-xs font-bold animate-pulse shadow-xl flex items-center gap-2 font-serif">
                    <div className="w-2 h-2 bg-white rounded-full"></div> 录音中...
                  </div>
               </div>
            )}
          </div>
        </div>

        {/* Universal Tools Footer */}
        {(practicePhase === 'shadowing' || practicePhase === 'cloze') && (
            <div className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] z-40 pb-6 md:pb-8 pt-4 relative shrink-0 transition-colors">
            <div className="max-w-4xl mx-auto flex items-center justify-between px-6 md:px-12 gap-2">
                <div className="flex items-center gap-2 md:gap-4 flex-1">
                    <button onClick={() => setPlayMode(playMode === 'full' ? 'single' : 'full')} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all ${playMode === 'single' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700'}`} title={playMode === 'full' ? "整篇循环" : "单句循环"}>{playMode === 'full' ? <RepeatIcon /> : <RepeatOneIcon />}</button>
                    <button onClick={() => setIsVocalEnabled(!isVocalEnabled)} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${!isVocalEnabled ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900/40' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700'}`}>{isVocalEnabled ? <HeadphonesIcon /> : <MusicNoteIcon />}</button>
                </div>

                <div className="relative group">
                    {hintMessage && (
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-indigo-900 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg z-50 whitespace-nowrap animate-fade-in-up flex items-center gap-2 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-[6px] after:border-transparent after:border-t-indigo-900 font-serif">
                            <Info size={14} className="text-indigo-300" />
                            {hintMessage}
                        </div>
                    )}

                    <button 
                        onClick={recorderState === RecorderState.RECORDING ? stopRecording : () => startRecording()} 
                        className={`w-16 h-16 md:w-20 md:h-20 rounded-full flex items-center justify-center shadow-lg transition-all transform active:scale-95 mx-6 ${
                            recorderState === RecorderState.RECORDING 
                            ? 'bg-red-500 text-white shadow-xl shadow-red-200 dark:shadow-none ring-8 ring-red-100 dark:ring-red-900/30 animate-pulse' 
                            : (recorderState === RecorderState.REVIEWING_AUDIO || isReadOnly || (practicePhase === 'cloze' && !savedClozeData.answers))
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed' 
                            : isSingleCompleted && playMode === 'single'
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none ring-8 ring-indigo-100 dark:ring-indigo-900/30 animate-bounce'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-200 dark:shadow-none ring-8 ring-white dark:ring-slate-900'
                        }`} 
                        disabled={recorderState === RecorderState.REVIEWING_AUDIO || isReadOnly || (practicePhase === 'cloze' && !savedClozeData.answers)}
                        >
                        {recorderState === RecorderState.RECORDING ? <StopIcon /> : (isSingleCompleted && playMode === 'single' ? <Play fill="currentColor" /> : <MicIcon />)}
                    </button>
                </div>

                <div className="flex items-center gap-2 md:gap-4 flex-1 justify-end">
                    <button onClick={() => setShowTranslation(!showTranslation)} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-colors ${showTranslation ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700'}`}>{showTranslation ? <TranslateIcon /> : <TranslateOffIcon />}</button>
                    <button onClick={() => setIsBlindMode(!isBlindMode)} className={`w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-all duration-300 ${isBlindMode ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/40' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700'}`}>{isBlindMode ? <EyeOffIcon /> : <EyeIcon />}</button>
                </div>
            </div>
            </div>
        )}
        <CustomConfirmModal 
          isOpen={!!confirmConfig && confirmConfig.isOpen}
          onClose={() => setConfirmConfig(null)}
          onConfirm={confirmConfig?.onConfirm || (() => {})}
          title={confirmConfig?.title || ""}
          message={confirmConfig?.message || ""}
          type={confirmConfig?.type}
        />
      </div>
  );
};

export default PracticeStudio;
