import React, { useEffect, useRef, useState } from 'react';
import { User, Question, ExamPaper, ExamSection, ExamItem, QuestionType } from '../types';
import { getQuestionsByIds, getQuestionsWithResourceInfo, saveExamPaper, updateExamPaper } from '../utils/storage';
import QuestionSelector from '../components/QuestionSelector';
import ExamStemRenderer from '../components/ExamStemRenderer';
import { getOptionGridColumns } from '../utils/optionLayout';
import { Save, ChevronUp, ChevronDown, Plus, Trash2, ArrowUp, ArrowDown, RotateCcw, Eye, EyeOff, ArrowUpCircle, ArrowDownCircle, BarChart3, X, ArrowDownUp, Printer, FileDown } from 'lucide-react';
import ExamAnalysisModal from '../components/ExamAnalysisModal';
import SectionSortModal, { SortCriterion } from '../components/SectionSortModal';
import { runExamPrint, ExamPrintMode } from '../utils/examPrint';
import { generateWordDocument } from '../utils/wordExport';
import { useModal } from '../contexts/ModalContext';

interface ExamProps {
  user: User;
  cart: string[];
  onRemoveFromCart: (id: string) => void;
  onClearCart: () => void;
  initialExam?: ExamPaper | null;
  onNavigateToBank: (previewExam?: ExamPaper) => void;
  autoPrintMode?: ExamPrintMode | null;
}

const DRAFT_KEY = 'parlezplus_exam_builder_draft';

