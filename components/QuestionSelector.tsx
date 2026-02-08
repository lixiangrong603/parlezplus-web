import React, { useState, useEffect, useMemo } from 'react';
import { User, Question, MediaResource, SyllabusCourse, Unit, KnowledgePoint, TranscriptSegment } from '../types';
import { getBankQuestions, getResources, getSyllabusCourses, getChannels } from '../utils/storage';
import { Search, Filter, X, CheckSquare, Square, FileText, Layers, Video, BookOpen, FolderOpen, ChevronDown, Puzzle, BookA, AlignLeft, Calendar } from 'lucide-react';
import UnitTreeSelector from './UnitTreeSelector';
import { getOptionGridColumns } from '../utils/optionLayout';
import { useModal } from '../contexts/ModalContext';
import { stripGapBackgroundHighlight } from '../utils/gapHtml';

// 扩展的Question类型，包含来源信息和资源扩展属性
type ExtendedQuestion = Question & {
  source: string;
  sourceId: string;
  resourceLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  resourceGrammarTags?: string[];
  resourceVocabTags?: string[];
  resourceTranscript?: TranscriptSegment[];
};

interface QuestionSelectorProps {
  user: User;
  onConfirm: (selectedIds: string[]) => void;
  onCancel: () => void;
  excludeIds?: string[]; // Already selected question IDs to exclude
}

