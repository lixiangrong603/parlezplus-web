import React, { useState, useEffect } from 'react';
import { ExamPaper, User, ExamSection, Question, Classroom, ExamFolder } from '../types';
import { 
  getExamPapers, saveExamPaper, deleteExamPaper, getQuestionsByIds, updateExamPaper, 
  getClassrooms, checkExamPaperReferences, cascadeDeleteExamPaper, 
  getExamFolders, saveExamFolder, deleteExamFolder,
  ReferenceInfo 
} from '../utils/storage';
import { useAuth } from '../contexts/AuthContext';
import { 
  FileText, Plus, Archive, FolderOpen, Edit3, Trash2, Calendar, CheckCircle, Eye, 
  FileEdit, Copy, Printer, Download, ChevronRight, FileDown, BarChart3, FolderPlus,
  Folder, ChevronDown, Menu, X, MoreVertical, PlayCircle, Send, ShieldAlert, AlertCircle, AlertTriangle
} from 'lucide-react';
import ExamBuilder from './ExamBuilder';
import { generateWordDocument } from '../utils/wordExport';
import ExamAnalysisModal from './ExamAnalysisModal';
import ExamTaker from './ExamTaker';
import { useModal } from '../contexts/ModalContext';

type SidebarView = 'drafts' | 'library';

interface DraftData {
  title: string;
  sections: ExamSection[];
  savedAt?: number;
}

const DRAFT_KEY = 'parlezplus_exam_builder_draft';