const ExamBuilder: React.FC<ExamProps> = ({ user, cart, onRemoveFromCart, onClearCart, initialExam, onNavigateToBank, autoPrintMode }) => {
  const modal = useModal();
  const [examTitle, setExamTitle] = useState('');
  const [sections, setSections] = useState<ExamSection[]>([]);
  const [questionById, setQuestionById] = useState<Record<string, Question>>({});
  const questionByIdRef = useRef<Record<string, Question>>({});
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [activeSectionIndex, setActiveSectionIndex] = useState<number | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);

  // View Answer State
  const [showAnswers, setShowAnswers] = useState(false);

  const [analysisExam, setAnalysisExam] = useState<ExamPaper | null>(null);
  const [sortModalSectionIdx, setSortModalSectionIdx] = useState<number | null>(null);
  const [editingSectionTotalIdx, setEditingSectionTotalIdx] = useState<number | null>(null);
  const [editingSectionTotalValue, setEditingSectionTotalValue] = useState<string>('');
  const [shouldScroll, setShouldScroll] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Print / Export handlers
  const handlePrint = (mode: ExamPrintMode) => {
    runExamPrint({
      mode,
      setShowAnswers,
      onCloseMenu: () => setExportMenuOpen(false),
      title: examTitle || 'Exam',
    });
  };

  const handleExportWord = async (version: 'STUDENT' | 'TEACHER') => {
    setExportMenuOpen(false);
    const qIds = Array.from(new Set(sections.flatMap(s => s.items.map(i => i.questionId))));
    await ensureQuestionsLoaded(qIds);
    const allQuestions = Object.values(questionByIdRef.current);
    const examSnapshot: ExamPaper = {
      id: initialExam?.id ?? 'draft',
      title: (examTitle || '').trim() || 'Untitled Exam',
      sections,
      totalScore: getTotalScore(),
      teacherId: user.id,
      createdAt: Date.now(),
    };
    await generateWordDocument(examSnapshot, allQuestions, version);
  };

  // Auto-print when autoPrintMode is set and exam is loaded
  useEffect(() => {
    if (autoPrintMode && hasLoaded && sections.length > 0) {
      // Small delay to ensure DOM is fully rendered
      const timer = setTimeout(() => {
        handlePrint(autoPrintMode);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [autoPrintMode, hasLoaded, sections.length]);

  useEffect(() => {
    if (shouldScroll) {
       setTimeout(() => {
         window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
       }, 100);
       setShouldScroll(false);
    }
  }, [shouldScroll, sections]);

  useEffect(() => {
    questionByIdRef.current = questionById;
  }, [questionById]);

  const ensureQuestionsLoaded = async (ids: string[]): Promise<Record<string, Question>> => {
    const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
    const current = questionByIdRef.current;
    const missing = uniqueIds.filter(id => !current[id]);
    if (missing.length === 0) return current;

    // Use getQuestionsWithResourceInfo to ensure resource questions are loaded correctly
    // This prioritizes finding questions in resources (with resourceId) over the question bank
    const questionsWithInfo = await getQuestionsWithResourceInfo(missing);
    const fetched = questionsWithInfo.map(info => info.question);
    
    if (!fetched || fetched.length === 0) {
      console.warn('[ExamBuilder] Failed to load questions:', missing);
      return current;
    }

    const merged = { ...current };
    for (const q of fetched) merged[q.id] = q;

    questionByIdRef.current = merged;
    setQuestionById(merged);
    return merged;
  };

  // Load initial or draft
  useEffect(() => {
    if (initialExam) {
      setExamTitle(initialExam.title);
      setSections(initialExam.sections);
      setHasLoaded(true);
    } else {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft && !hasLoaded) {
        try {
          const parsed = JSON.parse(draft);
          setExamTitle(parsed.title || '');
          setSections(parsed.sections || []);
          setDraftRestored(true);
          setTimeout(() => setDraftRestored(false), 3000);
        } catch (e) {
          console.error("Failed to restore draft", e);
        }
      }
      setHasLoaded(true);
    }
  }, [initialExam]);

  // Auto-save draft
  useEffect(() => {
    if (hasLoaded && !initialExam) {
      if (examTitle || sections.length > 0) {
         localStorage.setItem(DRAFT_KEY, JSON.stringify({ title: examTitle, sections }));
      }
    }
  }, [examTitle, sections, hasLoaded, initialExam]);

  const calculateDefaultPoints = (q: Question): { total: number, subPoints?: number[] } => {
      if (q.type === 'reading-comprehension' && q.subQuestions) {
          const subCount = q.subQuestions.length;
          return { total: subCount, subPoints: new Array(subCount).fill(1) };
      }
      if ((q.type === 'cloze-test' || q.type === 'compound-fill') && q.subQuestions) {
          const subCount = q.subQuestions.length;
          return { total: subCount, subPoints: new Array(subCount).fill(1) };
      }
      if (q.type === 'multiple-choice') return { total: 1 };
      if (q.type === 'fill-in-the-blank') {
          const blanks = (q.text.match(/_{3,}|\.{3,}/g) || []).length;
          return { total: Math.max(1, blanks) };
      }
      return { total: 1 }; // Default for Short Answer
  };

  useEffect(() => {
    if (initialExam || !hasLoaded) return;
    if (sections.length === 0 && cart.length > 0) {
      (async () => {
        const merged = await ensureQuestionsLoaded(cart);
        setSections([{
          id: crypto.randomUUID(),
          title: "Section I",
          instructions: "请仔细阅读题目并选择正确答案。",
          items: cart.map(id => {
            const q = merged[id];
            const defaults = q ? calculateDefaultPoints(q) : { total: 1 };
            return { questionId: id, points: defaults.total, subPoints: defaults.subPoints };
          })
        }]);
      })();
    }
  }, [cart, initialExam, sections.length, hasLoaded]);

  // Hydrate any questions referenced by cart/sections
  useEffect(() => {
    const ids = new Set<string>();
    cart.forEach(id => ids.add(id));
    sections.forEach(sec => sec.items.forEach(it => {
      if (it.type !== 'consigne' && it.questionId) {
        ids.add(it.questionId);
      }
    }));
    if (ids.size === 0) return;
    ensureQuestionsLoaded(Array.from(ids));
  }, [cart, sections]);

  const getTotalScore = () => sections.reduce((acc, sec) => acc + sec.items.filter(item => item.type !== 'consigne').reduce((sAcc, item) => sAcc + item.points, 0), 0);

  const openAnalysis = () => {
    (async () => {
      const qIds = Array.from(new Set(sections.flatMap(s => s.items.map(i => i.questionId))));
      await ensureQuestionsLoaded(qIds);
      const snapshot: ExamPaper = {
        id: initialExam?.id ?? 'draft',
        title: (examTitle || '').trim() || 'Untitled Exam',
        sections,
        totalScore: getTotalScore(),
        teacherId: user.id,
        createdAt: Date.now(),
        sharedWith: initialExam?.sharedWith,
      };
      setAnalysisExam(snapshot);
    })();
  };

  const handleCancel = async () => {
    const message = initialExam
      ? '放弃修改并返回？'
      : '放弃草稿并返回？';
    const ok = await modal.confirm({
      title: '确认',
      message,
      type: 'danger',
      confirmText: '放弃'
    });
    if (!ok) return;

    setAnalysisExam(null);

    if (!initialExam) {
      localStorage.removeItem(DRAFT_KEY);
      onClearCart();
      setExamTitle('');
      setSections([]);
    }

    onNavigateToBank(undefined);
  };

  const handleSaveExam = async () => {
    if (!examTitle.trim() || getTotalScore() === 0) { 
      await modal.alert({ message: '请输入试卷标题并设置分值' });
      return; 
    }
    const examData = { title: examTitle, sections: sections, totalScore: getTotalScore(), teacherId: user.id };
    
    let savedExam: ExamPaper;
    if (initialExam) { 
      savedExam = { ...initialExam, ...examData };
      await updateExamPaper(savedExam); 
    } else { 
      savedExam = await saveExamPaper({ ...examData, id: '', createdAt: Date.now() } as ExamPaper); 
      localStorage.removeItem(DRAFT_KEY);
      onClearCart();
    }
    
    await modal.alert({ message: '保存成功' });
    onNavigateToBank(savedExam);
  };

  const openQuestionSelector = (sectionIndex: number) => { 
    setActiveSectionIndex(sectionIndex); 
    setIsSelectorOpen(true); 
  };
  
  const handleAddQuestions = (selectedIds: string[]) => {
    if (activeSectionIndex === null) return;
    (async () => {
      const uniqueIds = Array.from(new Set(selectedIds));
      const merged = await ensureQuestionsLoaded(uniqueIds);

      const newItems = uniqueIds.map(id => {
        const q = merged[id];
        const defaults = q ? calculateDefaultPoints(q) : { total: 1 };
        return { questionId: id, points: defaults.total, subPoints: defaults.subPoints };
      });

      setSections(prev => prev.map((sec, idx) => {
        if (idx !== activeSectionIndex) return sec;
        return { ...sec, items: [...sec.items, ...newItems] };
      }));
      setIsSelectorOpen(false); 
      setActiveSectionIndex(null); 
      setShouldScroll(true);
    })();
  };

  const addSection = () => setSections([...sections, { 
    id: crypto.randomUUID(), 
    title: `Section ${sections.length + 1}`, 
    instructions: '请仔细阅读题目并选择正确答案。', 
    items: [] 
  }]);
  
  const updateSection = (index: number, field: 'title' | 'instructions', value: string) => {
    setSections(prev => prev.map((sec, idx) => (idx === index ? { ...sec, [field]: value } as ExamSection : sec)));
  };
  
  const deleteSection = async (index: number) => {
    const ok = await modal.confirm({
      title: '确认删除',
      message: '确认删除？',
      type: 'danger',
      confirmText: '删除'
    });
    if (!ok) return;
    setSections(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSortSection = (criteria: SortCriterion[]) => {
    if (sortModalSectionIdx === null) return;

    setSections(prevSections => {
        const section = prevSections[sortModalSectionIdx];
        if (!section) return prevSections;

        // Separate consignes from questions
        const consigneItems = section.items.filter(item => item.type === 'consigne');
        const questionItems = section.items.filter(item => item.type !== 'consigne');

        const itemsWithMeta = questionItems.map(item => ({
            item,
            q: questionById[item.questionId!],
            rand: Math.random()
        }));

        itemsWithMeta.sort((a, b) => {
            const qA = a.q;
            const qB = b.q;
            if (!qA || !qB) return 0;

            for (const c of criteria) {
                let res = 0;
                if (c.type === 'TYPE') {
                    const typeA = qA.type || '';
                    const typeB = qB.type || '';
                    res = typeA.localeCompare(typeB);
                } else if (c.type === 'DIFFICULTY') {
                    const levelA = qA.level || '';
                    const levelB = qB.level || '';
                    res = levelA.localeCompare(levelB);
                } else if (c.type === 'RANDOM') {
                    res = a.rand - b.rand;
                }

                if (res !== 0) {
                   if (c.type === 'RANDOM') return res;
                   return c.order === 'DESC' ? -res : res; 
                }
            }
            return 0;
        });

        // Merge sorted questions back with consignes at their original positions
        const sortedQuestions = itemsWithMeta.map(x => x.item);
        const mergedItems: ExamItem[] = [];
        let qIndex = 0;
        
        section.items.forEach((originalItem, idx) => {
            if (originalItem.type === 'consigne') {
                mergedItems.push(originalItem);
            } else {
                if (qIndex < sortedQuestions.length) {
                    mergedItems.push(sortedQuestions[qIndex]);
                    qIndex++;
                }
            }
        });
        
        // Add any remaining sorted questions
        while (qIndex < sortedQuestions.length) {
            mergedItems.push(sortedQuestions[qIndex]);
            qIndex++;
        }
        
        const newSections = [...prevSections];
        newSections[sortModalSectionIdx] = { ...section, items: mergedItems };
        return newSections;
    });

    setSortModalSectionIdx(null);
  };

  const moveSection = (index: number, direction: 'up' | 'down') => {
    setSections(prev => {
      if ((direction === 'up' && index === 0) || (direction === 'down' && index === prev.length - 1)) return prev;
      const n = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      [n[index], n[target]] = [n[target], n[index]];
      return n;
    });
  };

  const startEditSectionTotal = (index: number) => {
    const section = sections[index];
    if (!section) return;
    const currentTotal = section.items.reduce((acc, it) => acc + it.points, 0);
    setEditingSectionTotalIdx(index);
    setEditingSectionTotalValue(String(currentTotal));
  };

  const cancelEditSectionTotal = () => {
    setEditingSectionTotalIdx(null);
    setEditingSectionTotalValue('');
  };

  const applySectionTotal = (index: number) => {
    const parsed = Number.parseFloat(editingSectionTotalValue);
    if (isNaN(parsed) || parsed < 0) { 
      void modal.alert({ message: '无效的总分值' });
      return; 
    }
    distributePointsAcrossItems(index, parsed);
    setEditingSectionTotalIdx(null);
    setEditingSectionTotalValue('');
  };

  const roundTo = (value: number, decimals = 2) => Number(value.toFixed(decimals));

  const distributeEvenly = (total: number, count: number) => {
    if (count <= 0) return [] as number[];
    const base = total / count;
    const roundedBase = roundTo(base);
    const arr = new Array(count).fill(roundedBase);
    const currentSum = roundTo(arr.reduce((a, b) => a + b, 0));
    const diff = roundTo(total - currentSum);
    arr[count - 1] = roundTo(arr[count - 1] + diff);
    return arr;
  };

  const distributePointsAcrossItems = (secIndex: number, total: number) => {
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIndex) return sec;
      const n = sec.items.length;
      if (n === 0) return sec;
      const perItem = distributeEvenly(total, n);
      const newItems = sec.items.map((it, idx) => {
        let newPoints = perItem[idx];
        if (it.subPoints && it.subPoints.length > 0) {
          const m = it.subPoints.length;
          const newSub = distributeEvenly(newPoints, m);
          newPoints = roundTo(newSub.reduce((a, b) => a + b, 0));
          return { ...it, subPoints: newSub, points: newPoints };
        }
        return { ...it, points: roundTo(newPoints) };
      });

      return { ...sec, items: newItems };
    }));
  };

  const updatePoints = (secIndex: number, itemIndex: number, points: number) => {
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIndex) return sec;
      return {
        ...sec,
        items: sec.items.map((it, iIdx) => (iIdx === itemIndex ? { ...it, points } : it))
      };
    }));
  };

  const updateSubPoints = (secIndex: number, itemIndex: number, subIndex: number, value: number) => {
      setSections(prev => prev.map((sec, sIdx) => {
        if (sIdx !== secIndex) return sec;
        return {
          ...sec,
          items: sec.items.map((it, iIdx) => {
            if (iIdx !== itemIndex) return it;
            const subPoints = [...(it.subPoints || [])];
            subPoints[subIndex] = value;
            const total = subPoints.reduce((a, b) => a + b, 0);
            return { ...it, subPoints, points: total };
          })
        };
      }));
  };

  const deleteItem = (secIndex: number, itemIndex: number) => {
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIndex) return sec;
      return { ...sec, items: sec.items.filter((_, idx) => idx !== itemIndex) };
    }));
  };
  
  const moveItem = (secIndex: number, itemIndex: number, direction: 'up' | 'down') => {
    setSections(prev => prev.map((sec, sIdx) => {
      if (sIdx !== secIndex) return sec;
      const items = [...sec.items];
      if (direction === 'up' && itemIndex > 0) [items[itemIndex], items[itemIndex - 1]] = [items[itemIndex - 1], items[itemIndex]];
      else if (direction === 'down' && itemIndex < items.length - 1) [items[itemIndex], items[itemIndex + 1]] = [items[itemIndex + 1], items[itemIndex]];
      return { ...sec, items };
    }));
  };

  const reorderSubQuestion = async (q: Question, subIndex: number, direction: 'up' | 'down') => {
      if (!q.subQuestions) return;
      const subs = [...q.subQuestions];
      const targetIndex = direction === 'up' ? subIndex - 1 : subIndex + 1;
      if (targetIndex < 0 || targetIndex >= subs.length) return;
      [subs[subIndex], subs[targetIndex]] = [subs[targetIndex], subs[subIndex]];
      const updatedQ = { ...q, subQuestions: subs };
      setQuestionById(prev => ({ ...prev, [q.id]: updatedQ }));
  };

  const clearDraft = async () => {
    const ok = await modal.confirm({
      title: '确认清空',
      message: '确认清空草稿？',
      type: 'danger',
      confirmText: '清空'
    });
    if (!ok) return;
    setExamTitle('');
    setSections([]);
    localStorage.removeItem(DRAFT_KEY);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 print:h-auto print:overflow-visible print:bg-white">
      <div className="max-w-4xl mx-auto py-6 pb-20 relative print-exam print:py-0 print:pb-0 print:max-w-none">
      {analysisExam && (
        <ExamAnalysisModal
          exam={analysisExam}
          user={user}
          onClose={() => setAnalysisExam(null)}
        />
      )}
      {sortModalSectionIdx !== null && (
        <SectionSortModal
          onClose={() => setSortModalSectionIdx(null)}
          onApply={handleSortSection}
        />
      )}
      {draftRestored && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm animate-in fade-in slide-in-from-top-4">
           已恢复草稿
        </div>
      )}

      {isSelectorOpen && (
        <QuestionSelector 
          user={user} 
          onConfirm={handleAddQuestions} 
          onCancel={() => setIsSelectorOpen(false)} 
          excludeIds={sections.flatMap(s => s.items.map(i => i.questionId))} 
        />
      )}

      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 print:hidden">
         <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
           {!initialExam && (
             <button onClick={clearDraft} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="清空草稿">
               <RotateCcw className="w-4 h-4" />
             </button>
           )}
           <h1 className="font-bold text-slate-800 dark:text-white text-sm uppercase tracking-widest">
             {initialExam ? '编辑试卷' : '新建试卷'}
           </h1>
         </div>
         <div className="flex gap-2 w-full sm:w-auto justify-end flex-wrap">
            <button
              onClick={handleCancel}
              className="px-3 sm:px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-slate-50 shadow-sm transition-all"
              title="取消"
            >
              <X className="w-4 h-4" /> <span className="hidden sm:inline">取消</span>
            </button>
            <button
              onClick={openAnalysis}
              className="px-3 sm:px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-slate-50 shadow-sm transition-all"
              title="试卷分析"
            >
              <BarChart3 className="w-4 h-4" /> <span className="hidden sm:inline">分析</span>
            </button>
            <button 
                onClick={() => setShowAnswers(!showAnswers)} 
                className={`px-3 sm:px-4 py-2 border rounded-xl flex items-center gap-2 text-sm font-bold shadow-sm transition-all ${
                  showAnswers ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
            >
                {showAnswers ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden sm:inline">{showAnswers ? '隐藏答案' : '查看答案'}</span>
            </button>

            {/* Print / Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="px-3 sm:px-4 py-2 bg-white text-slate-600 border border-slate-200 rounded-xl flex items-center gap-2 text-sm font-bold hover:bg-slate-50 shadow-sm transition-all"
                title="打印/导出"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">导出</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">打印</div>
                  <button
                    onClick={() => handlePrint('STUDENT')}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> 学生版
                  </button>
                  <button
                    onClick={() => handlePrint('TEACHER')}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <Printer className="w-4 h-4" /> 教师版 (含答案)
                  </button>
                  <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Word 导出</div>
                  <button
                    onClick={() => handleExportWord('STUDENT')}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <FileDown className="w-4 h-4" /> 学生版 (.docx)
                  </button>
                  <button
                    onClick={() => handleExportWord('TEACHER')}
                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                  >
                    <FileDown className="w-4 h-4" /> 教师版 (.docx)
                  </button>
                </div>
              )}
            </div>

            <button onClick={handleSaveExam} className="flex-1 sm:flex-none justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-2 text-sm font-bold shadow-lg transition-all active:scale-95">
              <Save className="w-4 h-4" /> 
              <span className="inline">保存试卷</span> 
              <span className="bg-blue-500 px-1.5 rounded text-[10px]">{getTotalScore()}</span>
            </button>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 md:p-12 shadow-xl print:shadow-none print:p-0 font-serif border border-slate-200 dark:border-slate-800 print:border-none rounded-xl print:rounded-none">
        {/* Header */}
        <div className="text-center mb-10 border-b-2 border-black dark:border-slate-600 pb-6">
           <input 
             type="text" 
             value={examTitle} 
             onChange={(e) => setExamTitle(e.target.value)} 
             placeholder="请输入试卷标题" 
             className="w-full text-center text-2xl md:text-3xl font-bold uppercase tracking-[0.2em] border-none focus:ring-0 bg-transparent dark:text-white mb-8 placeholder-slate-200 dark:placeholder-slate-700" 
           />
           <div className="flex flex-col sm:flex-row justify-between items-center text-xs gap-4 sm:gap-6 text-slate-800 dark:text-slate-300">
             <div className="w-full sm:flex-1 text-left whitespace-nowrap">姓名: ______________________</div>
             <div className="w-full sm:flex-1 text-left sm:text-center whitespace-nowrap">班级: ______________</div>
             <div className="w-full sm:flex-1 text-left sm:text-right font-bold whitespace-nowrap">
               得分: ________________ / {getTotalScore()}
             </div>
           </div>
        </div>

        <div className="space-y-6">
          {sections.map((section, sIdx) => {
            const sectionTotal = section.items.reduce((acc, item) => acc + item.points, 0);
            return (
            <div
              key={section.id}
              className={`group/section relative border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800 hover:border-blue-200 dark:hover:border-blue-700 rounded-xl p-3 sm:p-6 transition-all shadow-sm`}
            >
              <div className="flex gap-1 items-center justify-end mb-3 sm:mb-0 sm:absolute sm:right-4 sm:top-4 print:hidden opacity-100 sm:opacity-0 sm:group-hover/section:opacity-100 transition-opacity bg-slate-50 sm:bg-white/90 shadow-sm sm:shadow-md p-1 rounded-lg border border-slate-200 z-10 w-full sm:w-fit overflow-x-auto">
                 <button onClick={() => moveSection(sIdx, 'up')} disabled={sIdx===0} className="p-2 sm:p-1.5 text-slate-500 hover:text-blue-600 disabled:opacity-20 hover:bg-blue-50 rounded"><ArrowUp className="w-4 h-4 sm:w-3.5 sm:h-3.5"/></button>
                 <button onClick={() => moveSection(sIdx, 'down')} disabled={sIdx===sections.length-1} className="p-2 sm:p-1.5 text-slate-500 hover:text-blue-600 disabled:opacity-20 hover:bg-blue-50 rounded"><ArrowDown className="w-4 h-4 sm:w-3.5 sm:h-3.5"/></button>
                 <div className="w-px h-4 bg-slate-300 mx-1"></div>
                 {editingSectionTotalIdx === sIdx ? (
                   <div className="flex items-center gap-1 bg-white rounded px-1">
                     <input
                       type="number"
                       step="0.1"
                       min="0"
                       value={editingSectionTotalValue}
                       onChange={(e) => setEditingSectionTotalValue(e.target.value)}
                       className="w-16 text-right text-xs border rounded px-1 py-1"
                       aria-label="编辑总分"
                     />
                     <button onClick={() => applySectionTotal(sIdx)} className="p-1 text-blue-600 hover:bg-blue-50 rounded"><Save className="w-3.5 h-3.5" /></button>
                     <button onClick={cancelEditSectionTotal} className="p-1 text-slate-500 hover:bg-slate-100 rounded"><X className="w-3.5 h-3.5" /></button>
                   </div>
                 ) : (
                   <button onClick={() => startEditSectionTotal(sIdx)} className="px-2 py-1 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded flex items-center gap-1" title="编辑总分">
                     <span className="text-[10px] font-bold uppercase text-slate-400">总分:</span>
                     <span className="text-xs font-bold">{sectionTotal}</span>
                   </button>
                 )}
                 <div className="w-px h-4 bg-slate-300 mx-1"></div>
                 <button onClick={() => setSortModalSectionIdx(sIdx)} className="p-2 sm:p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded" title="排序题目"><ArrowDownUp className="w-4 h-4 sm:w-3.5 sm:h-3.5"/></button>
                 <button onClick={() => deleteSection(sIdx)} className="p-2 sm:p-1.5 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" /></button>
              </div>

              <div className="mb-2">
                 <div className="flex justify-between items-center">
                    <input className="w-full font-bold text-lg border-none p-0 focus:ring-0 bg-transparent dark:text-white" value={section.title} onChange={(e) => updateSection(sIdx, 'title', e.target.value)} />
                    <span className="text-sm font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap hidden sm:block print:block">/ {sectionTotal} pts</span>
                 </div>
                 {section.instructions && (
                   <div className="group/instruction relative -mb-1">
                     <input 
                       className="w-full text-slate-500 dark:text-slate-400 italic border-none p-0 focus:ring-0 bg-transparent text-sm" 
                       value={section.instructions} 
                       onChange={(e) => updateSection(sIdx, 'instructions', e.target.value)}
                       onBlur={(e) => {
                         // Auto-delete if empty
                         if (!e.target.value.trim()) {
                           updateSection(sIdx, 'instructions', '');
                         }
                       }}
                       placeholder="添加说明文字..."
                     />
                     <button
                       onClick={() => updateSection(sIdx, 'instructions', '')}
                       className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/instruction:opacity-100 transition-opacity p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded print:hidden"
                       title="删除说明"
                     >
                       <Trash2 className="w-3 h-3" />
                     </button>
                   </div>
                 )}
              </div>

              <div className="space-y-2 pl-0 sm:pl-2">
                {section.items.map((item, qIdx) => {
                  // Handle consigne items
                  if (item.type === 'consigne') {
                    return (
                      <div key={`consigne-${qIdx}`} className="group/consigne relative -my-1">
                        <input
                          value={item.consigneText || ''}
                          onChange={(e) => {
                            const newSections = [...sections];
                            newSections[sIdx].items[qIdx] = { ...item, consigneText: e.target.value };
                            setSections(newSections);
                          }}
                          placeholder="说明文字 (consigne)..."
                          className="w-full text-slate-500 dark:text-slate-400 italic border-none p-0 focus:ring-0 bg-transparent text-sm"
                        />
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover/consigne:opacity-100 transition-opacity flex gap-1 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm rounded px-1">
                          <button onClick={() => deleteItem(sIdx, qIdx)} className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded transition-colors" title="删除说明"><Trash2 className="w-3 h-3"/></button>
                        </div>
                      </div>
                    );
                  }

                  const qId = item.questionId;
                  if (!qId) {
                    return (
                      <div key={`missing-id-${qIdx}`} className="group/item flex flex-wrap sm:flex-nowrap items-start gap-2 sm:gap-3 relative py-2 break-words max-w-full">
                        <div className="flex-1 min-w-0 max-w-full">
                          <div className="p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded text-sm text-rose-700 dark:text-rose-200">
                            ⚠️ 该试卷条目缺少 questionId，无法渲染题目内容。
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end w-full sm:w-auto mt-2 sm:mt-0 print:hidden bg-slate-50 sm:bg-white/95 p-1.5 rounded-lg shadow-sm sm:shadow-lg border border-slate-200 ring-1 ring-slate-200/50 z-20 sm:absolute sm:-right-3 sm:top-0 relative">
                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1">
                            <span className="text-[10px] text-slate-400 font-bold px-1">分值:</span>
                            <input type="number" step="0.1" min="0" value={item.points} onChange={(e) => updatePoints(sIdx, qIdx, Number(e.target.value))} className="w-10 text-center bg-transparent p-1 text-xs font-bold outline-none" />
                          </div>
                          <div className="w-px h-4 bg-slate-300 mx-1"></div>
                          <button onClick={() => moveItem(sIdx, qIdx, 'up')} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors"><ChevronUp className="w-4 h-4"/></button>
                          <button onClick={() => moveItem(sIdx, qIdx, 'down')} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors"><ChevronDown className="w-4 h-4"/></button>
                          <div className="w-px h-4 bg-slate-300 mx-1"></div>
                          <button onClick={() => deleteItem(sIdx, qIdx)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    );
                  }

                  const q = questionById[qId];
                  if (!q) {
                    return (
                      <div key={`${qId}-missing-${qIdx}`} className="group/item flex flex-wrap sm:flex-nowrap items-start gap-2 sm:gap-3 relative py-2 break-words max-w-full">
                        <div className="flex-1 min-w-0 max-w-full">
                          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-700 dark:text-amber-200">
                            ⚠️ 题目未加载，暂无法渲染内容（ID: <span className="font-mono text-[12px]">{qId}</span>）。
                            <button
                              onClick={() => { void ensureQuestionsLoaded([qId]); }}
                              className="ml-3 underline font-bold hover:text-amber-800 dark:hover:text-amber-100"
                            >
                              重试加载
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 justify-end w-full sm:w-auto mt-2 sm:mt-0 print:hidden bg-slate-50 sm:bg-white/95 p-1.5 rounded-lg shadow-sm sm:shadow-lg border border-slate-200 ring-1 ring-slate-200/50 z-20 sm:absolute sm:-right-3 sm:top-0 relative">
                          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1">
                            <span className="text-[10px] text-slate-400 font-bold px-1">分值:</span>
                            <input type="number" step="0.1" min="0" value={item.points} onChange={(e) => updatePoints(sIdx, qIdx, Number(e.target.value))} className="w-10 text-center bg-transparent p-1 text-xs font-bold outline-none" />
                          </div>
                          <div className="w-px h-4 bg-slate-300 mx-1"></div>
                          <button onClick={() => moveItem(sIdx, qIdx, 'up')} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors"><ChevronUp className="w-4 h-4"/></button>
                          <button onClick={() => moveItem(sIdx, qIdx, 'down')} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors"><ChevronDown className="w-4 h-4"/></button>
                          <div className="w-px h-4 bg-slate-300 mx-1"></div>
                          <button onClick={() => deleteItem(sIdx, qIdx)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </div>
                      </div>
                    );
                  }

                  const isReadingSet = q.type === 'reading-comprehension';
                  const isCloze = q.type === 'cloze-test' || q.type === 'compound-fill';
                  
                  // Calculate actual question number (excluding consignes)
                  const questionNumber = section.items.slice(0, qIdx).filter(i => i.type !== 'consigne').length + 1;
                  const showNumber = section.items.filter(i => i.type !== 'consigne').length > 1;

                  const itemContainerClassName = isReadingSet
                    ? 'group/item flex flex-col sm:flex-row items-start gap-2 sm:gap-3 relative py-1 break-words max-w-full'
                    : 'group/item flex flex-wrap sm:flex-nowrap items-start gap-2 sm:gap-3 relative py-1 break-words max-w-full';

                  return (
                    <div key={`${item.questionId}-${qIdx}`} className={itemContainerClassName}>
                       {/* Add Consigne Button */}
                       <button
                         onClick={() => {
                           const newSections = [...sections];
                           newSections[sIdx].items.splice(qIdx, 0, {
                             type: 'consigne',
                             consigneText: '',
                             points: 0
                           });
                           setSections(newSections);
                         }}
                         className="absolute -left-6 top-0 p-1 opacity-0 group-hover/item:opacity-100 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-all print:hidden"
                         title="在此题前插入说明文字"
                       >
                         <Plus className="w-3.5 h-3.5" />
                       </button>
                       {showNumber && <span className="font-bold text-base min-w-[22px] mt-0.5">{questionNumber}.</span>}
                       
                       <div className="flex-1 min-w-0 max-w-full">
                           <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                              <div className="w-full min-w-0">
                                  {isReadingSet ? (
                                      <div className="mb-2 w-full overflow-hidden">
                                        <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded mb-3 text-justify whitespace-pre-wrap leading-normal font-serif text-base dark:text-slate-300 max-w-full overflow-x-auto">
                                              <ExamStemRenderer content={{ readingPassage: q.readingPassage }} type={q.type} showAnswers={showAnswers} />
                                          </div>
                                          {q.subQuestions?.map((sq, sqIdx) => (
                                          <div key={sqIdx} className="mb-2 pl-2 group/sub relative">
                                                  <div className="flex items-center justify-end gap-2 mt-2 sm:mt-0 sm:absolute sm:-right-3 sm:top-0 print:hidden opacity-100 sm:opacity-0 sm:group-hover/sub:opacity-100 transition-opacity bg-white border rounded shadow-sm p-0.5 z-20 w-fit ml-auto sm:ml-0">
                                                      <div className="flex flex-col">
                                                          <button onClick={() => reorderSubQuestion(q, sqIdx, 'up')} className="text-slate-400 hover:text-blue-500 disabled:opacity-30" disabled={sqIdx===0}><ArrowUpCircle className="w-3 h-3"/></button>
                                                          <button onClick={() => reorderSubQuestion(q, sqIdx, 'down')} className="text-slate-400 hover:text-blue-500 disabled:opacity-30" disabled={sqIdx===(q.subQuestions?.length||0)-1}><ArrowDownCircle className="w-3 h-3"/></button>
                                                      </div>
                                                      <input 
                                                        type="number" 
                                                        step="0.1"
                                                        min="0"
                                                         className="w-12 text-center text-xs border rounded p-0.5 bg-slate-50" 
                                                         value={item.subPoints?.[sqIdx] ?? 1}
                                                         onChange={(e) => updateSubPoints(sIdx, qIdx, sqIdx, Number(e.target.value))}
                                                      />
                                                      <span className="text-[9px] text-slate-400">pts</span>
                                                  </div>

                                                  <div className="flex justify-between pr-8">
                                                      <p className="font-bold mb-1 text-base">{sqIdx + 1}) {sq.text}</p>
                                                  </div>
                                                  
                                                  {/* Sub-question image */}
                                                  {sq.imageUrl && (
                                                      <div className="my-2">
                                                          <img src={sq.imageUrl} alt="Question" className="max-w-md rounded border" />
                                                      </div>
                                                  )}
                                                  
                                                  {sq.options && sq.options.length > 0 && (
                                                      <div className={`grid gap-x-6 gap-y-1 grid-cols-${getOptionGridColumns(sq.options.map(o => o.text))}`}>
                                                          {sq.options.map((opt, oIdx) => {
                                                              const isCorrect = (String.fromCharCode(65 + oIdx) === sq.correctOptionId) || (opt.id === sq.correctOptionId);
                                                              return (
                                                                  <div key={oIdx} className="flex flex-col gap-1">
                                                                      <div className="flex gap-2 items-start text-base">
                                                                          <span className={`font-bold ${showAnswers && isCorrect ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>{String.fromCharCode(65 + oIdx)}.</span>
                                                                          <span className={`${showAnswers && isCorrect ? 'text-red-600 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>{opt.text}</span>
                                                                      </div>
                                                                      {opt.imageUrl && (
                                                                          <img src={opt.imageUrl} alt={`Option ${String.fromCharCode(65 + oIdx)}`} className="max-w-xs rounded border ml-6" />
                                                                      )}
                                                                  </div>
                                                              );
                                                          })}
                                                      </div>
                                                  )}

                                                  {(!sq.options || sq.options.length === 0) && (
                                                       showAnswers ? (
                                                          <div className="mt-1 p-2 bg-indigo-50 border border-indigo-100 rounded text-sm text-indigo-900 font-medium">
                                                            <span className="font-bold mr-1">R:</span> {(
                                                             (q.type === 'compound-fill' && sq.options?.[0]?.text) ||
                                                             sq.correctOptionId
                                                            )}
                                                          </div>
                                                       ) : (
                                                          <div className="w-full h-12 border-b border-slate-200 border-dashed mt-1"></div>
                                                       )
                                                  )}
                                              </div>
                                          ))}
                                      </div>
                                  ) : isCloze ? (
                                      <div className="w-full overflow-hidden">
                                        <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded mb-3 text-justify whitespace-pre-wrap leading-normal font-serif text-base dark:text-slate-300 max-w-full overflow-x-auto">
                                            {(() => {
                                              const text = q.readingPassage || q.text || '';
                                              // Replace HTML gap spans
                                              if (showAnswers && q.type === 'compound-fill' && q.subQuestions) {
                                                // For compound-fill with answers: show red answers
                                                let result = text;
                                                q.subQuestions.forEach((sq, idx) => {
                                                  const answer = sq.options?.[0]?.text || sq.correctOptionId || '';
                                                  const pattern = new RegExp(`<span[^>]*data-gap="${idx + 1}"[^>]*>.*?</span>`, 'gi');
                                                  result = result.replace(pattern, `<span class="font-bold text-red-600">(${idx + 1}) ${answer}</span>`);
                                                });
                                                return <span dangerouslySetInnerHTML={{ __html: result }} />;
                                              } else {
                                                // Replace HTML gap spans with plain text format: (n) __________
                                                const processed = text.replace(
                                                  /<span[^>]*data-gap="(\d+)"[^>]*>.*?<\/span>/gi,
                                                  (_, gapNum) => `(${gapNum}) ${'_'.repeat(15)}`
                                                );
                                                return processed;
                                              }
                                            })()}
                                        </div>
                                        {q.type === 'cloze-test' && q.subQuestions?.map((sq, sqIdx) => (
                                          <div key={sqIdx} className="mb-2 pl-2 group/sub relative">
                                              <div className="flex items-center justify-end gap-2 mt-2 sm:mt-0 sm:absolute sm:-right-3 sm:top-0 print:hidden opacity-100 sm:opacity-0 sm:group-hover/sub:opacity-100 transition-opacity bg-white dark:bg-slate-800 border rounded shadow-sm p-0.5 z-20 w-fit ml-auto sm:ml-0">
                                                  <input 
                                                    type="number" 
                                                    step="0.1"
                                                    min="0"
                                                    className="w-12 text-center text-xs border rounded p-0.5 bg-slate-50 dark:bg-slate-700 dark:text-slate-200" 
                                                    value={item.subPoints?.[sqIdx] ?? 1}
                                                    onChange={(e) => updateSubPoints(sIdx, qIdx, sqIdx, Number(e.target.value))}
                                                  />
                                                  <span className="text-[9px] text-slate-400">pts</span>
                                              </div>
                                              <div className="flex justify-between pr-8">
                                                  <p className="font-bold mb-1 text-base dark:text-slate-200">{sqIdx + 1}) {sq.text}</p>
                                              </div>
                                              {sq.options && sq.options.length > 0 && (
                                                  <div className={`grid gap-x-6 gap-y-1 grid-cols-${getOptionGridColumns(sq.options.map(o => o.text))}`}>
                                                      {sq.options.map((opt, oIdx) => {
                                                          const isCorrect = (String.fromCharCode(65 + oIdx) === sq.correctOptionId) || (opt.id === sq.correctOptionId);
                                                          return (
                                                              <div key={oIdx} className="flex flex-col gap-1">
                                                                  <div className="flex gap-2 items-start text-base">
                                                                      <span className={`font-bold ${showAnswers && isCorrect ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>{String.fromCharCode(65 + oIdx)}.</span>
                                                                      <span className={`${showAnswers && isCorrect ? 'text-red-600 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>{opt.text}</span>
                                                                  </div>
                                                                  {opt.imageUrl && (
                                                                      <img src={opt.imageUrl} alt={`Option ${String.fromCharCode(65 + oIdx)}`} className="max-w-xs rounded border ml-6" />
                                                                  )}
                                                              </div>
                                                          );
                                                      })}
                                                  </div>
                                              )}
                                          </div>
                                        ))}
                                      </div>
                                  ) : (
                                      <>
                                          <ExamStemRenderer
                                            content={{
                                              stem: q.text,
                                              correctAnswer: (() => {
                                                // For blank-in-stem MCQ, pass the actual correct option text
                                                if (q.options && q.options.length > 0) {
                                                  const byId = q.options.find(o => o.id === q.correctOptionId)?.text;
                                                  if (byId) return byId;
                                                  if (q.correctOptionId && /^[A-Z]$/.test(q.correctOptionId)) {
                                                    const idx = q.correctOptionId.charCodeAt(0) - 65;
                                                    return q.options[idx]?.text || q.correctOptionId;
                                                  }
                                                }
                                                // For true fill-in questions (no options), correctOptionId is treated as the answer text
                                                return q.correctOptionId;
                                              })(),
                                              explanation: q.explanation,
                                              options: q.options?.map(o => o.text),
                                            }}
                                            type={q.type}
                                            showAnswers={showAnswers}
                                          />
                                          {/* Question image */}
                                          {q.imageUrl && (
                                              <div className="my-2">
                                                <img src={q.imageUrl} alt="Question" className="max-w-[200px] h-auto rounded border" />
                                              </div>
                                          )}
                                      </>
                                  )}
                              </div>
                           </div>
                           
                           {!isReadingSet && !isCloze && (!q.type || q.type === 'multiple-choice') && (
                              q.options && q.options.length > 0 ? (
                                <div className={`grid gap-x-6 gap-y-1.5 grid-cols-${getOptionGridColumns(q.options.map(o => o.text))}`}>
                                   {q.options.map((opt, oIdx) => {
                                     const isCorrect = (String.fromCharCode(65 + oIdx) === q.correctOptionId) || (opt.id === q.correctOptionId);
                                     return (
                                         <div key={oIdx} className="flex flex-col gap-1">
                                            <div className="flex gap-2 items-start text-sm">
                                                <span className={`font-bold ${showAnswers && isCorrect ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>{String.fromCharCode(65 + oIdx)}.</span>
                                                <span className={`${showAnswers && isCorrect ? 'text-red-600 font-bold' : 'text-slate-800 dark:text-slate-200'}`}>{opt.text}</span>
                                            </div>
                                            {opt.imageUrl && (
                                                <img src={opt.imageUrl} alt={`Option ${String.fromCharCode(65 + oIdx)}`} className="max-w-xs rounded border ml-6" />
                                            )}
                                         </div>
                                     );
                                   })}
                                </div>
                              ) : (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-sm text-amber-700 dark:text-amber-300">
                                  ⚠️ 该题目缺少选项数据，请在题库中编辑此题目
                                </div>
                              )
                           )}
                       </div>
                       
                       <div className="flex items-center gap-2 justify-end w-full sm:w-auto mt-3 sm:mt-0 print:hidden opacity-100 sm:opacity-0 sm:group-hover/item:opacity-100 transition-opacity bg-slate-50 sm:bg-white/95 p-1.5 rounded-lg shadow-sm sm:shadow-lg border border-slate-200 ring-1 ring-slate-200/50 z-20 sm:absolute sm:-right-3 sm:top-0 relative">
                          {isReadingSet ? (
                              <span className="text-[10px] font-bold text-slate-500 px-1">{item.points} pts</span>
                          ) : (
                              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded px-1">
                                <span className="text-[10px] text-slate-400 font-bold px-1">分值:</span>
                                <input type="number" step="0.1" min="0" value={item.points} onChange={(e) => updatePoints(sIdx, qIdx, Number(e.target.value))} className="w-10 text-center bg-transparent p-1 text-xs font-bold outline-none" />
                              </div>
                          )}
                          <div className="w-px h-4 bg-slate-300 mx-1"></div>
                          <button onClick={() => moveItem(sIdx, qIdx, 'up')} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors"><ChevronUp className="w-4 h-4"/></button>
                          <button onClick={() => moveItem(sIdx, qIdx, 'down')} className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-blue-600 rounded transition-colors"><ChevronDown className="w-4 h-4"/></button>
                          <div className="w-px h-4 bg-slate-300 mx-1"></div>
                          <button onClick={() => deleteItem(sIdx, qIdx)} className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition-colors"><Trash2 className="w-4 h-4"/></button>
                       </div>
                    </div>
                  );
                })}
                <div className="mt-2 print:hidden">
                  <button onClick={() => openQuestionSelector(sIdx)} className="w-full py-2 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 hover:bg-blue-50/50 hover:text-blue-600 hover:border-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition-all group-hover/section:border-blue-100">
                    <Plus className="w-4 h-4" /> 添加题目
                  </button>
                </div>
              </div>
            </div>
          )})}
        </div>
        <div className="mt-8 print:hidden">
           <button onClick={addSection} className="w-full py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-100 hover:text-slate-800 flex items-center justify-center gap-3 text-sm shadow-sm transition-all active:scale-[0.99]">
             <Plus className="w-5 h-5" /> 添加 Section
           </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ExamBuilder;
