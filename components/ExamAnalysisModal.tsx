import React from 'react';
import { ExamPaper } from '../types';
import { AnalysisData } from '../services/examAnalysis';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface ExamAnalysisModalProps {
  exam: ExamPaper;
  analysisData: AnalysisData | null;
  allQuestions: any[];
  expandedPointId: string | null;
  setExpandedPointId: (id: string | null) => void;
  onClose: () => void;
  t: (key: string) => string;
}

const ExamAnalysisModal: React.FC<ExamAnalysisModalProps> = ({
  exam,
  analysisData,
  allQuestions,
  expandedPointId,
  setExpandedPointId,
  onClose,
  t
}) => {
  if (!analysisData) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md">
          <div className="flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
          </div>
          <p className="text-center text-slate-600 dark:text-slate-400 mt-4">正在分析试卷...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">试卷分析</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{exam.title}</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
              <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mb-1">题目总数</p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{analysisData.totalQuestions}</p>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl">
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mb-1">总分</p>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{analysisData.totalScore}</p>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl">
              <p className="text-xs text-purple-600 dark:text-purple-400 font-bold mb-1">平均分值</p>
              <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {analysisData.averagePointsPerQuestion.toFixed(1)}
              </p>
            </div>
          </div>

          {/* Section Analysis */}
          {analysisData.sectionAnalysis.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3">各部分分析</h3>
              <div className="space-y-2">
                {analysisData.sectionAnalysis.map((section, idx) => (
                  <div key={idx} className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">{section.sectionTitle}</span>
                      <span className="text-sm text-slate-500 dark:text-slate-400">
                        {section.questionCount} 题 • {section.totalPoints} 分
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${section.percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      占总分 {section.percentage.toFixed(1)}%
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Issues */}
          {analysisData.issues.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-3">建议与提示</h3>
              <div className="space-y-2">
                {analysisData.issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-4 rounded-xl flex items-start gap-3 ${
                      issue.type === 'error'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                        : issue.type === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
                        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    }`}
                  >
                    {issue.type === 'error' && <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                    {issue.type === 'warning' && <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                    {issue.type === 'info' && <Info className="w-5 h-5 shrink-0 mt-0.5" />}
                    <p className="text-sm">{issue.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamAnalysisModal;
