import React, { useState, useEffect, useMemo } from 'react';
import SyllabusManager from './SyllabusManager';
import { SyllabusCourse, Question, KnowledgePoint, User } from '../types';
import {
    getSyllabusCourses,
    saveSyllabusCourse,
    cascadeDeleteSyllabusCourse,
    checkSyllabusCourseQuestionReferences,
    getBankQuestions,
    saveBankQuestion,
    deleteBankQuestion,
    checkQuestionReferences,
    ReferenceInfo
} from '../utils/storage';
import { Sparkles, BrainCircuit, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useJobs } from '../contexts/JobContext';
import { useAuth } from '../contexts/AuthContext';
import QuestionGeneratorWizard from './QuestionGeneratorWizard';
import QuestionEditor from './QuestionEditor';
import QuestionList from './QuestionList';
import { useModal } from '../contexts/ModalContext';

const QuestionBankDashboard: React.FC = () => {
  const { jobs, clearJob } = useJobs();
  const { user } = useAuth();
    const modal = useModal();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const [courses, setCourses] = useState<SyllabusCourse[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [showWizard, setShowWizard] = useState(false);

    const [courseDeleteConfirmState, setCourseDeleteConfirmState] = useState<{
        courseId: string;
        courseName: string;
        references: ReferenceInfo[];
    } | null>(null);
  
  // Editing state for existing questions
  const [editingQId, setEditingQId] = useState<string | null>(null);
  const [editingOriginal, setEditingOriginal] = useState<Question | null>(null);

  useEffect(() => {
      if (!user?.id) {
          setCourses([]);
          setBankQuestions([]);
          return;
      }
      const loadData = async () => {
          const [coursesData, questionsData] = await Promise.all([
              getSyllabusCourses(user.id),
              getBankQuestions(user.id)
          ]);
          setCourses(coursesData);
          setBankQuestions(questionsData);
      };
      loadData();
  }, [user?.id]);

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

  const handleUpdateCourse = async (course: SyllabusCourse) => {
    await saveSyllabusCourse(course);
    if (user?.id) {
        const coursesData = await getSyllabusCourses(user.id);
        setCourses(coursesData);
    }
  };

    const refreshSyllabusAndQuestions = async () => {
        if (!user?.id) {
            setCourses([]);
            setBankQuestions([]);
            return;
        }
        const [coursesData, questionsData] = await Promise.all([
            getSyllabusCourses(user.id),
            getBankQuestions(user.id)
        ]);
        setCourses(coursesData);
        setBankQuestions(questionsData);
    };

  const handleDeleteCourse = async (id: string) => {
        const course = courses.find(c => c.id === id);
        if (!course) return;

        const checkResult = checkSyllabusCourseQuestionReferences(id);

        setCourseDeleteConfirmState({
            courseId: id,
            courseName: course.name,
            references: checkResult.references
        });
  };

    const executeDeleteCourse = async () => {
        if (!courseDeleteConfirmState) return;
        await cascadeDeleteSyllabusCourse(courseDeleteConfirmState.courseId, user?.id);
        if (user?.id) {
            const [coursesData, questionsData] = await Promise.all([
                getSyllabusCourses(user.id),
                getBankQuestions(user.id)
            ]);
            setCourses(coursesData);
            setBankQuestions(questionsData);
        } else {
            setCourses([]);
            setBankQuestions([]);
        }
        setCourseDeleteConfirmState(null);
    };

  // Helper to get selected KP objects
  const getSelectedKnowledgePoints = (): KnowledgePoint[] => {
      const allPoints = courses.flatMap(c => c.units.flatMap(u => u.knowledgePoints));
      return allPoints.filter(p => selectedIds.includes(p.id));
  };

  const handleSaveGeneratedQuestions = async (questions: Question[]) => {
      await Promise.all(questions.map(q => saveBankQuestion(q)));
      if (user?.id) {
          const questionsData = await getBankQuestions(user.id);
          setBankQuestions(questionsData);
      }
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

  const handleUpdateExistingQuestion = async (q: Question) => {
      await saveBankQuestion(q);
      if (user?.id) {
          const questionsData = await getBankQuestions(user.id);
          setBankQuestions(questionsData);
      }
      // FIXED: Do not close the editor (setEditingQId(null)) here. 
      // This allows continuous editing. The "Finish" button handles closing.
  };

    const handleDeleteExistingQuestion = async (id: string) => {
    // 检查引用
    const checkResult = checkQuestionReferences(id);
    
    const message = checkResult.hasReferences
      ? `确定要删除这道题吗？\n\n${checkResult.message}\n\n该题将被软删除，可在30天内恢复。`
      : '确定要删除这道题吗？该操作可在30天内恢复。';
    
    const ok = await modal.confirm({
        title: '确认删除',
        message,
        type: 'danger',
        confirmText: '删除'
    });
    if (!ok) return;
    await deleteBankQuestion(id, user?.id, '教师删除题目');
    if (user?.id) {
        const questionsData = await getBankQuestions(user.id);
        setBankQuestions(questionsData);
    }
  };

  const handleCancelEdit = async () => {
      if (editingOriginal) {
          await saveBankQuestion(editingOriginal);
          if (user?.id) {
              const questionsData = await getBankQuestions(user.id);
              setBankQuestions(questionsData);
          }
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
            {courseDeleteConfirmState && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
                        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">删除课程</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                                课程「{courseDeleteConfirmState.courseName}」关联了题库题目（通过知识点）。
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
                                <div className="text-sm font-bold text-amber-800 dark:text-amber-200">关联题目</div>
                                {courseDeleteConfirmState.references.length === 0 ? (
                                    <div className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/90">
                                        未发现关联题目。
                                    </div>
                                ) : (
                                    <>
                                        {courseDeleteConfirmState.references.map((ref, idx) => (
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
                                            本次删除将级联软删除课程及关联题目（30天内可在回收站恢复）。
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end">
                            <button
                                onClick={() => setCourseDeleteConfirmState(null)}
                                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => executeDeleteCourse()}
                                className="px-4 py-2 text-sm font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition"
                            >
                                级联删除（软删除）
                            </button>
                        </div>
                    </div>
                </div>
            )}
      {/* Left Sidebar: Syllabus Manager */}
      <SyllabusManager 
        courses={courses}
        onUpdateCourse={handleUpdateCourse}
        onDeleteCourse={handleDeleteCourse}
                onRefresh={refreshSyllabusAndQuestions}
        onSelectionChange={setSelectedIds}
        selectedIds={selectedIds}
                operatorId={user?.id}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
                <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-8 flex items-center justify-between shrink-0">
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
