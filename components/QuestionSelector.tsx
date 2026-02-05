import React, { useState, useEffect, useMemo } from 'react';
import { User, Question, MediaResource } from '../types';
import { getBankQuestions, getResources } from '../utils/storage';
import { Search, Filter, X, CheckSquare, Square, FileText, Layers } from 'lucide-react';

interface QuestionSelectorProps {
  user: User;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
  excludeIds?: string[]; // Already selected question IDs to exclude
}

const QuestionSelector: React.FC<QuestionSelectorProps> = ({ user, onConfirm, onCancel, excludeIds = [] }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'bank' | 'resources'>('all');
  
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [resources, setResources] = useState<MediaResource[]>([]);

  useEffect(() => {
    setBankQuestions(getBankQuestions());
    setResources(getResources());
  }, []);

  // 合并所有可选题目
  const allQuestions = useMemo(() => {
    const questions: Array<Question & { source: string; sourceId: string }> = [];
    
    // 题库中心的题目
    if (sourceFilter === 'all' || sourceFilter === 'bank') {
      bankQuestions
        .filter(q => !excludeIds.includes(q.id))
        .forEach(q => {
          questions.push({ ...q, source: '题库中心', sourceId: 'bank' });
        });
    }
    
    // 多媒体资源的题目
    if (sourceFilter === 'all' || sourceFilter === 'resources') {
      resources.forEach(resource => {
        if (resource.questions && resource.questions.length > 0) {
          resource.questions
            .filter(q => !excludeIds.includes(q.id))
            .forEach(q => {
              questions.push({ ...q, source: resource.title, sourceId: resource.id });
            });
        }
      });
    }
    
    return questions;
  }, [bankQuestions, resources, sourceFilter, excludeIds]);

  // 搜索过滤
  const filteredQuestions = useMemo(() => {
    if (!searchTerm.trim()) return allQuestions;
    const term = searchTerm.toLowerCase();
    return allQuestions.filter(q => 
      q.text.toLowerCase().includes(term) ||
      q.explanation?.toLowerCase().includes(term) ||
      q.level?.toLowerCase().includes(term)
    );
  }, [allQuestions, searchTerm]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredQuestions.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredQuestions.map(q => q.id));
    }
  };

  const handleConfirm = () => {
    if (selectedIds.length === 0) {
      alert('请至少选择一道题目');
      return;
    }
    onConfirm(selectedIds);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">选择题目</h2>
            <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          
          {/* Search & Filter */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="搜索题目内容..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              {[
                { value: 'all', label: '全部', icon: Layers },
                { value: 'bank', label: '题库', icon: FileText },
                { value: 'resources', label: '资源', icon: Filter }
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setSourceFilter(value as any)}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold flex items-center gap-1.5 transition-all ${
                    sourceFilter === value
                      ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Question List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-sm">没有找到题目</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={toggleAll}
                  className="text-sm text-blue-600 hover:text-blue-700 font-bold flex items-center gap-2"
                >
                  {selectedIds.length === filteredQuestions.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                  {selectedIds.length === filteredQuestions.length ? '取消全选' : '全选'}
                </button>
                <span className="text-sm text-slate-500">
                  已选 {selectedIds.length} / {filteredQuestions.length}
                </span>
              </div>
              
              <div className="space-y-3">
                {filteredQuestions.map(q => {
                  const isSelected = selectedIds.includes(q.id);
                  return (
                    <div
                      key={q.id}
                      onClick={() => toggleSelection(q.id)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-blue-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-800 dark:text-slate-200 mb-2 line-clamp-2">
                            {q.text || q.readingPassage?.substring(0, 100) + '...'}
                          </p>
                          
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
                              {q.source}
                            </span>
                            {q.type && (
                              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded">
                                {q.type === 'multiple-choice' && '选择题'}
                                {q.type === 'fill-in-the-blank' && '填空题'}
                                {q.type === 'reading-comprehension' && '阅读理解'}
                                {q.type === 'cloze-test' && '完形填空'}
                              </span>
                            )}
                            {q.level && (
                              <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded">
                                {q.level}
                              </span>
                            )}
                            {q.subQuestions && q.subQuestions.length > 0 && (
                              <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded">
                                {q.subQuestions.length} 小题
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            添加 {selectedIds.length > 0 && `(${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionSelector;
