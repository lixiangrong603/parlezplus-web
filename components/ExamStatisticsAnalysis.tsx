import React, { useState, useMemo, useContext } from 'react';
import {
  X, ChevronDown, ChevronUp, CheckCircle, XCircle, ChevronLeft, ChevronRight, BarChart3,
  BookOpen, Tag, Star, TrendingDown, User, ArrowUpDown, Sun, Moon, FileText
} from 'lucide-react';
import { ThemeContext } from '../App';
import { ExamPaper, ExamSession, Question, MediaResource, User as UserType, SyllabusCourse } from '../types';
import { getSyllabusCoursesSync } from '../utils/storage';
import { getOptionGridColumns } from '../utils/optionLayout';
import { stripGapBackgroundHighlight } from '../utils/gapHtml';

interface ExamStatisticsAnalysisProps {
  exam: ExamPaper;
  sessions: ExamSession[];
  allQuestions: Question[];
  questionResourceMap: Record<string, string>;
  resourcesMap: Record<string, MediaResource>;
  students: Array<{ userId?: string; name: string; id: string }>;
  onClose: () => void;
}

interface QuestionStatistic {
  questionId: string;
  question: Question;
  parentQuestion?: Question; // 父题目（用于复杂题型）
  subQuestionIndex?: number; // 子题目在父题中的索引
  sectionName: string; // Section 名称
  questionNumber: number; // 在 Section 内的题号
  resourceId?: string;
  resource?: MediaResource;
  correctCount: number;
  totalCount: number;
  errorRate: number;
  correctStudents: Array<{ userId: string; name: string }>;
  incorrectStudents: Array<{ userId: string; name: string; answer: string }>;
}

