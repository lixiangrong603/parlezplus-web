import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft, User, CheckCircle, XCircle, Clock, AlertCircle,
  Save, BarChart3, Download, RotateCcw, Edit3, Star, BookOpen, FileText
} from 'lucide-react';
import { getOptionGridColumns } from '../utils/optionLayout';
import { ExamSession, ExamPaper, Classroom, Question, MediaResource, ExamSection, ExamItem, User as UserType } from '../types';
import {
  getExamPaperById,
  getClassroomById,
  getExamSessionsByExamAndClass,
  updateExamSession,
  deleteExamSessionsByExam,
  getQuestionsWithResourceInfo,
  getResources
} from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';

interface ExamGradingManagerProps {
  examId: string;
  classId: string;
  onBack: () => void;
}

const ExamGradingManager: React.FC<ExamGradingManagerProps> = ({ examId, classId, onBack }) => {
  const { user } = useAuth();
  const [exam, setExam] = useState<ExamPaper | null>(null);
  const [classroom, setClassroom] = useState<Classroom | null>(null);
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [questionResourceMap, setQuestionResourceMap] = useState<Record<string, string>>({});
  const [resourcesMap, setResourcesMap] = useState<Record<string, MediaResource>>({});
  
  // Grading state
  const [teacherFeedback, setTeacherFeedback] = useState('');
  const [manualScore, setManualScore] = useState<number | undefined>(undefined);
  const [hasChanges, setHasChanges] = useState(false);
  
  // UI state
  const [filter, setFilter] = useState<'all' | 'graded' | 'pending' | 'unsubmitted'>('all');
  const [showStatistics, setShowStatistics] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showRedoConfirm, setShowRedoConfirm] = useState(false);
  
  // Load initial data
  useEffect(() => {
    const examData = getExamPaperById(examId);
    if (examData) setExam(examData);
    
    const classData = getClassroomById(classId);
    if (classData) setClassroom(classData);
    
    loadSessions();
  }, [examId, classId]);

  const loadSessions = () => {
    const sessionData = getExamSessionsByExamAndClass(examId, classId);
    setSessions(sessionData);
  };

  // Load questions when exam is loaded
  useEffect(() => {
    if (!exam) return;
    loadExamResources();
  }, [exam]);

  const loadExamResources = async () => {
    if (!exam) return;
    
    const questionIds = exam.sections
      .flatMap(s => s.items)
      .filter(item => item.type !== 'consigne' && item.questionId)
      .map(item => item.questionId!);

    const questionsWithInfo = await getQuestionsWithResourceInfo(questionIds);
    const questions = questionsWithInfo.map(info => info.question);
    setAllQuestions(questions);

    const resourceMap: Record<string, string> = {};
    const uniqueResourceIds = new Set<string>();
    questionsWithInfo.forEach(info => {
      if (info.resourceId) {
        resourceMap[info.question.id] = info.resourceId;
        uniqueResourceIds.add(info.resourceId);
      }
    });
    setQuestionResourceMap(resourceMap);

    const allResources = getResources();
    const resMap: Record<string, MediaResource> = {};
    uniqueResourceIds.forEach(rid => {
      const resource = allResources.find(r => r.id === rid);
      if (resource) {
        resMap[rid] = resource;
      }
    });
    setResourcesMap(resMap);
  };

  // Get current session
  const currentSession = useMemo(() => {
    if (!selectedStudentId) return null;
    return sessions.find(s => s.studentId === selectedStudentId);
  }, [selectedStudentId, sessions]);

  // Update grading state when student changes
  useEffect(() => {
    if (currentSession) {
      setTeacherFeedback(currentSession.teacherFeedback || '');
      setManualScore(currentSession.manualScore);
      setHasChanges(false);
    } else {
      setTeacherFeedback('');
      setManualScore(undefined);
      setHasChanges(false);
    }
  }, [currentSession?.id]);

  // Track changes
  useEffect(() => {
    if (!currentSession) {
      setHasChanges(false);
      return;
    }
    
    const feedbackChanged = teacherFeedback !== (currentSession.teacherFeedback || '');
    const scoreChanged = manualScore !== currentSession.manualScore;
    setHasChanges(feedbackChanged || scoreChanged);
  }, [teacherFeedback, manualScore, currentSession]);

  // Get student list with submission status
  const studentList = useMemo(() => {
    if (!classroom) return [];
    
    return classroom.students.map(student => {
      const session = sessions.find(s => s.studentId === student.userId);
      return {
        ...student,
        session,
        hasSubmitted: session?.isSubmitted || false,
        isGraded: session?.status === 'graded',
        score: session?.manualScore ?? session?.score,
        totalScore: session?.totalScore
      };
    });
  }, [classroom, sessions]);

  // Filter students
  const filteredStudents = useMemo(() => {
    if (filter === 'all') return studentList;
    if (filter === 'graded') return studentList.filter(s => s.isGraded);
    if (filter === 'pending') return studentList.filter(s => s.hasSubmitted && !s.isGraded);
    if (filter === 'unsubmitted') return studentList.filter(s => !s.hasSubmitted);
    return studentList;
  }, [studentList, filter]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const submitted = studentList.filter(s => s.hasSubmitted);
    const graded = studentList.filter(s => s.isGraded);
    
    const scores = graded
      .map(s => s.score)
      .filter((score): score is number => typeof score === 'number');
    
    const avgScore = scores.length > 0 
      ? scores.reduce((sum, score) => sum + score, 0) / scores.length 
      : 0;
    
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    return {
      totalStudents: studentList.length,
      submittedCount: submitted.length,
      gradedCount: graded.length,
      pendingCount: submitted.length - graded.length,
      submissionRate: studentList.length > 0 ? (submitted.length / studentList.length) * 100 : 0,
      avgScore,
      maxScore,
      minScore
    };
  }, [studentList]);

  // Save grading
  const handleSave = () => {
    if (!currentSession || !user) return;
    
    const updatedSession: ExamSession = {
      ...currentSession,
      teacherFeedback,
      manualScore,
      gradedBy: user.id,
      gradedAt: Date.now(),
      status: 'graded'
    };
    
    updateExamSession(updatedSession);
    loadSessions();
    setHasChanges(false);
  };

  // Export grades
  const handleExport = () => {
    if (!exam || !classroom) return;
    
    const csvRows = [
      ['学号', '姓名', '提交时间', '用时(分钟)', '自动评分', '最终得分', '教师评语']
    ];
    
    studentList.forEach(student => {
      const session = student.session;
      if (!session || !session.isSubmitted) {
        csvRows.push([
          student.id,
          student.name,
          '未提交',
          '-',
          '-',
          '-',
          '-'
        ]);
      } else {
        const submitTime = session.submitTime ? new Date(session.submitTime).toLocaleString('zh-CN') : '-';
        const elapsedMin = Math.round(session.elapsedTime / 60000);
        const autoScore = session.score ?? '-';
        const finalScore = session.manualScore ?? session.score ?? '-';
        const feedback = session.teacherFeedback || '-';
        
        csvRows.push([
          student.id,
          student.name,
          submitTime,
          String(elapsedMin),
          String(autoScore),
          String(finalScore),
          feedback
        ]);
      }
    });
    
    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exam.title}_${classroom.name}_成绩单_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    
    setShowExportModal(false);
  };

  // Return to redo
  const handleReturnToRedo = () => {
    if (!selectedStudentId) return;
    
    deleteExamSessionsByExam(examId, [selectedStudentId]);
    loadSessions();
    setSelectedStudentId(null);
    setShowRedoConfirm(false);
  };

  // Check answer helper
  const checkAnswer = (q: Question, userAnswer: string): boolean => {
    if (!userAnswer) return false;
    if (q.type === 'fill-in-the-blank') {
      const correctText = q.options[0]?.text || '';
      return userAnswer.trim().toLowerCase() === correctText.trim().toLowerCase();
    }
    return userAnswer === q.correctOptionId;
  };

  if (!exam || !classroom) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-slate-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="h-16 shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-black text-slate-800 dark:text-white">
              {exam.title} - 批改
            </h2>
            <p className="text-xs text-slate-500">
              {classroom.name} · 已批 {statistics.gradedCount}/{statistics.submittedCount} · 
              提交率 {statistics.submissionRate.toFixed(0)}%
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                filter === 'all' 
                  ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              全部 {studentList.length}
            </button>
            <button
              onClick={() => setFilter('graded')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                filter === 'graded' 
                  ? 'bg-white dark:bg-slate-600 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              已批 {statistics.gradedCount}
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                filter === 'pending' 
                  ? 'bg-white dark:bg-slate-600 text-amber-600 dark:text-amber-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              待批 {statistics.pendingCount}
            </button>
            <button
              onClick={() => setFilter('unsubmitted')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                filter === 'unsubmitted' 
                  ? 'bg-white dark:bg-slate-600 text-slate-600 dark:text-slate-400 shadow-sm' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              未交 {studentList.length - statistics.submittedCount}
            </button>
          </div>

          <div className="w-px h-6 bg-slate-300 dark:bg-slate-600"></div>

          <button
            onClick={() => setShowStatistics(true)}
            className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors flex items-center gap-1"
          >
            <BarChart3 size={16} />
            统计分析
          </button>
          <button
            onClick={() => setShowExportModal(true)}
            className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center gap-1"
          >
            <Download size={16} />
            导出成绩
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Student List */}
        <div className="w-80 shrink-0 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col">
          {/* Student List */}
          <div className="flex-1 overflow-y-auto">
            {filteredStudents.length === 0 ? (
              <div className="p-4 text-center text-sm text-slate-400">
                暂无学生
              </div>
            ) : (
              filteredStudents.map(student => (
                <div
                  key={student.id}
                  className={`w-full border-b border-slate-100 dark:border-slate-700 ${
                    !student.hasSubmitted 
                      ? 'opacity-50'
                      : selectedStudentId === student.userId
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-600'
                      : ''
                  }`}
                >
                  <button
                    onClick={() => student.hasSubmitted && student.userId && setSelectedStudentId(student.userId)}
                    disabled={!student.hasSubmitted}
                    className={`w-full p-3 flex items-center gap-3 transition-colors ${
                      !student.hasSubmitted 
                        ? 'cursor-not-allowed'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                    }`}
                  >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {student.avatar ? (
                      <img src={student.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      student.name.charAt(0)
                    )}
                  </div>
                  
                  <div className="flex-1 text-left min-w-0">
                    <div className="font-medium text-sm text-slate-800 dark:text-white truncate">
                      {student.name}
                    </div>
                    {student.hasSubmitted ? (
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between gap-2">
                        {student.isGraded ? (
                          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 min-w-0">
                            <CheckCircle size={12} />
                            <span className="truncate">已批 {student.score}/{student.totalScore}</span>
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1 min-w-0">
                            <Clock size={12} />
                            <span className="truncate">待批改</span>
                          </span>
                        )}

                        {selectedStudentId === student.userId && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setShowRedoConfirm(true);
                            }}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 shrink-0"
                            title="返回重做"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <XCircle size={12} />
                        未提交
                      </div>
                    )}
                  </div>
                </button>
              </div>
              ))
            )}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 overflow-y-auto">
          {!selectedStudentId || !currentSession ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <User size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-slate-500 dark:text-slate-400">请从左侧选择学生</p>
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto p-6 space-y-6">
              {/* Student Info & Grading Card - Compact Version */}
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-20">
                <div className="flex flex-col xl:flex-row gap-4 xl:items-center justify-between">
                  
                  {/* Left: Student Identity & Stats */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xl shrink-0 shadow-md shadow-indigo-200 dark:shadow-none">
                      {studentList.find(s => s.userId === selectedStudentId)?.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-black text-slate-800 dark:text-white truncate">
                          {studentList.find(s => s.userId === selectedStudentId)?.name}
                        </h3>
                        <div className="flex items-center bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 rounded-lg px-2 py-0.5">
                          <span className="text-[10px] uppercase font-bold text-indigo-400 dark:text-indigo-300 mr-2">最终得分</span>
                          <span className="text-base font-black text-indigo-600 dark:text-indigo-400 leading-none">
                            {currentSession.manualScore ?? currentSession.score ?? '-'}
                            <span className="text-xs text-indigo-400 dark:text-indigo-500 font-medium ml-0.5">/{currentSession.totalScore}</span>
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-medium">
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {currentSession.submitTime ? new Date(currentSession.submitTime).toLocaleString('zh-CN', {month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit'}) : '-'}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span className="flex items-center gap-1">
                          <span className="text-[10px] text-slate-400">用时</span>
                          {Math.round(currentSession.elapsedTime / 60000)}分钟
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <span className="bg-slate-100 dark:bg-slate-700 px-1.5 rounded text-[10px] text-slate-500">自动</span>
                          {currentSession.score ?? '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Grading Controls */}
                  <div className="flex-1 xl:max-w-2xl bg-slate-50 dark:bg-slate-900/50 rounded-xl p-2 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                    <div className="w-24 shrink-0">
                      <div className="relative">
                        <input
                          type="number"
                          value={manualScore === undefined ? '' : manualScore}
                          onChange={(e) => setManualScore(e.target.value === '' ? undefined : Number(e.target.value))}
                          placeholder="调分"
                          className="w-full pl-3 pr-2 py-2 text-sm font-bold border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all placeholder:font-normal"
                        />
                        {manualScore !== undefined && (
                          <div className="absolute right-0 top-0 bottom-0 flex items-center pr-2 pointer-events-none">
                            <span className="text-xs font-bold text-slate-400">分</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1">
                      <input
                        type="text"
                        value={teacherFeedback}
                        onChange={(e) => setTeacherFeedback(e.target.value)}
                        placeholder="输入教师评语..."
                        className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950 text-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>

                    <button
                      onClick={handleSave}
                      disabled={!hasChanges}
                      className={`h-[38px] px-4 rounded-lg font-bold text-sm transition-all flex items-center gap-2 shadow-sm shrink-0 ${
                        hasChanges 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white hover:shadow-indigo-200 hover:-translate-y-0.5' 
                        : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 cursor-default'
                      }`}
                    >
                      {hasChanges ? <Save size={16} /> : <CheckCircle size={16} />}
                      {hasChanges ? '保存' : '已存'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Exam Content - Render answers */}
              <ExamAnswerSheet
                exam={exam}
                session={currentSession}
                allQuestions={allQuestions}
                checkAnswer={checkAnswer}
              />
            </div>
          )}
        </div>
      </div>

      {/* Statistics Modal */}
      {showStatistics && (
        <StatisticsModal
          exam={exam}
          classroom={classroom}
          sessions={sessions}
          allQuestions={allQuestions}
          statistics={statistics}
          onClose={() => setShowStatistics(false)}
        />
      )}

      {/* Export Confirm Modal */}
      {showExportModal && (
        <ConfirmModal
          title="导出成绩单"
          message={`确定导出《${exam.title}》在《${classroom.name}》的成绩单吗？`}
          confirmText="导出"
          onConfirm={handleExport}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {/* Return to Redo Confirm Modal */}
      {showRedoConfirm && (
        <ConfirmModal
          title="返回重做"
          message="确定要清空该学生的作答记录吗？学生将可以重新答题。此操作不可撤销。"
          confirmText="确定"
          type="danger"
          onConfirm={handleReturnToRedo}
          onClose={() => setShowRedoConfirm(false)}
        />
      )}
    </div>
  );
};

// Exam Answer Sheet Component
interface ExamAnswerSheetProps {
  exam: ExamPaper;
  session: ExamSession;
  allQuestions: Question[];
  checkAnswer: (q: Question, answer: string) => boolean;
}

const ExamAnswerSheet: React.FC<ExamAnswerSheetProps> = ({ exam, session, allQuestions, checkAnswer }) => {
  const serifFont = 'font-serif';
  const questionClass = 'text-lg md:text-xl';
  const optionClass = 'text-base md:text-lg';
  const passageClass = 'text-base md:text-lg';
  
  // Helper to render cloze-test passage with student answers inline
  const renderClozePassageGrading = (question: Question, startNum: number) => {
    const passage = question.readingPassage || '';
    const parts: (string | JSX.Element)[] = [];
    const spanRegex = /<span\s+data-gap="(\d+)"[^>]*>.*?<\/span>/g;
    let lastIndex = 0;
    let match;

    while ((match = spanRegex.exec(passage)) !== null) {
      if (match.index > lastIndex) {
        parts.push(passage.substring(lastIndex, match.index));
      }

      const gapNum = parseInt(match[1], 10);
      const subQ = question.subQuestions?.[gapNum - 1];

      if (subQ) {
        const userAnswer = session.answers[subQ.id] || '';
        const isCorrect = checkAnswer(subQ, userAnswer);
        const displayNum = startNum + gapNum - 1;
        const correctOpt = subQ.options.find(o => o.id === subQ.correctOptionId);
        const userOpt = subQ.options.find(o => o.id === userAnswer);

        parts.push(
          <span key={`gap-${gapNum}`} className="inline-flex items-center mx-1">
            <span className="font-bold text-[10px] text-slate-400 mr-1">({displayNum})</span>
            <span className={`border-b-2 px-2 py-0.5 font-bold ${
              isCorrect
                ? 'border-emerald-500 bg-emerald-50/40 text-emerald-700 dark:text-emerald-300'
                : 'border-red-500 bg-red-50/40 text-red-700 dark:text-red-300'
            }`}>
              {userOpt?.text || '--'}
            </span>
            {!isCorrect && correctOpt && (
              <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 ml-1 whitespace-nowrap">
                [{correctOpt.text}]
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

    return parts.map((part, idx) => 
      typeof part === 'string' ? <span key={idx} dangerouslySetInnerHTML={{ __html: part }} /> : part
    );
  };

  // Helper to render compound-fill passage with student answers inline
  const renderCompoundFillPassageGrading = (question: Question, startNum: number) => {
    const passage = question.readingPassage || '';
    const parts: (string | JSX.Element)[] = [];
    const spanRegex = /<span\s+data-gap="(\d+)"[^>]*>.*?<\/span>/g;
    let lastIndex = 0;
    let match;

    while ((match = spanRegex.exec(passage)) !== null) {
      if (match.index > lastIndex) {
        parts.push(passage.substring(lastIndex, match.index));
      }

      const gapNum = parseInt(match[1], 10);
      const subQ = question.subQuestions?.[gapNum - 1];

      if (subQ) {
        const userAnswer = session.answers[subQ.id] || '';
        const isCorrect = checkAnswer(subQ, userAnswer);
        const displayNum = startNum + gapNum - 1;
        const correctAns = subQ.options[0]?.text || '';

        parts.push(
          <span key={`gap-${gapNum}`} className="inline-flex items-center mx-1">
            <span className="font-bold text-[10px] text-slate-400 mr-1">({displayNum})</span>
            <span className={`border-b-2 px-2 py-0.5 font-bold min-w-[60px] inline-block text-center ${
              isCorrect
                ? 'border-emerald-500 bg-emerald-50/40 text-emerald-700 dark:text-emerald-300'
                : 'border-red-500 bg-red-50/40 text-red-700 dark:text-red-300'
            }`}>
              {userAnswer || '___'}
            </span>
            {!isCorrect && correctAns && (
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

    return parts.map((part, idx) => 
      typeof part === 'string' ? <span key={idx} dangerouslySetInnerHTML={{ __html: part }} /> : part
    );
  };
  
  return (
    <div className="space-y-6">
      {exam.sections.map((section) => {
        let questionNumber = 0;
        
        return (
          <div key={section.id} className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="mb-4">
              <h3 className={`text-xl font-black text-slate-800 dark:text-white ${serifFont} mb-1`}>
                {section.title}
              </h3>
              {section.instructions && (
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed" 
                   dangerouslySetInnerHTML={{ __html: section.instructions }} />
              )}
            </div>
            
            <div className="space-y-4">
            {section.items.map((item, itemIdx) => {
              if (item.type === 'consigne') {
                return (
                  <div key={itemIdx} className="bg-blue-50 dark:bg-blue-900/10 border-l-2 border-blue-500 pl-3 py-2 mb-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <div className={`text-blue-900 dark:text-blue-200 text-sm ${serifFont}`}
                           dangerouslySetInnerHTML={{ __html: item.consigneText || '' }} />
                    </div>
                  </div>
                );
              }
              
              const question = allQuestions.find(q => q.id === item.questionId);
              if (!question) return null;
              
              // Handle Cloze Test
              if (question.type === 'cloze-test') {
                const startNum = questionNumber + 1;
                const subQs = question.subQuestions || [];
                questionNumber += subQs.length;

                const hasSubExplanations = subQs.some(sq => !!sq.explanation);

                return (
                  <div key={item.questionId} className="mb-6">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded mb-3">
                      <div className={`${passageClass} ${serifFont} leading-normal text-slate-700 dark:text-slate-200`}>
                        {renderClozePassageGrading(question, startNum)}
                      </div>
                    </div>
                    {/* Show answer summary below */}
                    <div className="ml-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {subQs.map((subQ, idx) => {
                        const isCorrect = checkAnswer(subQ, session.answers[subQ.id]);
                        const correctOpt = subQ.options.find(o => o.id === subQ.correctOptionId);
                        const userOpt = subQ.options.find(o => o.id === session.answers[subQ.id]);
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
                          </div>
                        );
                      })}
                    </div>

                    {question.explanation && (
                      <div className="mt-3 p-2 bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-indigo-400 text-sm text-indigo-900 dark:text-indigo-200">
                        <span className="font-bold text-xs">解析：</span>
                        <span className="whitespace-pre-wrap leading-relaxed">{question.explanation}</span>
                      </div>
                    )}

                    {hasSubExplanations && (
                      <div className="mt-3 p-2 bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-indigo-400 text-sm text-indigo-900 dark:text-indigo-200">
                        <span className="font-bold text-xs">解析：</span>
                        <div className="mt-1 space-y-1">
                          {subQs.map((sq, idx) =>
                            sq.explanation ? (
                              <div key={sq.id} className="whitespace-pre-wrap leading-relaxed">
                                <span className="font-bold">({startNum + idx}) </span>
                                {sq.explanation}
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              // Handle Compound Fill
              if (question.type === 'compound-fill') {
                const startNum = questionNumber + 1;
                const subQs = question.subQuestions || [];
                questionNumber += subQs.length;

                const hasSubExplanations = subQs.some(sq => !!sq.explanation);

                return (
                  <div key={item.questionId} className="mb-6">
                    <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded mb-3">
                      <div className={`${passageClass} ${serifFont} leading-normal text-slate-700 dark:text-slate-200`}>
                        {renderCompoundFillPassageGrading(question, startNum)}
                      </div>
                    </div>

                    {question.explanation && (
                      <div className="mt-3 p-2 bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-indigo-400 text-sm text-indigo-900 dark:text-indigo-200">
                        <span className="font-bold text-xs">解析：</span>
                        <span className="whitespace-pre-wrap leading-relaxed">{question.explanation}</span>
                      </div>
                    )}

                    {hasSubExplanations && (
                      <div className="mt-3 p-2 bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-indigo-400 text-sm text-indigo-900 dark:text-indigo-200">
                        <span className="font-bold text-xs">解析：</span>
                        <div className="mt-1 space-y-1">
                          {subQs.map((sq, idx) =>
                            sq.explanation ? (
                              <div key={sq.id} className="whitespace-pre-wrap leading-relaxed">
                                <span className="font-bold">({startNum + idx}) </span>
                                {sq.explanation}
                              </div>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }
              
              const renderSimpleQuestion = (q: Question, qNum: number) => {
                const userAnswer = session.answers[q.id];
                const isCorrect = checkAnswer(q, userAnswer);
                
                return (
                  <div key={q.id} className="mb-4">
                    <div className="flex items-start gap-2">
                      <span className={`font-bold ${questionClass} ${serifFont} min-w-[30px] mt-0.5`}>{qNum}.</span>
                      <div className="flex-1 min-w-0">
                        <div className={`${questionClass} ${serifFont} text-slate-800 dark:text-white mb-3`}
                             dangerouslySetInnerHTML={{ __html: q.text }} />
                        
                        {q.type === 'fill-in-the-blank' ? (
                          <div className="space-y-2">
                            <div className="inline-flex items-center">
                              <span className={`border-b-2 px-3 py-1 font-bold min-w-[100px] inline-block text-center ${
                                isCorrect
                                  ? 'border-emerald-500 bg-emerald-50/40 text-emerald-700 dark:text-emerald-300'
                                  : 'border-red-500 bg-red-50/40 text-red-700 dark:text-red-300'
                              }`}>
                                {userAnswer || '___'}
                              </span>
                              {!isCorrect && q.options[0]?.text && (
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 ml-3">
                                  [{q.options[0].text}]
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (() => {
                          const optionCols = getOptionGridColumns((q.options || []).map(o => o.text));
                          const gridColsClass =
                            optionCols === 4 ? 'grid-cols-2 md:grid-cols-4' :
                            optionCols === 2 ? 'grid-cols-1 md:grid-cols-2' :
                            'grid-cols-1';
                          const hasOptionImages = (q.options || []).some(o => !!o.imageUrl);
                          const isUnanswered = !userAnswer;
                          
                          return (
                            <div className={hasOptionImages ? 'space-y-2' : `grid gap-2 ${gridColsClass}`}>
                              {q.options.map((opt, optIdx) => {
                                const isSelected = userAnswer === opt.id;
                                const isThisCorrect = q.correctOptionId === opt.id;
                                const optionLetter = String.fromCharCode(65 + optIdx);
                                const showWrongWhenUnanswered = isUnanswered && !isThisCorrect;
                                
                                return (
                                  <div key={opt.id} className={hasOptionImages ? 'block' : 'flex items-start gap-2'}>
                                    <div className="flex items-start gap-2">
                                      <span className={`font-bold ${optionClass} ${serifFont} shrink-0 ${
                                        isThisCorrect
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : showWrongWhenUnanswered
                                          ? 'text-red-600 dark:text-red-400'
                                          : isSelected
                                          ? 'text-red-600 dark:text-red-400'
                                          : 'text-slate-700 dark:text-slate-300'
                                      }`}>
                                        {optionLetter}.
                                      </span>
                                      <span className={`${optionClass} ${serifFont} ${
                                        isThisCorrect
                                          ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                                          : showWrongWhenUnanswered
                                          ? 'text-red-700 dark:text-red-300'
                                          : isSelected
                                          ? 'text-red-700 dark:text-red-300'
                                          : 'text-slate-800 dark:text-slate-200'
                                      } ${(optionCols === 4 && !hasOptionImages) ? 'truncate' : 'whitespace-normal break-words'}`}>
                                        {opt.text}
                                      </span>
                                      {isSelected && (
                                        isCorrect ? (
                                          <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                                        ) : (
                                          <XCircle size={18} className="text-red-600 shrink-0" />
                                        )
                                      )}
                                      {isThisCorrect && !isSelected && (
                                        <CheckCircle size={18} className="text-emerald-600 shrink-0" />
                                      )}
                                    </div>
                                    {opt.imageUrl && (
                                      <img
                                        src={opt.imageUrl}
                                        className="mt-1 ml-6 max-w-[200px] h-auto object-contain rounded border border-slate-200 dark:border-slate-700"
                                        alt=""
                                      />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()}
                        
                        {q.explanation && (
                          <div className="mt-3 p-2 bg-indigo-50 dark:bg-indigo-900/10 border-l-2 border-indigo-400 text-sm text-indigo-900 dark:text-indigo-200">
                            <span className="font-bold text-xs">解析：</span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              };
              
              // Handle different question types
              if (question.subQuestions && question.subQuestions.length > 0) {
                // Reading comprehension or compound questions
                return (
                  <div key={item.questionId} className="mb-6">
                    {question.readingPassage && (
                      <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className={`${optionClass} ${serifFont} text-slate-700 dark:text-slate-300 leading-relaxed`}
                             dangerouslySetInnerHTML={{ __html: question.readingPassage }} />
                      </div>
                    )}
                    <div className="space-y-4">
                      {question.subQuestions.map((subQ) => {
                        const qNum = ++questionNumber;
                        return renderSimpleQuestion(subQ, qNum);
                      })}
                    </div>
                    {question.explanation && (
                      <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/10 border-l-4 border-indigo-400 text-sm text-indigo-900 dark:text-indigo-200 rounded-r-lg">
                        <span className="font-bold text-xs block mb-1">【试题解析】</span>
                        <div className="leading-relaxed whitespace-pre-wrap">{question.explanation}</div>
                      </div>
                    )}
                  </div>
                );
              } else {
                // Simple question
                const qNum = ++questionNumber;
                return renderSimpleQuestion(question, qNum);
              }
            })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Statistics Modal Component
interface StatisticsModalProps {
  exam: ExamPaper;
  classroom: Classroom;
  sessions: ExamSession[];
  allQuestions: Question[];
  statistics: any;
  onClose: () => void;
}

const StatisticsModal: React.FC<StatisticsModalProps> = ({ 
  exam, 
  classroom, 
  sessions, 
  allQuestions,
  statistics, 
  onClose 
}) => {
  // Calculate question-level statistics
  const questionStats = useMemo(() => {
    const stats: Record<string, { correct: number; total: number; rate: number }> = {};
    
    sessions.forEach(session => {
      if (!session.isSubmitted) return;
      
      Object.entries(session.answers).forEach(([questionId, answer]) => {
        if (!stats[questionId]) {
          stats[questionId] = { correct: 0, total: 0, rate: 0 };
        }
        
        const question = allQuestions.find(q => q.id === questionId);
        if (!question) return;
        
        stats[questionId].total++;
        
        const isCorrect = question.type === 'fill-in-the-blank'
          ? answer.trim().toLowerCase() === (question.options[0]?.text || '').trim().toLowerCase()
          : answer === question.correctOptionId;
        
        if (isCorrect) {
          stats[questionId].correct++;
        }
      });
    });
    
    // Calculate rates
    Object.keys(stats).forEach(qid => {
      stats[qid].rate = stats[qid].total > 0 ? (stats[qid].correct / stats[qid].total) * 100 : 0;
    });
    
    return stats;
  }, [sessions, allQuestions]);
  
  // Find hardest questions (lowest correct rate)
  const hardestQuestions = useMemo(() => {
    return Object.entries(questionStats)
      .map(([qid, stat]) => ({ questionId: qid, ...stat }))
      .filter(q => q.total > 0)
      .sort((a, b) => a.rate - b.rate)
      .slice(0, 5);
  }, [questionStats]);
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border dark:border-slate-800 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <BarChart3 size={24} />
                统计分析
              </h3>
              <p className="text-sm text-slate-500 mt-1">{exam.title} · {classroom.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <XCircle size={20} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overall Statistics */}
          <div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-3">整体统计</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">提交率</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white">
                  {statistics.submissionRate.toFixed(1)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {statistics.submittedCount}/{statistics.totalStudents}
                </div>
              </div>
              
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4">
                <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">平均分</div>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                  {statistics.avgScore.toFixed(1)}
                </div>
              </div>
              
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">最高分</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {statistics.maxScore}
                </div>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">最低分</div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
                  {statistics.minScore}
                </div>
              </div>
            </div>
          </div>
          
          {/* Hardest Questions */}
          <div>
            <h4 className="text-lg font-bold text-slate-800 dark:text-white mb-3">错题分析 (正确率最低)</h4>
            {hardestQuestions.length === 0 ? (
              <div className="text-center py-8 text-slate-400">暂无数据</div>
            ) : (
              <div className="space-y-2">
                {hardestQuestions.map((item, idx) => {
                  const question = allQuestions.find(q => q.id === item.questionId);
                  return (
                    <div key={item.questionId} className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 truncate">
                            {question?.text?.replace(/<[^>]*>/g, '').substring(0, 60)}...
                          </div>
                          <div className="text-xs text-slate-500">
                            正确 {item.correct}/{item.total} 人
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-2xl font-black ${
                            item.rate < 30 ? 'text-red-600' : item.rate < 60 ? 'text-amber-600' : 'text-slate-600'
                          }`}>
                            {item.rate.toFixed(0)}%
                          </div>
                          <div className="text-xs text-slate-500">正确率</div>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            item.rate < 30 ? 'bg-red-500' : item.rate < 60 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${item.rate}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white rounded-xl font-bold transition-all"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

// Confirm Modal Component
interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText: string;
  type?: 'info' | 'danger';
  onConfirm: () => void;
  onClose: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
  title, 
  message, 
  confirmText, 
  type = 'info',
  onConfirm, 
  onClose 
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border dark:border-slate-800">
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${
            type === 'danger' 
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600' 
              : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'
          }`}>
            {type === 'danger' ? <AlertCircle size={32} /> : <FileText size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t dark:border-slate-800">
          <button 
            onClick={onClose}
            className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            取消
          </button>
          <button 
            onClick={() => { onConfirm(); onClose(); }}
            className={`flex-[1.5] py-3 text-sm font-black text-white rounded-xl transition-all active:scale-95 ${
              type === 'danger'
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamGradingManager;