const QuestionSelector: React.FC<QuestionSelectorProps> = ({ user, onConfirm, onCancel, excludeIds = [] }) => {
  const modal = useModal();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'bank' | 'resources'>('bank');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [bankQuestions, setBankQuestions] = useState<Question[]>([]);
  const [resources, setResources] = useState<MediaResource[]>([]);
  const [courses, setCourses] = useState<SyllabusCourse[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  
  // Filter states
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [kpTypeFilter, setKpTypeFilter] = useState<string>('ALL');

  useEffect(() => {
    setBankQuestions(getBankQuestions(user.id));
    setResources(getResources(user.id));
    setCourses(getSyllabusCourses(user.id));
    setChannels(getChannels(user.id));
  }, [user.id]);

  // 构建知识点映射
  const knowledgePointMap = useMemo(() => {
    const map: Record<string, KnowledgePoint> = {};
    courses.forEach(course => {
      course.units.forEach(unit => {
        unit.knowledgePoints.forEach(kp => {
          map[kp.id] = kp;
        });
      });
    });
    return map;
  }, [courses]);

  // 构建单元到知识点的映射
  const unitToKnowledgePointsMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    courses.forEach(course => {
      course.units.forEach(unit => {
        map[unit.id] = unit.knowledgePoints.map(kp => kp.id);
      });
    });
    return map;
  }, [courses]);

  // 获取选中单元的所有知识点ID
  const selectedKnowledgePointIds = useMemo(() => {
    if (selectedUnitIds.length === 0) return [];
    const kpIds: string[] = [];
    selectedUnitIds.forEach(unitId => {
      const kps = unitToKnowledgePointsMap[unitId];
      if (kps) kpIds.push(...kps);
    });
    return kpIds;
  }, [selectedUnitIds, unitToKnowledgePointsMap]);

  // 准备单元和文件夹数据
  const { folders, units } = useMemo(() => {
    const folders: any[] = [];
    const units: Unit[] = [];
    
    courses.forEach(course => {
      // 将课程作为文件夹
      folders.push({ id: course.id, name: course.name });
      
      // 将单元添加到列表
      course.units.forEach(unit => {
        units.push({ ...unit, folderId: course.id } as Unit);
      });
    });
    
    return { folders, units };
  }, [courses]);

  // 合并所有可选题目
  const allQuestions = useMemo(() => {
    const questions: ExtendedQuestion[] = [];
    
    // 题库中心的题目
    if (sourceFilter === 'bank') {
      let filteredBankQuestions = bankQuestions.filter(q => !excludeIds.includes(q.id));
      
      // 按单元筛选：检查题目的知识点是否属于选中的单元
      if (selectedKnowledgePointIds.length > 0) {
        filteredBankQuestions = filteredBankQuestions.filter(q => 
          q.knowledgePointIds?.some(kpId => selectedKnowledgePointIds.includes(kpId))
        );
      }
      
      // 按知识点类型筛选
      if (kpTypeFilter !== 'ALL') {
        filteredBankQuestions = filteredBankQuestions.filter(q => {
          if (!q.knowledgePointIds || q.knowledgePointIds.length === 0) return false;
          return q.knowledgePointIds.some(kpId => {
            const kp = knowledgePointMap[kpId];
            return kp && kp.type === kpTypeFilter;
          });
        });
      }
      
      filteredBankQuestions.forEach(q => {
        questions.push({ ...q, source: '题库中心', sourceId: 'bank' });
      });
    }
    
    // 多媒体资源的题目
    if (sourceFilter === 'resources') {
      let filteredResources = resources;
      
      // 按频道筛选
      if (selectedChannelIds.length > 0) {
        filteredResources = filteredResources.filter(r => 
          selectedChannelIds.includes(r.channelId)
        );
      }
      
      // 按资源筛选
      if (selectedResourceIds.length > 0) {
        filteredResources = filteredResources.filter(r => 
          selectedResourceIds.includes(r.id)
        );
      }
      
      filteredResources.forEach(resource => {
        if (resource.questions && resource.questions.length > 0) {
          let resourceQuestions = resource.questions.filter(q => !excludeIds.includes(q.id));
          
          resourceQuestions.forEach(q => {
            // 确保多媒体资源的题目有正确的type字段
            const normalizedQ = {
              ...q,
              type: q.type || 'multiple-choice' as const,
              // 附加资源信息
              resourceLevel: resource.level,
              resourceGrammarTags: resource.grammarTags,
              resourceVocabTags: resource.vocabTags,
              resourceTranscript: resource.transcript
            };
            questions.push({ ...normalizedQ, source: resource.title, sourceId: resource.id });
          });
        }
      });
    }
    
    return questions;
  }, [bankQuestions, resources, sourceFilter, excludeIds, selectedKnowledgePointIds, selectedChannelIds, selectedResourceIds, kpTypeFilter, knowledgePointMap]);

  // 搜索和类型过滤
  const filteredQuestions = useMemo(() => {
    let result = allQuestions;
    
    // 搜索过滤
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(q => 
        q.text.toLowerCase().includes(term) ||
        q.explanation?.toLowerCase().includes(term) ||
        q.level?.toLowerCase().includes(term) ||
        q.readingPassage?.toLowerCase().includes(term)
      );
    }
    
    // 题型过滤
    if (typeFilter !== 'ALL') {
      result = result.filter(q => q.type === typeFilter);
    }
    
    // 难度过滤
    if (levelFilter !== 'ALL') {
      result = result.filter(q => q.level === levelFilter);
    }
    
    return result;
  }, [allQuestions, searchTerm, typeFilter, levelFilter]);

  // 按资源分组（仅在资源模式下）
  const groupedByResource = useMemo(() => {
    if (sourceFilter !== 'resources') return null;
    
    const groups: Record<string, ExtendedQuestion[]> = {};
    filteredQuestions.forEach(q => {
      const key = q.sourceId;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(q);
    });
    
    return Object.entries(groups).map(([sourceId, questions]) => ({
      sourceId,
      sourceName: questions[0].source,
      resourceLevel: questions[0].resourceLevel,
      resourceGrammarTags: questions[0].resourceGrammarTags,
      resourceVocabTags: questions[0].resourceVocabTags,
      resourceTranscript: questions[0].resourceTranscript,
      questions,
      allSelected: questions.every(q => selectedIds.includes(q.id))
    }));
  }, [filteredQuestions, sourceFilter, selectedIds]);

  const toggleSelection = (id: string) => {
    // 在资源模式下，选中/取消整个资源的所有题目
    if (sourceFilter === 'resources') {
      const clickedQuestion = filteredQuestions.find(q => q.id === id);
      if (clickedQuestion && clickedQuestion.sourceId) {
        const resourceQuestions = filteredQuestions.filter(q => q.sourceId === clickedQuestion.sourceId);
        const resourceQuestionIds = resourceQuestions.map(q => q.id);
        const allSelected = resourceQuestionIds.every(qid => selectedIds.includes(qid));
        
        if (allSelected) {
          // 取消选中所有该资源的题目
          setSelectedIds(prev => prev.filter(i => !resourceQuestionIds.includes(i)));
        } else {
          // 选中所有该资源的题目
          setSelectedIds(prev => [...new Set([...prev, ...resourceQuestionIds])]);
        }
      }
    } else {
      // 题库模式下，按题目单个选择
      setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    }
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
      void modal.alert({ message: '请至少选择一道题目' });
      return;
    }
    onConfirm(selectedIds);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 w-full h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 -ml-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-500 transition-colors"
            >
              <Filter className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">选择题目</h2>
              <p className="text-xs text-slate-500 font-medium">已选 {selectedIds.length} 题</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden relative">
          {/* Mobile Overlay */}
          {isSidebarOpen && (
            <div 
              className="absolute inset-0 bg-black/20 z-10 lg:hidden backdrop-blur-[1px]"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Filters Sidebar */}
          <div className={`
            absolute inset-y-0 left-0 z-20 w-72 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col transition-transform duration-300
            ${isSidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'}
            lg:static lg:translate-x-0 lg:shadow-none
          `}>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <input 
                  type="text" 
                  placeholder="搜索题目..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-300 outline-none"
                />
              </div>
              
              {/* Source Filter */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">数据源</label>
                <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
                  {[
                    { value: 'bank', label: '题库中心', icon: FileText },
                    { value: 'resources', label: '多媒体资源', icon: Video }
                  ].map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      onClick={() => setSourceFilter(value as 'bank' | 'resources')}
                      className={`flex-1 px-2 py-1.5 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                        sourceFilter === value
                          ? 'bg-white dark:bg-slate-700 text-blue-600 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Question Bank Filters */}
              {sourceFilter === 'bank' && (
                <>
                  {folders.length > 0 && (
                    <UnitTreeSelector
                      folders={folders}
                      units={units}
                      selectedUnitIds={selectedUnitIds}
                      onChange={setSelectedUnitIds}
                      label="题库单元筛选"
                    />
                  )}
                  
                  {/* Knowledge Point Type Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">知识点类型</label>
                    <select
                      value={kpTypeFilter}
                      onChange={(e) => setKpTypeFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900 focus:border-blue-300 outline-none"
                    >
                      <option value="ALL">全部类型</option>
                      <option value="grammar">语法 Grammar</option>
                      <option value="vocabulary">词汇 Vocabulary</option>
                      <option value="reading">阅读 Reading</option>
                    </select>
                  </div>
                </>
              )}

              {/* Resource Filters */}
              {sourceFilter === 'resources' && (
                <div className="space-y-3">
                  {/* Channel Filter */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">频道筛选</label>
                    <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 max-h-32 overflow-y-auto p-1">
                      {channels.map(channel => {
                        const isSelected = selectedChannelIds.includes(channel.id);
                        const resourceCount = resources.filter(r => r.channelId === channel.id).length;
                        
                        return (
                          <div
                            key={channel.id}
                            onClick={() => {
                              setSelectedChannelIds(prev => 
                                prev.includes(channel.id) 
                                  ? prev.filter(id => id !== channel.id)
                                  : [...prev, channel.id]
                              );
                            }}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
                              isSelected
                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                            )}
                            <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="flex-1 truncate">{channel.name}</span>
                            <span className="text-[10px] text-slate-400">({resourceCount})</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Resource Filter */}
                  {selectedChannelIds.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">资源筛选</label>
                      <div className="border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 max-h-40 overflow-y-auto p-1">
                        {resources
                          .filter(r => selectedChannelIds.includes(r.channelId))
                          .map(resource => {
                            const isSelected = selectedResourceIds.includes(resource.id);
                            const questionCount = resource.questions?.length || 0;
                            
                            return (
                              <div
                                key={resource.id}
                                onClick={() => {
                                  setSelectedResourceIds(prev => 
                                    prev.includes(resource.id) 
                                      ? prev.filter(id => id !== resource.id)
                                      : [...prev, resource.id]
                                  );
                                }}
                                className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-xs ${
                                  isSelected
                                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                    : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                                ) : (
                                  <Square className="w-3.5 h-3.5 text-slate-300 flex-shrink-0" />
                                )}
                                <Video className="w-3.5 h-3.5 flex-shrink-0" />
                                <span className="flex-1 truncate">{resource.title}</span>
                                <span className="text-[10px] text-slate-400">({questionCount})</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Type & Level Filters */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">题型</label>
                  <div className="relative">
                    <select 
                      value={typeFilter} 
                      onChange={(e) => setTypeFilter(e.target.value)} 
                      className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 dark:text-white appearance-none pr-8 focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                    >
                      <option value="ALL">全部题型</option>
                      <option value="multiple-choice">单项选择</option>
                      <option value="fill-in-the-blank">填空题</option>
                      <option value="reading-comprehension">阅读理解</option>
                      <option value="cloze-test">完型选择</option>
                      <option value="compound-fill">复合填空</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">难度</label>
                  <div className="relative">
                    <select 
                      value={levelFilter} 
                      onChange={(e) => setLevelFilter(e.target.value)} 
                      className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-800 dark:text-white appearance-none pr-8 focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
                    >
                      <option value="ALL">全部难度</option>
                      <option value="A1">A1</option>
                      <option value="A2">A2</option>
                      <option value="B1">B1</option>
                      <option value="B2">B2</option>
                      <option value="C1">C1</option>
                      <option value="C2">C2</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-slate-50/50 dark:bg-slate-900/50 overflow-hidden">
            {/* Top Bar */}
            <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <button
                onClick={toggleAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-bold flex items-center gap-2"
              >
                {selectedIds.length === filteredQuestions.length && filteredQuestions.length > 0 ? 
                  <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />
                }
                {selectedIds.length === filteredQuestions.length && filteredQuestions.length > 0 ? '取消全选' : '全选'}
              </button>
              <span className="text-sm text-slate-500">
                已选 {selectedIds.length} / {filteredQuestions.length}
              </span>
            </div>

            {/* Question List */}
            <div className="flex-1 overflow-y-auto p-4">
              {filteredQuestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <FileText className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-sm">没有找到题目</p>
                  <p className="text-xs mt-2 text-slate-400">试试调整筛选条件</p>
                </div>
              ) : sourceFilter === 'resources' && groupedByResource ? (
                // 资源模式：按资源分组显示
                <div className="grid grid-cols-1 gap-4 font-serif">
                  {groupedByResource.map(group => {
                    const firstQ = group.questions[0];
                    
                    const renderGapPlaceholders = (html?: string) => {
                      if (!html) return '';
                      const cleaned = stripGapBackgroundHighlight(html);
                      return cleaned.replace(/\{\{(\d+)\}\}/g, '<span class="inline-block text-slate-600 dark:text-slate-400 font-serif">($1) ____________</span>');
                    };

                    return (
                      <div
                        key={group.sourceId}
                        onClick={() => toggleSelection(firstQ.id)}
                        className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden ${
                          group.allSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                            : 'border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            {group.allSelected ? (
                              <CheckSquare className="w-5 h-5 text-blue-600" />
                            ) : (
                              <Square className="w-5 h-5 text-slate-300" />
                            )}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Resource Info: Name, Type, Level, Tags in one line */}
                            <div className="flex flex-wrap gap-2 items-center mb-2">
                              <Video className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{group.sourceName}</span>
                              <span className="text-slate-300 dark:text-slate-600">|</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {group.questions.length} 题
                              </span>
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold border dark:border-slate-700">
                                {group.resourceLevel || 'UNSET'}
                              </span>
                              {/* Grammar Tags */}
                              {group.resourceGrammarTags && group.resourceGrammarTags.length > 0 && group.resourceGrammarTags.map((tag, idx) => (
                                <span key={`grammar-${idx}`} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800">
                                  <Puzzle size={10} /> {tag}
                                </span>
                              ))}
                              {/* Vocabulary Tags */}
                              {group.resourceVocabTags && group.resourceVocabTags.length > 0 && group.resourceVocabTags.map((tag, idx) => (
                                <span key={`vocab-${idx}`} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800">
                                  <BookA size={10} /> {tag}
                                </span>
                              ))}
                            </div>

                            {/* Question preview - show first question's content */}
                            {firstQ.readingPassage ? (
                              <div 
                                className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800 mb-2 text-justify prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: renderGapPlaceholders(firstQ.readingPassage) }}
                              />
                            ) : firstQ.text ? (
                              <div 
                                className="text-slate-800 dark:text-slate-100 mb-3 text-sm line-clamp-2 prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: stripGapBackgroundHighlight(firstQ.text) }}
                              />
                            ) : null}
                            
                            {/* Transcript - Compact display */}
                            {group.resourceTranscript && group.resourceTranscript.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Transcription</div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                  {group.resourceTranscript.map(seg => seg.text).join(' ')}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                // 题库模式：按题目显示
                <div className="grid grid-cols-1 gap-4 font-serif">
                  {filteredQuestions.map(q => {
                    const isSelected = selectedIds.includes(q.id);
                    
                    const renderGapPlaceholders = (html?: string) => {
                      if (!html) return '';
                      const cleaned = stripGapBackgroundHighlight(html);
                      return cleaned.replace(/\{\{(\d+)\}\}/g, '<span class="inline-block text-slate-600 dark:text-slate-400 font-serif">($1) ____________</span>');
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
                      <div
                        key={q.id}
                        onClick={() => toggleSelection(q.id)}
                        className={`bg-white dark:bg-slate-900 rounded-2xl p-5 border shadow-sm hover:shadow-md transition-shadow cursor-pointer group relative overflow-hidden ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-500'
                            : 'border-slate-100 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
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
                            {/* Resource Name, Type, Level, Tags all in one line for Media Resources */}
                            {sourceFilter === 'resources' && 'source' in q && (
                              <div className="flex flex-wrap gap-2 items-center mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                                <Video className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{q.source}</span>
                                <span className="text-slate-300 dark:text-slate-600">|</span>
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
                                  {q.type === 'multiple-choice' && '单选题'}
                                  {q.type === 'fill-in-the-blank' && '填空题'}
                                  {q.type === 'reading-comprehension' && '阅读理解'}
                                  {q.type === 'cloze-test' && '完型选择'}
                                  {q.type === 'compound-fill' && '复合填空'}
                                  {!q.type && '单选题'}
                                </span>
                                <span className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded text-[10px] font-bold border dark:border-slate-700">
                                  {'resourceLevel' in q ? q.resourceLevel : q.level || 'UNSET'}
                                </span>
                                {/* Grammar Tags */}
                                {'resourceGrammarTags' in q && q.resourceGrammarTags && q.resourceGrammarTags.length > 0 && q.resourceGrammarTags.map((tag, idx) => (
                                  <span key={`grammar-${idx}`} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800">
                                    <Puzzle size={10} /> {tag}
                                  </span>
                                ))}
                                {/* Vocabulary Tags */}
                                {'resourceVocabTags' in q && q.resourceVocabTags && q.resourceVocabTags.length > 0 && q.resourceVocabTags.map((tag, idx) => (
                                  <span key={`vocab-${idx}`} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800">
                                    <BookA size={10} /> {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                            
                            {/* Type, Level, Knowledge Points & Date Tags for Bank Questions */}
                            {sourceFilter === 'bank' && (
                              <div className="flex flex-wrap gap-2 items-center mb-3">
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
                                  {q.type === 'multiple-choice' && '单选题'}
                                  {q.type === 'fill-in-the-blank' && '填空题'}
                                  {q.type === 'reading-comprehension' && '阅读理解'}
                                  {q.type === 'cloze-test' && '完型选择'}
                                  {q.type === 'compound-fill' && '复合填空'}
                                  {!q.type && '单选题'}
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
                            )}

                            {/* Reading Passage for complex types - no label */}
                            {(q.type === 'reading-comprehension' || q.type === 'cloze-test' || q.type === 'compound-fill') && q.readingPassage ? (
                              <div 
                                className="text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 p-2 rounded-lg border border-slate-100 dark:border-slate-800 mb-2 text-justify prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: renderGapPlaceholders(q.readingPassage) }}
                              />
                            ) : q.text ? (
                              /* Question Text for simple types */
                              <div 
                                className="text-slate-800 dark:text-slate-100 mb-3 text-sm line-clamp-2 prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: stripGapBackgroundHighlight(q.text) }}
                              />
                            ) : null}

                            {/* Options - 4 columns by default, use getOptionGridColumns */}
                            {q.type !== 'reading-comprehension' && q.type !== 'cloze-test' && q.type !== 'compound-fill' && q.options && q.options.length > 0 && (() => {
                              const firstFour = q.options.slice(0, 4);
                              const cols = getOptionGridColumns(firstFour.map(o => o.text));
                              const gridColsClass = cols === 4 ? 'grid-cols-2 lg:grid-cols-4' : cols === 2 ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1';
                              
                              return (
                                <div className={`grid gap-2 ${gridColsClass}`}>
                                  {firstFour.map((opt, i) => (
                                    <div key={opt.id} className={`flex items-start gap-2 text-xs min-w-0 ${opt.id === q.correctOptionId ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'}`}>
                                      <div className={`w-4 h-4 rounded-full flex items-center justify-center border text-[9px] shrink-0 mt-0.5 ${
                                        opt.id === q.correctOptionId 
                                          ? 'border-emerald-500 bg-emerald-500 text-white' 
                                          : 'border-slate-300 dark:border-slate-600'
                                      }`}>
                                        {String.fromCharCode(65 + i)}
                                      </div>
                                      <span className={cols === 4 ? 'truncate' : 'whitespace-normal break-words'}>{opt.text}</span>
                                    </div>
                                  ))}
                                  {q.options.length > 4 && <div className="text-[10px] text-slate-400 pl-2 col-span-full">... 更多选项</div>}
                                </div>
                              );
                            })()}
                            
                            {/* Transcript for Media Resources - Compact display */}
                            {sourceFilter === 'resources' && 'resourceTranscript' in q && q.resourceTranscript && q.resourceTranscript.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Transcription</div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                  {q.resourceTranscript.map(seg => seg.text).join(' ')}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedIds.length === 0}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 flex items-center gap-2"
          >
            添加 {selectedIds.length > 0 && `(${selectedIds.length})`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestionSelector;
