import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Sparkles, User, Play, Pause, 
  CheckCircle, ArrowRight, ArrowLeft, MessageSquare, Star, 
  ClipboardList, CheckCircle2, Users, BarChart3, Eye, EyeOff, RotateCcw, XCircle, Loader2,
  AlertTriangle, Trash2, HelpCircle, Edit3
} from 'lucide-react';
import { Submission, MediaResource, Classroom, Student, RecorderState, AIResponse, WordTiming } from '../types';
import { getResources, getClassroomById, getSubmissions, submitAssignment, getUserById } from '../utils/storage';
import { dataURLtoBlob } from '../utils/audioUtils';
import { getInitials, getColorFromString } from '../utils/mediaUtils';
import { useJobs } from '../contexts/JobContext';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import MediaPlayer from './MediaPlayer';
import { apiClient } from '../services/api/client';
import LazyImage, { DEFAULT_AVATAR_FALLBACK } from './LazyImage';

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
            {type === 'danger' ? <Trash2 size={32} /> : <Sparkles size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
                <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all">{cancelText}</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-[1.5] py-3 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

interface SubmissionManagerProps {
  taskId: string;
  classId: string;
  onBack: () => void;
}

const SubmissionManager: React.FC<SubmissionManagerProps> = ({ taskId, classId, onBack }) => {
  const { user } = useAuth();
  const modal = useModal();
  const { startBatchEvaluationJob, jobs, clearJob } = useJobs();
  
  const [resource, setResource] = useState<MediaResource | null>(null);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [showTranslations, setShowTranslations] = useState(false);
  const [hoveredWord, setHoveredWord] = useState<{ segId: string; wordIdx: number } | null>(null);
  
  // 批量批改状态
  const [batchQueue, setBatchQueue] = useState<string[]>([]);
  const [isBatching, setIsBatching] = useState(false);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  
  // 媒体播放状态
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewingMovie, setIsPreviewingMovie] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const userAudioRef = useRef<HTMLAudioElement>(null);

  const [feedback, setFeedback] = useState('');
  const [finalScore, setFinalScore] = useState(0);

  // 初始化加载数据
  useEffect(() => {
    const loadData = async () => {
      const allResources = await getResources(user?.id);
      const res = allResources.find(r => r.id === taskId);
      if (res) setResource(res);
      
            const cls = await getClassroomById(classId);
      if (cls) {
          setClassroom(cls);
                    await refreshSubmissions();
      }
    };
    loadData();
  }, [taskId, classId, user?.id]);

    // Refresh classroom data when storage is updated (e.g., student avatar changed)
    useEffect(() => {
                const handleDataChanged = async () => {
                        const cls = await getClassroomById(classId);
                        if (cls) setClassroom(cls);
                };
        window.addEventListener('parlezplus:data-changed', handleDataChanged as EventListener);
        return () => window.removeEventListener('parlezplus:data-changed', handleDataChanged as EventListener);
    }, [classId]);

    const refreshSubmissions = async () => {
        const allSubmissions = await getSubmissions();
        const relevantSubmissions = allSubmissions.filter(s => s.resourceId === taskId);
        setSubmissions(relevantSubmissions);
    };

  const currentStudent = classroom?.students.find(s => s.id === selectedStudentId);
  const currentSubmission = submissions.find(s => 
    s.studentId === currentStudent?.userId || s.studentId === currentStudent?.id
  );

  const evalJobId = currentSubmission ? `eval-${currentSubmission.id}` : '';
  const activeEvalJob = jobs[evalJobId];
  const jobStatus = activeEvalJob ? activeEvalJob.status : 'idle';
  const submissionId = currentSubmission ? currentSubmission.id : null;
  const submissionStatus = currentSubmission ? currentSubmission.status : null;

  useEffect(() => {
      if (currentSubmission) {
          setFeedback(currentSubmission.teacherFeedback || '');
          setFinalScore(currentSubmission.aiScore?.overallScore || 0);
      } else {
          setFeedback('');
          setFinalScore(0);
      }
  }, [submissionId]);

  const moveToNextInQueue = () => {
    if (!isBatching || !selectedStudentId) return;
    const currentIndex = batchQueue.indexOf(selectedStudentId);
    if (currentIndex < batchQueue.length - 1) {
        setTimeout(() => {
            setSelectedStudentId(batchQueue[currentIndex + 1]);
        }, 1500); 
    } else {
        setIsBatching(false);
        setBatchQueue([]);
    }
  };

  useEffect(() => {
    if (!activeEvalJob || !currentSubmission) return;

    if (activeEvalJob.status === 'completed' && activeEvalJob.result?.evaluationResult) {
        const batchResult = activeEvalJob.result.evaluationResult;
        
        if (batchResult && batchResult.segmentEvaluations && batchResult.segmentEvaluations.length > 0) {
            const evals = batchResult.segmentEvaluations as (AIResponse & { id: string })[];
            const fullEval = evals[0]; 
            
            const aggregatedScore: AIResponse = {
                overallScore: Math.round(fullEval.overallScore),
                correctness: Math.round(fullEval.correctness),
                completeness: Math.round(fullEval.completeness),
                fluency: Math.round(fullEval.fluency),
                prosody: Math.round(fullEval.prosody),
                generalFeedback: fullEval.generalFeedback,
                words: fullEval.words
            };

            const updatedSubmission: Submission = { 
                ...currentSubmission, 
                aiScore: aggregatedScore, 
                aiSegmentEvals: evals, 
                status: 'graded' as const 
            };
            
            submitAssignment(updatedSubmission);
            refreshSubmissions();
            setFinalScore(aggregatedScore.overallScore);
            clearJob(evalJobId);

            if (isBatching) {
                moveToNextInQueue();
            }
        }
    } else if (activeEvalJob.status === 'error') {
        console.error(`AI评估失败: ${activeEvalJob.error}`);
        clearJob(evalJobId);
        if (isBatching) {
            moveToNextInQueue();
        }
    }
  }, [jobStatus, submissionId, isBatching, batchQueue, selectedStudentId]);

  useEffect(() => {
      if (isBatching && selectedStudentId && currentSubmission) {
          if (currentSubmission.status === 'graded') {
              moveToNextInQueue();
          } else if (currentSubmission.status === 'pending_review') {
              if (jobStatus === 'idle') {
                  handleEvaluate();
              }
          }
      } else if (isBatching && selectedStudentId && !currentSubmission) {
          moveToNextInQueue();
      }
  }, [selectedStudentId, isBatching, submissionStatus, jobStatus]);

  const startBatchGrading = () => {
    const toGrade = classroom?.students.filter(s => {
        const sub = submissions.find(sub => sub.studentId === s.userId || sub.studentId === s.id);
        return sub && sub.status === 'pending_review';
    }).map(s => s.id) || [];

    if (toGrade.length === 0) return;

    setBatchQueue(toGrade);
    setShowBatchConfirm(true);
  };

  const executeBatchGrading = () => {
      setIsBatching(true);
      if (batchQueue.length > 0) {
        setSelectedStudentId(batchQueue[0]);
      }
  };

  const handleEvaluate = async () => {
      if (!currentSubmission?.audioUrl || !resource || !evalJobId) return;
      
      if (!user?.id) {
          void modal.alert({ message: '请先登录' });
          setIsBatching(false);
          return;
      }
      
      let azureKey = localStorage.getItem(`${user.id}_azure_speech_key`);
      let azureRegion = localStorage.getItem(`${user.id}_azure_speech_region`);
      const authToken = localStorage.getItem('auth_token');
      
      // 如果 localStorage 没有 key，尝试从数据库同步
      if (!azureKey) {
        try {
          const data = await apiClient.get<{
            hasAzureKey: boolean;
            azureKey?: string;
            azureRegion?: string;
          }>(`/api/users/${user.id}/api-keys?decrypt=true`);
          
          if (data.azureKey) {
            azureKey = data.azureKey;
            localStorage.setItem(`${user.id}_azure_speech_key`, azureKey);
          }
          if (data.azureRegion) {
            azureRegion = data.azureRegion;
            localStorage.setItem(`${user.id}_azure_speech_region`, azureRegion);
          }
        } catch (e) {
          console.error('Failed to sync API keys:', e);
        }
      }
      
      if (!azureKey || !azureRegion || !authToken) {
          if(!azureKey) void modal.alert({ message: '未配置 Azure Speech Key' });
          else if(!authToken) void modal.alert({ message: '请先登录' });
          setIsBatching(false);
          return;
      }

      try {
          const audioBlob = dataURLtoBlob(currentSubmission.audioUrl);
          const segmentsForEval = resource.transcript.map(s => ({ id: s.id, text: s.text }));
          startBatchEvaluationJob(currentSubmission.id, segmentsForEval, audioBlob, azureKey, azureRegion, authToken);
      } catch (e) {
          console.error("Evaluation start failed", e);
          if (isBatching) moveToNextInQueue();
      }
  };

  const getWordInfo = (segId: string, wordText: string) => {
    const words = currentSubmission?.aiScore?.words;
    if (!words || words.length === 0) return null;
    const cleanTarget = wordText.toLowerCase().replace(/[.,!?;:"«»()]/g, '').trim();
    if (!cleanTarget) return null;
    return words.find(w => {
        const cleanWordFromAI = w.word.toLowerCase().replace(/[.,!?;:"«»()]/g, '').trim();
        return cleanWordFromAI === cleanTarget || cleanWordFromAI.includes(cleanTarget) || cleanTarget.includes(cleanWordFromAI);
    }) || null;
  };

  const getWordColor = (wordInfo: { score: number } | null) => {
    if (!wordInfo) return 'text-slate-700 dark:text-slate-200';
    if (wordInfo.score >= 90) return 'text-emerald-500 font-bold';
    if (wordInfo.score >= 75) return 'text-amber-500 font-bold';
    return 'text-red-500 font-bold';
  };

  const handleTogglePreview = () => {
    if (!currentSubmission?.audioUrl) return;
    if (isPreviewingMovie) {
        setIsPreviewingMovie(false);
        setIsPlaying(false);
        videoRef.current?.pause();
        bgmRef.current?.pause();
        userAudioRef.current?.pause();
    } else {
        setIsPreviewingMovie(true);
        setIsPlaying(true);
        if (userAudioRef.current) {
            userAudioRef.current.currentTime = 0;
            userAudioRef.current.play().catch(e => console.error(e));
        }
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.muted = true;
            videoRef.current.play().catch(e => console.error(e));
        }
        if (bgmRef.current) {
            bgmRef.current.currentTime = 0;
            bgmRef.current.play().catch(e => console.error(e));
        }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleSeekToWord = (time: number) => {
      setCurrentTime(time);
      if (videoRef.current) videoRef.current.currentTime = time;
      if (bgmRef.current) bgmRef.current.currentTime = time;
      if (userAudioRef.current) userAudioRef.current.currentTime = time;
  };

  const handleConfirmGrading = () => {
      if (!currentSubmission) return;
      const updatedSubmission: Submission = { 
          ...currentSubmission, 
          status: 'graded' as const,
          teacherFeedback: feedback,
          aiScore: currentSubmission.aiScore ? { ...currentSubmission.aiScore, overallScore: finalScore } : undefined
      };
      submitAssignment(updatedSubmission);
      refreshSubmissions();
  };

  const batchProcessingIndex = isBatching && selectedStudentId ? batchQueue.indexOf(selectedStudentId) : -1;

  const normalize = (str: string) => str.toLowerCase().replace(/[.,!?;:"«»()]/g, '').trim();

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden relative">
      <audio ref={userAudioRef} src={currentSubmission?.audioUrl} onEnded={() => { setIsPlaying(false); setIsPreviewingMovie(false); }} />

      {isBatching && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[60] animate-fade-in-down pointer-events-none">
              <div className="bg-indigo-600 text-white px-6 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 border border-indigo-400">
                  <div className="relative w-10 h-10 shrink-0">
                      <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-white rounded-full border-t-transparent animate-spin"></div>
                  </div>
                  <div className="flex flex-col min-w-[180px]">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-70">批量批改队列</span>
                      <span className="text-sm font-bold truncate">正在处理: {currentStudent?.name || '...'}</span>
                      <div className="mt-1 h-1 w-full bg-white/20 rounded-full overflow-hidden">
                          <div className="h-full bg-white transition-all duration-500" style={{ width: `${((batchProcessingIndex + 1) / batchQueue.length) * 100}%` }}></div>
                      </div>
                  </div>
                  <div className="text-right ml-2">
                      <span className="text-xs font-black">{batchProcessingIndex + 1} / {batchQueue.length}</span>
                  </div>
              </div>
          </div>
      )}

      <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between shrink-0 z-10 shadow-sm transition-colors">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-full text-slate-500 hover:text-indigo-600 transition-all">
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-slate-100 truncate max-w-xs">{resource?.title}</h2>
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">{classroom?.name} · 批改作业</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              待评: <span className="text-indigo-600 font-black">{submissions.filter(s => s.status === 'pending_review').length}</span> / {classroom?.students.length}
            </span>
            <button 
                onClick={startBatchGrading}
                disabled={isBatching}
                className={`px-4 py-1.5 rounded-xl text-xs font-black shadow-lg transition-all flex items-center justify-center gap-2 ${isBatching ? 'bg-indigo-100 text-indigo-400' : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700 active:scale-95'}`}
            >
               {isBatching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
               {isBatching ? `批量批改中...` : "自动批量批改"}
            </button>
            {isBatching && (
                <button onClick={() => { setIsBatching(false); setBatchQueue([]); }} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                    <XCircle size={18} />
                </button>
            )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-60 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
            <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">待批改列表</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-1.5 space-y-1 no-scrollbar">
            {classroom?.students.map(student => {
              const sub = submissions.find(s => s.studentId === student.userId || s.studentId === student.id);
              const isSelected = selectedStudentId === student.id;
              const isGradingThis = isBatching && selectedStudentId === student.id;
              return (
                <button 
                  key={student.id} 
                  onClick={() => { if(!isBatching) { setSelectedStudentId(student.id); setIsPreviewingMovie(false); setIsPlaying(false); } }}
                  disabled={!sub || (isBatching && !isSelected)}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all ${!sub ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:bg-slate-50 dark:hover:bg-slate-800'} ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-1 ring-indigo-500 shadow-sm' : ''} ${isGradingThis ? 'animate-pulse' : ''}`}
                >
                                    {(() => {
                                        const userAvatar = student.userId ? getUserById(student.userId)?.avatar : undefined;
                                        const avatar = userAvatar || student.avatar;
                                        return avatar ? (
                                            <LazyImage
                                              src={avatar}
                                              fallbackSrc={DEFAULT_AVATAR_FALLBACK}
                                              alt={student.name}
                                              containerClassName="w-8 h-8 rounded-full border border-white dark:border-slate-700 shadow-sm"
                                              className="w-full h-full rounded-full object-cover"
                                            />
                                        ) : (
                                            <div 
                                                className="w-8 h-8 rounded-full border border-white dark:border-slate-700 shadow-sm flex items-center justify-center text-white text-[10px] font-black"
                                                style={{ backgroundColor: getColorFromString(student.userId || student.name) }}
                                            >
                                                {getInitials(student.name)}
                                            </div>
                                        );
                                    })()}
                  <div className="text-left flex-1 min-w-0">
                    <p className={`text-[11px] font-black truncate ${isSelected ? 'text-indigo-600' : 'text-slate-700 dark:text-slate-200'}`}>{student.name}</p>
                    <p className="text-[8px] text-slate-400 leading-none">{sub ? sub.submittedAt : '-'}</p>
                  </div>
                  {sub && sub.status === 'graded' && <CheckCircle size={10} className="text-emerald-500" />}
                  {isGradingThis && <Loader2 size={10} className="animate-spin text-indigo-500" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 no-scrollbar bg-slate-50 dark:bg-slate-950">
          {!selectedStudentId ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
               <User size={40} className="opacity-10 mb-4" />
               <p className="text-[10px] font-black uppercase tracking-widest">请选择一名学生开始批改</p>
            </div>
          ) : (
            <div className="max-w-5xl mx-auto space-y-5 animate-fade-in pb-10">
                {(currentSubmission?.quizResult || currentSubmission?.clozeResult) && (
                    <div className="flex flex-col md:flex-row gap-5">
                        {currentSubmission?.quizResult && (
                            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-4 border dark:border-slate-800 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600">
                                        <ClipboardList size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-100 leading-none">听力测试</h4>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Quiz Score</p>
                                    </div>
                                </div>
                                <div className="text-right leading-none">
                                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">得分</span>
                                    <span className="text-xl font-black text-emerald-600">{currentSubmission.quizResult.score} / {currentSubmission.quizResult.total}</span>
                                </div>
                            </div>
                        )}
                        {currentSubmission?.clozeResult && (
                            <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl p-4 border dark:border-slate-800 shadow-sm flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-emerald-900/20 flex items-center justify-center text-amber-600">
                                        <HelpCircle size={18} />
                                    </div>
                                    <div>
                                        <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-100 leading-none">填空练习</h4>
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Cloze Score</p>
                                    </div>
                                </div>
                                <div className="text-right leading-none">
                                    <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">得分</span>
                                    <span className="text-xl font-black text-amber-600">{currentSubmission.clozeResult.score} / {currentSubmission.clozeResult.total}</span>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                    <div className="lg:col-span-7 bg-slate-900 rounded-[1.5rem] shadow-lg overflow-hidden border-2 border-white dark:border-slate-800 flex flex-col relative group">
                        <div className="aspect-video relative">
                            {resource && (
                                <MediaPlayer 
                                    resource={resource}
                                    videoRef={videoRef}
                                    bgmRef={bgmRef}
                                    isPlaying={isPlaying}
                                    currentTime={currentTime}
                                    duration={duration}
                                    playbackRate={1.0}
                                    isPreviewingMovie={isPreviewingMovie}
                                    userAudioUrl={currentSubmission?.audioUrl || null}
                                    recorderState={RecorderState.IDLE}
                                    onTimeUpdate={handleTimeUpdate}
                                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                                    onEnded={() => { setIsPlaying(false); setIsPreviewingMovie(false); }}
                                    onTogglePlay={handleTogglePreview}
                                    onSeek={(e) => handleSeekToWord(parseFloat(e.target.value))}
                                    onToggleSpeed={() => {}}
                                    onExport={() => {}}
                                    onToggleMoviePreview={handleTogglePreview}
                                />
                            )}
                        </div>
                        <div className="p-2 bg-indigo-600 text-white flex justify-between items-center px-4">
                             <div className="flex items-center gap-2">
                                <div className={`w-1.5 h-1.5 rounded-full bg-white ${isPlaying ? 'animate-pulse' : ''}`} />
                                <span className="text-[8px] font-black uppercase tracking-widest">录音实时同步</span>
                             </div>
                        </div>
                    </div>

                    <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-[1.5rem] p-5 border dark:border-slate-800 shadow-sm flex flex-col relative overflow-hidden">
                        <div className="flex justify-between items-start mb-5">
                            <div className="flex flex-col">
                                <h4 className="text-[11px] font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5"><BarChart3 size={14} className="text-indigo-600" /> AI 维度评估</h4>
                                <p className="text-[8px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Automated Analysis</p>
                            </div>
                            <div className="text-right">
                                {currentSubmission?.aiScore ? (
                                    <span className="text-4xl font-black text-indigo-600 leading-none tracking-tighter">{currentSubmission.aiScore.overallScore}</span>
                                ) : (
                                    <span className="text-sm font-black text-slate-400">未评分</span>
                                )}
                            </div>
                        </div>

                        {currentSubmission?.aiScore ? (
                            <>
                                <div className="grid grid-cols-2 gap-x-5 gap-y-3 mb-4">
                                    <ScoreMetric label="发音准确" value={currentSubmission.aiScore.correctness || 0} color="bg-indigo-500" />
                                    <ScoreMetric label="语段完整" value={currentSubmission.aiScore.completeness || 0} color="bg-emerald-500" />
                                    <ScoreMetric label="语流流畅" value={currentSubmission.aiScore.fluency || 0} color="bg-blue-500" />
                                </div>
                                <div className="flex-1 bg-slate-50 dark:bg-slate-950 rounded-xl p-3 border border-slate-100 dark:border-slate-800 overflow-y-auto no-scrollbar relative">
                                    <div className="flex items-center gap-1 mb-1.5 text-[8px] font-black text-indigo-500 uppercase tracking-widest sticky top-0 bg-slate-50 dark:bg-slate-950 py-0.5">
                                        <Sparkles size={10} /> 评价反馈
                                    </div>
                                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 italic">"{currentSubmission.aiScore.generalFeedback}"</p>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                {jobStatus === 'processing' ? (
                                    <>
                                        <Loader2 size={24} className="mb-2 text-indigo-500 animate-spin" />
                                        <p className="text-xs font-bold text-indigo-600">正在分析...</p>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={24} className="mb-2 opacity-20" />
                                        <p className="text-xs font-bold">待 AI 批改</p>
                                        <button onClick={handleEvaluate} disabled={!currentSubmission?.audioUrl || isBatching} className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition disabled:opacity-50">
                                            立即评分
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-5 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-indigo-500" />
                            <h4 className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">词级发音评估 {currentSubmission?.clozeResult && "& 填空详情"}</h4>
                        </div>
                        <div className="flex items-center gap-4">
                            <button onClick={() => setShowTranslations(!showTranslations)} className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-black transition-all ${showTranslations ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 hover:text-indigo-600'}`}>
                                {showTranslations ? <Eye size={10} /> : <EyeOff size={10} />} {showTranslations ? '隐藏译文' : '显示译文'}
                            </button>
                        </div>
                    </div>
                    <div className="p-5 space-y-3 max-h-[400px] overflow-y-auto no-scrollbar divide-y divide-slate-50 dark:divide-slate-800">
                        {resource?.transcript.map((seg, sIdx) => (
                            <div key={seg.id} className="pt-3 first:pt-0">
                                <div className="flex gap-5 group items-start">
                                    <div className="shrink-0 w-6 flex flex-col items-center"><span className="text-[10px] font-black text-slate-300">{(sIdx + 1).toString().padStart(2, '0')}</span></div>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium leading-relaxed mb-1 tracking-tight">
                                            {seg.words.map((wordObj, wIdx) => {
                                                const wordText = wordObj.word;
                                                const clozeKey = `${sIdx}-${wIdx}`;
                                                const clozeAnswer = currentSubmission?.clozeResult?.answers?.[clozeKey];
                                                const isClozeWord = wordObj.isCloze;
                                                
                                                const wordInfo = getWordInfo(seg.id, wordText);
                                                const color = getWordColor(wordInfo);
                                                const isHovered = hoveredWord?.segId === seg.id && hoveredWord.wordIdx === wIdx;
                                                const wordStartTime = wordObj.startTime ?? seg.startTime;

                                                if (isClozeWord) {
                                                    const isCorrect = clozeAnswer && normalize(clozeAnswer) === normalize(wordText);
                                                    return (
                                                        <div key={wIdx} className="relative inline-block mr-1.5 align-baseline group/cloze">
                                                            <div className={`px-1.5 py-0.5 rounded border-b-2 transition-all cursor-help ${isCorrect ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400'}`}>
                                                                <span className="font-black">{clozeAnswer || "(未填)"}</span>
                                                            </div>
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 bg-slate-800 text-white text-[10px] rounded-lg shadow-xl z-50 pointer-events-none opacity-0 group-hover/cloze:opacity-100 transition-opacity whitespace-nowrap border border-slate-700">
                                                                <div className="mb-1">正确答案: <span className="font-bold text-emerald-300">{wordText}</span></div>
                                                                {wordInfo && (
                                                                    <div>发音得分: <span className={`font-bold ${wordInfo.score >= 90 ? 'text-emerald-400' : wordInfo.score >= 75 ? 'text-amber-400' : 'text-red-400'}`}>{Math.round(wordInfo.score)}</span></div>
                                                                )}
                                                                <div className="absolute top-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45 border-t border-l border-slate-700"></div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                    <div key={wIdx} onMouseEnter={() => setHoveredWord({ segId: seg.id, wordIdx: wIdx })} onMouseLeave={() => setHoveredWord(null)} onClick={() => handleSeekToWord(wordStartTime)} className="relative inline-block mr-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-0.5 transition-colors">
                                                        <span className={`inline-block transition-colors ${color}`}>{wordText}</span>
                                                        {isHovered && wordInfo && (
                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-slate-800 text-white text-[10px] rounded shadow-xl z-50 pointer-events-none animate-fade-in-up whitespace-nowrap">Score: <span className="font-bold">{Math.round(wordInfo.score)}</span><div className="absolute top-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div></div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                        {showTranslations && <p className="text-[10px] text-slate-400 italic line-clamp-1 animate-fade-in">{seg.translation}</p>}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border dark:border-slate-800 shadow-xl border-t-4 border-t-indigo-600 flex flex-col md:flex-row gap-6">
                    <div className="flex-1 space-y-2">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><MessageSquare size={12} className="text-indigo-500" /> 教师批改评语</label>
                        <textarea className="w-full h-20 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-[12px] outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all resize-none dark:text-white" placeholder="请输入纠音建议或鼓励..." value={feedback} onChange={e => setFeedback(e.target.value)} />
                    </div>
                    <div className="w-full md:w-80 flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 pl-6">
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5"><Star size={12} className="text-amber-400" /> 最终综合评分</label>
                            <div className="flex items-center gap-4">
                                <div className="w-16 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl p-2 flex flex-col items-center">
                                    <input type="number" className="bg-transparent text-xl font-black text-indigo-600 outline-none text-center w-full" value={finalScore} onChange={e => setFinalScore(parseInt(e.target.value) || 0)} />
                                </div>
                                <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(star => (<Star key={star} size={16} className={`cursor-pointer transition-all ${finalScore >= star * 20 ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-800'}`} onClick={() => setFinalScore(star * 20)} />))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button className="flex-[1] py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-red-500 rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-1.5"><XCircle size={14} /> 驳回</button>
                            <button onClick={handleConfirmGrading} className="flex-[2] py-2.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-1.5"><CheckCircle size={14} /> 保存评分</button>
                        </div>
                    </div>
                </div>
            </div>
          )}
        </div>
      </div>
      
      <CustomConfirmModal 
        isOpen={showBatchConfirm}
        onClose={() => setShowBatchConfirm(false)}
        onConfirm={executeBatchGrading}
        title="批量批改"
        message={`准备为 ${batchQueue.length} 名学生进行 AI 自动批改。系统将依次分析录音并保存结果。是否开始？`}
      />
    </div>
  );
};

const ScoreMetric = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="flex flex-col">
    <div className="flex justify-between text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase mb-1 px-1"><span>{label}</span><span className="text-slate-700 dark:text-slate-300 font-black">{value}%</span></div>
    <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-white dark:border-slate-700 transition-colors"><div className={`h-full ${color} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${value}%` }}></div></div>
  </div>
);

export default SubmissionManager;