const ExamStatisticsAnalysis: React.FC<ExamStatisticsAnalysisProps> = ({
  exam,
  sessions,
  allQuestions,
  questionResourceMap,
  resourcesMap,
  students,
  onClose
}) => {
  const [sortBy, setSortBy] = useState<'errorRate' | 'order'>('order');
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionStatistic | null>(null);
  const [showCorrectStudents, setShowCorrectStudents] = useState(false);
  const [showIncorrectStudents, setShowIncorrectStudents] = useState(false);
  const [showTopStats, setShowTopStats] = useState(false);
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [textSize, setTextSize] = useState<'base' | 'lg' | 'xl'>('base');
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  
  // Load syllabuses for knowledge points
  const syllabuses = useMemo(() => getSyllabusCoursesSync(), []);
  
  // Get text size classes
  const textSizeClasses = useMemo(() => {
    if (textSize === 'xl') return { text: 'text-xl', option: 'text-lg', passage: 'text-xl' };
    if (textSize === 'lg') return { text: 'text-lg', option: 'text-base', passage: 'text-lg' };
    return { text: 'text-base', option: 'text-sm', passage: 'text-base' };
  }, [textSize]);
  
  // Get knowledge point names by IDs
  const getKnowledgePointNames = (pointIds?: string[]): string[] => {
    if (!pointIds || pointIds.length === 0) return [];
    
    const names: string[] = [];
    (syllabuses || []).forEach(syllabus => {
      (syllabus.units || []).forEach(unit => {
        (unit.knowledgePoints || []).forEach(kp => {
          if (pointIds.includes(kp.id)) {
            names.push(kp.name);
          }
        });
      });
    });
    return names;
  };
  
  // Calculate statistics for each question
  const questionStatistics = useMemo(() => {
    const stats: QuestionStatistic[] = [];
    const submittedSessions = sessions.filter(s => s.isSubmitted);
    
    // Helper function to check if an answer is correct
    const checkAnswer = (q: Question, userAnswer: string): boolean => {
      if (!userAnswer) return false;
      if (q.type === 'fill-in-the-blank' || q.type === 'compound-fill') {
        const correctText = q.options[0]?.text || '';
        return userAnswer.trim().toLowerCase() === correctText.trim().toLowerCase();
      }
      return userAnswer === q.correctOptionId;
    };
    
    // Get all questions from exam (including sub-questions with parent info)
    const allExamQuestions: Array<{ 
      question: Question; 
      parent?: Question; 
      subIndex?: number;
      sectionName: string;
      questionNumber: number;
    }> = [];
    
    exam.sections.forEach(section => {
      let questionNumber = 0;
      
      section.items.forEach(item => {
        if (item.type !== 'consigne' && item.questionId) {
          const question = allQuestions.find(q => q.id === item.questionId);
          if (question) {
            if (question.subQuestions && question.subQuestions.length > 0) {
              // 复杂题型：记录父题目和子题目索引
              question.subQuestions.forEach((subQ, idx) => {
                questionNumber++;
                allExamQuestions.push({ 
                  question: subQ, 
                  parent: question, 
                  subIndex: idx,
                  sectionName: section.title,
                  questionNumber
                });
              });
            } else {
              questionNumber++;
              allExamQuestions.push({ 
                question, 
                parent: undefined, 
                subIndex: undefined,
                sectionName: section.title,
                questionNumber
              });
            }
          }
        }
      });
    });
    
    // Calculate stats for each question
    allExamQuestions.forEach(({ question, parent, subIndex, sectionName, questionNumber }) => {
      let correctCount = 0;
      let totalCount = 0;
      const correctStudents: Array<{ userId: string; name: string }> = [];
      const incorrectStudents: Array<{ userId: string; name: string; answer: string }> = [];
      
      submittedSessions.forEach(session => {
        const student = students.find(s => s.userId === session.studentId);
        // 每个已提交的学生都计入总人数（即使没答该题）
        totalCount++;

        const hasAnswer = Object.prototype.hasOwnProperty.call(session.answers || {}, question.id);
        if (!hasAnswer) {
          // 未作答视为错误，记录为“未作答”
          if (student) {
            incorrectStudents.push({ userId: session.studentId, name: student.name, answer: '未作答' });
          }
        } else {
          const userAnswer = session.answers[question.id];
          const isCorrect = checkAnswer(question, userAnswer);

          if (isCorrect) {
            correctCount++;
            if (student) {
              correctStudents.push({ userId: session.studentId, name: student.name });
            }
          } else {
            if (student) {
              // 保持原始答案ID，不要在这里转换
              incorrectStudents.push({ userId: session.studentId, name: student.name, answer: userAnswer });
            }
          }
        }
      });
      
      if (totalCount > 0) {
        const errorRate = ((totalCount - correctCount) / totalCount) * 100;
        
        // Find resource for this question
        const resourceId = questionResourceMap[question.id];
        const resource = resourceId ? resourcesMap[resourceId] : undefined;
        
        stats.push({
          questionId: question.id,
          question,
          parentQuestion: parent,
          subQuestionIndex: subIndex,
          sectionName,
          questionNumber,
          resourceId,
          resource,
          correctCount,
          totalCount,
          errorRate,
          correctStudents,
          incorrectStudents
        });
      }
    });
    
    return stats;
  }, [exam, sessions, allQuestions, students, questionResourceMap, resourcesMap]);
  
  // Sort statistics
  const sortedStatistics = useMemo(() => {
    if (sortBy === 'errorRate') {
      return [...questionStatistics].sort((a, b) => b.errorRate - a.errorRate);
    }
    return questionStatistics;
  }, [questionStatistics, sortBy]);
  
  // Overall statistics
  const overallStats = useMemo(() => {
    const totalQuestions = questionStatistics.length;
    const avgErrorRate = totalQuestions > 0
      ? questionStatistics.reduce((sum, stat) => sum + stat.errorRate, 0) / totalQuestions
      : 0;
    
    const highErrorCount = questionStatistics.filter(s => s.errorRate > 50).length;
    const mediumErrorCount = questionStatistics.filter(s => s.errorRate > 30 && s.errorRate <= 50).length;
    const lowErrorCount = questionStatistics.filter(s => s.errorRate <= 30).length;
    
    return {
      totalQuestions,
      avgErrorRate,
      highErrorCount,
      mediumErrorCount,
      lowErrorCount
    };
  }, [questionStatistics]);
  
  return (
    <>
      {/* Hide scrollbar globally for this component */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
      
      <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/60 backdrop-blur-sm font-serif">
        <div className="bg-white dark:bg-slate-900 w-full h-full max-w-full rounded-none shadow-2xl overflow-hidden border-0 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                <TrendingDown size={28} />
                统计分析
              </h3>
              <p className="text-sm text-slate-500 mt-1">{exam.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowTopStats(!showTopStats)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  showTopStats 
                    ? 'bg-indigo-600 text-white shadow-lg' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <BarChart3 size={18} />
                统计概览
              </button>
              <button
                onClick={toggleTheme}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title={isDarkMode ? '切换到浅色模式' : '切换到深色模式'}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
          </div>
          
          {/* Overall Stats Cards */}
          {showTopStats && (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3 animate-slide-down">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">总题数</div>
                <div className="text-2xl font-black text-slate-800 dark:text-white">
                  {overallStats.totalQuestions}
                </div>
              </div>
              
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3">
                <div className="text-xs text-indigo-600 dark:text-indigo-400 mb-1">平均错误率</div>
                <div className="text-2xl font-black text-indigo-700 dark:text-indigo-300">
                  {overallStats.avgErrorRate.toFixed(1)}%
                </div>
              </div>
              
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3">
                <div className="text-xs text-red-600 dark:text-red-400 mb-1">高错误率 (&gt;50%)</div>
                <div className="text-2xl font-black text-red-700 dark:text-red-300">
                  {overallStats.highErrorCount}
                </div>
              </div>
              
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">中错误率 (30-50%)</div>
                <div className="text-2xl font-black text-amber-700 dark:text-amber-300">
                  {overallStats.mediumErrorCount}
                </div>
              </div>
              
              <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-3">
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">低错误率 (≤30%)</div>
                <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300">
                  {overallStats.lowErrorCount}
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-hidden flex relative">
          {/* Collapsed List Indicator/Button */}
          {isListCollapsed && (
            <button
              onClick={() => setIsListCollapsed(false)}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-6 h-24 bg-white dark:bg-slate-800 border-y border-r border-slate-200 dark:border-slate-700 rounded-r-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all"
              title="展开列表"
            >
              <ChevronRight size={18} />
            </button>
          )}

          {/* Question List */}
          <div className={`shrink-0 overflow-y-auto border-r border-slate-200 dark:border-slate-700 hide-scrollbar transition-all duration-300 ease-in-out ${isListCollapsed ? 'w-0 opacity-0 invisible' : 'w-[480px] opacity-100 visible'}`}>
            <div className="p-4">
              {/* Sort Controls */}
              <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-bold text-slate-700 dark:text-slate-300">
                  题目列表 ({sortedStatistics.length})
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSortBy(sortBy === 'errorRate' ? 'order' : 'errorRate')}
                    className="px-3 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors flex items-center gap-1.5"
                  >
                    <ArrowUpDown size={14} />
                    {sortBy === 'errorRate' ? '按错误率排序' : '按题号排序'}
                  </button>
                  <button
                    onClick={() => setIsListCollapsed(true)}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 group"
                    title="收起列表"
                  >
                    <ChevronLeft size={20} className="group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                  </button>
                </div>
              </div>
              
              {/* Question Items */}
              <div className="space-y-1.5">
                {sortedStatistics.map((stat, index) => {
                  const isSelected = selectedQuestion?.questionId === stat.questionId;
                  const errorRateColor = 
                    stat.errorRate > 50 ? 'text-red-600 dark:text-red-400' :
                    stat.errorRate > 30 ? 'text-amber-600 dark:text-amber-400' :
                    'text-emerald-600 dark:text-emerald-400';
                  
                  // Get tags to display - 复杂题型从父题获取难度和知识点
                  const displayQuestion = stat.parentQuestion || stat.question;
                  const knowledgePoints = displayQuestion.knowledgePointIds 
                    ? getKnowledgePointNames(displayQuestion.knowledgePointIds)
                    : displayQuestion.knowledgePointName 
                    ? [displayQuestion.knowledgePointName]
                    : [];
                  
                  const grammarTags = stat.resource?.grammarTags || [];
                  const vocabTags = stat.resource?.vocabTags || [];
                  const allTags = [...knowledgePoints, ...grammarTags, ...vocabTags];
                  
                  const level = displayQuestion.level || stat.resource?.level;
                  
                  // 题号：Section名-题号
                  const questionLabel = `${stat.sectionName}-${stat.questionNumber}`;
                  
                  return (
                    <button
                      key={stat.questionId}
                      onClick={() => {
                        setSelectedQuestion(stat);
                        setShowCorrectStudents(false);
                        setShowIncorrectStudents(false);
                      }}
                      className={`w-full text-left p-2.5 transition-all ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-900/20'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {/* Question Label (Section-Number) */}
                        <div className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                          {questionLabel}
                        </div>
                        
                        {/* Level */}
                        {level && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[10px] font-bold shrink-0">
                            <Star size={9} />
                            {level}
                          </span>
                        )}
                        
                        {/* Error Rate */}
                        <div className={`text-lg font-black ${errorRateColor} shrink-0`}>
                          {stat.errorRate.toFixed(0)}%
                        </div>
                        
                        {/* Knowledge Points */}
                        {allTags.slice(0, 2).map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] font-medium truncate max-w-[200px]"
                            title={tag}
                          >
                            {tag}
                          </span>
                        ))}
                        
                        {allTags.length > 2 && (
                          <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded text-[10px] shrink-0">
                            +{allTags.length - 2}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          
          {/* Detail Panel */}
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 hide-scrollbar">
            {!selectedQuestion ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <BookOpen size={48} className="mb-3" />
                <p>选择题目查看详细分析</p>
              </div>
            ) : (
              <div className="p-6">
                {/* Question Detail Header */}
                <div className="mb-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <h4 className="text-lg font-black text-slate-800 dark:text-white">题目详情</h4>
                      {/* Font Size Toggle Button */}
                      <button
                        onClick={() => {
                          setTextSize(prev => 
                            prev === 'base' ? 'lg' : prev === 'lg' ? 'xl' : 'base'
                          );
                        }}
                        className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors flex items-center justify-center"
                        title="切换字体大小"
                      >
                        <span className={`font-bold transition-all ${
                          textSize === 'base' ? 'text-sm' : textSize === 'lg' ? 'text-base' : 'text-lg'
                        }`}>T</span>
                      </button>
                    </div>
                    <div className={`text-3xl font-black ${
                      selectedQuestion.errorRate > 50 ? 'text-red-600' :
                      selectedQuestion.errorRate > 30 ? 'text-amber-600' :
                      'text-emerald-600'
                    }`}>
                      {selectedQuestion.errorRate.toFixed(1)}%
                    </div>
                  </div>
                  
                  <div className="p-4 mb-4">
                    {/* 复杂题型：展示父篇章 */}
                    {selectedQuestion.parentQuestion?.readingPassage && (
                      <div className="mb-4 p-4">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
                          <BookOpen size={12} />
                          阅读材料
                        </div>
                        <div 
                          className={`${textSizeClasses.passage} text-slate-700 dark:text-slate-300 leading-relaxed`}
                          dangerouslySetInnerHTML={{ __html: stripGapBackgroundHighlight(selectedQuestion.parentQuestion.readingPassage) }}
                        />
                      </div>
                    )}
                    
                    {/* 子题目标识 */}
                    {selectedQuestion.subQuestionIndex !== undefined && (
                      <div className="mb-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                        第 {selectedQuestion.subQuestionIndex + 1} 小题
                      </div>
                    )}
                    
                    {/* 题目文本 */}
                    <div 
                      className={`${textSizeClasses.text} text-slate-800 dark:text-slate-200 leading-relaxed mb-3`}
                      dangerouslySetInnerHTML={{ __html: selectedQuestion.question.text }}
                    />
                    
                    {/* 题目图片 */}
                    {selectedQuestion.question.imageUrl && (
                      <img
                        src={selectedQuestion.question.imageUrl}
                        alt="Question"
                        className="max-w-[320px] h-auto object-contain mb-3"
                      />
                    )}
                    
                    {/* All Tags - 复杂题型从父题获取 */}
                    <div className="flex flex-wrap gap-2">
                      {(() => {
                        // 对于复杂题型，优先显示父题的标签
                        const displayQuestion = selectedQuestion.parentQuestion || selectedQuestion.question;
                        const level = displayQuestion.level || selectedQuestion.resource?.level;
                        const knowledgePointIds = displayQuestion.knowledgePointIds;
                        const knowledgePointName = displayQuestion.knowledgePointName;
                        
                        return (
                          <>
                            {level && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-bold">
                                <Star size={12} />
                                难度: {level}
                              </span>
                            )}
                            
                            {knowledgePointIds && getKnowledgePointNames(knowledgePointIds).map((kp, idx) => (
                              <span
                                key={`kp-${idx}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium"
                              >
                                <BookOpen size={12} />
                                知识点: {kp}
                              </span>
                            ))}
                            
                            {knowledgePointName && !knowledgePointIds && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-medium">
                                <BookOpen size={12} />
                                知识点: {knowledgePointName}
                              </span>
                            )}
                          </>
                        );
                      })()}
                      
                      {selectedQuestion.resource?.grammarTags?.map((tag, idx) => (
                        <span
                          key={`grammar-${idx}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-medium"
                        >
                          <Tag size={12} />
                          语法: {tag}
                        </span>
                      ))}
                      
                      {selectedQuestion.resource?.vocabTags?.map((tag, idx) => (
                        <span
                          key={`vocab-${idx}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg text-xs font-medium"
                        >
                          <Tag size={12} />
                          词汇: {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Correct Answer Reference */}
                  {selectedQuestion.question.correctOptionId && (
                    <div className="p-4 mb-4">
                      <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-2">正确答案</div>
                      
                      {/* 对于填空题 */}
                      {(selectedQuestion.question.type === 'fill-in-the-blank' || 
                        selectedQuestion.question.type === 'compound-fill') ? (
                        <div className={`${textSizeClasses.text} text-indigo-900 dark:text-indigo-200 font-medium mb-3`}>
                          {selectedQuestion.question.options[0]?.text}
                        </div>
                      ) : (
                        /* 对于所有其他题型（包括媒体资源题目），使用grid布局展示所有选项 */
                        selectedQuestion.question.options.length > 0 && (() => {
                          const optionTexts = selectedQuestion.question.options.map(opt => opt.text);
                          const columns = getOptionGridColumns(optionTexts);
                          const gridColsClass = 
                            columns === 4 ? 'grid-cols-4' :
                            columns === 2 ? 'grid-cols-2' :
                            'grid-cols-1';
                          
                          return (
                            <div className={`grid ${gridColsClass} gap-3 mb-3`}>
                              {selectedQuestion.question.options.map((opt, idx) => {
                                const isCorrect = opt.id === selectedQuestion.question.correctOptionId;
                                const optionLetter = String.fromCharCode(65 + idx);
                                return (
                                  <div 
                                    key={opt.id} 
                                    className="p-3"
                                  >
                                    <div className="flex items-start gap-2">
                                      <span className={`font-bold shrink-0 ${
                                        isCorrect ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
                                      }`}>
                                        {optionLetter}.
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <span 
                                          className={`${textSizeClasses.option} break-words ${
                                            isCorrect ? 'text-emerald-900 dark:text-emerald-200 font-medium' : 'text-slate-700 dark:text-slate-300'
                                          }`}
                                          dangerouslySetInnerHTML={{ __html: opt.text }}
                                        />
                                        {isCorrect && (
                                          <span className="ml-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">✓ 正确</span>
                                        )}
                                        {opt.imageUrl && (
                                          <img
                                            src={opt.imageUrl}
                                            alt={`Option ${optionLetter}`}
                                            className="mt-2 max-w-full h-auto object-contain"
                                          />
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })()
                      )}
                      
                      {selectedQuestion.question.explanation && (
                        <div className="pt-3">
                          <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">解析</div>
                          <div className="text-sm text-indigo-800 dark:text-indigo-300 leading-relaxed">
                            {selectedQuestion.question.explanation}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Transcript - Show if available from resource */}
                  {selectedQuestion.resource?.transcript && selectedQuestion.resource.transcript.length > 0 && (
                    <div className="mb-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl p-4 border border-slate-100 dark:border-slate-800">
                      <h4 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                        <FileText size={16} className="text-indigo-600" />
                        录音/视频原文 (Transcription)
                      </h4>
                      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {selectedQuestion.resource.transcript.map((seg, idx) => (
                          <div key={idx} className="group flex gap-3 items-start">
                            <span className="text-[10px] font-mono text-slate-400 mt-1 shrink-0 bg-slate-100 dark:bg-slate-800 px-1 rounded">
                              {Math.floor(seg.startTime / 60).toString().padStart(2, '0')}:{(seg.startTime % 60).toString().padStart(2, '0')}
                            </span>
                            <div className="flex-1 space-y-1">
                              <div className="text-sm leading-relaxed font-serif text-slate-700 dark:text-slate-200 font-medium">
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
                  
                  {/* Stats Overview - Compact */}
                  <div className="flex items-center gap-3 text-sm mb-4 text-slate-600 dark:text-slate-400">
                    <span>作答 <span className="font-bold text-slate-800 dark:text-white">{selectedQuestion.totalCount}</span> 人</span>
                    <span className="w-px h-4 bg-slate-300 dark:bg-slate-600"></span>
                    <span>正确 <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedQuestion.correctCount}</span> 人</span>
                    <span className="w-px h-4 bg-slate-300 dark:bg-slate-600"></span>
                    <span>错误 <span className="font-bold text-red-600 dark:text-red-400">{selectedQuestion.totalCount - selectedQuestion.correctCount}</span> 人</span>
                  </div>
                </div>
                
                {/* Student Answers - Two Columns */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Correct Answers Section */}
                  <div>
                    <button
                      onClick={() => setShowCorrectStudents(!showCorrectStudents)}
                      className="w-full text-left p-3 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle size={16} className="text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          答对的同学 ({selectedQuestion.correctCount})
                        </span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">
                        {showCorrectStudents ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    
                    {showCorrectStudents && (
                      <div className="mt-2 p-3">
                        {selectedQuestion.correctStudents.length === 0 ? (
                          <div className="text-sm text-slate-400 text-center py-2">暂无</div>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {selectedQuestion.correctStudents.map((student) => (
                              <div
                                key={student.userId}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm"
                              >
                                <User size={12} className="text-slate-600 dark:text-slate-400" />
                                <span className="text-slate-700 dark:text-slate-300 font-medium">
                                  {student.name}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Incorrect Answers Section */}
                  <div>
                    <button
                      onClick={() => setShowIncorrectStudents(!showIncorrectStudents)}
                      className="w-full text-left p-3 transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <XCircle size={16} className="text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
                          答错的同学 ({selectedQuestion.incorrectStudents.length})
                        </span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-400">
                        {showIncorrectStudents ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </button>
                    
                    {showIncorrectStudents && (
                      <div className="mt-2 p-3">
                        {selectedQuestion.incorrectStudents.length === 0 ? (
                          <div className="text-sm text-slate-400 text-center py-2">暂无</div>
                        ) : (
                          <div className="space-y-2">
                            {selectedQuestion.incorrectStudents.map((student) => {
                              // 将选项ID转换为字母格式
                              let displayAnswer = student.answer;
                              if (selectedQuestion.question.type === 'multiple-choice' || 
                                  selectedQuestion.question.type === 'cloze-test' || 
                                  selectedQuestion.question.type === 'reading-comprehension') {
                                const optionIndex = selectedQuestion.question.options.findIndex(opt => opt.id === student.answer);
                                if (optionIndex !== -1) {
                                  displayAnswer = String.fromCharCode(65 + optionIndex);
                                }
                              }
                              return (
                                <div
                                  key={student.userId}
                                  className="flex items-start gap-3 p-2.5"
                                >
                                  <User size={14} className="text-slate-600 dark:text-slate-400 shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                      {student.name}
                                    </div>
                                    <div className="text-xs text-slate-600 dark:text-slate-400">
                                      <span className="font-medium">答案: </span>
                                      <span className="font-mono">{displayAnswer}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default ExamStatisticsAnalysis;
