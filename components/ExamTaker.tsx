import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import { ExamPaper, Question, ExamSection, ExamItem, User, ExamSession, MediaResource, RecorderState, ExamTakerSettings, ExamTakerResourcePlaybackSettings, SyllabusCourse } from '../types';
import { saveExamSession, getExamSessionById, getQuestionsWithResourceInfo, getResources, getExamPaperById, updateExamPaper, getSyllabusCourses } from '../utils/storage';
import { getOptionGridColumns } from '../utils/optionLayout';
import MediaPlayer from './MediaPlayer';
import { ThemeContext } from '../App';
import { useModal } from '../contexts/ModalContext';
import { stripGapBackgroundHighlight } from '../utils/gapHtml';
import { 
  ChevronLeft, ChevronRight, CheckCircle, XCircle, 
  Clock, PlayCircle, AlertCircle, BookOpen, 
  FileText, Menu, X, ChevronDown, ChevronUp, ArrowLeft, Star, Sun, Moon
} from 'lucide-react';

interface ExamTakerProps {
  exam: ExamPaper;
  user: User;
  onExit: () => void;
}

interface LoadingProgress {
  total: number;
  loaded: number;
  failed: string[];
}

type ViewMode = 'start' | 'exam' | 'result';

const formatDuration = (ms: number) => {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const ExamTaker: React.FC<ExamTakerProps> = ({ exam, user, onExit }) => {
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const modal = useModal();
  const [viewMode, setViewMode] = useState<ViewMode>('start');
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({ total: 0, loaded: 0, failed: [] });
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [questionResourceMap, setQuestionResourceMap] = useState<Record<string, string>>({}); // questionId -> resourceId
  const [resourcesMap, setResourcesMap] = useState<Record<string, MediaResource>>({}); // resourceId -> MediaResource
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [currentResourceIndex, setCurrentResourceIndex] = useState(0); // For navigating between media resources
  const [textSizeLevel, setTextSizeLevel] = useState<0 | 1 | 2>(0);
  const [sidebarOpen, setSidebarOpen] = useState(typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [markedQuestionIds, setMarkedQuestionIds] = useState<Set<string>>(new Set());
  const [currentSession, setCurrentSession] = useState<ExamSession | null>(null);
  
  // Load syllabuses for knowledge points
  const [syllabuses, setSyllabuses] = useState<SyllabusCourse[]>([]);

  useEffect(() => {
    let active = true;
    const loadSyllabuses = async () => {
      const data = await getSyllabusCourses();
      if (!active) return;
      setSyllabuses(data);
    };
    loadSyllabuses();
    return () => {
      active = false;
    };
  }, []);

  // Auto-close sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };
    // Only set on mount if strictly needed, but better to let user control it after mount.
    // just init state is enough.
  }, []);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [startTime, setStartTime] = useState<number>(0);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  const isTeacherView = user.role === 'teacher' || user.role === 'admin';

  // Stable session id: one student + one exam = one session (no retake, overwrite)
  const sessionId = useMemo(() => `session_${exam.id}_${user.id}`,
    [exam.id, user.id]
  );

  const restoreAttemptedRef = useRef(false);
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const [examTakerSettings, setExamTakerSettings] = useState<ExamTakerSettings>(exam.examTakerSettings || {});
  const autoSubmitTriggeredRef = useRef(false);
  const sectionStartElapsedMsRef = useRef<Record<string, number>>({});
  const sectionAutoAdvancedRef = useRef<Set<string>>(new Set());
  const [lockedSectionIds, setLockedSectionIds] = useState<Set<string>>(new Set());

  const navClickTimerRef = useRef<number | null>(null);

  // Refs for scrolling to questions
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const toggleQuestionMark = (questionId: string) => {
    setMarkedQuestionIds(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  const [examDurationDraftMin, setExamDurationDraftMin] = useState<string>(() => {
    const sec = exam.examTakerSettings?.durationSec;
    if (!sec || sec <= 0) return '';
    return String(Math.round(sec / 60));
  });
  // Load latest persisted settings (teacher may have saved them on the exam paper)
  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      const fresh = await getExamPaperById(exam.id);
      if (!active || !fresh?.examTakerSettings) return;
      setExamTakerSettings(fresh.examTakerSettings);
    };
    loadSettings();
    return () => {
      active = false;
    };
  }, [exam.id]);

  // Auto-restore student's latest session (draft or submitted)
  useEffect(() => {
    if (isTeacherView) return;
    if (restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;
    let active = true;

    const restoreSession = async () => {
      const existing = await getExamSessionById(sessionId);
      if (!existing || !active) return;

      // Store current session for accessing teacher feedback and manual score
      setCurrentSession(existing);

      const restoredAnswers = existing.answers || {};
      setAnswers(restoredAnswers);

      const restoredElapsed = typeof existing.elapsedTime === 'number' ? existing.elapsedTime : 0;
      setElapsedTime(restoredElapsed);

      // Resume timer without counting time away from page
      const resumedStart = Date.now() - Math.max(0, restoredElapsed);
      setStartTime(resumedStart);

      if (existing.isSubmitted) {
        setIsSubmitted(true);
        setViewMode('result');
      } else {
        // Draft: jump back into exam automatically
        setIsSubmitted(false);
        setViewMode('exam');
      }
    };

    restoreSession();
    return () => {
      active = false;
    };
  }, [isTeacherView, sessionId]);

  // Load resources on mount
  useEffect(() => {
    loadExamResources();
  }, []);

  // Timer effect
  useEffect(() => {
    if (viewMode === 'exam' && !isSubmitted) {
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [viewMode, isSubmitted, startTime]);

  // Load all resources and questions
  const loadExamResources = async () => {
    try {
      // Get all question IDs
      const questionIds = exam.sections
        .flatMap(s => s.items)
        .filter(item => item.type !== 'consigne' && item.questionId)
        .map(item => item.questionId!);

      setLoadingProgress({ total: questionIds.length, loaded: 0, failed: [] });

      // Load questions with resource info
      const questionsWithInfo = await getQuestionsWithResourceInfo(questionIds);
      const questions = questionsWithInfo.map(info => info.question);
      setAllQuestions(questions);

      // Build resource map
      const resourceMap: Record<string, string> = {};
      const uniqueResourceIds = new Set<string>();
      questionsWithInfo.forEach(info => {
        if (info.resourceId) {
          resourceMap[info.question.id] = info.resourceId;
          uniqueResourceIds.add(info.resourceId);
        }
      });
      setQuestionResourceMap(resourceMap);

      // Load full resource data
      const allResources = await getResources();
      const resMap: Record<string, MediaResource> = {};
      uniqueResourceIds.forEach(rid => {
        const resource = allResources.find(r => r.id === rid);
        if (resource) {
          resMap[rid] = resource;
        }
      });
      setResourcesMap(resMap);

      // Collect all image URLs
      const imageUrls: string[] = [];
      questions.forEach(q => {
        if (q.imageUrl) imageUrls.push(q.imageUrl);
        q.options.forEach(opt => {
          if (opt.imageUrl) imageUrls.push(opt.imageUrl);
        });
        if (q.subQuestions) {
          q.subQuestions.forEach(subQ => {
            if (subQ.imageUrl) imageUrls.push(subQ.imageUrl);
            subQ.options.forEach(opt => {
              if (opt.imageUrl) imageUrls.push(opt.imageUrl);
            });
          });
        }
      });

      // Preload images
      const failedUrls: string[] = [];
      let loadedCount = questionIds.length;
      
      for (const url of imageUrls) {
        try {
          await fetch(url);
          loadedCount++;
        } catch {
          failedUrls.push(url);
        }
        setLoadingProgress({ total: questionIds.length + imageUrls.length, loaded: loadedCount, failed: failedUrls });
      }

      setLoadingProgress({ 
        total: questionIds.length + imageUrls.length, 
        loaded: questionIds.length + imageUrls.length, 
        failed: failedUrls 
      });

    } catch (error) {
      console.error('Failed to load exam resources:', error);
    }
  };

  // Calculate total questions (excluding consignes)
  const totalQuestions = useMemo(() => {
    let count = 0;
    exam.sections.forEach(section => {
      section.items.forEach(item => {
        if (item.type !== 'consigne' && item.questionId) {
          const question = allQuestions.find(q => q.id === item.questionId);
          if (question?.subQuestions && question.subQuestions.length > 0) {
            count += question.subQuestions.length;
          } else {
            count++;
          }
        }
      });
    });
    return count;
  }, [exam, allQuestions]);

  // Reset resource index when changing sections
  useEffect(() => {
    setCurrentResourceIndex(0);
  }, [currentSectionIndex]);

  // Get unique resource IDs in current section
  const getCurrentSectionResources = () => {
    const section = exam.sections[currentSectionIndex];
    if (!section) return [];

    const resourceIds = new Set<string>();
    section.items.forEach(item => {
      if (item.type !== 'consigne' && item.questionId) {
        const resourceId = questionResourceMap[item.questionId];
        if (resourceId) {
          resourceIds.add(resourceId);
        }
      }
    });
    return Array.from(resourceIds);
  };

  const currentSectionResources = getCurrentSectionResources();
  const activeResourceId = currentSectionResources.length > 0 ? currentSectionResources[currentResourceIndex] : undefined;
  const activeResourcePlaybackSettings = activeResourceId ? examTakerSettings.resources?.[activeResourceId] : undefined;

  const hasExamDuration = typeof examTakerSettings.durationSec === 'number' && examTakerSettings.durationSec > 0;
  const remainingTimeMs = hasExamDuration
    ? Math.max(0, (examTakerSettings.durationSec as number) * 1000 - elapsedTime)
    : 0;

  const currentSection = exam.sections[currentSectionIndex];
  const currentSectionDurationSec = currentSection?.id ? examTakerSettings.sections?.[currentSection.id]?.durationSec : undefined;
  const hasSectionDuration = typeof currentSectionDurationSec === 'number' && currentSectionDurationSec > 0;
  const currentSectionStartElapsed = currentSection?.id ? sectionStartElapsedMsRef.current[currentSection.id] : undefined;
  const currentSectionElapsedMs = currentSection?.id && typeof currentSectionStartElapsed === 'number'
    ? Math.max(0, elapsedTime - currentSectionStartElapsed)
    : 0;
  const currentSectionRemainingMs = hasSectionDuration
    ? Math.max(0, (currentSectionDurationSec as number) * 1000 - currentSectionElapsedMs)
    : 0;

  // Check if all questions are answered
  const answeredCount = Object.keys(answers).length;

  const persistExamTakerSettings = async (next: ExamTakerSettings) => {
    setExamTakerSettings(next);
    if (!isTeacherView) return;
    const fresh = (await getExamPaperById(exam.id)) || exam;
    await updateExamPaper({ ...fresh, examTakerSettings: next });
  };

  const saveResourcePlaybackSettings = (resourceId: string, nextSettings: ExamTakerResourcePlaybackSettings) => {
    const nextResources = { ...(examTakerSettings.resources || {}) };
    const hasAny = Object.values(nextSettings).some(v => v !== undefined && v !== null && v !== '');
    if (!hasAny) {
      delete nextResources[resourceId];
    } else {
      nextResources[resourceId] = nextSettings;
    }
    persistExamTakerSettings({ ...examTakerSettings, resources: nextResources });
  };

  const clearResourcePlaybackSettings = (resourceId: string) => {
    const nextResources = { ...(examTakerSettings.resources || {}) };
    delete nextResources[resourceId];
    persistExamTakerSettings({ ...examTakerSettings, resources: nextResources });
  };

  const saveSectionDurationSec = (sectionId: string, durationSec?: number) => {
    const nextSections = { ...(examTakerSettings.sections || {}) };
    if (!durationSec || durationSec <= 0) {
      delete nextSections[sectionId];
    } else {
      nextSections[sectionId] = { ...(nextSections[sectionId] || {}), durationSec };
    }
    persistExamTakerSettings({ ...examTakerSettings, sections: nextSections });
  };

  const getSectionQuestionIds = (section: ExamSection) => {
    const ids: string[] = [];
    section.items.forEach(item => {
      if (item.type === 'consigne' || !item.questionId) return;
      const q = allQuestions.find(qq => qq.id === item.questionId);
      if (!q) return;
      if (q.subQuestions && q.subQuestions.length > 0) {
        q.subQuestions.forEach(sq => ids.push(sq.id));
      } else {
        ids.push(q.id);
      }
    });
    return ids;
  };

  const isSectionCompleted = (section: ExamSection) => {
    const ids = getSectionQuestionIds(section);
    if (ids.length === 0) return true;
    return ids.every(id => !!answers[id]);
  };

  const lockSection = (sectionId: string) => {
    setLockedSectionIds(prev => {
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
  };

  const attemptNavigateToSection = (targetIndex: number) => {
    const target = exam.sections[targetIndex];
    const current = exam.sections[currentSectionIndex];
    if (!target) return false;
    if (targetIndex === currentSectionIndex) {
      setCurrentSectionIndex(targetIndex);
      return true;
    }

    if (isTeacherView) {
      setCurrentSectionIndex(targetIndex);
      return true;
    }

    // After submission, allow free navigation/review.
    if (isSubmitted) {
      setCurrentSectionIndex(targetIndex);
      return true;
    }

    if (lockedSectionIds.has(target.id)) {
      void modal.alert({ message: '该部分已结束，不能返回。' });
      return false;
    }

    const curDuration = current?.id ? examTakerSettings.sections?.[current.id]?.durationSec : undefined;
    const curHasDuration = typeof curDuration === 'number' && curDuration > 0;

    if (curHasDuration && current?.id) {
      const curStart = sectionStartElapsedMsRef.current[current.id] ?? 0;
      const curRemaining = Math.max(0, curDuration * 1000 - Math.max(0, elapsedTime - curStart));

      if (curRemaining <= 0) {
        void modal.alert({ message: '本部分时间已到，将自动进入下一部分。' });
        return false;
      }

      if (!isSectionCompleted(current)) {
        void modal.alert({ message: '请在规定时间内完成本部分所有题目后再跳转。' });
        return false;
      }

      lockSection(current.id);
    }

    setCurrentSectionIndex(targetIndex);
    return true;
  };

  // Keep draft in sync when saved value changes (teacher)
  useEffect(() => {
    if (!isTeacherView) return;
    if (!examTakerSettings.durationSec || examTakerSettings.durationSec <= 0) {
      setExamDurationDraftMin('');
      return;
    }
    setExamDurationDraftMin(String(Math.round(examTakerSettings.durationSec / 60)));
  }, [examTakerSettings.durationSec, isTeacherView]);

  // Calculate score
  const calculateScore = () => {
    let totalScore = 0;
    let earnedScore = 0;

    exam.sections.forEach(section => {
      section.items.forEach(item => {
        if (item.type === 'consigne' || !item.questionId) return;

        const question = allQuestions.find(q => q.id === item.questionId);
        if (!question) return;

        if (question.subQuestions && question.subQuestions.length > 0) {
          // Complex question with sub-questions
          question.subQuestions.forEach((subQ, idx) => {
            const points = item.subPoints?.[idx] || 0;
            totalScore += points;
            
            const userAnswer = answers[subQ.id];
            const isCorrect = checkAnswer(subQ, userAnswer);
            if (isCorrect) earnedScore += points;
          });
        } else {
          // Simple question
          totalScore += item.points;
          const userAnswer = answers[question.id];
          const isCorrect = checkAnswer(question, userAnswer);
          if (isCorrect) earnedScore += item.points;
        }
      });
    });

    return { earnedScore, totalScore };
  };

  // Check if an answer is correct
  const checkAnswer = (q: Question, userAnswer: string): boolean => {
    if (!userAnswer) return false;
    if (q.type === 'fill-in-the-blank') {
      const correctText = q.options[0]?.text || '';
      return userAnswer.trim().toLowerCase() === correctText.trim().toLowerCase();
    }
    return userAnswer === q.correctOptionId;
  };

  // Handle answer change
  const handleAnswer = (questionId: string, answer: string) => {
    if (isSubmitted) return;
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  // Handle scroll to question
  const scrollToQuestion = (questionId: string) => {
    const element = questionRefs.current[questionId];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Toggle section collapse
  const toggleSectionCollapse = (sectionId: string) => {
    setCollapsedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  // Handle exam start
  const handleStartExam = () => {
    autoSubmitTriggeredRef.current = false;
    sectionStartElapsedMsRef.current = {};
    sectionAutoAdvancedRef.current = new Set();
    setLockedSectionIds(new Set());
    setCurrentSectionIndex(0);
    setCurrentResourceIndex(0);
    setElapsedTime(0);
    const now = Date.now();
    setStartTime(now);
    setViewMode('exam');

    // Create/overwrite draft session immediately for persistence
    if (!isTeacherView) {
      const draft: ExamSession = {
        id: sessionId,
        examPaperId: exam.id,
        examTitle: exam.title,
        studentId: user.id,
        studentName: user.name,
        answers: {},
        startTime: now,
        elapsedTime: 0,
        totalScore: exam.totalScore,
        isSubmitted: false,
      };
      saveExamSession(draft);
    }
  };

  // Debounced autosave draft on answer changes (students only)
  useEffect(() => {
    if (isTeacherView) return;
    if (viewMode !== 'exam') return;
    if (isSubmitted) return;

    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
      autoSaveTimeoutRef.current = null;
    }

    autoSaveTimeoutRef.current = window.setTimeout(() => {
      const draft: ExamSession = {
        id: sessionId,
        examPaperId: exam.id,
        examTitle: exam.title,
        studentId: user.id,
        studentName: user.name,
        answers,
        startTime: startTime || Date.now(),
        elapsedTime,
        totalScore: exam.totalScore,
        isSubmitted: false,
      };
      saveExamSession(draft);
    }, 800);

    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
        autoSaveTimeoutRef.current = null;
      }
    };
  }, [answers, elapsedTime, exam.id, exam.title, exam.totalScore, isSubmitted, isTeacherView, sessionId, startTime, user.id, user.name, viewMode]);

  // Heartbeat autosave to persist elapsedTime even if answers don't change
  useEffect(() => {
    if (isTeacherView) return;
    if (viewMode !== 'exam') return;
    if (isSubmitted) return;

    const interval = window.setInterval(() => {
      const draft: ExamSession = {
        id: sessionId,
        examPaperId: exam.id,
        examTitle: exam.title,
        studentId: user.id,
        studentName: user.name,
        answers,
        startTime: startTime || Date.now(),
        elapsedTime,
        totalScore: exam.totalScore,
        isSubmitted: false,
      };
      saveExamSession(draft);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [answers, elapsedTime, exam.id, exam.title, exam.totalScore, isSubmitted, isTeacherView, sessionId, startTime, user.id, user.name, viewMode]);

  const handleExit = () => {
    if (!isTeacherView && viewMode === 'exam' && !isSubmitted) {
      const draft: ExamSession = {
        id: sessionId,
        examPaperId: exam.id,
        examTitle: exam.title,
        studentId: user.id,
        studentName: user.name,
        answers,
        startTime: startTime || Date.now(),
        elapsedTime,
        totalScore: exam.totalScore,
        isSubmitted: false,
      };
      saveExamSession(draft);
    }
    onExit();
  };

  // Handle submit
  const submitExam = async (skipConfirm: boolean) => {
    if (isSubmitted) return;

    if (!skipConfirm) {
      const ok = await modal.confirm({
        title: '确认提交',
        message: `您已完成 ${answeredCount}/${totalQuestions} 道题，确认提交？`,
        type: 'danger',
        confirmText: '提交'
      });
      if (!ok) return;
    }

    const { earnedScore, totalScore } = calculateScore();
    const submitTime = Date.now();

    const session: ExamSession = {
      id: sessionId,
      examPaperId: exam.id,
      examTitle: exam.title,
      studentId: user.id,
      studentName: user.name,
      answers,
      startTime,
      submitTime,
      elapsedTime: submitTime - startTime,
      score: earnedScore,
      totalScore,
      isSubmitted: true
    };

    saveExamSession(session);

    setIsSubmitted(true);
    setViewMode('result');
  };

  const handleSubmit = () => void submitExam(false);

  // Auto submit when duration is exceeded
  useEffect(() => {
    if (viewMode !== 'exam' || isSubmitted) return;
    const durationSec = examTakerSettings.durationSec;
    if (!durationSec || durationSec <= 0) return;

    if (elapsedTime >= durationSec * 1000 && !autoSubmitTriggeredRef.current) {
      autoSubmitTriggeredRef.current = true;
      void submitExam(true);
    }
  }, [elapsedTime, examTakerSettings.durationSec, isSubmitted, viewMode]);

  // Mark section start time (relative to elapsedTime)
  useEffect(() => {
    if (viewMode !== 'exam') return;
    const sec = exam.sections[currentSectionIndex];
    if (!sec) return;
    if (typeof sectionStartElapsedMsRef.current[sec.id] !== 'number') {
      sectionStartElapsedMsRef.current[sec.id] = elapsedTime;
    }
  }, [currentSectionIndex, elapsedTime, exam.sections, viewMode]);

  // Auto advance to next section when current section time is exceeded (students only)
  useEffect(() => {
    if (viewMode !== 'exam' || isSubmitted) return;
    if (isTeacherView) return;
    const sec = exam.sections[currentSectionIndex];
    if (!sec) return;

    const durationSec = examTakerSettings.sections?.[sec.id]?.durationSec;
    if (!durationSec || durationSec <= 0) return;

    const start = sectionStartElapsedMsRef.current[sec.id] ?? 0;
    const remaining = durationSec * 1000 - Math.max(0, elapsedTime - start);
    if (remaining > 0) return;
    if (sectionAutoAdvancedRef.current.has(sec.id)) return;

    sectionAutoAdvancedRef.current.add(sec.id);
    lockSection(sec.id);

    const nextIndex = currentSectionIndex + 1;
    if (nextIndex < exam.sections.length) {
      setCurrentSectionIndex(nextIndex);
    } else {
      submitExam(true);
    }
  }, [currentSectionIndex, elapsedTime, exam.sections, examTakerSettings.sections, isSubmitted, isTeacherView, viewMode]);

  // Render start page
  if (viewMode === 'start') {
    const isLoading = loadingProgress.loaded < loadingProgress.total;
    const progress = loadingProgress.total > 0 
      ? (loadingProgress.loaded / loadingProgress.total) * 100 
      : 0;

    return (
      <div className="h-full w-full bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full mx-auto">
          <div className="bg-white dark:bg-slate-800 rounded-[2rem] md:rounded-3xl shadow-2xl p-6 md:p-8 border border-slate-200 dark:border-slate-700">
            {/* Header */}
            <div className="text-center mb-6 md:mb-8">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 md:w-10 md:h-10 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h1 className="text-xl md:text-3xl font-black text-slate-800 dark:text-white mb-1 md:mb-2">{exam.title}</h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">在线测试</p>
            </div>

            {/* Exam Info */}
            <div className="grid grid-cols-3 gap-2 md:gap-4 mb-4 md:mb-6">
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 md:p-4 text-center">
                <div className="text-lg md:text-2xl font-black text-indigo-600 dark:text-indigo-400 mb-0.5 md:mb-1">{exam.sections.length}</div>
                <div className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-tighter md:tracking-normal">部分</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 md:p-4 text-center">
                <div className="text-lg md:text-2xl font-black text-purple-600 dark:text-purple-400 mb-0.5 md:mb-1">{totalQuestions}</div>
                <div className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-tighter md:tracking-normal">题目</div>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-3 md:p-4 text-center">
                <div className="text-lg md:text-2xl font-black text-emerald-600 dark:text-emerald-400 mb-0.5 md:mb-1">{exam.totalScore}</div>
                <div className="text-[10px] md:text-xs text-slate-600 dark:text-slate-400 font-bold uppercase tracking-tighter md:tracking-normal">满分</div>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl p-4 mb-6 hidden md:block">
              <h3 className="font-bold text-amber-900 dark:text-amber-200 mb-2 flex items-center gap-2">
                <AlertCircle size={18} /> 考试说明
              </h3>
              <ul className="text-sm text-amber-800 dark:text-amber-300 space-y-1 list-disc list-inside">
                <li>本次考试共 {exam.sections.length} 个部分，{totalQuestions} 道题目</li>
                <li>所有资源将在开始前加载完成，避免网络中断</li>
                <li>考试过程中可以在不同部分之间跳转</li>
                <li>提交后将显示得分和答案解析</li>
              </ul>
            </div>

            {/* Loading Progress */}
            {isLoading ? (
              <div className="mb-4 md:mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400">
                    正在加载资源...
                  </span>
                  <span className="text-xs md:text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {loadingProgress.loaded} / {loadingProgress.total}
                  </span>
                </div>
                <div className="h-2 md:h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {loadingProgress.failed.length > 0 && (
                  <p className="text-[10px] md:text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
                    {loadingProgress.failed.length} 个资源加载失败，但不影响考试
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={handleStartExam}
                className="w-full py-3 md:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl font-black text-base md:text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <PlayCircle size={24} /> 开始考试
              </button>
            )}

            <button
              onClick={handleExit}
              className="w-full mt-2 md:mt-3 py-2.5 md:py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-sm md:text-base transition-all active:scale-95"
            >
              返回
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render exam page (will be implemented next)
  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex relative overflow-hidden">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-[100] lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-y-0 left-0 z-[110] w-64 lg:static lg:z-auto bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0 shadow-2xl lg:shadow-none h-full">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleExit}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="返回列表"
              >
                <ArrowLeft size={18} />
              </button>
              <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex-1">题目导航</h3>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                title="收起导航"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Section List with Question Numbers */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {(() => {
              return exam.sections.map((section, secIdx) => {
                const sectionQuestions: { id: string; number: number; answered: boolean; correct?: boolean }[] = [];
                let sectionIndex = 0; // 每个section内部从1开始计数
                
                section.items.forEach(item => {
                  if (item.type === 'consigne' || !item.questionId) return;
                  
                  const question = allQuestions.find(q => q.id === item.questionId);
                  if (!question) return;

                  if (question.subQuestions && question.subQuestions.length > 0) {
                    question.subQuestions.forEach(subQ => {
                      const num = ++sectionIndex;
                      sectionQuestions.push({
                        id: subQ.id,
                        number: num,
                        answered: !!answers[subQ.id],
                        correct: isSubmitted ? checkAnswer(subQ, answers[subQ.id]) : undefined
                      });
                    });
                  } else {
                    const num = ++sectionIndex;
                    sectionQuestions.push({
                      id: question.id,
                      number: num,
                      answered: !!answers[question.id],
                      correct: isSubmitted ? checkAnswer(question, answers[question.id]) : undefined
                    });
                  }
                });

                const isCollapsed = collapsedSections.has(section.id);
                const sectionDurationSec = examTakerSettings.sections?.[section.id]?.durationSec;
                const hasSectionDuration = !isTeacherView && typeof sectionDurationSec === 'number' && sectionDurationSec > 0;
                const sectionDurationMin = hasSectionDuration ? Math.max(1, Math.ceil(sectionDurationSec / 60)) : 0;
                const isEnded = !isTeacherView && lockedSectionIds.has(section.id);

                return (
                  <div key={section.id} className="border-b border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => {
                        attemptNavigateToSection(secIdx);
                        toggleSectionCollapse(section.id);
                      }}
                      className={`w-full px-4 py-3 flex items-center justify-between transition-all ${
                        currentSectionIndex === secIdx
                          ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <span className="text-sm font-bold truncate flex-1 text-left">{section.title}</span>
                      <div className="flex items-center gap-2">
                        {hasSectionDuration && !isEnded && (
                          <span
                            className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                            title="进入该部分后必须在规定的时长内完成所有题目，不能跳转至其他部分，结束后也不能返回"
                          >
                            {sectionDurationMin}分钟
                          </span>
                        )}
                        {!isTeacherView && lockedSectionIds.has(section.id) && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            已结束
                          </span>
                        )}
                        {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                      </div>
                    </button>

                    {!isCollapsed && (
                      <div className="p-2 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="grid grid-cols-6 gap-1.5">
                          {sectionQuestions.map(q => (
                            <button
                              key={q.id}
                              onClick={() => {
                                if (navClickTimerRef.current) {
                                  window.clearTimeout(navClickTimerRef.current);
                                  navClickTimerRef.current = null;
                                  toggleQuestionMark(q.id);
                                } else {
                                  navClickTimerRef.current = window.setTimeout(() => {
                                    navClickTimerRef.current = null;
                                    const ok = attemptNavigateToSection(secIdx);
                                    if (ok) {
                                      window.setTimeout(() => scrollToQuestion(q.id), 50);
                                    }
                                  }, 250);
                                }
                              }}
                              onDoubleClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              title="双击标记/取消标记"
                              className={`relative aspect-square rounded-md text-xs font-bold transition-all hover:scale-110 ${
                                isSubmitted
                                  ? q.correct
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-red-500 text-white'
                                  : q.answered
                                    ? 'bg-indigo-500 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {q.number}
                              {markedQuestionIds.has(q.id) && (
                                <Star
                                  size={12}
                                  className="absolute -top-1 -right-1 text-amber-400"
                                  fill="currentColor"
                                />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        <div className="h-14 md:h-16 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 md:px-6 flex items-center justify-between gap-2 z-30">
          <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors shrink-0"
                title="展开导航"
              >
                <Menu size={18} />
              </button>
            )}
            <h2 className="text-base md:text-lg font-black text-slate-800 dark:text-white truncate pr-2">
              {exam.title}
              {isSubmitted && (
                <span className="ml-2 text-emerald-600 dark:text-emerald-400 tabular-nums">
                  ({calculateScore().earnedScore}/{calculateScore().totalScore})
                </span>
              )}
            </h2>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            {isTeacherView && (
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">时长</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={examDurationDraftMin}
                  onChange={(e) => setExamDurationDraftMin(e.target.value)}
                  className="w-20 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-800 dark:text-slate-200"
                  placeholder="分钟"
                  title="考试总时长（分钟），留空为不限制"
                />
                <button
                  onClick={() => {
                    const raw = examDurationDraftMin.trim();
                    const minutes = raw === '' ? undefined : Math.floor(Number(raw));
                    const nextSec = typeof minutes === 'number' && minutes > 0 ? minutes * 60 : undefined;
                    persistExamTakerSettings({ ...examTakerSettings, durationSec: nextSec });
                  }}
                  className="text-[11px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                  title="保存考试总时长"
                >
                  保存
                </button>
              </div>
            )}
            <div className="hidden md:block text-sm font-medium text-slate-600 dark:text-slate-400">
              已答 <span className="font-bold text-slate-800 dark:text-slate-100">{answeredCount}</span>/{totalQuestions}
            </div>
              {hasExamDuration && (
                <div className="flex items-center gap-1 md:gap-2 text-xs md:text-sm font-medium text-slate-600 dark:text-slate-400 shrink-0" title="剩余时间">
                  <Clock size={14} className="md:w-4 md:h-4" />
                  {formatDuration(remainingTimeMs)}
                </div>
              )}
            <button
              onClick={toggleTheme}
              className="hidden md:block p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title={isDarkMode ? '切换到亮色模式' : '切换到暗色模式'}
              type="button"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button
              onClick={() => setTextSizeLevel((prev) => ((prev + 1) % 3) as 0 | 1 | 2)}
              className={`hidden md:block p-2 rounded-lg transition-all ${textSizeLevel > 0 ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'}`}
              title="调整字号"
            >
              <span
                className={`font-black font-serif leading-none ${
                  textSizeLevel === 0 ? 'text-base' : textSizeLevel === 1 ? 'text-lg' : 'text-xl'
                }`}
              >
                T
              </span>
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitted}
              className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg font-bold transition-all shrink-0"
            >
              {isSubmitted ? '已提交' : '提交'}
            </button>
          </div>
        </div>

        {/* Main content - Current Section */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6 no-scrollbar">
          <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
            {/* Teacher Feedback and Manual Score - Show before first section */}
            {isSubmitted && currentSession && currentSectionIndex === 0 && (currentSession.teacherFeedback || currentSession.manualScore !== undefined) && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30 rounded-2xl p-6 border-2 border-indigo-200 dark:border-indigo-800 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 shadow-lg">
                    <Star size={24} className="text-white" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-100">
                        教师评语与评分
                      </h3>
                      {currentSession.manualScore !== undefined && (
                        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-lg px-4 py-2 border border-indigo-200 dark:border-indigo-700 shadow-sm">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-400">最终得分</span>
                          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
                            {currentSession.manualScore}
                            <span className="text-sm text-indigo-400 dark:text-indigo-500 ml-1">/{currentSession.totalScore}</span>
                          </span>
                        </div>
                      )}
                    </div>
                    {currentSession.teacherFeedback && (
                      <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-indigo-100 dark:border-indigo-800 shadow-sm">
                        <div className="text-base leading-relaxed text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                          {currentSession.teacherFeedback}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            {/* Section Content */}
            {exam.sections[currentSectionIndex] && (
              <RenderSection 
                section={exam.sections[currentSectionIndex]}
                allQuestions={allQuestions}
                answers={answers}
                onAnswer={handleAnswer}
                isSubmitted={isSubmitted}
                checkAnswer={checkAnswer}
                textSizeLevel={textSizeLevel}
                questionRefs={questionRefs}
                sectionDurationSec={currentSectionDurationSec}
                sectionRemainingMs={!isTeacherView && hasSectionDuration ? currentSectionRemainingMs : undefined}
                onSaveSectionDurationSec={saveSectionDurationSec}
                currentResourceId={activeResourceId}
                activeResourcePlaybackSettings={activeResourcePlaybackSettings}
                isTeacherView={isTeacherView}
                onSaveResourcePlaybackSettings={saveResourcePlaybackSettings}
                onClearResourcePlaybackSettings={clearResourcePlaybackSettings}
                questionResourceMap={questionResourceMap}
                resourcesMap={resourcesMap}
                currentSectionResources={currentSectionResources}
                currentResourceIndex={currentResourceIndex}
                setCurrentResourceIndex={setCurrentResourceIndex}
                markedQuestionIds={markedQuestionIds}
                toggleQuestionMark={toggleQuestionMark}
                syllabuses={syllabuses}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Simple MediaPlayer wrapper for Exam
type AutoPlaybackPhase = 'idle' | 'pre' | 'playing' | 'post' | 'pause' | 'done';

const ExamMediaPlayer: React.FC<{
  resource: MediaResource;
  playbackSettings?: ExamTakerResourcePlaybackSettings;
  onAutoPlaybackComplete?: () => void;
}> = ({ resource, playbackSettings, onAutoPlaybackComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bgmRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  const autoPlaybackEnabled = useMemo(() => {
    if (!playbackSettings) return false;
    return (
      typeof playbackSettings.playCount === 'number' ||
      typeof playbackSettings.preCountdownSec === 'number' ||
      typeof playbackSettings.postCountdownSec === 'number' ||
      typeof playbackSettings.pauseBetweenPlaysSec === 'number' ||
      typeof playbackSettings.playbackRate === 'number'
    );
  }, [playbackSettings]);

  const playCount = Math.max(1, playbackSettings?.playCount ?? 1);
  const fixedRate: 0.5 | 0.75 | 1 = playbackSettings?.playbackRate ?? 1;
  const preSec = Math.max(0, playbackSettings?.preCountdownSec ?? 0);
  const postSec = Math.max(0, playbackSettings?.postCountdownSec ?? 0);
  const pauseSec = Math.max(0, playbackSettings?.pauseBetweenPlaysSec ?? 0);

  const [autoPhase, setAutoPhase] = useState<AutoPlaybackPhase>('idle');
  const [autoRemainingSec, setAutoRemainingSec] = useState(0);
  const [autoPlayIndex, setAutoPlayIndex] = useState(1);

  const seekToStart = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setCurrentTime(0);
  };

  const ensureRate = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const playMedia = async () => {
    if (!videoRef.current) return;
    try {
      await videoRef.current.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const pauseMedia = () => {
    if (!videoRef.current) return;
    videoRef.current.pause();
    setIsPlaying(false);
  };

  const advanceToNextPlayOrDone = () => {
    setAutoPlayIndex(prev => {
      if (prev < playCount) {
        const next = prev + 1;
        seekToStart();
        // Pre-countdown only happens once before the first play.
        setAutoPhase('playing');
        return next;
      }

      setAutoPhase('done');
      onAutoPlaybackComplete?.();
      return prev;
    });
  };

  // Initialize/reset auto playback when resource or settings change
  useEffect(() => {
    if (!autoPlaybackEnabled) {
      setAutoPhase('idle');
      setAutoRemainingSec(0);
      setAutoPlayIndex(1);
      return;
    }

    seekToStart();
    pauseMedia();
    ensureRate(fixedRate);
    setAutoPlayIndex(1);

    if (preSec > 0) {
      setAutoPhase('pre');
      setAutoRemainingSec(preSec);
    } else {
      setAutoPhase('playing');
      setAutoRemainingSec(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.id, autoPlaybackEnabled, fixedRate, preSec, postSec, pauseSec, playCount]);

  // Apply fixed playback rate during auto playback
  useEffect(() => {
    if (!autoPlaybackEnabled) return;
    ensureRate(fixedRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlaybackEnabled, fixedRate]);

  // Countdown timer for pre/post/pause phases
  useEffect(() => {
    if (!autoPlaybackEnabled) return;
    if (autoPhase !== 'pre' && autoPhase !== 'post' && autoPhase !== 'pause') return;

    if (autoRemainingSec <= 0) {
      if (autoPhase === 'pre') {
        setAutoPhase('playing');
      } else if (autoPhase === 'post') {
        // Post-countdown only applies after the final play; do not chain into pause.
        advanceToNextPlayOrDone();
      } else if (autoPhase === 'pause') {
        advanceToNextPlayOrDone();
      }
      return;
    }

    const t = window.setTimeout(() => {
      setAutoRemainingSec(prev => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlaybackEnabled, autoPhase, autoRemainingSec, pauseSec]);

  // Start playback when entering playing phase
  useEffect(() => {
    if (!autoPlaybackEnabled) return;
    if (autoPhase !== 'playing') return;
    void playMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlaybackEnabled, autoPhase]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    setDuration(e.currentTarget.duration);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (!autoPlaybackEnabled) return;
    pauseMedia();

    const isLastPlay = autoPlayIndex >= playCount;
    if (isLastPlay) {
      if (postSec > 0) {
        setAutoPhase('post');
        setAutoRemainingSec(postSec);
      } else {
        advanceToNextPlayOrDone();
      }
      return;
    }

    // Between plays, use pause (if configured), otherwise continue immediately.
    if (pauseSec > 0) {
      setAutoPhase('pause');
      setAutoRemainingSec(pauseSec);
    } else {
      advanceToNextPlayOrDone();
    }
  };

  const handleTogglePlay = () => {
    if (autoPlaybackEnabled) return;
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(e => console.warn('Play interrupted', e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (autoPlaybackEnabled) return;
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleToggleSpeed = () => {
    if (autoPlaybackEnabled) return;
    const speeds = [1, 0.75, 0.5];
    const currentIndex = speeds.indexOf(playbackRate);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackRate(nextSpeed);
    if (videoRef.current) {
      videoRef.current.playbackRate = nextSpeed;
    }
  };

  return (
    <div className="space-y-2">
      {autoPlaybackEnabled && (
        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
          自动播放：第 {autoPlayIndex}/{playCount} 次
          {autoPhase === 'pre' ? `（播放前倒计时 ${autoRemainingSec}s）` : ''}
          {autoPhase === 'post' ? `（播放后倒计时 ${autoRemainingSec}s）` : ''}
          {autoPhase === 'pause' ? `（间隔 ${autoRemainingSec}s）` : ''}
          {autoPhase === 'done' ? '（已完成）' : ''}
        </div>
      )}
      <MediaPlayer
        resource={resource}
        videoRef={videoRef}
        bgmRef={bgmRef}
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        hideExportButton={true}
        hideMoviePreviewButton={true}
        controlsDisabled={autoPlaybackEnabled}
        isPreviewingMovie={false}
        userAudioUrl={null}
        recorderState={RecorderState.IDLE}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onTogglePlay={handleTogglePlay}
        onSeek={handleSeek}
        onToggleSpeed={handleToggleSpeed}
        onExport={() => {}}
        onToggleMoviePreview={() => {}}
      />
    </div>
  );
};

// Section Renderer Component
interface RenderSectionProps {
  section: ExamSection;
  allQuestions: Question[];
  answers: Record<string, string>;
  onAnswer: (questionId: string, answer: string) => void;
  isSubmitted: boolean;
  checkAnswer: (q: Question, answer: string) => boolean;
  textSizeLevel: 0 | 1 | 2;
  questionRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  sectionDurationSec?: number;
  sectionRemainingMs?: number;
  onSaveSectionDurationSec: (sectionId: string, durationSec?: number) => void;
  currentResourceId?: string;
  activeResourcePlaybackSettings?: ExamTakerResourcePlaybackSettings;
  isTeacherView: boolean;
  onSaveResourcePlaybackSettings: (resourceId: string, settings: ExamTakerResourcePlaybackSettings) => void;
  onClearResourcePlaybackSettings: (resourceId: string) => void;
  questionResourceMap: Record<string, string>;
  resourcesMap: Record<string, MediaResource>;
  currentSectionResources: string[];
  currentResourceIndex: number;
  setCurrentResourceIndex: React.Dispatch<React.SetStateAction<number>>;
  markedQuestionIds: Set<string>;
  toggleQuestionMark: (questionId: string) => void;
  syllabuses: SyllabusCourse[];
}

const RenderSection: React.FC<RenderSectionProps> = ({
  section,
  allQuestions,
  answers,
  onAnswer,
  isSubmitted,
  checkAnswer,
  textSizeLevel,
  questionRefs,
  sectionDurationSec,
  sectionRemainingMs,
  onSaveSectionDurationSec,
  currentResourceId,
  activeResourcePlaybackSettings,
  isTeacherView,
  onSaveResourcePlaybackSettings,
  onClearResourcePlaybackSettings,
  questionResourceMap,
  resourcesMap,
  currentSectionResources,
  currentResourceIndex,
  setCurrentResourceIndex,
  markedQuestionIds,
  toggleQuestionMark,
  syllabuses
}) => {
  const questionClass = textSizeLevel === 0 ? 'text-base' : textSizeLevel === 1 ? 'text-lg' : 'text-xl';
  const optionClass = textSizeLevel === 0 ? 'text-sm' : textSizeLevel === 1 ? 'text-base' : 'text-lg';
  const passageClass = textSizeLevel === 0 ? 'text-base' : textSizeLevel === 1 ? 'text-lg' : 'text-xl';
  
  const stemClickTimerRef = useRef<Record<string, number>>({});

  // Add serif font for all text
  const serifFont = 'font-serif';

  const sectionScore = useMemo(() => {
    let earned = 0;
    let total = 0;
    section.items.forEach(item => {
      if (item.type === 'consigne' || !item.questionId) return;
      const question = allQuestions.find(q => q.id === item.questionId);
      if (!question) return;

      if (question.subQuestions && question.subQuestions.length > 0) {
        question.subQuestions.forEach((subQ, idx) => {
          const pts = item.subPoints?.[idx] || 0;
          total += pts;
          if (isSubmitted && checkAnswer(subQ, answers[subQ.id])) earned += pts;
        });
      } else {
        total += item.points || 0;
        if (isSubmitted && checkAnswer(question, answers[question.id])) earned += item.points || 0;
      }
    });
    return { earned, total };
  }, [section, allQuestions, answers, isSubmitted, checkAnswer]);

  const sectionTotalScore = sectionScore.total;

  const autoPlaybackEnabled = useMemo(() => {
    if (isSubmitted) return false;
    if (!activeResourcePlaybackSettings) return false;
    return (
      typeof activeResourcePlaybackSettings.playCount === 'number' ||
      typeof activeResourcePlaybackSettings.preCountdownSec === 'number' ||
      typeof activeResourcePlaybackSettings.postCountdownSec === 'number' ||
      typeof activeResourcePlaybackSettings.pauseBetweenPlaysSec === 'number' ||
      typeof activeResourcePlaybackSettings.playbackRate === 'number'
    );
  }, [activeResourcePlaybackSettings, isSubmitted]);

  const studentResourceSwitchLocked = autoPlaybackEnabled && !isTeacherView && !isSubmitted;

  const [sectionDurationDraftMin, setSectionDurationDraftMin] = useState<string>(() => {
    if (!sectionDurationSec || sectionDurationSec <= 0) return '';
    return String(Math.round(sectionDurationSec / 60));
  });

  useEffect(() => {
    if (!isTeacherView) return;
    if (!sectionDurationSec || sectionDurationSec <= 0) {
      setSectionDurationDraftMin('');
      return;
    }
    setSectionDurationDraftMin(String(Math.round(sectionDurationSec / 60)));
  }, [isTeacherView, sectionDurationSec]);

  const [resourceDraft, setResourceDraft] = useState<ExamTakerResourcePlaybackSettings>({});
  const [resourceDraftDirty, setResourceDraftDirty] = useState(false);

  useEffect(() => {
    setResourceDraft(activeResourcePlaybackSettings || {});
    setResourceDraftDirty(false);
  }, [currentResourceId, activeResourcePlaybackSettings]);

  const buildInlineBlankParts = (stemHtml: string) => {
    if (typeof document === 'undefined') {
      return { htmlWithMarkers: stemHtml, blankCount: 0 };
    }

    const container = document.createElement('div');
    container.innerHTML = stemHtml || '';

    const blankRegex = /(\{\{\d+\}\}|_{3,}|\.{3,})/g;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);

    let blankCount = 0;
    const nodesToProcess: Text[] = [];

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      nodesToProcess.push(currentNode as Text);
    }

    nodesToProcess.forEach(textNode => {
      const text = textNode.nodeValue || '';
      if (!blankRegex.test(text)) return;

      blankRegex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = blankRegex.exec(text)) !== null) {
        const before = text.slice(lastIndex, match.index);
        if (before) frag.appendChild(document.createTextNode(before));

        blankCount++;
        const marker = document.createElement('span');
        marker.setAttribute('data-inline-blank', String(blankCount));
        frag.appendChild(marker);

        lastIndex = match.index + match[0].length;
      }
      const after = text.slice(lastIndex);
      if (after) frag.appendChild(document.createTextNode(after));

      textNode.parentNode?.replaceChild(frag, textNode);
    });

    return { htmlWithMarkers: container.innerHTML, blankCount };
  };

  const renderInlineFillBlankStem = (question: Question, userAnswer: string, isCorrect: boolean, isMarked: boolean) => {
    const rawStem = question.text || '';
    const { htmlWithMarkers, blankCount } = buildInlineBlankParts(rawStem);

    // Only do true inline-blank input for the common single-blank case.
    if (blankCount !== 1 || !htmlWithMarkers.includes('data-inline-blank')) {
      return {
        mode: 'fallback' as const,
        node: (
          <h3
            className={`${questionClass} ${serifFont} ${isMarked ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-100'} leading-normal`}
            dangerouslySetInnerHTML={{ __html: stripGapBackgroundHighlight(rawStem) }}
          />
        )
      };
    }

    const parts = htmlWithMarkers.split(/<span\s+data-inline-blank="1"\s*><\/span>/i);
    const correctAns = question.options?.[0]?.text || '';

    const inputNode = (
      <span className="inline-flex items-end mx-1">
        <input
          type="text"
          value={userAnswer || ''}
          onChange={(e) => onAnswer(question.id, e.target.value)}
          disabled={isSubmitted}
          className={`border-b-2 outline-none px-1 pb-0.5 text-center font-bold bg-transparent min-w-[80px] md:min-w-[110px] max-w-full transition-colors ${
            isSubmitted
              ? isCorrect
                ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50/40'
                : 'border-red-500 text-red-700 dark:text-red-300 bg-red-50/40'
              : 'border-slate-200 dark:border-slate-600 focus:border-indigo-500 text-indigo-700 dark:text-indigo-300'
          }`}
          style={{ 
            width: `${Math.max(80, Math.min(400, (userAnswer || '').length * 12 + 30))}px`,
            maxWidth: '100%'
          }}
          autoComplete="off"
        />
        {isSubmitted && !isCorrect && correctAns && (
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 ml-2 whitespace-nowrap">{correctAns}</span>
        )}
      </span>
    );

    return {
      mode: 'inline' as const,
      node: (
        <div className={`${questionClass} ${serifFont} ${isMarked ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-100'} leading-normal whitespace-pre-wrap`}>
          <span dangerouslySetInnerHTML={{ __html: parts[0] || '' }} />
          {inputNode}
          <span dangerouslySetInnerHTML={{ __html: parts[1] || '' }} />
        </div>
      )
    };
  };

  // Get knowledge point names by IDs
  const getKnowledgePointNames = (pointIds?: string[]): string[] => {
    if (!pointIds || pointIds.length === 0) return [];
    
    const names: string[] = [];
    syllabuses.forEach(syllabus => {
      syllabus.units.forEach(unit => {
        unit.knowledgePoints.forEach(kp => {
          if (pointIds.includes(kp.id)) {
            names.push(kp.name);
          }
        });
      });
    });
    return names;
  };

  const renderQuestionTags = (q: Question) => {
    // Only show tags when viewing results (submitted)
    if (!isSubmitted) return null;

    // Get Resource Tags
    const resourceId = questionResourceMap[q.id];
    const resource = resourceId ? resourcesMap[resourceId] : undefined;
    
    // Combine all tags
    const questionLevel = q.level || resource?.level;
    const grammarTags = resource?.grammarTags || [];
    const vocabTags = resource?.vocabTags || [];
    // If q.tags exists use it, otherwise empty
    const questionTags = q.tags || []; 

    // Get Knowledge Points from IDs
    const knowledgePointNames = getKnowledgePointNames(q.knowledgePointIds);
    // Combine with single knowledgePointName if exists
    if (q.knowledgePointName && !knowledgePointNames.includes(q.knowledgePointName)) {
      knowledgePointNames.push(q.knowledgePointName);
    }
    
    // Combine unique other tags
    const otherTags = Array.from(new Set([...grammarTags, ...vocabTags, ...questionTags]));

    if (!questionLevel && knowledgePointNames.length === 0 && otherTags.length === 0) return null;

    return (
      <div className="flex flex-wrap items-center gap-2 mb-2">
        {questionLevel && (
          <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            {questionLevel}
          </span>
        )}
        {knowledgePointNames.map((kpName, idx) => (
          <span key={`kp-${idx}`} className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
            {kpName}
          </span>
        ))}
        {otherTags.map((tag, idx) => (
          <span key={`tag-${idx}`} className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
            {tag}
          </span>
        ))}
      </div>
    );
  };
  
  // Filter items based on current resource
  const filteredItems = section.items.filter((item, itemIdx) => {
    // Consigne需要根据它下面的第一个非consigne题目来判断是否显示
    if (item.type === 'consigne') {
      // 查找下一个非consigne题目
      const nextNonConsigneItem = section.items.slice(itemIdx + 1).find(i => i.type !== 'consigne' && i.questionId);
      if (nextNonConsigneItem && nextNonConsigneItem.questionId) {
        const nextResourceId = questionResourceMap[nextNonConsigneItem.questionId];
        // Consigne跟随下一题的资源
        if (currentResourceId) {
          return nextResourceId === currentResourceId;
        } else {
          return !nextResourceId;
        }
      }
      // 如果没有下一个非consigne题目，总是显示
      return true;
    }
    
    if (!item.questionId) return true;
    
    // If there's a current resource, only show questions belonging to that resource
    if (currentResourceId) {
      return questionResourceMap[item.questionId] === currentResourceId;
    }
    
    // If no resource is selected but section has resources, show non-resource questions
    return !questionResourceMap[item.questionId];
  });

  // Calculate starting question number for this set of filtered items
  let initialQuestionNumber = 0;
  if (filteredItems.length > 0) {
    const firstItem = filteredItems[0];
    const firstItemIdxInOriginal = section.items.indexOf(firstItem);
    for (let i = 0; i < firstItemIdxInOriginal; i++) {
      const item = section.items[i];
      if (item.type === 'consigne' || !item.questionId) continue;
      const q = allQuestions.find(qq => qq.id === item.questionId);
      if (!q) continue;
      if (q.subQuestions && q.subQuestions.length > 0) {
        initialQuestionNumber += q.subQuestions.length;
      } else {
        initialQuestionNumber += 1;
      }
    }
  }
  let questionNumber = initialQuestionNumber;

  const renderQuestion = (item: ExamItem, question: Question) => {
    // Handle Consigne
    if (item.type === 'consigne') {
      return (
        <div className="bg-blue-50 dark:bg-blue-900/10 border-l-2 border-blue-500 pl-3 py-2 mb-2">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className={`text-blue-900 dark:text-blue-200 ${passageClass} ${serifFont}`} dangerouslySetInnerHTML={{ __html: item.consigneText || '' }} />
          </div>
        </div>
      );
    }

    // Handle Cloze Test (with dropdown selects)
    if (question.type === 'cloze-test') {
      return renderClozeTest(question);
    }

    // Handle Compound Fill
    if (question.type === 'compound-fill') {
      return renderCompoundFill(question);
    }

    // Handle Reading Comprehension
    if (question.type === 'reading-comprehension' && question.subQuestions && question.subQuestions.length > 0) {
      return renderReadingComprehension(question, item);
    }

    const qNum = ++questionNumber;
    
    // Only show tags if it's a simple question (not sub-question of cloze/reading),
    // OR if we decide to show them for simple questions. 
    // Here we are inside renderQuestion, which handles simple questions directly or delegates.
    // For simple questions, we should render tags.
    const isSimpleQuestion = !question.subQuestions || question.subQuestions.length === 0;
    
    // We already handled complex types above, so if we are here, it SHOULD be simple.
    // But verify to be safe and avoid TS errors.
    const tagsElement = isSimpleQuestion ? renderQuestionTags(question) : null;

    return (
      <div key={question.id}>
        {tagsElement}
        {renderSimpleQuestion(question, qNum, item.points)}
      </div>
    );
  };

  const renderClozeTest = (question: Question) => {
    const startNum = questionNumber + 1;
    const subQs = question.subQuestions || [];
    questionNumber += subQs.length;

    return (
      <div 
        ref={(el) => {
          subQs.forEach(sq => {
            questionRefs.current[sq.id] = el;
          });
        }}
        className="mb-4"
      >
        {renderQuestionTags(question)}
        <div className="flex items-start gap-2">
          <span className={`font-bold ${questionClass} ${serifFont} min-w-[30px] mt-0.5`}>{startNum}.</span>
          <div className="flex-1 min-w-0">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded mb-3">
              <div className={`${passageClass} ${serifFont} leading-normal text-slate-700 dark:text-slate-200`}>
                {renderClozePassage(question, startNum)}
              </div>
            </div>
            {isSubmitted && (
              <div className="ml-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                {subQs.map((subQ, idx) => {
                  const isCorrect = checkAnswer(subQ, answers[subQ.id]);
                  const correctOpt = subQ.options.find(o => o.id === subQ.correctOptionId);
                  const userOpt = subQ.options.find(o => o.id === answers[subQ.id]);
                  const displayNum = startNum + idx;
                  
                  return (
                    <div key={subQ.id} className="text-sm">
                      <span className="font-bold mr-2">({displayNum})</span>
                      <span className={isCorrect ? 'text-emerald-600 font-bold' : 'text-red-600 font-bold'}>
                        {correctOpt?.text}
                      </span>
                      {!isCorrect && userOpt && (
                        <span className="text-slate-500 ml-2">
                          (您选: {userOpt.text})
                        </span>
                      )}
                      {isSubmitted && subQ.explanation && (
                        <div className="mt-2 ml-6 p-2 bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-indigo-400 text-xs text-indigo-900 dark:text-indigo-200">
                          <span className="font-bold text-[10px]">解析：</span> {subQ.explanation}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {isSubmitted && question.explanation && (
              <div className="mt-4 p-2 bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-indigo-400 text-sm text-indigo-900 dark:text-indigo-200">
                <span className="font-bold text-xs">解析：</span>
                <div className="mt-1 leading-relaxed whitespace-pre-wrap">{question.explanation}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderClozePassage = (question: Question, startNum: number) => {
    let passage = stripGapBackgroundHighlight(question.readingPassage || '');
    const parts: (string | JSX.Element)[] = [];
    
    // Parse the HTML and replace spans with dropdowns
    const spanRegex = /<span\s+data-gap="(\d+)"[^>]*>.*?<\/span>/g;
    let lastIndex = 0;
    let match;

    while ((match = spanRegex.exec(passage)) !== null) {
      // Add text before the span
      if (match.index > lastIndex) {
        parts.push(passage.substring(lastIndex, match.index));
      }

      const gapNum = parseInt(match[1], 10);
      const subQ = question.subQuestions?.[gapNum - 1];

      if (subQ) {
        const userAnswer = answers[subQ.id] || '';
        const isCorrect = isSubmitted && checkAnswer(subQ, userAnswer);
        const displayNum = startNum + gapNum - 1;

        parts.push(
          <span key={`gap-${gapNum}`} className="inline-flex items-center mx-1">
            <span className="font-bold text-[10px] text-slate-400 mr-1">({displayNum})</span>
            <select
              value={userAnswer}
              onChange={(e) => onAnswer(subQ.id, e.target.value)}
              disabled={isSubmitted}
              className={`border-b-2 outline-none px-2 py-0.5 rounded-t font-bold transition-all ${
                isSubmitted
                  ? isCorrect
                    ? 'border-emerald-500 bg-emerald-50/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-red-500 bg-red-50/40 text-red-700 dark:text-red-300'
                  : 'border-slate-200 dark:border-slate-600 focus:border-indigo-500 bg-white/50 dark:bg-slate-800/50 text-indigo-700 dark:text-indigo-300'
              }`}
            >
              <option value="">--</option>
              {subQ.options.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.text}</option>
              ))}
            </select>
            {isSubmitted && !isCorrect && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 ml-1 whitespace-nowrap">
                [{subQ.options.find(o => o.id === subQ.correctOptionId)?.text}]
              </span>
            )}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < passage.length) {
      parts.push(passage.substring(lastIndex));
    }

    return parts.map((part, idx) => 
      typeof part === 'string' ? <span key={idx} dangerouslySetInnerHTML={{ __html: part }} /> : part
    );
  };

  const renderCompoundFill = (question: Question) => {
    const startNum = questionNumber + 1;
    const subQs = question.subQuestions || [];
    questionNumber += subQs.length;

    let passage = stripGapBackgroundHighlight(question.readingPassage || '');
    const parts: (string | JSX.Element)[] = [];
    
    const spanRegex = /<span\s+data-gap="(\d+)"[^>]*>.*?<\/span>/g;
    let lastIndex = 0;
    let match;

    while ((match = spanRegex.exec(passage)) !== null) {
      if (match.index > lastIndex) {
        parts.push(passage.substring(lastIndex, match.index));
      }

      const gapNum = parseInt(match[1], 10);
      const subQ = subQs[gapNum - 1];

      if (subQ) {
        const userAnswer = answers[subQ.id] || '';
        const isCorrect = isSubmitted && checkAnswer(subQ, userAnswer);
        const correctAns = subQ.options[0]?.text;
        const displayNum = startNum + gapNum - 1;

        parts.push(
          <span key={`gap-${gapNum}`} className="inline-flex items-center mx-1">
            <span className="font-bold text-[10px] text-slate-400 mr-1">({displayNum})</span>
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => onAnswer(subQ.id, e.target.value)}
              disabled={isSubmitted}
              className={`border-b-2 outline-none px-2 py-0.5 text-center font-bold bg-transparent min-w-[80px] max-w-full md:max-w-[300px] transition-all ${
                isSubmitted
                  ? isCorrect
                    ? 'border-emerald-500 text-emerald-700 dark:text-emerald-300 bg-emerald-50/40'
                    : 'border-red-500 text-red-700 dark:text-red-300 bg-red-50/40'
                  : 'border-slate-200 dark:border-slate-600 focus:border-indigo-500 text-indigo-700 dark:text-indigo-300'
              }`}
              style={{ width: `${Math.max(80, Math.min(300, userAnswer.length * 12 + 30))}px`, maxWidth: '100%' }}
              autoComplete="off"
            />
            {isSubmitted && !isCorrect && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 ml-1 whitespace-nowrap">
                [{correctAns}]
              </span>
            )}
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < passage.length) {
      parts.push(passage.substring(lastIndex));
    }

    return (
      <div 
        ref={(el) => {
          subQs.forEach(sq => {
            questionRefs.current[sq.id] = el;
          });
        }}
        className="mb-4"
      >
        {renderQuestionTags(question)}
        <div className="flex items-start gap-2">
          <span className={`font-bold ${questionClass} ${serifFont} min-w-[30px] mt-0.5`}>{startNum}.</span>
          <div className="flex-1 min-w-0">
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded">
              <div className={`${passageClass} ${serifFont} leading-normal text-slate-700 dark:text-slate-200`}>
                {parts.map((part, idx) => 
                  typeof part === 'string' ? <span key={idx} dangerouslySetInnerHTML={{ __html: part }} /> : part
                )}
              </div>
            </div>
            {isSubmitted && question.explanation && (
              <div className="mt-4 p-2 bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-indigo-400 text-sm text-indigo-900 dark:text-indigo-200">
                <span className="font-bold text-xs">解析：</span>
                <div className="mt-1 leading-relaxed whitespace-pre-wrap">{question.explanation}</div>
              </div>
            )}
            {isSubmitted && subQs.some(sq => !!sq.explanation) && (
              <div className="mt-2 space-y-2 ml-4">
                {subQs.map((sq, idx) =>
                  sq.explanation ? (
                    <div
                      key={sq.id}
                      className="p-2 bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-indigo-400 text-xs text-indigo-900 dark:text-indigo-200"
                    >
                      <span className="font-bold text-[10px]">({startNum + idx}) 解析：</span> {sq.explanation}
                    </div>
                  ) : null
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderReadingComprehension = (question: Question, item: ExamItem) => {
    const isMultimediaLayout = !!currentResourceId;
    return (
      <div className="mb-4">
        {renderQuestionTags(question)}
        <div className={isMultimediaLayout ? 'space-y-6' : 'grid grid-cols-1 lg:grid-cols-2 gap-6'}>
          {/* Left: Reading Passage (or Top in multimedia) */}
          <div className={isMultimediaLayout ? 'w-full' : 'lg:border-r border-slate-200 dark:border-slate-700 lg:pr-6 border-b lg:border-b-0 pb-6 lg:pb-0'}>
            <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm">
              <div
                className={`${passageClass} ${serifFont} leading-relaxed text-slate-700 dark:text-slate-200 prose max-w-none`}
                dangerouslySetInnerHTML={{ __html: stripGapBackgroundHighlight(question.readingPassage || '') }}
              />
            </div>
          </div>
          {/* Right: Sub Questions (or Bottom in multimedia) */}
          <div className="space-y-4">
            {question.subQuestions?.map((subQ, idx) => {
              const qNum = ++questionNumber;
              const points = item.subPoints?.[idx] || 0;
              return renderSimpleQuestion(subQ, qNum, points, true);
            })}
          </div>
        </div>
        {isSubmitted && question.explanation && (
          <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/10 border-l-4 border-indigo-400 text-sm text-indigo-900 dark:text-indigo-200 rounded-r-lg">
            <span className="font-bold text-xs block mb-1">【试题解析】</span>
            <div className="leading-relaxed whitespace-pre-wrap">{question.explanation}</div>
          </div>
        )}
      </div>
    );
  };

  const renderSimpleQuestion = (question: Question, qNum: number, points: number, isSub = false) => {
    const userAnswer = answers[question.id];
    const isCorrect = isSubmitted && checkAnswer(question, userAnswer);
    const isMarked = markedQuestionIds.has(question.id);

    const fillBlankStem =
      question.type === 'fill-in-the-blank'
        ? renderInlineFillBlankStem(question, userAnswer || '', !!isCorrect, isMarked)
        : null;

    const stemContent = fillBlankStem
      ? fillBlankStem.node
      : (
          <h3
            className={`${questionClass} ${serifFont} ${isMarked ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-slate-100'} leading-normal`}
            dangerouslySetInnerHTML={{ __html: stripGapBackgroundHighlight(question.text) }}
          />
        );

    const stemNode = (
      <div
        className={`flex-1 min-w-0 cursor-default select-none ${
          isMarked
            ? 'rounded-lg px-2 py-1 bg-red-50/70 dark:bg-red-900/20 ring-1 ring-red-200 dark:ring-red-900/30'
            : ''
        }`}
        onClick={() => {
          const now = Date.now();
          const lastClick = (stemClickTimerRef.current as any)[question.id] || 0;
          if (now - lastClick < 300) {
            (stemClickTimerRef.current as any)[question.id] = 0;
            toggleQuestionMark(question.id);
          } else {
            (stemClickTimerRef.current as any)[question.id] = now;
          }
        }}
      >
        {stemContent}
      </div>
    );

    const shouldShowSeparateFillInput =
      question.type === 'fill-in-the-blank' && fillBlankStem?.mode === 'fallback';

    const optionCols = getOptionGridColumns((question.options || []).map(o => o.text));
    const gridColsClass =
      optionCols === 4 ? 'grid-cols-2 md:grid-cols-4' :
      optionCols === 2 ? 'grid-cols-1 md:grid-cols-2' :
      'grid-cols-1';

    const hasOptionImages = (question.options || []).some(o => !!o.imageUrl);

    return (
      <div
        key={question.id}
        ref={(el) => {
          questionRefs.current[question.id] = el;
        }}
        className="mb-4"
      >
        <div className="flex items-start gap-2">
          <span className={`font-bold ${questionClass} ${serifFont} min-w-[30px] mt-0.5`}>{qNum}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between mb-2 gap-4">
              {stemNode}
              <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">({points} 分)</span>
            </div>

            {question.imageUrl && (
              <img
                src={question.imageUrl}
                alt="Question"
                className="max-w-[200px] h-auto object-contain mb-2 border border-slate-200 dark:border-slate-700 rounded"
              />
            )}
          </div>
        </div>

        {shouldShowSeparateFillInput ? (
          <div className="ml-8 mt-2">
            <div className="relative">
              <input
                type="text"
                value={userAnswer || ''}
                onChange={(e) => onAnswer(question.id, e.target.value)}
                disabled={isSubmitted}
                className={`w-full px-3 py-2 border-b-2 outline-none ${optionClass} transition-all ${
                  isSubmitted
                    ? isCorrect
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                      : 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                }`}
                placeholder="请输入答案..."
                autoComplete="off"
              />
              {isSubmitted && (
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  {isCorrect ? <CheckCircle size={20} className="text-emerald-500" /> : <XCircle size={20} className="text-red-500" />}
                </div>
              )}
            </div>
            {isSubmitted && !isCorrect && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 font-bold">
                正确答案：{question.options[0]?.text}
              </p>
            )}
          </div>
        ) : question.type === 'fill-in-the-blank' ? null : (
          <div className={hasOptionImages ? 'ml-8 space-y-2' : `ml-8 grid gap-2 ${gridColsClass}`}>
            {question.options.map((opt, optIdx) => {
              const isSelected = userAnswer === opt.id;
              const isThisCorrect = question.correctOptionId === opt.id;
              const optionLetter = String.fromCharCode(65 + optIdx);

              return (
                <button
                  key={opt.id}
                  onClick={() => onAnswer(question.id, opt.id)}
                  disabled={isSubmitted}
                  className={`w-full text-left transition-all px-2 py-1 rounded ${serifFont} ${
                    isSelected && !isSubmitted ? 'bg-indigo-50 dark:bg-amber-900/30' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={`font-bold shrink-0 ${serifFont} ${
                        isSubmitted && isThisCorrect
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : isSubmitted && (isSelected || !userAnswer) && !isThisCorrect
                            ? 'text-red-600 dark:text-red-400'
                            : isSelected
                              ? 'text-indigo-600 dark:text-amber-300'
                              : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {optionLetter}.
                    </span>
                    <span
                      className={`${optionClass} ${serifFont} ${
                        isSubmitted && isThisCorrect
                          ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                          : isSubmitted && (isSelected || !userAnswer) && !isThisCorrect
                            ? 'text-red-700 dark:text-red-300'
                            : isSelected
                              ? 'text-indigo-700 dark:text-amber-200 font-medium'
                              : 'text-slate-800 dark:text-slate-200'
                      } ${(optionCols === 4 && !hasOptionImages) ? 'truncate' : 'whitespace-normal break-words'}`}
                      dangerouslySetInnerHTML={{ __html: opt.text }}
                    />
                  </div>
                  {opt.imageUrl && (
                    <img
                      src={opt.imageUrl}
                      className="mt-1 ml-6 max-w-[200px] h-auto object-contain rounded border border-slate-200 dark:border-slate-700"
                      alt=""
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {isSubmitted && question.explanation && (
          <div className="ml-8 mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-indigo-400 text-sm text-indigo-900 dark:text-indigo-200">
            <span className="font-bold text-xs">解析：</span>
            {question.explanation}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className={`bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm ${serifFont}`}>
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">{section.title}</h2>
          <div className="flex items-center gap-2 shrink-0">
            {isTeacherView ? (
              <>
                <span className="text-xs font-black text-slate-600 dark:text-slate-300">本部分时长(分)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={sectionDurationDraftMin}
                  onChange={(e) => setSectionDurationDraftMin(e.target.value)}
                  className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                  placeholder="未设置"
                />
                <button
                  onClick={() => {
                    const raw = sectionDurationDraftMin.trim();
                    const minutes = raw === '' ? undefined : Math.floor(Number(raw));
                    const nextSec = typeof minutes === 'number' && minutes > 0 ? minutes * 60 : undefined;
                    onSaveSectionDurationSec(section.id, nextSec);
                  }}
                  className="text-[11px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                  title="学生超时将自动进入下一部分，离开后不可返回"
                >
                  保存
                </button>
              </>
            ) : (
              typeof sectionDurationSec === 'number' && sectionDurationSec > 0 && (
                <div className="px-3 py-1 rounded-full bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200 text-sm font-black">
                  剩余 {formatDuration(sectionRemainingMs || 0)}
                </div>
              )
            )}
            <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-200 text-sm font-black tabular-nums">
              {isSubmitted ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  {sectionScore.earned}/{sectionScore.total}
                </span>
              ) : (
                `${sectionTotalScore} 分`
              )}
            </div>
          </div>
        </div>
        {section.instructions && (
          <p className="text-slate-600 dark:text-slate-400 leading-relaxed" dangerouslySetInnerHTML={{ __html: section.instructions }} />
        )}
      </div>

      {/* Media Resource with Questions - Left Right Layout */}
      {currentResourceId && resourcesMap[currentResourceId] ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-blue-100 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="flex items-center justify-between p-4 bg-blue-50/30 dark:bg-slate-950/50 border-b border-blue-100 dark:border-slate-800">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 text-xs font-black uppercase tracking-widest">
              <BookOpen size={14} />
            </div>

            {isTeacherView && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black text-slate-600 dark:text-slate-300">播放规则</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={resourceDraft.playCount ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const v = raw === '' ? undefined : Math.max(1, Math.floor(Number(raw)));
                    setResourceDraft(prev => ({ ...prev, playCount: v }));
                    setResourceDraftDirty(true);
                  }}
                  className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                  placeholder="次数"
                  title="播放次数"
                />
                <select
                  value={resourceDraft.playbackRate ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const v = raw === '' ? undefined : (Number(raw) as 0.5 | 0.75 | 1);
                    setResourceDraft(prev => ({ ...prev, playbackRate: v }));
                    setResourceDraftDirty(true);
                  }}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                  title="播放速度"
                >
                  <option value="">速度</option>
                  <option value="1">1x</option>
                  <option value="0.75">0.75x</option>
                  <option value="0.5">0.5x</option>
                </select>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={resourceDraft.preCountdownSec ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const v = raw === '' ? undefined : Math.max(0, Math.floor(Number(raw)));
                    setResourceDraft(prev => ({ ...prev, preCountdownSec: v }));
                    setResourceDraftDirty(true);
                  }}
                  className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                  placeholder="前(s)"
                  title="播放前倒计时（仅第一遍前生效）"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={resourceDraft.postCountdownSec ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const v = raw === '' ? undefined : Math.max(0, Math.floor(Number(raw)));
                    setResourceDraft(prev => ({ ...prev, postCountdownSec: v }));
                    setResourceDraftDirty(true);
                  }}
                  className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                  placeholder="后(s)"
                  title="播放后倒计时（仅最后一遍后生效）"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={resourceDraft.pauseBetweenPlaysSec ?? ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const v = raw === '' ? undefined : Math.max(0, Math.floor(Number(raw)));
                    setResourceDraft(prev => ({ ...prev, pauseBetweenPlaysSec: v }));
                    setResourceDraftDirty(true);
                  }}
                  className="w-16 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                  placeholder="隔(s)"
                  title="播放间隔暂停（在各遍之间）"
                />
                <button
                  onClick={() => {
                    if (!currentResourceId) return;
                    onSaveResourcePlaybackSettings(currentResourceId, {
                      playCount: resourceDraft.playCount,
                      playbackRate: resourceDraft.playbackRate,
                      preCountdownSec: resourceDraft.preCountdownSec,
                      postCountdownSec: resourceDraft.postCountdownSec,
                      pauseBetweenPlaysSec: resourceDraft.pauseBetweenPlaysSec
                    });
                    setResourceDraftDirty(false);
                  }}
                  className={`text-[11px] px-2 py-1 rounded-md transition-colors ${
                    resourceDraftDirty
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400'
                  }`}
                  title="保存该资源播放规则"
                >
                  保存
                </button>
                <button
                  onClick={() => {
                    onClearResourcePlaybackSettings(currentResourceId);
                    setResourceDraft({});
                    setResourceDraftDirty(false);
                  }}
                  className="text-[11px] px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                  title="清除该资源规则"
                >
                  清除
                </button>
              </div>
            )}
            {currentSectionResources.length > 1 && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setCurrentResourceIndex(Math.max(0, currentResourceIndex - 1))}
                  disabled={studentResourceSwitchLocked || currentResourceIndex === 0}
                  className="p-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="上一资源"
                >
                  <ChevronLeft size={20} />
                </button>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {currentResourceIndex + 1} / {currentSectionResources.length}
                </span>
                <button
                  onClick={() => setCurrentResourceIndex(Math.min(currentSectionResources.length - 1, currentResourceIndex + 1))}
                  disabled={studentResourceSwitchLocked || currentResourceIndex === currentSectionResources.length - 1}
                  className="p-1 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  title="下一资源"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 md:p-6">
            {/* Left: Media Player */}
            <div className="lg:border-r border-b lg:border-b-0 border-slate-200 dark:border-slate-700 lg:pr-6 pb-6 lg:pb-0">
              <ExamMediaPlayer
                resource={resourcesMap[currentResourceId]}
                playbackSettings={isSubmitted ? undefined : activeResourcePlaybackSettings}
                onAutoPlaybackComplete={
                  isSubmitted
                    ? undefined
                    : () => {
                        setCurrentResourceIndex(prev =>
                          prev < currentSectionResources.length - 1 ? prev + 1 : prev
                        );
                      }
                }
              />

              {isSubmitted && resourcesMap[currentResourceId].transcript && (
                <div className="mt-8 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                    <FileText size={16} className="text-indigo-600" />
                    录音/视频原文 (Transcription)
                  </h4>
                  <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {resourcesMap[currentResourceId].transcript.map((seg, idx) => (
                      <div key={idx} className="group flex gap-3 items-start">
                        <span className="text-[10px] font-mono text-slate-400 mt-1 shrink-0 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                          {formatDuration(seg.startTime * 1000)}
                        </span>
                        <div className="flex-1 space-y-1">
                          <div className={`text-sm leading-relaxed ${serifFont} text-slate-700 dark:text-slate-200 font-medium`}>
                            {seg.text}
                          </div>
                          {seg.translation && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 group-hover:line-clamp-none transition-all">
                              {seg.translation}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {/* Right: Questions */}
            <div className="space-y-4 overflow-y-auto max-h-[600px] no-scrollbar">
              {filteredItems.map((item, itemIdx) => {
                if (item.type === 'consigne') {
                  const nextItem = filteredItems[itemIdx + 1];
                  if (nextItem && nextItem.type !== 'consigne' && nextItem.questionId) {
                    const nextQuestion = allQuestions.find(q => q.id === nextItem.questionId);
                    if (nextQuestion) {
                      return (
                        <div key={`consigne-with-${nextItem.questionId}`} className="space-y-4">
                          {renderQuestion(item, {} as Question)}
                          {renderQuestion(nextItem, nextQuestion)}
                        </div>
                      );
                    }
                  }
                  return <div key={`consigne-${Math.random()}`}>{renderQuestion(item, {} as Question)}</div>;
                }
                
                const prevItem = itemIdx > 0 ? filteredItems[itemIdx - 1] : null;
                if (prevItem && prevItem.type === 'consigne') {
                  return null;
                }
                
                const question = allQuestions.find(q => q.id === item.questionId);
                if (!question) return null;
                
                return <div key={item.questionId}>{renderQuestion(item, question)}</div>;
              })}
            </div>
          </div>
        </div>
      ) : (
        /* Non-Resource Questions - Original Layout */
        <>
          {filteredItems.map((item, itemIdx) => {
            if (item.type === 'consigne') {
              const nextItem = filteredItems[itemIdx + 1];
              if (nextItem && nextItem.type !== 'consigne' && nextItem.questionId) {
                const nextQuestion = allQuestions.find(q => q.id === nextItem.questionId);
                if (nextQuestion) {
                  return (
                    <div key={`consigne-with-${nextItem.questionId}`} className="space-y-4">
                      {renderQuestion(item, {} as Question)}
                      {renderQuestion(nextItem, nextQuestion)}
                    </div>
                  );
                }
              }
              return <div key={`consigne-${Math.random()}`}>{renderQuestion(item, {} as Question)}</div>;
            }
            
            const prevItem = itemIdx > 0 ? filteredItems[itemIdx - 1] : null;
            if (prevItem && prevItem.type === 'consigne') {
              return null;
            }
            
            const question = allQuestions.find(q => q.id === item.questionId);
            if (!question) return null;
            
            return <div key={item.questionId}>{renderQuestion(item, question)}</div>;
          })}
        </>
      )}
    </div>
  );
};

export default ExamTaker;
