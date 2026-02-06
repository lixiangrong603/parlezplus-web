import React, { useState, useEffect } from 'react';
import { ExamPaper, User, ExamSection, Question } from '../types';
import { getExamPapers, deleteExamPaper, getQuestionsByIds } from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { 
  FileText, Plus, Archive, FolderOpen, Edit3, Trash2, Calendar, CheckCircle, Eye, 
  FileEdit, Copy, Printer, Download, ChevronRight, FileDown, BarChart3, FolderPlus,
  Folder, ChevronDown, Menu, X, MoreVertical
} from 'lucide-react';
import ExamBuilder from './ExamBuilder';
import { generateWordDocument } from '../utils/wordExport';
import ExamAnalysisModal from './ExamAnalysisModal';

type SidebarView = 'drafts' | 'library';

interface DraftData {
  title: string;
  sections: ExamSection[];
  savedAt?: number;
}

interface ExamFolder {
  id: string;
  name: string;
  createdAt: number;
}

const DRAFT_KEY = 'parlezplus_exam_builder_draft';
const FOLDERS_KEY = 'parlezplus_exam_folders';

const ExamCenterDashboard: React.FC = () => {
  const { user } = useAuth();
  const [sidebarView, setSidebarView] = useState<SidebarView>('library');
  const [examPapers, setExamPapers] = useState<ExamPaper[]>([]);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [showExamBuilder, setShowExamBuilder] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamPaper | null>(null);
  const [analysisExam, setAnalysisExam] = useState<ExamPaper | null>(null);
  
  // Folder management
  const [folders, setFolders] = useState<ExamFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [folderSidebarOpen, setFolderSidebarOpen] = useState(true);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  useEffect(() => {
    loadExamPapers();
    loadDraft();
    loadFolders();
  }, [user?.id]);

  const loadFolders = () => {
    try {
      const foldersStr = localStorage.getItem(FOLDERS_KEY);
      if (foldersStr) {
        setFolders(JSON.parse(foldersStr));
      }
    } catch (e) {
      console.error('Failed to load folders', e);
    }
  };

  const saveFolders = (newFolders: ExamFolder[]) => {
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(newFolders));
    setFolders(newFolders);
  };

  const handleCreateFolder = () => {
    const newFolder: ExamFolder = {
      id: `folder_${Date.now()}`,
      name: '新建文件夹',
      createdAt: Date.now()
    };
    saveFolders([...folders, newFolder]);
    // 自动进入编辑模式
    setEditingFolderId(newFolder.id);
    setEditingFolderName('新建文件夹');
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingFolderId(null);
      return;
    }
    const updatedFolders = folders.map(f => 
      f.id === folderId ? { ...f, name: newName.trim() } : f
    );
    saveFolders(updatedFolders);
    setEditingFolderId(null);
  };

  const startEditingFolder = (folderId: string, currentName: string) => {
    setEditingFolderId(folderId);
    setEditingFolderName(currentName);
  };

  const handleDeleteFolder = (folderId: string) => {
    if (confirm('确认删除该文件夹？文件夹内的试卷将移至未分类。')) {
      saveFolders(folders.filter(f => f.id !== folderId));
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      // Remove folderId from all exams
      const updatedPapers = examPapers.map(exam => ({
        ...exam,
        folderId: exam.folderId === folderId ? undefined : exam.folderId
      }));
      updatedPapers.forEach(exam => {
        const allPapers = getExamPapers();
        const index = allPapers.findIndex(p => p.id === exam.id);
        if (index !== -1) {
          allPapers[index] = exam;
          localStorage.setItem('parlezplus_exam_papers', JSON.stringify(allPapers));
        }
      });
      loadExamPapers();
    }
  };

  const handleMoveToFolder = (examId: string, folderId: string | null) => {
    const allPapers = getExamPapers();
    const examIndex = allPapers.findIndex(p => p.id === examId);
    if (examIndex !== -1) {
      allPapers[examIndex] = { ...allPapers[examIndex], folderId };
      localStorage.setItem('parlezplus_exam_papers', JSON.stringify(allPapers));
      loadExamPapers();
    }
  };

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
      id: `exam_${Date.now()}`,
      title: `${exam.title} (副本)`,
      createdAt: Date.now(),
    };
    // Save directly to storage
    const allPapers = getExamPapers();
    allPapers.push(duplicatedExam);
    localStorage.setItem('parlezplus_exam_papers', JSON.stringify(allPapers));
    loadExamPapers();
  };

  const handleExportWord = async (exam: ExamPaper, version: 'STUDENT' | 'TEACHER') => {
    const qIds = exam.sections.flatMap(s => s.items.map(i => i.questionId));
    const allQuestions = await getQuestionsByIds(qIds);
    await generateWordDocument(exam, allQuestions, version);
  };

  const handleShowAnalysis = (exam: ExamPaper) => {
    setAnalysisExam(exam);
  };

  // Filter exams by selected folder
  const filteredExams = selectedFolderId === null
    ? examPapers.filter(e => !e.folderId)
    : examPapers.filter(e => e.folderId === selectedFolderId);

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
      {/* Left Main Sidebar */}
      <div className="w-64 h-full bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
            <FileText size={20} className="text-indigo-600" />
            组卷中心
          </h2>
        </div>

        {/* New Exam Button removed from sidebar (moved to header) */}

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <button
            onClick={() => setSidebarView('library')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              sidebarView === 'library' 
                ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' 
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <FolderOpen size={18} /> 试卷库
            <span className="ml-auto text-xs bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
              {examPapers.length}
            </span>
          </button>
          <button
            onClick={() => setSidebarView('drafts')}
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
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-w-0">
        {/* Folder Sidebar (only for library view) */}
        {sidebarView === 'library' && (
          <div className={`${folderSidebarOpen ? 'w-56' : 'w-0'} h-full bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col transition-all duration-300 overflow-hidden shrink-0`}>
            {folderSidebarOpen && (
              <>
                <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">文件夹</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleCreateFolder}
                      className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded transition-colors"
                      title="新建文件夹"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => setFolderSidebarOpen(false)}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    >
                      <X size={14} className="text-slate-500" />
                    </button>
                  </div>
                </div>
                
                {/* Folder List */}
                <div className="flex-1 overflow-y-auto p-2">
                  <button
                    onClick={() => setSelectedFolderId(null)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                      selectedFolderId === null
                        ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <FileText size={14} />
                    <span className="flex-1 text-left">未分类</span>
                    <span className="text-xs">{examPapers.filter(e => !e.folderId).length}</span>
                  </button>
                  
                  {folders.map(folder => (
                    <div key={folder.id} className="group relative">
                      {editingFolderId === folder.id ? (
                        <div className="flex items-center gap-1 px-3 py-2">
                          <Folder size={14} className="text-slate-400 shrink-0" />
                          <input
                            type="text"
                            value={editingFolderName}
                            onChange={e => setEditingFolderName(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleRenameFolder(folder.id, editingFolderName);
                              if (e.key === 'Escape') setEditingFolderId(null);
                            }}
                            onBlur={() => handleRenameFolder(folder.id, editingFolderName)}
                            autoFocus
                            className="flex-1 px-2 py-0.5 text-sm bg-white dark:bg-slate-800 border border-indigo-500 rounded focus:outline-none"
                          />
                        </div>
                      ) : (
                        <button
                          onClick={() => setSelectedFolderId(folder.id)}
                          onDoubleClick={() => startEditingFolder(folder.id, folder.name)}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                            selectedFolderId === folder.id
                              ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-bold'
                              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <Folder size={14} />
                          <span className="flex-1 text-left truncate">{folder.name}</span>
                          <span className="text-xs">{examPapers.filter(e => e.folderId === folder.id).length}</span>
                        </button>
                      )}
                      {editingFolderId !== folder.id && (
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => startEditingFolder(folder.id, folder.name)}
                            className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-all"
                            title="重命名"
                          >
                            <Edit3 size={12} className="text-blue-600" />
                          </button>
                          <button
                            onClick={() => handleDeleteFolder(folder.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                            title="删除文件夹"
                          >
                            <Trash2 size={12} className="text-red-600" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              {sidebarView === 'library' && !folderSidebarOpen && (
                <button
                  onClick={() => setFolderSidebarOpen(true)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  title="显示文件夹"
                >
                  <Menu size={18} className="text-slate-600 dark:text-slate-400" />
                </button>
              )}
              <h3 className="text-base font-bold text-slate-800 dark:text-white flex items-center gap-3">
                <span>{sidebarView === 'library' ? '我的试卷' : '草稿箱'}</span>
                {sidebarView === 'library' && (
                  <button onClick={handleCreateExam} className="ml-2 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors">
                    <Plus size={14} className="inline -mt-0.5 mr-1"/> 新建试卷
                  </button>
                )}
              </h3>
            </div>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              共 {sidebarView === 'library' ? filteredExams.length : (draft ? 1 : 0)} 份
            </span>
          </header>

          <div className="flex-1 overflow-y-auto p-6">
          {sidebarView === 'library' ? (
            filteredExams.length > 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_100px_80px_80px_260px] gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400">
                  <div>试卷标题</div>
                  <div className="text-center">创建时间</div>
                  <div className="text-center">题目数</div>
                  <div className="text-center">满分</div>
                  <div className="text-right pr-2">操作</div>
                </div>
                {/* Table Rows */}
                {filteredExams.map(exam => (
                  <div
                    key={exam.id}
                    className="grid grid-cols-[1fr_100px_80px_80px_260px] gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors items-center group"
                  >
                    {/* Title */}
                    <div className="font-medium text-slate-800 dark:text-white text-sm truncate pr-2">
                      {exam.title}
                    </div>
                    
                    {/* Date */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                      {new Date(exam.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    </div>
                    
                    {/* Question Count */}
                    <div className="text-xs text-slate-600 dark:text-slate-300 text-center font-medium">
                      {exam.sections.reduce((sum, s) => sum + s.items.length, 0)}
                    </div>
                    
                    {/* Score */}
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 text-center">
                      {exam.totalScore}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-1.5 justify-end">
                      <button
                        onClick={() => handleEditExam(exam)}
                        className="p-1.5 hover:bg-indigo-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="编辑"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => handleShowAnalysis(exam)}
                        className="p-1.5 hover:bg-blue-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="分析"
                      >
                        <BarChart3 size={14} />
                      </button>
                      <button
                        onClick={() => handleDuplicateExam(exam)}
                        className="p-1.5 hover:bg-purple-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="复制"
                      >
                        <Copy size={14} />
                      </button>
                      <button
                        onClick={() => handleExportWord(exam, 'STUDENT')}
                        className="p-1.5 hover:bg-indigo-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="导出学生版"
                      >
                        <FileDown size={14} />
                      </button>
                      <button
                        onClick={() => handleExportWord(exam, 'TEACHER')}
                        className="p-1.5 hover:bg-amber-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="导出教师版"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteExam(exam.id)}
                        className="p-1.5 hover:bg-red-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                      
                      {/* Move to Folder Dropdown */}
                      <div className="relative group/folder">
                        <button
                          className="p-1.5 hover:bg-slate-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                          title="移动到文件夹"
                        >
                          <MoreVertical size={14} />
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 opacity-0 invisible group-hover/folder:opacity-100 group-hover/folder:visible transition-all z-50">
                          <button
                            onClick={() => handleMoveToFolder(exam.id, null)}
                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            移至未分类
                          </button>
                          {folders.map(folder => (
                            <button
                              key={folder.id}
                              onClick={() => handleMoveToFolder(exam.id, folder.id)}
                              className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 truncate"
                            >
                              {folder.name}
                            </button>
                          ))}
                        </div>
                      </div>
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition"
                >
                  <Plus size={16} className="inline mr-1" /> 创建第一份试卷
                </button>
              </div>
            )
          ) : draft ? (
            <div className="space-y-4">
              <div className="p-5 bg-amber-50 dark:bg-amber-900/10 rounded-xl border-2 border-amber-200 dark:border-amber-800 transition-all">
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
      </div>

      {/* Analysis Modal */}
      {analysisExam && user && (
        <ExamAnalysisModal
          exam={analysisExam}
          user={user}
          onClose={() => setAnalysisExam(null)}
        />
      )}
    </div>
  );
};

export default ExamCenterDashboard;
