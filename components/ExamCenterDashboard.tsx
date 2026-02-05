import React, { useState, useEffect } from 'react';
import { ExamPaper, User, ExamSection } from '../types';
import { getExamPapers, deleteExamPaper } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { 
  FileText, Plus, Archive, FolderOpen, Edit3, Trash2, Calendar, CheckCircle, Eye, 
  FileEdit, Copy, Printer, Download, ChevronRight
} from 'lucide-react';
import ExamBuilder from './ExamBuilder';

type SidebarView = 'drafts' | 'library';

interface DraftData {
  title: string;
  sections: ExamSection[];
  savedAt?: number;
}

const DRAFT_KEY = 'parlezplus_exam_builder_draft';

const ExamCenterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [sidebarView, setSidebarView] = useState<SidebarView>('library');
  const [examPapers, setExamPapers] = useState<ExamPaper[]>([]);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [showExamBuilder, setShowExamBuilder] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamPaper | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  useEffect(() => {
    loadExamPapers();
    loadDraft();
  }, [user?.id]);

  const loadExamPapers = () => {
    setExamPapers(getExamPapers(user?.id));
  };

  const loadDraft = () => {
    try {
      const draftStr = localStorage.getItem(DRAFT_KEY);
      if (draftStr) {
        const parsed = JSON.parse(draftStr);
        setDraft({ ...parsed, savedAt: Date.now() });
      } else {
        setDraft(null);
      }
    } catch (e) {
      console.error('Failed to load draft', e);
      setDraft(null);
    }
  };

  const handleCreateExam = () => {
    setEditingExam(null);
    setShowExamBuilder(true);
  };

  const handleEditExam = (exam: ExamPaper) => {
    setEditingExam(exam);
    setShowExamBuilder(true);
  };

  const handleDeleteExam = (examId: string) => {
    if (confirm('确认删除该试卷？此操作不可撤销。')) {
      deleteExamPaper(examId);
      loadExamPapers();
      if (selectedExamId === examId) {
        setSelectedExamId(null);
      }
    }
  };

  const handleNavigateBack = () => {
    setShowExamBuilder(false);
    setEditingExam(null);
    loadExamPapers();
    loadDraft();
  };

  const handleEditDraft = () => {
    setEditingExam(null);
    setShowExamBuilder(true);
  };

  const handleDeleteDraft = () => {
    if (confirm('确认删除草稿？此操作不可撤销。')) {
      localStorage.removeItem(DRAFT_KEY);
      setDraft(null);
    }
  };

  const handleDuplicateExam = (exam: ExamPaper) => {
    const duplicatedExam: ExamPaper = {
      ...exam,
      id: '', // Will be generated on save
      title: `${exam.title} (副本)`,
      createdAt: Date.now(),
    };
    setEditingExam(duplicatedExam);
    setShowExamBuilder(true);
  };

  const selectedExam = examPapers.find(e => e.id === selectedExamId);

  // If editing, show ExamBuilder fullscreen
  if (showExamBuilder && user) {
    return (
      <ExamBuilder
        user={user}
        cart={[]}
        onRemoveFromCart={() => {}}
        onClearCart={() => {}}
        initialExam={editingExam}
        onNavigateToBank={handleNavigateBack}
      />
    );
  }

  return (
    <div className="flex h-full w-full bg-white dark:bg-slate-900 transition-colors duration-300">
      {/* Left Sidebar */}
      <div className="w-64 h-full bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <FileText size={20} className="text-emerald-600" />
            组卷中心
          </h2>
        </div>

        {/* New Exam Button */}
        <div className="p-3">
          <button
            onClick={handleCreateExam}
            className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-bold shadow-lg transition-all active:scale-[0.98]"
          >
            <Plus size={18} /> 新建试卷
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => { setSidebarView('library'); setSelectedExamId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              sidebarView === 'library' 
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderOpen size={18} /> 试卷库
            <span className="ml-auto text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
              {examPapers.length}
            </span>
          </button>
          <button
            onClick={() => { setSidebarView('drafts'); setSelectedExamId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              sidebarView === 'drafts' 
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Archive size={18} /> 草稿箱
            {draft && (
              <span className="ml-auto text-xs bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full">
                1
              </span>
            )}
          </button>
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            提示：点击试卷卡片查看详情
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-w-0">
        {/* Exam List Panel */}
        <div className={`${selectedExamId ? 'w-1/2 border-r border-slate-200 dark:border-slate-700' : 'flex-1'} flex flex-col min-w-0 transition-all`}>
          <header className="h-16 bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-6 flex items-center justify-between shrink-0">
            <h3 className="text-base font-bold text-slate-800 dark:text-white">
              {sidebarView === 'library' ? '我的试卷' : '草稿箱'}
            </h3>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              共 {sidebarView === 'library' ? examPapers.length : 0} 份
            </span>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
            {sidebarView === 'library' ? (
              examPapers.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {examPapers.map(exam => (
                    <div
                      key={exam.id}
                      onClick={() => setSelectedExamId(exam.id)}
                      className={`p-5 bg-slate-50 dark:bg-slate-800 rounded-xl border-2 transition-all cursor-pointer group ${
                        selectedExamId === exam.id 
                          ? 'border-emerald-500 dark:border-emerald-600 shadow-lg shadow-emerald-500/10' 
                          : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-bold text-slate-800 dark:text-white text-base flex-1 line-clamp-1">
                          {exam.title}
                        </h4>
                        <ChevronRight 
                          size={18} 
                          className={`text-slate-400 transition-transform ${selectedExamId === exam.id ? 'rotate-90' : ''}`} 
                        />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle size={14} className="text-emerald-500" /> 
                          {exam.sections.length} 个部分
                        </span>
                        <span className="flex items-center gap-1.5">
                          <FileText size={14} /> 
                          {exam.sections.reduce((sum, s) => sum + s.items.length, 0)} 道题
                        </span>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          满分 {exam.totalScore}
                        </span>
                        <span className="flex items-center gap-1.5 ml-auto text-slate-400">
                          <Calendar size={14} /> 
                          {new Date(exam.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                  <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100 dark:border-slate-800">
                    <FileText size={40} className="text-slate-200 dark:text-slate-700" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">暂无试卷</h3>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mb-4">点击左上角"新建试卷"开始组卷</p>
                  <button
                    onClick={handleCreateExam}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition"
                  >
                    <Plus size={16} className="inline mr-1" /> 创建第一份试卷
                  </button>
                </div>
              )
            ) : draft ? (
              <div className="grid grid-cols-1 gap-4">
                <div
                  className="p-5 bg-amber-50 dark:bg-amber-900/10 rounded-xl border-2 border-amber-200 dark:border-amber-800 transition-all cursor-pointer group hover:border-amber-400 dark:hover:border-amber-600 hover:shadow-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-xs font-bold rounded">草稿</span>
                        <h4 className="font-bold text-slate-800 dark:text-white text-base line-clamp-1">
                          {draft.title || '未命名试卷'}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        自动保存于 {draft.savedAt ? new Date(draft.savedAt).toLocaleString() : '刚刚'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-3">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-amber-500" /> 
                      {draft.sections.length} 个部分
                    </span>
                    <span className="flex items-center gap-1.5">
                      <FileText size={14} /> 
                      {draft.sections.reduce((sum, s) => sum + s.items.length, 0)} 道题
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleEditDraft}
                      className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold transition-all"
                    >
                      <Edit3 size={14} className="inline mr-1" /> 继续编辑
                    </button>
                    <button
                      onClick={handleDeleteDraft}
                      className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg text-sm font-medium transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-slate-100 dark:border-slate-800">
                  <Archive size={40} className="text-slate-200 dark:text-slate-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-600 dark:text-slate-400 mb-2">草稿箱为空</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500">编辑试卷时会自动保存草稿到这里</p>
              </div>
            )}
          </div>
        </div>

        {/* Exam Detail Panel (Right side when exam selected) */}
        {selectedExamId && selectedExam && (
          <div className="w-1/2 flex flex-col min-w-0 bg-white dark:bg-slate-900">
            <header className="h-16 bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-6 flex items-center justify-between shrink-0">
              <h3 className="text-base font-bold text-slate-800 dark:text-white line-clamp-1">
                {selectedExam.title}
              </h3>
              <button 
                onClick={() => setSelectedExamId(null)}
                className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                关闭
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Exam Info */}
              <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">创建时间</span>
                    <p className="font-medium text-slate-800 dark:text-white">
                      {new Date(selectedExam.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">总分</span>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 text-lg">
                      {selectedExam.totalScore} 分
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">题目总数</span>
                    <p className="font-medium text-slate-800 dark:text-white">
                      {selectedExam.sections.reduce((sum, s) => sum + s.items.length, 0)} 道
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">部分数量</span>
                    <p className="font-medium text-slate-800 dark:text-white">
                      {selectedExam.sections.length} 个
                    </p>
                  </div>
                </div>
              </div>

              {/* Section Overview */}
              <div className="mb-6">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">试卷结构</h4>
                <div className="space-y-2">
                  {selectedExam.sections.map((section, idx) => (
                    <div 
                      key={section.id} 
                      className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <span className="font-medium text-slate-800 dark:text-white text-sm">
                          Part {idx + 1}: {section.title}
                        </span>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {section.items.length} 道题 · {section.items.reduce((sum, i) => sum + i.points, 0)} 分
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => handleEditExam(selectedExam)}
                  className="w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all"
                >
                  <Edit3 size={16} /> 编辑试卷
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleDuplicateExam(selectedExam)}
                    className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all"
                  >
                    <Copy size={14} /> 复制
                  </button>
                  <button
                    onClick={() => handleDeleteExam(selectedExam.id)}
                    className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all"
                  >
                    <Trash2 size={14} /> 删除
                  </button>
                </div>
                <button
                  onClick={() => {
                    handleEditExam(selectedExam);
                    // Will trigger print after builder loads
                  }}
                  className="w-full px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all"
                >
                  <Eye size={14} /> 预览 / 打印
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamCenterDashboard;
