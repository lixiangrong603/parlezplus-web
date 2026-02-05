
import React, { useState } from 'react';
import { Tag, Plus, X, BarChart } from 'lucide-react';

interface ResourceTaggerProps {
    difficulty: string;
    setDifficulty: (l: any) => void;
    grammarTags: string[];
    setGrammarTags: (t: string[]) => void;
    vocabTags: string[];
    setVocabTags: (t: string[]) => void;
}

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const ResourceTagger: React.FC<ResourceTaggerProps> = ({
    difficulty, setDifficulty,
    grammarTags, setGrammarTags,
    vocabTags, setVocabTags
}) => {
    const [gramInput, setGramInput] = useState('');
    const [vocabInput, setVocabInput] = useState('');

    const addGrammar = () => {
        if(gramInput.trim() && !grammarTags.includes(gramInput.trim())) {
            setGrammarTags([...grammarTags, gramInput.trim()]);
            setGramInput('');
        }
    };

    const addVocab = () => {
        if(vocabInput.trim() && !vocabTags.includes(vocabInput.trim())) {
            setVocabTags([...vocabTags, vocabInput.trim()]);
            setVocabInput('');
        }
    };

    const removeGrammar = (t: string) => setGrammarTags(grammarTags.filter(x => x !== t));
    const removeVocab = (t: string) => setVocabTags(vocabTags.filter(x => x !== t));

    return (
        <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 mb-6 transition-colors">
            <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Tag size={14} /> 资源标签与定级
            </h3>

            {/* Difficulty */}
            <div className="mb-6">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-1">
                    <BarChart size={12} className="text-indigo-500" /> CEFR 难度等级
                </label>
                <div className="flex flex-wrap gap-2">
                    {LEVELS.map(lvl => (
                        <button
                            key={lvl}
                            onClick={() => setDifficulty(lvl)}
                            className={`px-3 py-1.5 rounded-lg font-black text-xs transition-all ${
                                difficulty === lvl 
                                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-200 dark:ring-indigo-900' 
                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700'
                            }`}
                        >
                            {lvl}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Grammar Tags */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">语法考点 (Grammar)</label>
                    <div className="flex gap-2 mb-3">
                        <input 
                            value={gramInput}
                            onChange={e => setGramInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addGrammar()}
                            placeholder="例如: 虚拟式, 复合过去时"
                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        />
                        <button onClick={addGrammar} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded-lg text-slate-500 transition-colors">
                            <Plus size={14} />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {grammarTags.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-md text-[10px] font-bold border border-indigo-100 dark:border-indigo-800">
                                {tag}
                                <button onClick={() => removeGrammar(tag)} className="hover:text-indigo-900 dark:hover:text-indigo-200"><X size={10} /></button>
                            </span>
                        ))}
                        {grammarTags.length === 0 && <span className="text-slate-300 dark:text-slate-600 text-[10px] italic">暂无语法标签</span>}
                    </div>
                </div>

                {/* Vocab Tags */}
                <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">词汇主题 (Vocabulary)</label>
                    <div className="flex gap-2 mb-3">
                        <input 
                            value={vocabInput}
                            onChange={e => setVocabInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addVocab()}
                            placeholder="例如: 商务, 旅游, 美食"
                            className="flex-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                        />
                        <button onClick={addVocab} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 p-2 rounded-lg text-slate-500 transition-colors">
                            <Plus size={14} />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {vocabTags.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-md text-[10px] font-bold border border-emerald-100 dark:border-emerald-800">
                                {tag}
                                <button onClick={() => removeVocab(tag)} className="hover:text-emerald-900 dark:hover:text-emerald-200"><X size={10} /></button>
                            </span>
                        ))}
                        {vocabTags.length === 0 && <span className="text-slate-300 dark:text-slate-600 text-[10px] italic">暂无主题标签</span>}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ResourceTagger;