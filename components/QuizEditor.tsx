
import React, { useState, useRef } from 'react';
import { Question, QuestionOption } from '../types';
import { useJobs } from '../contexts/JobContext';
import { 
    Plus, Trash2, Image as ImageIcon, Sparkles, 
    AlertCircle, GripVertical, X, Minus
} from 'lucide-react';

// --- SHARED MODAL COMPONENT ---
const CustomConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "确认", 
  cancelText = "取消",
  type = "danger" 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void, 
  title: string, 
  message: string, 
  confirmText?: string, 
  cancelText?: string,
  type?: "danger" | "info"
}) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}>
            {type === 'danger' ? <Trash2 size={32} /> : <AlertCircle size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
                <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all">{cancelText}</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-[1.5] py-3 text-sm font-black text-white rounded-xl shadow-lg transition-all active:scale-95 ${type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-100 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

interface QuizEditorProps {
    questions: Question[];
    onChange: (questions: Question[]) => void;
    fullText: string; // Resource's full text for AI generation
    geminiKey: string;
    onOpenSettings: () => void;
    resourceId?: string; // Needed for starting background task
}

const QuizEditor: React.FC<QuizEditorProps> = ({ 
    questions, onChange, fullText, geminiKey, onOpenSettings, resourceId
}) => {
    // Context - using useJobs to access startQuizGeneration
    const { startQuizGeneration } = useJobs();

    // Generator State
    const [genCount, setGenCount] = useState(3);
    const [genLevel, setGenLevel] = useState('B1');
    const [error, setError] = useState<string | null>(null);

    // Editing State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [activeUploadContext, setActiveUploadContext] = useState<{ qIndex: number, optIndex?: number } | null>(null);
    const [confirmDeleteIdx, setConfirmDeleteIdx] = useState<number | null>(null);

    // --- Actions ---

    const handleGenerate = async () => {
        if (!geminiKey) {
            onOpenSettings();
            return;
        }
        if (!fullText.trim()) {
            setError("资源文本内容为空，请先完成字幕编辑。");
            return;
        }
        if (!resourceId) {
             setError("资源 ID 缺失。");
             return;
        }

        setError(null);
        startQuizGeneration(resourceId, fullText, genCount, genLevel, geminiKey);
    };

    const addQuestion = () => {
        const newQ: Question = {
            id: `manual-${Date.now()}`,
            text: '',
            options: [
                { id: `opt-${Date.now()}-1`, text: '' },
                { id: `opt-${Date.now()}-2`, text: '' },
                { id: `opt-${Date.now()}-3`, text: '' },
                { id: `opt-${Date.now()}-4`, text: '' },
            ],
            correctOptionId: `opt-${Date.now()}-1`,
            explanation: ''
        };
        onChange([...questions, newQ]);
    };

    const updateQuestion = (index: number, field: keyof Question, value: any) => {
        const newQuestions = [...questions];
        newQuestions[index] = { ...newQuestions[index], [field]: value };
        onChange(newQuestions);
    };

    const updateOption = (qIndex: number, optIndex: number, field: keyof QuestionOption, value: any) => {
        const newQuestions = [...questions];
        const newOptions = [...newQuestions[qIndex].options];
        newOptions[optIndex] = { ...newOptions[optIndex], [field]: value };
        newQuestions[qIndex] = { ...newQuestions[qIndex], options: newOptions };
        onChange(newQuestions);
    };

    const executeDeleteQuestion = () => {
        if (confirmDeleteIdx === null) return;
        const newQuestions = [...questions];
        newQuestions.splice(confirmDeleteIdx, 1);
        onChange(newQuestions);
        setConfirmDeleteIdx(null);
    };

    const adjustCount = (delta: number) => {
        setGenCount(prev => Math.max(1, Math.min(20, prev + delta)));
    };

    // --- Image Handling ---

    const triggerImageUpload = (qIndex: number, optIndex?: number) => {
        setActiveUploadContext({ qIndex, optIndex });
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !activeUploadContext) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = reader.result as string;
            const { qIndex, optIndex } = activeUploadContext;

            if (optIndex !== undefined) {
                updateOption(qIndex, optIndex, 'imageUrl', base64);
            } else {
                updateQuestion(qIndex, 'imageUrl', base64);
            }
            if (fileInputRef.current) fileInputRef.current.value = '';
            setActiveUploadContext(null);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = (qIndex: number, optIndex?: number) => {
        if (optIndex !== undefined) {
            updateOption(qIndex, optIndex, 'imageUrl', undefined);
        } else {
            updateQuestion(qIndex, 'imageUrl', undefined);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pb-40">
            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleFileChange} 
            />

            <div className="bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800 p-6 rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-sm mb-8 transition-colors">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <h3 className="text-lg font-bold text-indigo-900 dark:text-indigo-400 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-indigo-600" />
                        AI 智能生成题库
                    </h3>
                    
                    <div className="flex items-center gap-3 w-full md:w-auto">
                        <div className="relative">
                            <select 
                                value={genLevel} 
                                onChange={e => setGenLevel(e.target.value)}
                                className="bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 text-indigo-900 dark:text-indigo-300 text-sm rounded-lg focus:ring-indigo-500 block px-3 py-2 outline-none font-bold appearance-none pr-8 cursor-pointer shadow-sm w-24 text-center transition-colors"
                            >
                                <option value="A1">A1 初级</option>
                                <option value="A2">A2 基础</option>
                                <option value="B1">B1 进阶</option>
                                <option value="B2">B2 商务</option>
                                <option value="C1">C1 熟练</option>
                                <option value="C2">C2 精通</option>
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-indigo-600">
                                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                            </div>
                        </div>

                        <div className="flex items-center bg-white dark:bg-slate-800 border border-indigo-200 dark:border-slate-700 rounded-lg shadow-sm">
                            <button onClick={() => adjustCount(-1)} className="px-2 py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-l-lg border-r border-indigo-100 dark:border-slate-700">
                                <Minus className="w-3 h-3" />
                            </button>
                            <input 
                                type="number" 
                                value={genCount} 
                                onChange={e => setGenCount(parseInt(e.target.value) || 1)}
                                className="w-12 text-center text-indigo-900 dark:text-indigo-300 font-bold text-sm outline-none p-1 bg-transparent appearance-none"
                                min={1}
                                max={20}
                            />
                            <button onClick={() => adjustCount(1)} className="px-2 py-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-r-lg border-l border-indigo-100 dark:border-slate-700">
                                <Plus className="w-3 h-3" />
                            </button>
                        </div>

                        <button 
                            onClick={handleGenerate} 
                            className="text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-300 font-black rounded-lg text-sm px-6 py-2.5 flex items-center gap-2 shadow-sm transition-all whitespace-nowrap"
                        >
                            <Sparkles className="w-4 h-4" />
                            立即生成
                        </button>
                    </div>
                </div>
                {error && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-2 text-sm border border-red-100 dark:border-red-900/30">
                        <AlertCircle className="w-4 h-4" /> {error}
                    </div>
                )}
            </div>

            <div className="space-y-6">
                {questions.length === 0 && (
                    <div className="text-center py-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-400 dark:text-slate-600">
                        暂无题目。请点击上方按钮智能生成，或手动添加。
                    </div>
                )}

                {questions.map((q, qIdx) => (
                    <div key={q.id} className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                            <span className="font-bold text-slate-500 dark:text-slate-400 text-xs flex items-center gap-2">
                                <GripVertical className="w-4 h-4 text-slate-300 dark:text-slate-700 cursor-move" /> 第 {qIdx + 1} 题
                            </span>
                            <button onClick={() => setConfirmDeleteIdx(qIdx)} className="p-1.5 text-slate-300 dark:text-slate-700 hover:text-red-500 transition-colors">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                        
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">题干内容</label>
                                <div className="flex gap-2 items-start">
                                    <textarea 
                                        value={q.text}
                                        onChange={e => updateQuestion(qIdx, 'text', e.target.value)}
                                        className="flex-1 w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-colors"
                                        rows={2}
                                        placeholder="请输入问题描述..."
                                    />
                                    <button 
                                        onClick={() => triggerImageUpload(qIdx)}
                                        className={`p-3 rounded-xl border transition-colors ${q.imageUrl ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                        title="为题干添加图片"
                                    >
                                        <ImageIcon className="w-5 h-5" />
                                    </button>
                                </div>
                                {q.imageUrl && (
                                    <div className="mt-3 relative inline-block group/img">
                                        <img src={q.imageUrl} alt="Prompt" className="h-32 rounded-xl border border-slate-200 dark:border-slate-700 object-cover" />
                                        <button 
                                            onClick={() => removeImage(qIdx)}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover/img:opacity-100 transition-opacity"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">选项配置 (勾选正确项)</label>
                                {q.options.map((opt, oIdx) => (
                                    <div key={opt.id} className="flex items-center gap-3">
                                        <input 
                                            type="radio" 
                                            name={`correct-${q.id}`} 
                                            checked={q.correctOptionId === opt.id}
                                            onChange={() => updateQuestion(qIdx, 'correctOptionId', opt.id)}
                                            className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                        />
                                        <div className="flex-1 flex gap-2">
                                            <input 
                                                type="text" 
                                                value={opt.text}
                                                onChange={e => updateOption(qIdx, oIdx, 'text', e.target.value)}
                                                className={`flex-1 border rounded-xl px-4 py-2 text-sm outline-none transition-all ${q.correctOptionId === opt.id ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 font-bold' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-300 focus:border-indigo-400'}`}
                                                placeholder={`选项 ${oIdx + 1}`}
                                            />
                                            <button 
                                                onClick={() => triggerImageUpload(qIdx, oIdx)}
                                                className={`p-2 rounded-xl border transition-colors ${opt.imageUrl ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                                            >
                                                <ImageIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                <div className="flex gap-2 pl-7 flex-wrap mt-2">
                                    {q.options.map((opt, oIdx) => opt.imageUrl && (
                                        <div key={opt.id} className="relative group/optimg">
                                            <img src={opt.imageUrl} alt={`Opt ${oIdx+1}`} className="h-32 rounded-lg border border-slate-200 dark:border-slate-700 object-cover" />
                                            <button 
                                                onClick={() => removeImage(qIdx, oIdx)}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 shadow-md opacity-0 group-hover/optimg:opacity-100 transition-opacity"
                                            >
                                                <X className="w-2 h-2" />
                                            </button>
                                            <div className="absolute bottom-0 right-0 bg-white dark:bg-slate-800 text-[8px] font-bold px-1 rounded-tl border-l border-t border-slate-200 dark:border-slate-700">{oIdx + 1}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">答案解析</label>
                                <textarea 
                                    value={q.explanation || ''}
                                    onChange={e => updateQuestion(qIdx, 'explanation', e.target.value)}
                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-sm text-slate-600 dark:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-colors"
                                    rows={2}
                                    placeholder="解释为什么这个答案是正确的..."
                                />
                            </div>
                        </div>
                    </div>
                ))}

                <button 
                    onClick={addQuestion}
                    className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl text-slate-500 dark:text-slate-500 font-bold hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all flex items-center justify-center gap-2"
                >
                    <Plus className="w-5 h-5" /> 手动添加新题目
                </button>
            </div>

            <CustomConfirmModal 
              isOpen={confirmDeleteIdx !== null}
              onClose={() => setConfirmDeleteIdx(null)}
              onConfirm={executeDeleteQuestion}
              title="删除题目"
              message="确定要删除这道题目吗？此操作无法恢复。"
            />
        </div>
    );
};

export default QuizEditor;
