
import React, { useState, useEffect, useMemo } from 'react';
import SyllabusManager from './SyllabusManager';
import { SyllabusCourse, Question, KnowledgePoint, User } from '../types';
import { getSyllabusCourses, saveSyllabusCourse, deleteSyllabusCourse, getBankQuestions, saveBankQuestion, deleteBankQuestion } from '../utils/storage';
import { CURRENT_USER_ID } from '../constants';
import { Sparkles, BrainCircuit, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useJobs } from '../contexts/JobContext';
import { useAuth } from '../contexts/AuthContext';
import QuestionGeneratorWizard from './QuestionGeneratorWizard';
import QuestionEditor from './QuestionEditor';
import QuestionList from './QuestionList';

const QuestionBankDashboard: React.FC = () => {
  const { jobs, clearJob } = useJobs();
  const { user } = useAuth();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [courses, setCourses] = useState<SyllabusCourse[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [showWizard, setShowWizard] = useState(false);
  
  // Editing state for existing questions
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<Question | null>(null);

  useEffect(() => {
    setCourses(getSyllabusCourses(CURRENT_USER_ID));
    setBankQuestions(getBankQuestions());
  }, []);

  // Sync with context to find active job (persisted background job)
  useEffect(() => {
      const foundEntry = Object.entries(jobs).find(([id, job]) => id.startsWith('gen-quiz-'));
      if (foundEntry) {
          setActiveJobId(foundEntry[0]);
      } else {
          setActiveJobId(null);
      }
  }, [jobs]);

  // Memoize Knowledge Point Map for lookup in QuestionList
  const kpMap = useMemo(() => {
      const map: Record<string, KnowledgePoint> = {};
      courses.forEach(c => c.units.forEach(u => u.knowledgePoints.forEach(kp => {
          map[kp.id] = kp;
      })));
      return map;
  }, [courses]);

  const activeJob = activeJobId ? jobs[activeJobId] : null;

  const handleUpdateCourse = (course: SyllabusCourse) => {
    saveSyllabusCourse(course);
    setCourses(getSyllabusCourses(CURRENT_USER_ID));
  };

  const handleDeleteCourse = (id: string) => {
    deleteSyllabusCourse(id);
    setCourses(getSyllabusCourses(CURRENT_USER_ID));
  };

  // Helper to get selected KP objects
  const getSelectedKnowledgePoints = (): KnowledgePoint[] => {
      const allPoints = courses.flatMap(c => c.units.flatMap(u => u.knowledgePoints));
      return allPoints.filter(p => selectedIds.includes(p.id));
  };

  const handleSaveGeneratedQuestions = (questions: Question[]) => {
      questions.forEach(q => saveBankQuestion(q));
      setBankQuestions(getBankQuestions());
      setShowWizard(false);
      // Clean up job on save
      if (activeJobId) clearJob(activeJobId);
  };

  const handleCloseWizard = () => {
      setShowWizard(false);
      // If the job is completed or errored and user closes the wizard (Cancel), 
      // we should probably clear the job so it doesn't stick around as "Completed" forever in the dashboard.
      // However, if it's processing, we keep it (backgrounding).
      if (activeJob?.status === 'completed' || activeJob?.status === 'error') {
          if (activeJobId) clearJob(activeJobId);
      }
  };

  const handleUpdateExistingQuestion = (q: Question) => {
      saveBankQuestion(q);
      setBankQuestions(getBankQuestions());
      // FIXED: Do not close the editor (setEditingQId(null)) here. 
      // This allows continuous editing. The "Finish" button handles closing.
  };

  const handleDeleteExistingQuestion = (id: string) => {
      if(confirm('确定要删除这道题吗？')) {
          deleteBankQuestion(id);
          setBankQuestions(getBankQuestions());
      }
  };

  const handleCancelEdit = () => {
      if (editingOriginal) {
          saveBankQuestion(editingOriginal);
          setBankQuestions(getBankQuestions());
      }
      setEditingQId(null);
      setEditingOriginal(null);
  };

  // Logic to filter questions passed to the list
  const filteredQuestions = bankQuestions.filter(q => {
      // If syllabus items selected, filter by them
      const matchesSelection = selectedIds.length === 0 || (q.knowledgePointIds && q.knowledgePointIds.some(id => selectedIds.includes(id)));
      return matchesSelection;
  });

  return (
    <div className="flex h-full w-full bg-white dark:bg-slate-900 transition-colors duration-300">
      {/* Left Sidebar: Syllabus Manager */}
      <SyllabusManager 
        courses={courses}
        onUpdateCourse={handleUpdateCourse}
        onDeleteCourse={handleDeleteCourse}
        onSelectionChange={setSelectedIds}
        selectedIds={selectedIds}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white dark:bg-slate-800 border-b dark:border-slate-700 px-8 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-black text-slate-800 dark:text-white tracking-tight">题库中心</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowWizard(true)}
              disabled={selectedIds.length === 0}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-2 text-sm font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              <Sparkles size={16} /> 智能生成新题
            </button>
          </div>
        </header>

        {/* Persistent Job Status Bar (Visible if job exists AND wizard is NOT open) */}
        {activeJobId && !showWizard && (
            <div className="mx-8 mt-6 mb-0 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-indigo-100 dark:border-slate-700 flex items-center justify-between animate-fade-in-down">
                <div className="flex items-center gap-3">
                    {activeJob?.status === 'processing' ? (
                        <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center text-indigo-600 animate-spin">
                            <Loader2 size={20} />
                        </div>
                    ) : activeJob?.status === 'completed' ? (
                        <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600">
                            <CheckCircle size={20} />
                        </div>
                    ) : (
                        <div className="w-10 h-10 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600">
                            <AlertCircle size={20} />
                        </div>
                    )}
                    <div>
                        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {activeJob?.status === 'processing' ? 'AI 正在生成题库...' : activeJob?.status === 'completed' ? '题库生成完成' : '生成任务失败'}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{activeJob?.message || (activeJob?.status === 'completed' ? '点击右侧按钮审核并保存题目' : activeJob?.error)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {activeJob?.status === 'completed' ? (
                        <>
                            <button onClick={() => { clearJob(activeJobId); }} className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">放弃</button>
                            <button onClick={() => setShowWizard(true)} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-indigo-700 transition">
                                审核入库
                            </button>
                        </>
                    ) : activeJob?.status === 'processing' ? (
                        <button onClick={() => setShowWizard(true)} className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-600 transition">
                            查看进度
                        </button>
                    ) : (
                        <button onClick={() => { clearJob(activeJobId); }} className="px-4 py-2 text-xs font-bold text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition">
                            清除
                        </button>
                    )}
                </div>
            </div>
        )}

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
            {selectedIds.length === 0 && bankQuestions.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                    <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-sm border border-slate-100 dark:border-slate-800">
                        <BrainCircuit size={48} className="text-indigo-200 dark:text-indigo-800" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">题库为空</h3>
                    <p className="text-xs">请在左侧创建大纲并选择知识点开始生成</p>
                </div>
            ) : (
                <div className="w-full space-y-6">
                    {editingQId ? (
                        <div className="animate-fade-in w-full">
                            {/* Find the question being edited */}
                            {bankQuestions.filter(q => q.id === editingQId).map((q, idx) => (
                                <div key={q.id}>
                                    <QuestionEditor 
                                        question={q} 
                                        index={0} // Index in editing context is singular
                                        onChange={handleUpdateExistingQuestion} 
                                        onDelete={() => { handleDeleteExistingQuestion(q.id); setEditingQId(null); setEditingOriginal(null); }}
                                        onCancel={handleCancelEdit}
                                        onDone={() => { setEditingQId(null); setEditingOriginal(null); }}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <QuestionList 
                            questions={filteredQuestions}
                            onEdit={(q) => { setEditingQId(q.id); setEditingOriginal(JSON.parse(JSON.stringify(q))); }}
                            onDelete={handleDeleteExistingQuestion}
                            knowledgePointMap={kpMap}
                        />
                    )}
                </div>
            )}
        </div>
      </div>

      {showWizard && (
          <QuestionGeneratorWizard 
            knowledgePoints={getSelectedKnowledgePoints()}
            onClose={handleCloseWizard}
            onSave={handleSaveGeneratedQuestions}
            initialJobId={activeJobId}
            onJobStarted={setActiveJobId}
          />
      )}
    </div>
  );
};

export default QuestionBankDashboard;
