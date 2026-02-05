
import React, { useState, useEffect } from 'react';
import { KnowledgePoint, Question, QuestionType } from '../types';
import { Sparkles, BrainCircuit, CheckCircle, ArrowRight, Loader2, Save, X, RotateCcw, FileText, List, AlignLeft, Puzzle, Keyboard } from 'lucide-react';
import { useJobs } from '../contexts/JobContext';
import { CURRENT_USER_ID } from '../constants';
import QuestionEditor from './QuestionEditor';

interface QuestionGeneratorWizardProps {
    knowledgePoints: KnowledgePoint[];
    onClose: () => void;
    onSave: (questions: Question[]) => void;
    initialJobId?: string | null;
    onJobStarted?: (jobId: string) => void;
}

const QuestionGeneratorWizard: React.FC<QuestionGeneratorWizardProps> = ({ 
    knowledgePoints: initialKnowledgePoints, onClose, onSave, initialJobId, onJobStarted 
}) => {
    const { startSyllabusQuizGeneration, jobs, clearJob } = useJobs();
    
    const [localKnowledgePoints, setLocalKnowledgePoints] = useState<KnowledgePoint[]>(initialKnowledgePoints);

    // Steps: 'config' -> 'generating' -> 'review'
    // If initialJobId exists, we determine step based on job status in useEffect
    const [step, setStep] = useState<'config' | 'generating' | 'review'>(initialJobId ? 'generating' : 'config');
    const [config, setConfig] = useState({
        difficulty: 'B1',
        count: 2, // Default per topic count
        type: 'multiple-choice' as QuestionType,
        subQuestionCount: 3,
        customPrompt: ''
    });
    
    const [jobId, setJobId] = useState<string>(initialJobId || '');
    const [generatedQuestions, setGeneratedQuestions] = useState<Question[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Monitor Job Status
    useEffect(() => {
        if (!jobId) return;
        const job = jobs[jobId];
        if (job) {
            if (job.status === 'completed' && job.result?.questions) {
                // Questions already have knowledgePointIds assigned by the worker
                // Only enforce type if not set correctly
                const linkedQuestions = job.result.questions.map(q => ({
                    ...q,
                    // Keep the knowledgePointIds from worker (each question has its own KP)
                    // If generated questions don't have type set correctly by worker, enforce it here
                    type: q.type || config.type 
                }));
                setGeneratedQuestions(linkedQuestions);
                setStep('review');
                // IMPORTANT: Do NOT clearJob(jobId) here automatically. 
                // We want the result to persist so we can review it even if we close/reopen this modal.
                // The parent component or explicit actions (Save/Discard) should handle clearing.
            } else if (job.status === 'error') {
                setError(job.error || '生成失败');
                setStep('config');
                // Keep job in context so error persists until user dismisses or starts new
            } else if (job.status === 'processing') {
                setStep('generating');
            }
        }
    }, [jobId, jobs, localKnowledgePoints, config.type]);

    const handleGenerate = () => {
        if (localKnowledgePoints.length === 0) {
            setError("请至少保留一个知识点");
            return;
        }

        const apiKey = localStorage.getItem(`${CURRENT_USER_ID}_gemini_api_key`);
        if (!apiKey) {
            alert("请先在教师设置中配置 Gemini API Key");
            return;
        }

        const newJobId = `gen-quiz-${Date.now()}`;
        setJobId(newJobId);
        if (onJobStarted) onJobStarted(newJobId);
        
        setError(null);
        setStep('generating');
        
        // Calculate total count based on logic
        let totalCount = config.count;
        if (['reading-comprehension', 'cloze-test', 'compound-fill'].includes(config.type!)) {
            // For complex passage-based types, count is the number of passages
            totalCount = config.count;
        } else {
            // For MC and Cloze (single sentence), count is per topic
            totalCount = config.count * localKnowledgePoints.length;
        }

        // Pass distinct arguments including subQuestionCount
        startSyllabusQuizGeneration(
            newJobId, 
            localKnowledgePoints, 
            totalCount, 
            config.difficulty, 
            config.type,
            config.subQuestionCount,
            apiKey,
            config.customPrompt
        );
    };

    const handleQuestionUpdate = (idx: number, updatedQ: Question) => {
        const newQs = [...generatedQuestions];
        newQs[idx] = updatedQ;
        setGeneratedQuestions(newQs);
    };

    const handleQuestionDelete = (idx: number) => {
        const newQs = [...generatedQuestions];
        newQs.splice(idx, 1);
        setGeneratedQuestions(newQs);
    };

    const handleFinalSave = () => {
        onSave(generatedQuestions);
    };

    const removeKnowledgePoint = (id: string) => {
        setLocalKnowledgePoints(prev => prev.filter(kp => kp.id !== id));
    };

    const isComplexType = ['reading-comprehension', 'cloze-test', 'compound-fill'].includes(config.type!);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-[95vw] xl:max-w-[90vw] h-[95vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden border dark:border-slate-800 transition-colors">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                            <Sparkles size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">AI 智能出题向导</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                {step === 'generating' ? '后台生成中...' : '基于选定的知识点自动生成'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content Body */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-8 bg-slate-50 dark:bg-slate-950/30">
                    
                    {step === 'config' && (
                        <div className="max-w-xl mx-auto space-y-8 animate-fade-in-up">
                            {error && (
                                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-bold border border-red-100">
                                    出错了: {error}
                                </div>
                            )}

                            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-indigo-100 dark:border-slate-800 shadow-sm">
                                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">已选考点 Focus Topics ({localKnowledgePoints.length})</h4>
                                <div className="flex flex-wrap gap-2">
                                    {localKnowledgePoints.map(kp => (
                                        <div key={kp.id} className="flex items-center gap-1 pl-3 pr-1 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold border border-indigo-100 dark:border-indigo-800 group">
                                            {kp.name}
                                            <button 
                                                onClick={() => removeKnowledgePoint(kp.id)}
                                                className="p-0.5 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    {localKnowledgePoints.length === 0 && (
                                        <span className="text-xs text-red-500 font-bold">请至少保留一个考点</span>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">题目类型</label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                        {[
                                            { id: 'multiple-choice', icon: FileText, label: '单选' },
                                            { id: 'fill-in-the-blank', icon: List, label: '填空' },
                                            { id: 'reading-comprehension', icon: AlignLeft, label: '阅读' },
                                            { id: 'cloze-test', icon: Puzzle, label: '完型选择' },
                                            { id: 'compound-fill', icon: Keyboard, label: '复合填空' }
                                        ].map(t => (
                                            <button 
                                                key={t.id}
                                                onClick={() => setConfig({...config, type: t.id as any})}
                                                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-xl border transition-all ${config.type === t.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                            >
                                                <t.icon size={18} />
                                                <span className="text-xs font-bold">{t.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">CEFR 难度</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(lvl => (
                                            <button 
                                                key={lvl}
                                                onClick={() => setConfig({...config, difficulty: lvl})}
                                                className={`py-2 rounded-lg text-xs font-bold border transition-all ${config.difficulty === lvl ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}
                                            >
                                                {lvl}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-3 md:col-span-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                                        {isComplexType ? '文章篇数' : '每个知识点生成题数'}
                                        {!isComplexType && (
                                            <span className="text-xs font-normal text-slate-400">
                                                (共 {localKnowledgePoints.length} 个知识点)
                                            </span>
                                        )}
                                    </label>
                                    <div className="flex items-center gap-4">
                                        <input 
                                            type="range" 
                                            min="1" max={isComplexType ? 5 : 5} 
                                            value={config.count} 
                                            onChange={e => setConfig({...config, count: parseInt(e.target.value)})}
                                            className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                                        />
                                        <div className="text-center font-black text-indigo-600 text-lg w-12">{config.count}</div>
                                    </div>
                                    {!isComplexType && (
                                        <p className="text-xs text-slate-400 dark:text-slate-500 text-right">
                                            预计共生成 <span className="font-bold text-indigo-600 dark:text-indigo-400">{config.count * localKnowledgePoints.length}</span> 道题
                                        </p>
                                    )}
                                </div>

                                {isComplexType && (
                                    <div className="space-y-3 md:col-span-2 animate-fade-in">
                                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">
                                            {config.type === 'reading-comprehension' ? '每篇子问题数量' : '每篇挖空数量'}
                                        </label>
                                        <div className="flex items-center gap-4">
                                            <input 
                                                type="range" 
                                                min="2" max={20} 
                                                value={config.subQuestionCount} 
                                                onChange={e => setConfig({...config, subQuestionCount: parseInt(e.target.value)})}
                                                className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                            />
                                            <div className="text-center font-black text-orange-500 text-lg w-12">{config.subQuestionCount}</div>
                                        </div>
                                        <p className="text-[10px] text-slate-400">生成的文章将适配 {config.difficulty} 难度字数要求。</p>
                                    </div>
                                )}

                                <div className="space-y-3 md:col-span-2">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">额外指令 (Optional)</label>
                                    <textarea 
                                        value={config.customPrompt}
                                        onChange={e => setConfig({...config, customPrompt: e.target.value})}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white resize-none"
                                        rows={3}
                                        placeholder="例如：请使用商务场景对话；增加关于'面试'的词汇；保持语气幽默..."
                                    />
                                </div>
                            </div>

                            <div className="pt-8">
                                <button 
                                    onClick={handleGenerate}
                                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 dark:shadow-none flex items-center justify-center gap-3 transition-transform active:scale-95"
                                >
                                    <BrainCircuit size={24} />
                                    开始生成
                                    <ArrowRight size={20} className="opacity-50" />
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'generating' && (
                        <div className="h-full flex flex-col items-center justify-center text-center animate-fade-in">
                            <div className="relative w-24 h-24 mb-8">
                                <div className="absolute inset-0 border-4 border-indigo-100 dark:border-slate-800 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                                <Sparkles className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={32} />
                            </div>
                            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-2">AI 老师正在出题...</h3>
                            <p className="text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-8">
                                正在根据 {localKnowledgePoints.length} 个知识点构建 {config.difficulty} 难度的真实场景语料。
                            </p>
                            <button 
                                onClick={onClose} 
                                className="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                            >
                                最小化到后台
                            </button>
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="w-full space-y-6 animate-fade-in">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-bold text-slate-700 dark:text-slate-300">生成结果预览 ({generatedQuestions.length})</h4>
                                <button onClick={() => setStep('config')} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                                    <RotateCcw size={12} /> 重新生成
                                </button>
                            </div>
                            
                            <div className="space-y-6">
                                {generatedQuestions.map((q, idx) => (
                                    <QuestionEditor 
                                        key={q.id} 
                                        question={q} 
                                        index={idx} 
                                        onChange={(updated) => handleQuestionUpdate(idx, updated)}
                                        onDelete={() => handleQuestionDelete(idx)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer Actions (Review Step Only) */}
                {step === 'review' && (
                    <div className="p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                        <button onClick={onClose} className="px-6 py-3 rounded-xl text-slate-500 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                            放弃
                        </button>
                        <button 
                            onClick={handleFinalSave}
                            disabled={generatedQuestions.length === 0}
                            className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black shadow-lg flex items-center gap-2 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save size={18} />
                            保存到题库
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default QuestionGeneratorWizard;
