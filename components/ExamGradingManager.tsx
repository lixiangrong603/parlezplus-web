import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ChevronLeft, User, CheckCircle, XCircle, Clock, AlertCircle,
  Save, BarChart3, Download, RotateCcw, Edit3, Star, BookOpen, FileText, ChevronDown, ChevronUp
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { getOptionGridColumns } from '../utils/optionLayout';
import { stripGapBackgroundHighlight } from '../utils/gapHtml';
import { getInitials, getColorFromString } from '../utils/mediaUtils';
import { ExamSession, ExamPaper, Classroom, Question, MediaResource, ExamSection, ExamItem, User as UserType, SyllabusCourse } from '../types';
import {
  getExamPaperById,
  getClassroomById,
  getExamSessionsByExamAndClass,
  updateExamSession,
  deleteExamSessionsByExam,
  getQuestionsWithResourceInfo,
  getResources,
  getSyllabusCourses,
  getUserById
} from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import ExamStatisticsAnalysis from './ExamStatisticsAnalysis';

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
  
  // Load syllabuses for knowledge points
  const syllabuses = useMemo(() => getSyllabusCourses(), []);

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
  const [showOnlyIncorrect, setShowOnlyIncorrect] = useState(false);
  const [redoReason, setRedoReason] = useState(''); // 打回原因
  
  // Load initial data
  useEffect(() => {
    const examData = getExamPaperById(examId);
    if (examData) setExam(examData);
    
    const classData = getClassroomById(classId);
    if (classData) setClassroom(classData);
    
    loadSessions();
  }, [examId, classId]);

  // Refresh classroom data when storage is updated (e.g., student avatar changed)
  useEffect(() => {
    const handleDataChanged = () => {
      const classData = getClassroomById(classId);
      if (classData) setClassroom(classData);
    };
    window.addEventListener('parlezplus:data-changed', handleDataChanged as EventListener);
    return () => window.removeEventListener('parlezplus:data-changed', handleDataChanged as EventListener);
  }, [classId]);

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

    const allResources = await getResources();
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
      const userAvatar = student.userId ? getUserById(student.userId)?.avatar : undefined;
      return {
        ...student,
        avatar: userAvatar || student.avatar,
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

  // Export grades with detailed information
  const handleExport = async () => {
    if (!exam || !classroom) return;
    
    // === Sheet 1: 学生信息表 ===
    const studentInfoData: any[][] = [];
    studentInfoData.push(['学号', '姓名', '提交时间', '用时(分钟)', '系统评分', '最终得分', '教师评语']);
    
    studentList.forEach(student => {
      const session = student.session;
      
      if (!session || !session.isSubmitted) {
        studentInfoData.push([
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
        const systemScore = session.score ?? 0;
        const manualScore = session.manualScore ?? '';
        const teacherFeedback = session.teacherFeedback || '';
        
        studentInfoData.push([
          student.id,
          student.name,
          submitTime,
          elapsedMin,
          systemScore,
          manualScore === '' ? '' : manualScore,
          teacherFeedback
        ]);
      }
    });
    
    // === Sheet 2: 答题得分表 ===
    const scoreData: any[][] = [];
    
    // Build question header row
    const questionHeaders: any[] = ['学生姓名'];
    
    interface QuestionMeta {
      sectionIdx: number;
      sectionTitle: string;
      questionNumber: number;
      item: ExamItem;
      question: Question;
      subQuestionIndex?: number;
    }
    
    const questionMetaList: QuestionMeta[] = [];
    const sectionEndIndices: number[] = [];
    
    exam.sections.forEach((section, sectionIdx) => {
      let questionNumber = 0;
      
      section.items.forEach((item) => {
        if (item.type === 'consigne') return;
        
        const question = allQuestions.find(q => q.id === item.questionId);
        if (!question) return;
        
        if (question.type === 'cloze-test' || question.type === 'compound-fill') {
          const subQs = question.subQuestions || [];
          subQs.forEach((sq, subIdx) => {
            questionNumber++;
            questionMetaList.push({
              sectionIdx,
              sectionTitle: section.title,
              questionNumber,
              item,
              question: sq,
              subQuestionIndex: subIdx
            });
            questionHeaders.push(`${section.title}-${questionNumber}`);
          });
        } else if (question.subQuestions && question.subQuestions.length > 0) {
          question.subQuestions.forEach((sq, subIdx) => {
            questionNumber++;
            questionMetaList.push({
              sectionIdx,
              sectionTitle: section.title,
              questionNumber,
              item,
              question: sq,
              subQuestionIndex: subIdx
            });
            questionHeaders.push(`${section.title}-${questionNumber}`);
          });
        } else {
          questionNumber++;
          questionMetaList.push({
            sectionIdx,
            sectionTitle: section.title,
            questionNumber,
            item,
            question
          });
          questionHeaders.push(`${section.title}-${questionNumber}`);
        }
      });
      
      sectionEndIndices.push(questionMetaList.length - 1);
      questionHeaders.push(`${section.title}-总分`);
    });
    
    questionHeaders.push('最终得分');
    scoreData.push(questionHeaders);
    
    // Build score rows
    const submittedStudents = studentList.filter(s => s.session?.isSubmitted);
    const questionCorrectCounts: number[] = new Array(questionMetaList.length).fill(0);
    const sectionTotalScores: number[][] = [];
    const finalScores: number[] = [];
    
    studentList.forEach((student) => {
      const session = student.session;
      const scoreRow: any[] = [student.name];
      
      if (!session || !session.isSubmitted) {
        questionMetaList.forEach(() => scoreRow.push('-'));
        exam.sections.forEach(() => scoreRow.push('-'));
        scoreRow.push('-');
        finalScores.push(0);
        sectionTotalScores.push(new Array(exam.sections.length).fill(0));
      } else {
        const studentSectionTotals: number[] = new Array(exam.sections.length).fill(0);
        
        questionMetaList.forEach((meta, qIdx) => {
          const { item, question, subQuestionIndex, sectionIdx } = meta;
          
          const isCorrect = checkAnswer(question, session.answers[question.id]);
          let points = 0;
          
          if (subQuestionIndex !== undefined) {
            points = item.subPoints?.[subQuestionIndex] ?? 1;
          } else {
            points = item.points || 1;
          }
          
          const earned = isCorrect ? points : 0;
          studentSectionTotals[sectionIdx] += earned;
          
          if (isCorrect) {
            questionCorrectCounts[qIdx]++;
          }
          
          scoreRow.push(earned);
          
          if (sectionEndIndices.includes(qIdx)) {
            scoreRow.push(studentSectionTotals[sectionIdx]);
          }
        });
        
        sectionTotalScores.push(studentSectionTotals);
        
        const finalScore = session.manualScore ?? session.score ?? 0;
        finalScores.push(finalScore);
        scoreRow.push(finalScore);
      }
      
      scoreData.push(scoreRow);
    });
    
    // Add statistics row
    const statsRow: any[] = ['正确率/平均分'];
    const submittedCount = submittedStudents.length || 1;
    
    questionMetaList.forEach((meta, qIdx) => {
      const { sectionIdx } = meta;
      
      const correctRate = (questionCorrectCounts[qIdx] / submittedCount * 100).toFixed(1) + '%';
      statsRow.push(correctRate);
      
      if (sectionEndIndices.includes(qIdx)) {
        const sectionAvg = sectionTotalScores
          .filter((_, idx) => studentList[idx].session?.isSubmitted)
          .reduce((sum, studentSections) => sum + (studentSections[sectionIdx] || 0), 0) / submittedCount;
        statsRow.push(parseFloat(sectionAvg.toFixed(1)));
      }
    });
    
    const finalScoreAvg = finalScores
      .filter((_, idx) => studentList[idx].session?.isSubmitted)
      .reduce((sum, score) => sum + score, 0) / submittedCount;
    statsRow.push(parseFloat(finalScoreAvg.toFixed(1)));
    
    scoreData.push(statsRow);
    
    // Create Excel workbook with ExcelJS
    const workbook = new ExcelJS.Workbook();
    
    // === Sheet 1: 学生信息表 ===
    const ws1 = workbook.addWorksheet('学生信息表');
    
    // Set column widths for Sheet 1
    ws1.columns = [
      { width: 12 },  // 学号
      { width: 10 },  // 姓名
      { width: 20 },  // 提交时间
      { width: 12 },  // 用时
      { width: 10 },  // 系统评分
      { width: 10 },  // 最终得分
      { width: 30 }   // 教师评语
    ];
    
    // Add data to Sheet 1
    studentInfoData.forEach((row, rowIdx) => {
      const excelRow = ws1.addRow(row);
      
      // Style header row
      if (rowIdx === 0) {
        excelRow.eachCell((cell) => {
          cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        });
      } else {
        // Style data cells
        excelRow.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
          };
          
          // Highlight unsubmitted rows
          if (row[2] === '未提交') {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
          }
        });
      }
    });
    
    // Freeze first row for Sheet 1
    ws1.views = [{ state: 'frozen', ySplit: 1 }];
    
    // === Sheet 2: 答题得分表 ===
    const ws2 = workbook.addWorksheet('答题得分表');
    
    // Set column widths for Sheet 2 - auto width
    ws2.columns = questionHeaders.map((header, idx) => ({
      width: idx === 0 ? 12 : (header.includes('-总分') || header === '最终得分' ? 10 : 8)
    }));
    
    // Add data to Sheet 2
    scoreData.forEach((row, rowIdx) => {
      const excelRow = ws2.addRow(row);
      
      // Style header row
      if (rowIdx === 0) {
        excelRow.eachCell((cell) => {
          cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
          cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        });
      } else if (rowIdx === scoreData.length - 1) {
        // Style statistics row (last row)
        excelRow.eachCell((cell, colNumber) => {
          cell.font = { bold: true, size: 11 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'medium', color: { argb: 'FF000000' } },
            bottom: { style: 'medium', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          
          // Light blue background for section total and final score columns
          const header = questionHeaders[colNumber - 1];
          if (colNumber > 1 && header && (header.includes('-总分') || header === '最终得分')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F5' } };
          }
        });
      } else {
        // Style data cells
        excelRow.eachCell((cell, colNumber) => {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
            right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
          };
          
          // Highlight section total and final score columns with light blue
          const header = questionHeaders[colNumber - 1];
          if (colNumber > 1 && header && (header.includes('-总分') || header === '最终得分')) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F5' } };
            cell.font = { bold: true };
          }
        });
      }
    });
    
    // Freeze first row for Sheet 2
    ws2.views = [{ state: 'frozen', xSplit: 1, ySplit: 1 }];
    
    // Export Excel file
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exam.title}_${classroom.name}_成绩单_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    
    setShowExportModal(false);
  };

  // Return to redo
  const handleReturnToRedo = () => {
    if (!selectedStudentId) return;
    
    const currentUser = exam?.teacherId;
    deleteExamSessionsByExam(examId, [selectedStudentId], currentUser, redoReason || '教师要求重做');
    loadSessions();
    setSelectedStudentId(null);
    setShowRedoConfirm(false);
    setRedoReason(''); // 清空原因
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
    <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col" style={{ zoom: '0.9' }}>
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
          <div className="flex-1 overflow-y-auto no-scrollbar">
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
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {student.avatar ? (
                      <img src={student.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <div 
                        className="w-full h-full rounded-full flex items-center justify-center"
                        style={{ backgroundColor: getColorFromString(student.userId || student.name) }}
                      >
                        {getInitials(student.name)}
                      </div>
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
        <div className="flex-1 overflow-y-auto no-scrollbar">
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
                    <button
                      onClick={() => setShowOnlyIncorrect(!showOnlyIncorrect)}
                      className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap ${
                        showOnlyIncorrect
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                          : 'bg-white text-slate-600 dark:bg-slate-950 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      只看错题
                    </button>
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
                resourcesMap={resourcesMap}
                questionResourceMap={questionResourceMap}
                syllabuses={syllabuses}
                checkAnswer={checkAnswer}
                showOnlyIncorrect={showOnlyIncorrect}
              />
            </div>
          )}
        </div>
      </div>

      {/* Statistics Modal */}
      {showStatistics && (
        <ExamStatisticsAnalysis
          exam={exam}
          sessions={sessions}
          allQuestions={allQuestions}
          questionResourceMap={questionResourceMap}
          resourcesMap={resourcesMap}
          students={studentList}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">返回重做</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                确定要打回该学生的考试，让其重新作答吗？
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                原记录将被标记为已删除（可在系统中查看历史），操作将被记录到审计日志。
              </p>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  打回原因（必填）
                </label>
                <textarea
                  value={redoReason}
                  onChange={(e) => setRedoReason(e.target.value)}
                  placeholder="请说明打回的原因，例如：系统故障、作弊嫌疑、学生申请等..."
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-slate-800 dark:text-white resize-none"
                  rows={3}
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRedoConfirm(false);
                  setRedoReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              >
                取消
              </button>
              <button
                onClick={handleReturnToRedo}
                disabled={!redoReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition"
              >
                确认打回
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Exam Answer Sheet Component
interface ExamAnswerSheetProps {
  exam: ExamPaper;
  session: ExamSession;
  allQuestions: Question[];
  resourcesMap: Record<string, MediaResource>;
  questionResourceMap: Record<string, string>;
  syllabuses: SyllabusCourse[];
  checkAnswer: (q: Question, answer: string) => boolean;
  showOnlyIncorrect: boolean;
}

const ExamAnswerSheet: React.FC<ExamAnswerSheetProps> = ({ 
  exam, 
  session, 
  allQuestions, 
  resourcesMap,
  questionResourceMap,
  syllabuses,
  checkAnswer, 
  showOnlyIncorrect 
}) => {
  const serifFont = 'font-serif';
  const questionClass = 'text-lg md:text-xl';
  const optionClass = 'text-base md:text-lg';
  const passageClass = 'text-base md:text-lg';
  
  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  
  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };
  
  // Helper to determine if a question (or any part of it) is incorrect
  const isQuestionIncorrect = (q: Question): boolean => {
    if (q.subQuestions && q.subQuestions.length > 0) {
      return q.subQuestions.some(sq => !checkAnswer(sq, session.answers[sq.id]));
    }
    return !checkAnswer(q, session.answers[q.id]);
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
  
  // Helper to render cloze-test passage with student answers inline
  const renderClozePassageGrading = (question: Question, startNum: number) => {
    const passage = stripGapBackgroundHighlight(question.readingPassage || '');
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
    const passage = stripGapBackgroundHighlight(question.readingPassage || '');
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
  
  // Calculate section score
  const calculateSectionScore = (section: ExamSection): { earned: number; total: number } => {
    let earned = 0;
    let total = 0;
    
    section.items.forEach(item => {
      if (item.type === 'consigne') return;
      
      const question = allQuestions.find(q => q.id === item.questionId);
      if (!question) return;
      
      const points = item.points || 1;
      
      if (question.type === 'cloze-test' || question.type === 'compound-fill') {
        const subQs = question.subQuestions || [];
        subQs.forEach((sq, idx) => {
          const subPoints = item.subPoints?.[idx] ?? 1;
          total += subPoints;
          if (checkAnswer(sq, session.answers[sq.id])) {
            earned += subPoints;
          }
        });
      } else if (question.subQuestions && question.subQuestions.length > 0) {
        question.subQuestions.forEach((sq, idx) => {
          const subPoints = item.subPoints?.[idx] ?? 1;
          total += subPoints;
          if (checkAnswer(sq, session.answers[sq.id])) {
            earned += subPoints;
          }
        });
      } else {
        total += points;
        if (checkAnswer(question, session.answers[question.id])) {
          earned += points;
        }
      }
    });
    
    return { earned, total };
  };
  
  return (
    <div className="space-y-6">
      {exam.sections.map((section) => {
        let questionNumber = 0;
        const sectionScore = calculateSectionScore(section);
        const isCollapsed = collapsedSections.has(section.id);
        
        return (
          <div key={section.id} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <button
              onClick={() => toggleSection(section.id)}
              className="w-full p-6 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            >
              <div className="flex-1 text-left">
                <div className="flex items-center gap-3">
                  <h3 className={`text-xl font-black text-slate-800 dark:text-white ${serifFont}`}>
                    {section.title}
                  </h3>
                  <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700 rounded-lg px-3 py-1">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">得分</span>
                    <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                      {sectionScore.earned}/{sectionScore.total}
                    </span>
                  </div>
                </div>
                {section.instructions && !isCollapsed && (
                  <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed mt-2" 
                     dangerouslySetInnerHTML={{ __html: section.instructions }} />
                )}
              </div>
              <div className="ml-4 text-slate-400 dark:text-slate-500">
                {isCollapsed ? <ChevronDown size={24} /> : <ChevronUp size={24} />}
              </div>
            </button>
            
            {!isCollapsed && (
              <div className="px-6 pb-6">
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

                if (showOnlyIncorrect && !isQuestionIncorrect(question)) return null;

                const hasSubExplanations = subQs.some(sq => !!sq.explanation);

                return (
                  <div key={item.questionId} className="mb-6">
                    {renderQuestionTags(question)}
                    <div className="flex items-start gap-2">
                      <span className={`font-bold ${questionClass} ${serifFont} min-w-[30px] mt-0.5`}>{startNum}.</span>
                      <div className="flex-1 min-w-0">
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
                    </div>
                  </div>
                );
              }

              // Handle Compound Fill
              if (question.type === 'compound-fill') {
                const startNum = questionNumber + 1;
                const subQs = question.subQuestions || [];
                questionNumber += subQs.length;

                if (showOnlyIncorrect && !isQuestionIncorrect(question)) return null;

                const hasSubExplanations = subQs.some(sq => !!sq.explanation);

                return (
                  <div key={item.questionId} className="mb-6">
                    {renderQuestionTags(question)}
                    <div className="flex items-start gap-2">
                      <span className={`font-bold ${questionClass} ${serifFont} min-w-[30px] mt-0.5`}>{startNum}.</span>
                      <div className="flex-1 min-w-0">
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
                    </div>
                  </div>
                );
              }
              
              const renderSimpleQuestion = (q: Question, qNum: number) => {
                const userAnswer = session.answers[q.id];
                const isCorrect = checkAnswer(q, userAnswer);
                
                return (
                  <div key={q.id} className="mb-4">
                    {renderQuestionTags(q)}
                    <div className="flex items-start gap-2">
                      <span className={`font-bold ${questionClass} ${serifFont} min-w-[30px] mt-0.5`}>{qNum}.</span>
                      <div className="flex-1 min-w-0">
                        <div className={`${questionClass} ${serifFont} text-slate-800 dark:text-white mb-3`}
                             dangerouslySetInnerHTML={{ __html: q.text }} />

                        {q.imageUrl && (
                          <div className="mb-3">
                            <img 
                              src={q.imageUrl} 
                              alt="Question Image" 
                              className="max-w-full h-auto max-h-[300px] rounded-lg border border-slate-200 dark:border-slate-700 object-contain"
                            />
                          </div>
                        )}
                        
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
                          
                          // Use grid layout even for images to display them in rows
                          const finalGridClass = hasOptionImages 
                             ? (optionCols >= 2 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4' : 'grid-cols-1 md:grid-cols-2') 
                             : gridColsClass;
                          
                          return (
                            <div className={`grid gap-2 ${finalGridClass}`}>
                              {q.options.map((opt, optIdx) => {
                                const isSelected = userAnswer === opt.id;
                                const isThisCorrect = q.correctOptionId === opt.id;
                                const optionLetter = String.fromCharCode(65 + optIdx);
                                const showWrongWhenUnanswered = isUnanswered && !isThisCorrect;
                                
                                return (
                                  <div key={opt.id} className={`flex items-start gap-2 ${hasOptionImages ? 'flex-col sm:flex-row' : ''}`}>
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
                                        className="mt-1 sm:ml-2 max-w-[200px] h-auto object-contain rounded border border-slate-200 dark:border-slate-700"
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
                if (showOnlyIncorrect && !isQuestionIncorrect(question)) {
                   questionNumber += question.subQuestions.length;
                   return null;
                }

                return (
                  <div key={item.questionId} className="mb-6">
                    {renderQuestionTags(question)}
                    {question.readingPassage && (
                      <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div
                          className={`${optionClass} ${serifFont} text-slate-700 dark:text-slate-300 leading-relaxed`}
                          dangerouslySetInnerHTML={{ __html: stripGapBackgroundHighlight(question.readingPassage) }}
                        />
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
                if (showOnlyIncorrect && !isQuestionIncorrect(question)) return null;
                return renderSimpleQuestion(question, qNum);
              }
            })}
                </div>
              </div>
            )}
          </div>
        );
      })}
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
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
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
        <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
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
