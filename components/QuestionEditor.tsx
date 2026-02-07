
import React, { useState, useEffect, useRef } from 'react';
import { Question, QuestionType } from '../types';
import { Trash2, Plus, FileText, AlignLeft, List, X, CheckCircle, Puzzle, Keyboard, Wand2 } from 'lucide-react';
import { getOptionGridColumns } from '../utils/optionLayout';
import RichTextEditor, { RichTextEditorHandle } from './RichTextEditor';

interface QuestionEditorProps {
    question: Question;
    index: number;
    onChange: (updatedQ: Question) => void;
    onDelete: () => void;
    onCancel?: () => void;
    onDone?: () => void;
    isSubQuestion?: boolean; 
}

const AutoResizeTextarea = ({ 
    value, 
    onChange, 
    className, 
    placeholder,
    id
}: { 
    value: string; 
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void; 
    className?: string; 
    placeholder?: string;
    id?: string;
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [value]);

    return (
        <textarea
            id={id}
            ref={textareaRef}
            value={value}
            onChange={onChange}
            className={className}
            placeholder={placeholder}
            rows={1}
            style={{ overflow: 'hidden', resize: 'none' }}
        />
    );
};

const QuestionEditor: React.FC<QuestionEditorProps> = ({ question, index, onChange, onDelete, onCancel, onDone, isSubQuestion = false }) => {
    const passageEditorRef = useRef<RichTextEditorHandle | null>(null);
    
    const updateField = (field: keyof Question, value: any) => {
        onChange({ ...question, [field]: value });
    };

    const stripGapHighlights = (html: string) => {
        if (!html) return '';
        return html.replace(/<span\s+data-gap="\d+"[^>]*>(.*?)<\/span>/gi, '$1');
    };

    const highlightGaps = (html: string) => {
        const clean = stripGapHighlights(html);
        let gapIndex = 0;
        return clean.replace(/\{\{\d+\}\}|\(\d+\)\s*_{2,}/g, (match) => {
            gapIndex += 1;
            return `<span data-gap="${gapIndex}" class="bg-amber-100/70 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1 rounded">(${gapIndex}) ____________</span>`;
        });
    };

    const renumberGaps = (html: string) => {
        let idx = 0;
        return html.replace(/\{\{\d+\}\}/g, () => `{{${++idx}}}`);
    };

    // Ensure highlighting is applied on mount for cloze/compound types
    useEffect(() => {
        if (question.type === 'cloze-test' || question.type === 'compound-fill') {
            const passage = question.readingPassage || '';
            if (passage && !passage.includes('data-gap=')) {
                const highlighted = highlightGaps(passage);
                if (highlighted !== passage) {
                    updateField('readingPassage', highlighted);
                }
            }
        }
    }, [question.id, question.type]);

    const updateOption = (optIdx: number, text: string) => {
        const newOpts = [...question.options];
        newOpts[optIdx] = { ...newOpts[optIdx], text };
        onChange({ ...question, options: newOpts });
    };

    const setCorrectOption = (optId: string) => {
        onChange({ ...question, correctOptionId: optId });
    };

    const addSubQuestion = () => {
        const newSubQ: Question = {
            id: `sub-${Date.now()}-${Math.random()}`,
            text: '',
            options: [
                { id: `opt-${Date.now()}-1`, text: '' },
            ],
            correctOptionId: `opt-${Date.now()}-1`,
            explanation: '',
            type: question.type === 'compound-fill' ? 'fill-in-the-blank' : 'multiple-choice'
        };
        
        if (question.type !== 'compound-fill') {
             newSubQ.options.push(
                 { id: `opt-${Date.now()}-2`, text: '' },
                 { id: `opt-${Date.now()}-3`, text: '' },
                 { id: `opt-${Date.now()}-4`, text: '' }
             );
        }

        const currentSubs = question.subQuestions || [];
        updateField('subQuestions', [...currentSubs, newSubQ]);
    };

    const updateSubQuestion = (sIdx: number, updatedSubQ: Question) => {
        const currentSubs = [...(question.subQuestions || [])];
        currentSubs[sIdx] = updatedSubQ;
        updateField('subQuestions', currentSubs);
    };

    const deleteSubQuestion = (sIdx: number) => {
        const currentSubs = [...(question.subQuestions || [])];
        currentSubs.splice(sIdx, 1);
        updateField('subQuestions', currentSubs);
    };

    const syncGapsFromPassage = (html: string) => {
        if (!['cloze-test', 'compound-fill'].includes(question.type || '')) return;

        // 解析所有高亮的 span 标签，提取 data-gap 属性（按 HTML 中的出现顺序）
        const foundGaps: number[] = [];
        const spanRegex = /<span\s+data-gap="(\d+)"[^>]*>.*?<\/span>/g;
        let match;
        while ((match = spanRegex.exec(html)) !== null) {
            foundGaps.push(parseInt(match[1], 10));
        }
        
        const currentSubs = question.subQuestions || [];
        const gapCount = foundGaps.length;

        // 建立当前 HTML 中 gap 编号到子题的映射
        // 先解析当前 HTML，找出每个 gap 对应的子题索引
        const currentGaps: number[] = [];
        const currentHtml = question.readingPassage || '';
        const currentSpanRegex = /<span\s+data-gap="(\d+)"[^>]*>.*?<\/span>/g;
        let currentMatch;
        while ((currentMatch = currentSpanRegex.exec(currentHtml)) !== null) {
            currentGaps.push(parseInt(currentMatch[1], 10));
        }
        
        // 建立旧 gap 编号到子题的映射（按当前 HTML 中的顺序）
        const oldGapToSub: Record<number, Question> = {};
        currentGaps.forEach((gapNum, idx) => {
            if (currentSubs[idx]) {
                oldGapToSub[gapNum] = currentSubs[idx];
            }
        });

        // 按新顺序重建子问题数组（foundGaps 的顺序就是新的位置顺序）
        const newSubs: Question[] = [];
        foundGaps.forEach((oldGapNum, newIdx) => {
            const oldSub = oldGapToSub[oldGapNum];
            if (oldSub) {
                // 保留原有内容，更新题干显示
                newSubs.push({ ...oldSub, text: `Gap ${newIdx + 1}` });
            } else {
                // 新增的挖空（创建新子题）
                const ts = Date.now() + newIdx;
                const newSub: Question = {
                    id: `auto-sub-${ts}`,
                    text: `Gap ${newIdx + 1}`,
                    options: [{ id: `opt-${ts}`, text: '' }],
                    correctOptionId: `opt-${ts}`,
                    explanation: '',
                    type: question.type === 'compound-fill' ? 'fill-in-the-blank' : 'multiple-choice'
                };
                if (question.type === 'cloze-test') {
                    newSub.options = [
                        { id: `opt-${ts}-1`, text: '' },
                        { id: `opt-${ts}-2`, text: '' },
                        { id: `opt-${ts}-3`, text: '' },
                        { id: `opt-${ts}-4`, text: '' }
                    ];
                    newSub.correctOptionId = newSub.options[0].id;
                }
                newSubs.push(newSub);
            }
        });

        // 重新编号所有 gap（确保连续：1, 2, 3...）
        let renumberedHtml = html;
        let gapIndex = 0;
        renumberedHtml = renumberedHtml.replace(/<span\s+data-gap="\d+"([^>]*)>(.*?)<\/span>/g, (fullMatch, attrs, content) => {
            gapIndex++;
            return `<span data-gap="${gapIndex}"${attrs}>(${gapIndex}) ____________</span>`;
        });

        const currentPassage = question.readingPassage || '';
        const shouldUpdatePassage = renumberedHtml !== currentPassage;
        const shouldUpdateSubs =
            gapCount !== currentSubs.length ||
            JSON.stringify(newSubs.map(s => s.id)) !== JSON.stringify(currentSubs.map(s => s.id));

        if (shouldUpdatePassage || shouldUpdateSubs) {
            onChange({
                ...question,
                readingPassage: shouldUpdatePassage ? renumberedHtml : currentPassage,
                subQuestions: shouldUpdateSubs ? newSubs : currentSubs,
            });
        }
    };

    const getTypeConfig = (type: QuestionType) => {
        switch (type) {
            case 'reading-comprehension': return { label: '阅读理解', icon: AlignLeft, color: 'text-orange-600', bg: 'bg-orange-50' };
            case 'cloze-test': return { label: '完型选择', icon: Puzzle, color: 'text-purple-600', bg: 'bg-purple-50' };
            case 'compound-fill': return { label: '复合填空', icon: Keyboard, color: 'text-emerald-600', bg: 'bg-emerald-50' };
            case 'fill-in-the-blank': return { label: '填空题', icon: List, color: 'text-blue-600', bg: 'bg-blue-50' };
            default: return { label: '单选题', icon: FileText, color: 'text-indigo-600', bg: 'bg-white' };
        }
    };

    const config = getTypeConfig(question.type || 'multiple-choice');
    const TypeIcon = config.icon;
    const isComplexContainer = ['reading-comprehension', 'cloze-test', 'compound-fill'].includes(question.type || '');
    const isAutoSyncType = ['cloze-test', 'compound-fill'].includes(question.type || '');

    // --- Compact Sub-Question Render Logic ---
    if (isSubQuestion) {
        return (
            <div className="flex gap-3 items-start p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 transition-colors hover:border-slate-300 dark:hover:border-slate-700">
                <div className="w-6 pt-2.5 font-bold text-slate-400 dark:text-slate-500 text-xs text-center shrink-0">
                    {index + 1}.
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                    {/* Stem (Optional for simple fills, but good for Reading Comp sub-questions) */}
                    {question.type !== 'fill-in-the-blank' && (
                        <AutoResizeTextarea 
                            value={question.text}
                            onChange={e => updateField('text', e.target.value)}
                            className="w-full bg-transparent border-b border-dashed border-slate-200 dark:border-slate-700 p-1 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 transition-colors"
                            placeholder="子问题题干..."
                        />
                    )}

                    {/* Options / Answer */}
                    {question.type === 'fill-in-the-blank' ? (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase shrink-0">Answer:</span>
                            <input 
                                type="text" 
                                value={question.options[0]?.text || ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    const optId = question.options[0]?.id || `opt-${Date.now()}`;
                                    const newOpts = [{ id: optId, text: val }];
                                    onChange({ ...question, options: newOpts, correctOptionId: optId });
                                }}
                                className="flex-1 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded px-2 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-200 outline-none focus:ring-1 focus:ring-emerald-500"
                                placeholder="Correct answer"
                            />
                        </div>
                    ) : (
                        (() => {
                            const cols = getOptionGridColumns((question.options || []).map(o => o.text));
                            const gridColsClass =
                                cols === 4 ? 'grid-cols-2 md:grid-cols-4' :
                                cols === 2 ? 'grid-cols-1 md:grid-cols-2' :
                                'grid-cols-1';

                            return (
                                <div className={`grid ${gridColsClass} gap-2`}>
                                    {question.options.map((opt, oIdx) => (
                                        <div key={opt.id} className={`flex items-center gap-1.5 p-1.5 rounded border transition-all ${question.correctOptionId === opt.id ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800'}`}>
                                            <button 
                                                onClick={() => setCorrectOption(opt.id)}
                                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 ${question.correctOptionId === opt.id ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 hover:border-slate-400'}`}
                                            >
                                                {question.correctOptionId === opt.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </button>
                                            <input 
                                                type="text" 
                                                value={opt.text}
                                                onChange={e => updateOption(oIdx, e.target.value)}
                                                className="flex-1 bg-transparent text-xs outline-none min-w-0"
                                                placeholder={`Opt ${String.fromCharCode(65 + oIdx)}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            );
                        })()
                    )}

                    {/* Explanation */}
                    <div className="flex gap-2 items-start">
                        <span className="text-[10px] font-bold text-slate-400 uppercase mt-1 shrink-0">Exp:</span>
                        <AutoResizeTextarea 
                            value={question.explanation || ''}
                            onChange={e => updateField('explanation', e.target.value)}
                            className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded p-1 text-xs text-slate-500 dark:text-slate-400 outline-none focus:bg-indigo-50 dark:focus:bg-indigo-900/10 transition-colors"
                            placeholder="解析..."
                        />
                    </div>
                </div>
                <button onClick={onDelete} className="p-1.5 text-slate-300 hover:text-red-500 transition-colors self-start">
                    <Trash2 size={14} />
                </button>
            </div>
        );
    }

    // --- Main Parent Editor Render ---
    return (
        <div className="w-full bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden transition-all hover:border-indigo-300 dark:hover:border-indigo-700">
            {/* Main Header */}
            <div className="p-4 border-b bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center font-black text-xs bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700">
                        {index + 1}
                    </div>
                    <div className="flex items-center gap-2">
                        <select 
                            value={question.type || 'multiple-choice'}
                            onChange={(e) => updateField('type', e.target.value)}
                            className="bg-transparent font-bold text-xs text-slate-600 dark:text-slate-300 outline-none cursor-pointer hover:text-indigo-600 transition-colors appearance-none"
                        >
                            <option value="multiple-choice">单选题 (Multiple Choice)</option>
                            <option value="fill-in-the-blank">填空题 (Cloze)</option>
                            <option value="reading-comprehension">阅读理解 (Reading Comp)</option>
                            <option value="cloze-test">完型选择 (Cloze Selection)</option>
                            <option value="compound-fill">复合填空 (Compound Fill)</option>
                        </select>
                        <TypeIcon size={14} className={config.color} />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {onDone && (
                        <button onClick={onDone} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">
                            <CheckCircle className="w-3.5 h-3.5" /> 完成编辑
                        </button>
                    )}
                    {onCancel && (
                        <button onClick={onCancel} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                            <X className="w-3.5 h-3.5" /> 取消编辑
                        </button>
                    )}
                    <button onClick={onDelete} className="p-1.5 text-slate-300 dark:text-slate-700 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
            
            <div className="p-5 space-y-5">
                {/* Complex Types: Left-Right Layout (Passage Left, Sub-Questions Right) */}
                {isComplexContainer && (
                    <div className="flex flex-col lg:flex-row gap-5 items-stretch">
                        {/* Left: Passage (was 60%, now ~40% on large screens for more room on right) */}
                        <div className="w-full lg:w-[40%] space-y-2 shrink-0 flex flex-col">
                            <div className="flex justify-between items-center">
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    {question.type === 'reading-comprehension' ? '阅读文章' : '文章内容 (含挖空)'}
                                </label>
                            </div>
                            <RichTextEditor
                                ref={passageEditorRef}
                                value={question.readingPassage || ''}
                                onChange={(html) => {
                                    if (question.type === 'reading-comprehension') {
                                        updateField('readingPassage', html);
                                        return;
                                    }
                                    syncGapsFromPassage(html);
                                }}
                                placeholder={question.type === 'reading-comprehension' ? "在此粘贴或输入阅读理解的文章内容..." : "例如: Je suis (1) ________ à Paris. Il (2) ________ beau."}
                                minHeight="260px"
                                contentClassName="text-justify"
                                onAddCloze={isAutoSyncType ? () => {
                                    // 使用临时大编号避免冲突，syncGapsFromPassage 会重新分配连续编号
                                    const tempNum = Date.now();
                                    return `<span data-gap="${tempNum}" class="bg-amber-100/70 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1 rounded">(${tempNum}) ____________</span>`;
                                } : undefined}
                            />
                            {isAutoSyncType && (
                                <p className="text-[10px] text-slate-400 italic">
                                    * 子问题将根据文章中的 {`{{1}}, {{2}}`} 标记自动生成或删除，支持中间位置插入/删除并自动重排序号。
                                </p>
                            )}
                        </div>

                        {/* Right: Sub-Questions */}
                        <div className="w-full lg:flex-1 min-w-0 space-y-3 flex flex-col">
                            <div className="flex justify-between items-end border-b border-slate-100 dark:border-slate-800 pb-2">
                                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    {question.type === 'reading-comprehension' ? '子问题列表' : '挖空项详情'} ({question.subQuestions?.length || 0})
                                </label>
                                {question.type === 'reading-comprehension' && (
                                    <button onClick={addSubQuestion} className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1">
                                        <Plus size={12} /> 添加子问题
                                    </button>
                                )}
                            </div>
                            <div className="space-y-2 flex-1 overflow-y-auto no-scrollbar pr-1 min-h-[260px]">
                                {question.subQuestions && question.subQuestions.map((subQ, sIdx) => (
                                    <QuestionEditor 
                                        key={subQ.id}
                                        question={subQ}
                                        index={sIdx}
                                        onChange={(updated) => updateSubQuestion(sIdx, updated)}
                                        onDelete={() => deleteSubQuestion(sIdx)}
                                        isSubQuestion={true}
                                    />
                                ))}
                                {(!question.subQuestions || question.subQuestions.length === 0) && (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-center border border-dashed border-slate-200 dark:border-slate-700">
                                        <p className="text-xs text-slate-400 italic">
                                            {isAutoSyncType ? "请在文章中使用 {{1}} 格式添加挖空，子问题将自动出现。" : "暂无子问题，请点击右上角添加。"}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Question Stem (Not for Reading/Cloze main editor if they are containers) */}
                {!isComplexContainer && (
                    <div>
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                            {question.type === 'fill-in-the-blank' ? '填空题干 (使用 ___ 代表空缺)' : '题干内容'}
                        </label>
                        <RichTextEditor
                            value={question.text || ''}
                            onChange={(html) => updateField('text', html)}
                            placeholder={question.type === 'fill-in-the-blank' ? "例如: Je m'appelle ___." : "在此输入题干内容..."}
                            minHeight="150px"
                        />
                    </div>
                )}

                {/* Options for simple types (MCQ / Fill-in) */}
                {!isComplexContainer && question.type === 'fill-in-the-blank' ? (
                    /* Correct Answer for Fill-in or Compound-Fill Sub-item */
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                            标准答案
                        </label>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800">
                                <CheckCircle size={16} />
                            </div>
                            <input 
                                type="text" 
                                value={question.options[0]?.text || ''}
                                onChange={e => {
                                    const val = e.target.value;
                                    const optId = question.options[0]?.id || `opt-${Date.now()}`;
                                    const newOpts = [{ id: optId, text: val }];
                                    onChange({ ...question, options: newOpts, correctOptionId: optId });
                                }}
                                className="flex-1 border rounded-xl px-3 py-2 text-sm outline-none transition-all border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10 text-blue-900 dark:text-blue-200 font-bold"
                                placeholder="输入唯一的正确单词或短语..."
                            />
                        </div>
                    </div>
                ) : (
                    /* Options for MCQ */
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                            选项配置 (勾选正确项)
                        </label>
                        {(() => {
                            const cols = getOptionGridColumns((question.options || []).map(o => o.text));
                            const gridColsClass =
                                cols === 4 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' :
                                cols === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                                'grid-cols-1';

                            return (
                                <div className={`grid ${gridColsClass} gap-3`}>
                                    {question.options.map((opt, oIdx) => (
                                        <div key={opt.id} className={`flex items-center gap-2 p-2 rounded-lg border transition-all ${question.correctOptionId === opt.id ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-950 border-slate-100 dark:border-slate-800'}`}>
                                            <button 
                                                onClick={() => setCorrectOption(opt.id)}
                                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${question.correctOptionId === opt.id ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 dark:border-slate-600 hover:border-slate-400'}`}
                                                title="设为正确答案"
                                            >
                                                {question.correctOptionId === opt.id && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                                            </button>
                                            <input 
                                                type="text" 
                                                value={opt.text}
                                                onChange={e => updateOption(oIdx, e.target.value)}
                                                className="flex-1 bg-transparent text-xs font-medium outline-none min-w-0"
                                                placeholder={`选项 ${String.fromCharCode(65 + oIdx)}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            );
                        })()}
                    </div>
                )}

                {/* Explanation */}
                <div className="pt-2 border-t border-slate-50 dark:border-slate-800">
                    <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">
                        {isComplexContainer ? '整体解析' : '答案解析'}
                    </label>
                    <AutoResizeTextarea 
                        value={question.explanation || ''}
                        onChange={e => updateField('explanation', e.target.value)}
                        className="w-full bg-indigo-50/30 dark:bg-indigo-900/10 border border-transparent focus:border-indigo-200 dark:focus:border-indigo-800 rounded-xl p-3 text-xs text-indigo-900 dark:text-indigo-200 outline-none transition-colors"
                        placeholder={isComplexContainer ? "输入整体解析，帮助学生理解这篇文章..." : "输入解析，帮助学生理解..."}
                    />
                </div>
            </div>
        </div>
    );
};

export default QuestionEditor;
