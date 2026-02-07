
import React, { useEffect, useMemo, useState } from 'react';
import { Question, QuestionType, KnowledgePoint, KnowledgePointType } from '../types';
import { Search, Filter, Edit3, Trash2, FileText, List, AlignLeft, Layers, Puzzle, Keyboard, BookA, Calendar, ArrowDown, ArrowUp, Clock } from 'lucide-react';
import { getOptionGridColumns } from '../utils/optionLayout';

interface QuestionListProps {
  questions: Question[];
  onEdit: (q: Question) => void;
  onDelete: (id: string) => void;
  knowledgePointMap?: Record<string, KnowledgePoint>; // Optional map to resolve KP names
}

type SortOrder = 'newest' | 'oldest';

const QuestionList: React.FC<QuestionListProps> = ({ questions, onEdit, onDelete, knowledgePointMap }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<QuestionType | 'all'>('all');
  const [filterLevel, setFilterLevel] = useState<string>('all');
  const [filterKPType, setFilterKPType] = useState<KnowledgePointType | 'all'>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  const normalizeText = (value?: string) => {
    if (!value) return '';
    return value
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  };

  const renderGapPlaceholders = (html?: string) => {
    if (!html) return '';
    return html.replace(/\{\{(\d+)\}\}/g, '<span class="inline-block bg-amber-100/70 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1 rounded">($1) ____________</span>');
  };

  const stripHtmlForDisplay = (html?: string) => {
    if (!html) return '';
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .trim();
  };

  const buildSearchBlob = (q: Question) => {
    const parts: string[] = [];
    if (q.text) parts.push(normalizeText(q.text));
    if (q.readingPassage) parts.push(normalizeText(q.readingPassage));

    if (q.options?.length) {
      q.options.forEach(opt => parts.push(normalizeText(opt.text)));
    }

    if (q.subQuestions?.length) {
      q.subQuestions.forEach(sq => {
        if (sq.text) parts.push(normalizeText(sq.text));
        if (sq.options?.length) {
          sq.options.forEach(opt => parts.push(normalizeText(opt.text)));
        }
      });
    }

    return parts.filter(Boolean).join(' ');
  };

  const filteredQuestions = useMemo(() => {
    const term = normalizeText(searchTerm);
    let result = questions.filter(q => {
      const blob = buildSearchBlob(q);
      const matchesSearch = term.length === 0 ? true : blob.includes(term);
      const matchesType = filterType === 'all' || q.type === filterType;
      const matchesLevel = filterLevel === 'all' || q.level === filterLevel;
      
      let matchesKPType = true;
      if (filterKPType !== 'all' && knowledgePointMap && q.knowledgePointIds) {
          // Check if any of the question's KPs match the filter type
          const hasMatchingKP = q.knowledgePointIds.some(kpId => {
              const kp = knowledgePointMap[kpId];
              return kp && kp.type === filterKPType;
          });
          if (!hasMatchingKP) matchesKPType = false;
      }

      return matchesSearch && matchesType && matchesLevel && matchesKPType;
    });

    // Sorting
    result.sort((a, b) => {
        const timeA = a.createdAt || 0;
        const timeB = b.createdAt || 0;
        return sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [questions, searchTerm, filterType, filterLevel, filterKPType, sortOrder, knowledgePointMap]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterType, filterLevel, filterKPType, sortOrder, questions.length]);

  const totalItems = filteredQuestions.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedQuestions = filteredQuestions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getTypeIcon = (type?: QuestionType) => {
    switch (type) {
      case 'reading-comprehension': return <AlignLeft size={14} />;
      case 'cloze-test': return <Puzzle size={14} />;
      case 'compound-fill': return <Keyboard size={14} />;
      case 'fill-in-the-blank': return <List size={14} />;
      default: return <FileText size={14} />;
    }
  };

  const getTypeLabel = (type?: QuestionType) => {
    switch (type) {
      case 'reading-comprehension': return '阅读理解';
      case 'cloze-test': return '完型选择';
      case 'compound-fill': return '复合填空';
      case 'fill-in-the-blank': return '填空题';
      default: return '单选题';
    }
  };

  const getKPTypeConfig = (type: string) => {
    switch(type) {
        case 'grammar': return { icon: Puzzle, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' };
        case 'vocabulary': return { icon: BookA, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20' };
        case 'reading': return { icon: AlignLeft, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' };
        default: return { icon: FileText, color: 'text-slate-500', bg: 'bg-slate-100' };
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      {/* Filters Toolbar */}
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm w-full shrink-0">
        <div className="relative w-full xl:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="搜索题目关键字..." 
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors dark:text-white"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3 w-full xl:w-auto items-center">
          {/* Sort Order */}
          <button 
            onClick={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors min-w-[120px]"
          >
             <Clock size={14} className="text-indigo-500" />
             {sortOrder === 'newest' ? '最新创建' : '最早创建'}
             {sortOrder === 'newest' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
          </button>

          <div className="w-[1px] h-8 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

          {/* KP Type Filter */}
          <div className="relative group">
             <select 
              value={filterKPType}
              onChange={e => setFilterKPType(e.target.value as any)}
              className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[120px]"
            >
              <option value="all">所有知识点</option>
              <option value="grammar">语法 (Grammar)</option>
              <option value="vocabulary">词汇 (Vocab)</option>
              <option value="reading">阅读 (Reading)</option>
            </select>
            <Filter size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative group">
            <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value as any)}
              className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[120px]"
            >
              <option value="all">所有题型</option>
              <option value="multiple-choice">单选题</option>
              <option value="fill-in-the-blank">填空题</option>
              <option value="reading-comprehension">阅读理解</option>
              <option value="cloze-test">完型选择</option>
              <option value="compound-fill">复合填空</option>
            </select>
            <Layers size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
             <select 
              value={filterLevel}
              onChange={e => setFilterLevel(e.target.value)}
              className="appearance-none bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer min-w-[100px]"
            >
              <option value="all">所有等级</option>
              <option value="A1">A1</option>
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
              <option value="C1">C1</option>
              <option value="C2">C2</option>
            </select>
            <Layers size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Questions Grid */}
      <div className="flex-1 overflow-y-auto mt-4 no-scrollbar">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">共 {totalItems} 题</div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs"
            >
              <option value={8}>8</option>
              <option value={12}>12</option>
              <option value={16}>16</option>
              <option value={24}>24</option>
            </select>
            <span>题</span>
          </div>
        </div>
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-20 text-slate-400 dark:text-slate-600">
            <p>没有找到匹配的题目</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
          {pagedQuestions.map((q, idx) => (
            <div key={q.id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
              <div className="flex justify-between items-start mb-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                    q.type === 'reading-comprehension' 
                      ? 'bg-orange-50 dark:bg-orange-900/30 text-orange-600 border-orange-100 dark:border-orange-800' 
                      : q.type === 'cloze-test'
                      ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 border-purple-100 dark:border-purple-800'
                      : q.type === 'compound-fill'
                      ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 border-emerald-100 dark:border-emerald-800'
                      : q.type === 'fill-in-the-blank'
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 border-blue-100 dark:border-blue-800'
                      : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 border-indigo-100 dark:border-indigo-800'
                  }`}>
                    {getTypeIcon(q.type)} {getTypeLabel(q.type)}
                  </span>
                  <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold border dark:border-slate-700">
                    {q.level || 'UNSET'}
                  </span>
                  
                  {/* Knowledge Point Tags */}
                  {knowledgePointMap && q.knowledgePointIds && q.knowledgePointIds.map(kpId => {
                      const kp = knowledgePointMap[kpId];
                      if (!kp) return null;
                      const conf = getKPTypeConfig(kp.type);
                      const Icon = conf.icon;
                      return (
                          <span key={kpId} className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${conf.bg} ${conf.color} border-transparent`}>
                              <Icon size={10} /> {kp.name}
                          </span>
                      );
                  })}

                  {/* Created Date */}
                  {q.createdAt && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500 ml-1">
                          <Calendar size={10} /> {new Date(q.createdAt).toLocaleDateString()}
                      </span>
                  )}
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEdit(q)} className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 rounded-lg transition-colors">
                    <Edit3 size={14} />
                  </button>
                  <button onClick={() => onDelete(q.id)} className="p-1.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-red-500 rounded-lg transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {(q.type === 'reading-comprehension' || q.type === 'cloze-test' || q.type === 'compound-fill') ? (
                <div className="mb-2">
                  <div className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-1">文章片段</div>
                  <div 
                    className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800 mb-2 text-justify prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: renderGapPlaceholders(q.readingPassage) || "<span class='text-slate-400'>无文章内容</span>" }}
                  />
                </div>
              ) : (
                <div 
                  className="font-bold text-slate-800 dark:text-slate-100 mb-3 text-sm line-clamp-2 prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: q.text || '<span class="text-slate-400">无题干</span>' }}
                />
              )}

              {q.type !== 'reading-comprehension' && q.type !== 'cloze-test' && q.type !== 'compound-fill' && (
                (() => {
                  const firstFour = q.options.slice(0, 4);
                  const cols = getOptionGridColumns(firstFour.map(o => o.text));
                  const gridColsClass =
                    cols === 4 ? 'grid-cols-2 lg:grid-cols-4' :
                    cols === 2 ? 'grid-cols-1 lg:grid-cols-2' :
                    'grid-cols-1';

                  return (
                    <div className={`grid gap-2 ${gridColsClass}`}>
                      {firstFour.map((opt, i) => (
                        <div key={opt.id} className={`flex items-start gap-2 text-xs p-2 rounded-lg border min-w-0 ${opt.id === q.correctOptionId ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'border-slate-100 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center border text-[9px] shrink-0 mt-0.5 ${opt.id === q.correctOptionId ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                            {String.fromCharCode(65 + i)}
                          </div>
                          <span className={cols === 4 ? 'truncate' : 'whitespace-normal break-words'}>{opt.text}</span>
                        </div>
                      ))}
                      {q.options.length > 4 && <div className="text-[10px] text-slate-400 pl-2 col-span-full">... 更多选项</div>}
                    </div>
                  );
                })()
              )}
            </div>
          ))}
          </div>
        )}

        {totalItems > 0 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              disabled={currentPage === 1}
            >
              上一页
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
              disabled={currentPage === totalPages}
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionList;