// Classroom Assignment Modal Component
const ClassroomAssignmentModal: React.FC<{
  exam: ExamPaper;
  teacherId: string;
  onClose: () => void;
  onSave: (selectedClassIds: string[]) => void;
}> = ({ exam, teacherId, onClose, onSave }) => {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>(exam.assignedClassIds || []);

  useEffect(() => {
    let active = true;
    const loadClassrooms = async () => {
      const all = await getClassrooms();
      if (!active) return;
      setClassrooms(all.filter(c => c.userId === teacherId));
    };
    loadClassrooms();
    return () => {
      active = false;
    };
  }, [teacherId]);

  const handleToggleClass = (classId: string) => {
    setSelectedClassIds(prev =>
      prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
    );
  };

  const handleSave = () => {
    onSave(selectedClassIds);
  };

  if (classrooms.length === 0) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FolderOpen size={32} className="text-amber-600" />
            </div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">暂无班级</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">您还没有创建任何班级，请先在班级管理中创建班级。</p>
            <button onClick={onClose} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all">
              确定
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">分发试卷</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <X size={20} />
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 uppercase">{exam.title}</p>
        </div>
        
        <div className="p-6 max-h-[400px] overflow-y-auto">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">选择班级</p>
          <div className="space-y-2">
            {classrooms.map(classroom => (
              <label
                key={classroom.id}
                className="flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                style={{
                  borderColor: selectedClassIds.includes(classroom.id) ? '#6366f1' : 'transparent',
                  backgroundColor: selectedClassIds.includes(classroom.id) ? 'rgba(99, 102, 241, 0.05)' : ''
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedClassIds.includes(classroom.id)}
                  onChange={() => handleToggleClass(classroom.id)}
                  className="w-5 h-5 rounded border-2 border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{classroom.name}</p>
                  <p className="text-xs text-slate-500">{classroom.studentCount || 0} 名学生</p>
                </div>
                {(exam.assignedClassIds || []).includes(classroom.id) && (
                  <span className="text-xs px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg font-bold">已分发</span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
            取消
          </button>
          <button onClick={handleSave} className="flex-[1.5] py-3 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg transition-all">
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

// --- PLAGIARISM CHECK MODAL ---
const ExamPlagiarismModal: React.FC<{
  examIds: string[];
  onClose: () => void;
}> = ({ examIds, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<ExamPaper[]>([]);
  const [results, setResults] = useState<{
    duplicates: { q1: Question; q2: Question; reason: 'ID一致' | '内容一致' }[];
    highlySimilar: { q1: Question; q2: Question; score: number }[];
  }>({ duplicates: [], highlySimilar: [] });

  const stripHtml = (html: string) => {
    return html.replace(/<[^>]*>?/gm, '').replace(/&nbsp;/g, ' ').trim();
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const allPapers = await getExamPapers();
      const selectedExams = allPapers.filter(p => examIds.includes(p.id));
      setExams(selectedExams);

      if (selectedExams.length === 2) {
        const e1 = selectedExams[0];
        const e2 = selectedExams[1];
        
        const qIds1 = e1.sections.flatMap(s => s.items.map(i => i.questionId));
        const qIds2 = e2.sections.flatMap(s => s.items.map(i => i.questionId));
        
        const questions1 = await getQuestionsByIds(qIds1);
        const questions2 = await getQuestionsByIds(qIds2);

        const dups: { q1: Question; q2: Question; reason: 'ID一致' | '内容一致' }[] = [];
        const highlySim: { q1: Question; q2: Question; score: number }[] = [];

        questions1.forEach(q1 => {
          questions2.forEach(q2 => {
            if (q1.id === q2.id) {
              dups.push({ q1, q2, reason: 'ID一致' });
            } else {
              const text1 = stripHtml(q1.text).toLowerCase();
              const text2 = stripHtml(q2.text).toLowerCase();
              if (text1 === text2 && text1.length > 0) {
                dups.push({ q1, q2, reason: '内容一致' });
              } else if (text1.length > 5 && text2.length > 5) {
                // Simple similarity check
                if (text1.includes(text2) || text2.includes(text1)) {
                  highlySim.push({ q1, q2, score: 0.9 });
                }
              }
            }
          });
        });

        setResults({ duplicates: dups, highlySimilar: highlySim });
      }
      setLoading(false);
    };
    fetchData();
  }, [examIds]);

  if (loading) return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400 font-bold">正在比对试题内容...</p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-slate-50 dark:bg-slate-950 w-full max-w-6xl h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
        <header className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center">
              <ShieldAlert className="text-purple-600" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">试卷查重分析</h2>
              <p className="text-xs text-slate-400">正在对比: {exams[0]?.title} vs {exams[1]?.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-red-50 dark:bg-red-900/10 p-6 rounded-3xl border border-red-100 dark:border-red-900/20 flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-red-600">
                <AlertTriangle size={24} />
              </div>
              <div>
                <p className="text-xs text-red-600 dark:text-red-400 font-bold uppercase tracking-wider">完全重复试题</p>
                <p className="text-3xl font-black text-red-700 dark:text-red-300">{results.duplicates.length} <span className="text-sm">道</span></p>
              </div>
            </div>
            
            <div className="bg-amber-50 dark:bg-amber-900/10 p-6 rounded-3xl border border-amber-100 dark:border-amber-900/20 flex items-center gap-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-2xl flex items-center justify-center text-amber-600">
                <AlertCircle size={24} />
              </div>
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">高度相似试题</p>
                <p className="text-3xl font-black text-amber-700 dark:text-amber-300">{results.highlySimilar.length} <span className="text-sm">道</span></p>
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/20 flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center text-emerald-600">
                <CheckCircle size={24} />
              </div>
              <div>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">内容差异率</p>
                <p className="text-3xl font-black text-emerald-700 dark:text-emerald-300">
                  {Math.round((1 - (results.duplicates.length + results.highlySimilar.length) / Math.max(1, (exams[0]?.sections.reduce((a, s) => a+s.items.length, 0) || 1))) * 100)}%
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-4">
              <div className="font-bold text-sm text-slate-500 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                试卷 A: {exams[0]?.title}
              </div>
              <div className="font-bold text-sm text-slate-500 flex items-center gap-2 border-l border-slate-200 pl-4 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                试卷 B: {exams[1]?.title}
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {results.duplicates.length === 0 && results.highlySimilar.length === 0 && (
                <div className="p-20 text-center text-slate-400 flex flex-col items-center">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-950 rounded-3xl flex items-center justify-center mb-4">
                    <CheckCircle size={40} className="text-emerald-500 opacity-20" />
                  </div>
                  <p className="font-bold">两张试卷未发现重复或高度相似试题</p>
                  <p className="text-xs mt-1">内容差异性良好，可以直接分发给不同班级。</p>
                </div>
              )}

              {[...results.duplicates, ...results.highlySimilar.map(s => ({ ...s, reason: '相似性较强' as const }))].map((match, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-4 p-6 group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                  <div className="pr-4 space-y-2 relative">
                    <div className="flex items-center gap-2">
                       <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${match.reason === 'ID一致' || match.reason === '内容一致' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                         试题 A
                       </span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                       {stripHtml(match.q1.text)}
                    </p>
                    {match.q1.readingPassage && (
                      <p className="text-[10px] text-slate-400 italic line-clamp-2">原文: {stripHtml(match.q1.readingPassage)}</p>
                    )}
                  </div>
                  <div className="pl-4 border-l border-slate-200 dark:border-slate-800 space-y-2 relative">
                    <div className="flex items-center justify-between">
                       <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${match.reason === 'ID一致' || match.reason === '内容一致' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'}`}>
                         试题 B
                       </span>
                       <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{match.reason}</span>
                    </div>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                       {stripHtml(match.q2.text)}
                    </p>
                    {match.q2.readingPassage && (
                      <p className="text-[10px] text-slate-400 italic line-clamp-2">原文: {stripHtml(match.q2.readingPassage)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExamCenterDashboard: React.FC = () => {
  const { user } = useAuth();
  const modal = useModal();
  const [sidebarView, setSidebarView] = useState<SidebarView>('library');
  const [examPapers, setExamPapers] = useState<ExamPaper[]>([]);
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [showExamBuilder, setShowExamBuilder] = useState(false);
  const [editingExam, setEditingExam] = useState<ExamPaper | null>(null);
  const [analysisExam, setAnalysisExam] = useState<ExamPaper | null>(null);
  const [takingExam, setTakingExam] = useState<ExamPaper | null>(null);
  const [assigningExam, setAssigningExam] = useState<ExamPaper | null>(null);
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [showPlagiarismModal, setShowPlagiarismModal] = useState(false);

  const [examDeleteConfirmState, setExamDeleteConfirmState] = useState<{
    examId: string;
    examTitle: string;
    references: ReferenceInfo[];
  } | null>(null);
  
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

  const loadFolders = async () => {
    if (!user?.id) return;
    try {
      const userFolders = await getExamFolders(user.id);
      setFolders(userFolders);
    } catch (e) {
      console.error('Failed to load folders', e);
    }
  };

  const handleCreateFolder = async () => {
    if (!user?.id) return;
    const newFolder: ExamFolder = {
      id: `temp-${Date.now()}`,
      userId: user.id,
      name: '新建文件夹',
      createdAt: Date.now()
    };
    try {
      const saved = await saveExamFolder(newFolder, user.id);
      setFolders([...folders, saved]);
      // 自动进入编辑模式
      setEditingFolderId(saved.id);
      setEditingFolderName('新建文件夹');
    } catch (e) {
      console.error('Failed to create folder', e);
    }
  };

  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (!newName.trim() || !user?.id) {
      setEditingFolderId(null);
      return;
    }
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;
    
    try {
      const updated = await saveExamFolder({ ...folder, name: newName.trim() }, user.id);
      setFolders(folders.map(f => f.id === folderId ? updated : f));
      setEditingFolderId(null);
    } catch (e) {
      console.error('Failed to rename folder', e);
      setEditingFolderId(null);
    }
  };

  const startEditingFolder = (folderId: string, currentName: string) => {
    setEditingFolderId(folderId);
    setEditingFolderName(currentName);
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!user?.id) return;
    const ok = await modal.confirm({
      title: '确认删除',
      message: '确认删除该文件夹？文件夹内的试卷将移至未分类。',
      type: 'danger',
      confirmText: '删除'
    });
    if (!ok) return;

    try {
      await deleteExamFolder(folderId, user.id);
      setFolders(folders.filter(f => f.id !== folderId));
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
      // 注意：删除文件夹时，API后端会自动清除exam_papers中的folder_id
      // 这里重新加载exam papers以反映变化
      await loadExamPapers();
    } catch (e) {
      console.error('Failed to delete folder', e);
    }
  };

  const handleMoveToFolder = async (examId: string, folderId: string | null) => {
    const exam = examPapers.find(p => p.id === examId);
    if (!exam) return;
    try {
      await saveExamPaper({ ...exam, folderId: folderId || undefined });
      await loadExamPapers();
    } catch (e) {
      console.error('Failed to move exam', e);
    }
  };

  const loadExamPapers = async () => {
    const papers = await getExamPapers(user?.id);
    setExamPapers(papers);
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

  const handleDeleteExam = async (examId: string) => {
    const paper = examPapers.find(p => p.id === examId);
    if (!paper) return;

    const checkResult = checkExamPaperReferences(examId);
    setExamDeleteConfirmState({
      examId,
      examTitle: paper.title,
      references: checkResult.references
    });
  };

  const executeDeleteExam = async (cascade: boolean) => {
    if (!examDeleteConfirmState) return;

    if (cascade) {
      await cascadeDeleteExamPaper(examDeleteConfirmState.examId, user?.id);
    } else {
      await deleteExamPaper(examDeleteConfirmState.examId, user?.id, '教师删除试卷');
    }

    setExamDeleteConfirmState(null);
    await loadExamPapers();
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

  const handleDeleteDraft = async () => {
    const ok = await modal.confirm({
      title: '确认删除',
      message: '确认删除草稿？此操作不可撤销。',
      type: 'danger',
      confirmText: '删除'
    });
    if (!ok) return;
    localStorage.removeItem(DRAFT_KEY);
    setDraft(null);
  };

  const handleDuplicateExam = async (exam: ExamPaper) => {
    const duplicatedExam: ExamPaper = {
      ...exam,
      id: `temp-${Date.now()}`,
      title: `${exam.title} (副本)`,
      createdAt: Date.now(),
    };
    await saveExamPaper(duplicatedExam);
    await loadExamPapers();
  };

  const handleExportWord = async (exam: ExamPaper, version: 'STUDENT' | 'TEACHER') => {
    const qIds = exam.sections.flatMap(s => s.items.map(i => i.questionId));
    const allQuestions = await getQuestionsByIds(qIds);
    await generateWordDocument(exam, allQuestions, version);
  };

  const handleShowAnalysis = (exam: ExamPaper) => {
    setAnalysisExam(exam);
  };

  const handleStartExam = (exam: ExamPaper) => {
    setTakingExam(exam);
  };

  const handleAssignExam = (exam: ExamPaper) => {
    setAssigningExam(exam);
  };

  const handleSaveAssignment = async (selectedClassIds: string[]) => {
    if (assigningExam) {
      const prevDeadlines = assigningExam.assignedClassDeadlines || {};
      const nextDeadlines: Record<string, number> = {};
      selectedClassIds.forEach((id) => {
        const v = prevDeadlines[id];
        if (typeof v === 'number') nextDeadlines[id] = v;
      });
      await updateExamPaper({
        ...assigningExam,
        assignedClassIds: selectedClassIds,
        assignedClassDeadlines: Object.keys(nextDeadlines).length > 0 ? nextDeadlines : undefined
      });
      setAssigningExam(null);
      await loadExamPapers();
    }
  };

  // Filter exams by selected folder
  const filteredExams = selectedFolderId === null
    ? examPapers.filter(e => !e.folderId)
    : examPapers.filter(e => e.folderId === selectedFolderId);

  // If taking exam, show ExamTaker fullscreen
  if (takingExam && user) {
    return <ExamTaker exam={takingExam} user={user} onExit={() => setTakingExam(null)} />;
  }

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
      {examDeleteConfirmState && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">删除试卷</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                试卷「{examDeleteConfirmState.examTitle}」可能存在考试记录。
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
                <div className="text-sm font-bold text-amber-800 dark:text-amber-200">关联考试记录</div>
                {examDeleteConfirmState.references.length === 0 ? (
                  <div className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/90">未发现关联考试记录。</div>
                ) : (
                  <>
                    {examDeleteConfirmState.references.map((ref, idx) => (
                      <div key={idx} className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/90">
                        <div className="font-semibold">{ref.type}：{ref.count}</div>
                        {ref.items?.length ? (
                          <ul className="mt-1 space-y-1 list-disc list-inside">
                            {ref.items.map(it => (
                              <li key={it.id} className="truncate">{it.name}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                    <div className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                      仅删除试卷会保留考试记录；级联删除会将这些考试记录一并软删除（可在回收站恢复）。
                    </div>
                  </>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                两种方式都会软删除试卷（可在回收站恢复）。
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end">
              <button
                onClick={() => setExamDeleteConfirmState(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
              >
                取消
              </button>
              <button
                onClick={() => executeDeleteExam(false)}
                className="px-4 py-2 text-sm font-black text-amber-700 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/40 rounded-xl transition"
              >
                仅删除试卷
              </button>
              <button
                onClick={() => executeDeleteExam(true)}
                className="px-4 py-2 text-sm font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition"
              >
                级联删除（含考试记录）
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Left Main Sidebar */}
      <div className="w-64 h-full bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center">
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
                <div className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
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
          <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between shrink-0">
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
                  <div className="flex items-center gap-2">
                    <button onClick={handleCreateExam} className="ml-2 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors">
                      <Plus size={14} className="inline -mt-0.5 mr-1"/> 新建试卷
                    </button>
                    {selectedExamIds.length === 2 && (
                      <button 
                        onClick={() => setShowPlagiarismModal(true)} 
                        className="px-3 py-1 rounded-md bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold shadow-sm animate-fade-in flex items-center gap-1.5"
                      >
                        <ShieldAlert size={14} /> 试卷查重
                      </button>
                    )}
                  </div>
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
                <div className="grid grid-cols-[40px_1fr_100px_80px_80px_260px] gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400">
                  <div className="flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      onChange={(e) => {
                        if (e.target.checked) setSelectedExamIds(filteredExams.map(e => e.id));
                        else setSelectedExamIds([]);
                      }}
                      checked={selectedExamIds.length === filteredExams.length && filteredExams.length > 0}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </div>
                  <div>试卷标题</div>
                  <div className="text-center">创建时间</div>
                  <div className="text-center">题目数</div>
                  <div className="text-center">满分</div>
                  <div className="text-center">操作</div>
                </div>
                {/* Table Rows */}
                {filteredExams.map(exam => (
                  <div
                    key={exam.id}
                    className="grid grid-cols-[40px_1fr_100px_80px_80px_260px] gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors items-center group"
                  >
                    <div className="flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        checked={selectedExamIds.includes(exam.id)}
                        onChange={() => {
                          setSelectedExamIds(prev => 
                            prev.includes(exam.id) ? prev.filter(id => id !== exam.id) : [...prev, exam.id]
                          );
                        }}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </div>
                    {/* Title */}
                    <div className="font-medium text-slate-800 dark:text-white text-sm truncate pr-2 uppercase">
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
                    <div className="flex items-center gap-1.5 justify-center">
                      <button
                        onClick={() => handleAssignExam(exam)}
                        className="p-1.5 hover:bg-emerald-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="分发到班级"
                      >
                        <Send size={14} />
                      </button>
                      <button
                        onClick={() => handleStartExam(exam)}
                        className="p-1.5 hover:bg-green-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="线上测试"
                      >
                        <PlayCircle size={14} />
                      </button>
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
                        onClick={() => handleDeleteExam(exam.id)}
                        className="p-1.5 hover:bg-red-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="删除"
                      >
                        <Trash2 size={14} />
                      </button>
                      {/* Word Export Dropdown */}
                      <div className="relative group/export">
                        <button
                          className="p-1.5 hover:bg-indigo-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                          title="导出Word"
                        >
                          <FileDown size={14} />
                        </button>
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-1 opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-50">
                          <button
                            onClick={() => handleExportWord(exam, 'STUDENT')}
                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            导出学生版
                          </button>
                          <button
                            onClick={() => handleExportWord(exam, 'TEACHER')}
                            className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
                          >
                            导出教师版
                          </button>
                        </div>
                      </div>
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
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {/* Table Header */}
                <div className="grid grid-cols-[1fr_120px_100px_100px_180px] gap-3 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-400">
                  <div>草稿标题</div>
                  <div className="text-center">保存时间</div>
                  <div className="text-center">部分数</div>
                  <div className="text-center">题目数</div>
                  <div className="text-center">操作</div>
                </div>
                {/* Draft Row */}
                <div
                    className="grid grid-cols-[1fr_120px_100px_100px_180px] gap-3 px-4 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors items-center group"
                  >
                    {/* Title */}
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded">草稿</span>
                      <div className="font-bold text-slate-800 dark:text-white text-sm truncate uppercase">
                        {draft.title || '未命名试卷'}
                      </div>
                    </div>
                    
                    {/* Date */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
                      {draft.savedAt ? new Date(draft.savedAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '刚刚'}
                    </div>
                    
                    {/* Sections */}
                    <div className="text-xs text-slate-600 dark:text-slate-300 text-center font-medium">
                      {draft.sections.length}
                    </div>
                    
                    {/* Question Count */}
                    <div className="text-xs text-slate-600 dark:text-slate-300 text-center font-medium">
                      {draft.sections.reduce((sum, s) => sum + s.items.length, 0)}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 justify-center">
                      <button
                        onClick={handleEditDraft}
                        className="p-1.5 hover:bg-amber-600 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="继续编辑"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={handleDeleteDraft}
                        className="p-1.5 hover:bg-red-500 hover:text-white text-slate-500 dark:text-slate-400 rounded transition-all"
                        title="删除草稿"
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

      {/* Plagiarism Modal */}
      {showPlagiarismModal && (
        <ExamPlagiarismModal
          examIds={selectedExamIds}
          onClose={() => setShowPlagiarismModal(false)}
        />
      )}

      {/* Assignment Modal */}
      {assigningExam && user && (
        <ClassroomAssignmentModal
          exam={assigningExam}
          teacherId={user.id}
          onClose={() => setAssigningExam(null)}
          onSave={handleSaveAssignment}
        />
      )}
    </div>
  );
};

export default ExamCenterDashboard;
