import React, { useState, useEffect } from 'react';
import { ExamPaper, User } from '../types';
import { X, AlertCircle, Info, AlertTriangle, PieChart, BookOpen, Layers } from 'lucide-react';
import { calculateExamAnalysis, AnalysisData } from '../services/examAnalysis';
import { getQuestionsByIds } from '../utils/storage';

interface ExamAnalysisModalProps {
  exam: ExamPaper;
  user: User;
  onClose: () => void;
}

const ExamAnalysisModal: React.FC<ExamAnalysisModalProps> = ({ exam, user, onClose }) => {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'category' | 'hierarchy'>('overview');

  useEffect(() => {
    loadAnalysis();
  }, [exam.id]);

  const loadAnalysis = async () => {
    setLoading(true);
    try {
      const qIds = exam.sections.flatMap(s => s.items.map(i => i.questionId));
      const allQuestions = await getQuestionsByIds(qIds);
      const result = await calculateExamAnalysis({ exam, user, allQuestions });
      setAnalysis(result);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getIssueIcon = (type: 'error' | 'warning' | 'info') => {
    if (type === 'error') return <AlertCircle size={16} className="text-red-500" />;
    if (type === 'warning') return <AlertTriangle size={16} className="text-amber-500" />;
    return <Info size={16} className="text-blue-500" />;
  };

  const getIssueColor = (type: 'error' | 'warning' | 'info') => {
    if (type === 'error') return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
    if (type === 'warning') return 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800';
    return 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">试卷分析</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{exam.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
          >
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 dark:border-slate-700 px-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'overview'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <PieChart size={16} className="inline mr-2" />
              总体概览
            </button>
            <button
              onClick={() => setActiveTab('category')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'category'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <BookOpen size={16} className="inline mr-2" />
              题型分类
            </button>
            <button
              onClick={() => setActiveTab('hierarchy')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === 'hierarchy'
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300'
              }`}
            >
              <Layers size={16} className="inline mr-2" />
              知识点分布
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-emerald-500 border-t-transparent"></div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">分析中...</p>
              </div>
            </div>
          ) : !analysis ? (
            <div className="text-center text-slate-500 dark:text-slate-400 py-12">
              <AlertCircle size={48} className="mx-auto mb-4" />
              <p>分析失败，请重试</p>
            </div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">题目总数</p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
                        {analysis.totalQuestions}
                      </p>
                    </div>
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">总分</p>
                      <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                        {analysis.totalScore}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">平均分值</p>
                      <p className="text-2xl font-bold text-purple-700 dark:text-purple-300 mt-1">
                        {analysis.averagePointsPerQuestion.toFixed(1)}
                      </p>
                    </div>
                  </div>

                  {/* Category Distribution */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">题目分类占比</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-slate-600 dark:text-slate-400">语法</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-white">{analysis.grammarPct}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 transition-all"
                            style={{ width: `${analysis.grammarPct}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-slate-600 dark:text-slate-400">词汇</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-white">{analysis.vocabPct}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                            style={{ width: `${analysis.vocabPct}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm text-slate-600 dark:text-slate-400">阅读</span>
                          <span className="text-sm font-bold text-slate-800 dark:text-white">{analysis.readingPct}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-purple-600 transition-all"
                            style={{ width: `${analysis.readingPct}%` }}
                          ></div>
                        </div>
                      </div>
                      {analysis.otherPct > 0 && (
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm text-slate-600 dark:text-slate-400">其他</span>
                            <span className="text-sm font-bold text-slate-800 dark:text-white">{analysis.otherPct}%</span>
                          </div>
                          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-slate-400 to-slate-500 transition-all"
                              style={{ width: `${analysis.otherPct}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section Analysis */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">各部分分析</h3>
                    <div className="space-y-3">
                      {analysis.sectionAnalysis.map((section, idx) => (
                        <div key={idx} className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{section.sectionTitle}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              {section.questionCount} 题 · {section.totalPoints} 分
                            </p>
                          </div>
                          <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {section.percentage.toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Issues */}
                  {analysis.issues.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">建议与提示</h3>
                      {analysis.issues.map((issue) => (
                        <div
                          key={issue.id}
                          className={`p-3 rounded-lg border flex items-start gap-3 ${getIssueColor(issue.type)}`}
                        >
                          {getIssueIcon(issue.type)}
                          <p className="text-sm text-slate-700 dark:text-slate-300 flex-1">{issue.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'category' && (
                <div className="space-y-6">
                  {/* Question Type Distribution */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">题型分布</h3>
                    <div className="space-y-2">
                      {Object.entries(analysis.typeDistribution).map(([type, count]) => (
                        <div key={type} className="flex items-center justify-between p-2">
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {type === 'multiple-choice' && '单项选择'}
                            {type === 'reading-comprehension' && '阅读理解'}
                            {type === 'cloze-test' && '完形填空'}
                            {type === 'fill-in-the-blank' && '填空题'}
                            {type === 'compound-fill' && '复合填空'}
                            {!['multiple-choice', 'reading-comprehension', 'cloze-test', 'fill-in-the-blank', 'compound-fill'].includes(type) && type}
                          </span>
                          <span className="text-sm font-bold text-slate-800 dark:text-white">{count} 题</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Level Distribution */}
                  {Object.keys(analysis.levelDistribution).length > 0 && (
                    <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">难度分布</h3>
                      <div className="grid grid-cols-3 gap-3">
                        {Object.entries(analysis.levelDistribution).map(([level, count]) => (
                          <div key={level} className="p-3 bg-white dark:bg-slate-800 rounded-lg text-center">
                            <p className="text-xs text-slate-500 dark:text-slate-400">CEFR {level}</p>
                            <p className="text-lg font-bold text-slate-800 dark:text-white mt-1">{count}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'hierarchy' && (
                <div className="space-y-4">
                  {analysis.hierarchy.length === 0 ? (
                    <div className="text-center text-slate-500 dark:text-slate-400 py-12">
                      <Info size={48} className="mx-auto mb-4" />
                      <p>暂无知识点关联数据</p>
                      <p className="text-xs mt-2">题目尚未关联到教学大纲</p>
                    </div>
                  ) : (
                    analysis.hierarchy.map((course) => (
                      <div key={course.courseId} className="p-5 bg-slate-50 dark:bg-slate-900 rounded-xl">
                        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">
                          {course.courseName}
                        </h3>
                        <div className="space-y-4">
                          {course.units.map((unit) => (
                            <div key={unit.unitId} className="pl-4 border-l-2 border-emerald-500">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{unit.unitName}</p>
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  {unit.totalUnitScore} 分
                                </span>
                              </div>
                              <div className="space-y-1">
                                {unit.points.map((point) => (
                                  <div
                                    key={point.pointId}
                                    className="flex items-center justify-between p-2 bg-white dark:bg-slate-800 rounded text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                          point.pointType === 'grammar'
                                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                                            : point.pointType === 'vocabulary'
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                            : point.pointType === 'reading'
                                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'
                                        }`}
                                      >
                                        {point.pointType === 'grammar' && '语法'}
                                        {point.pointType === 'vocabulary' && '词汇'}
                                        {point.pointType === 'reading' && '阅读'}
                                        {point.pointType === 'other' && '其他'}
                                      </span>
                                      <span className="text-slate-600 dark:text-slate-400">{point.pointName}</span>
                                    </div>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">{point.score} 分</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamAnalysisModal;
