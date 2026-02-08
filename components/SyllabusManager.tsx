
import React, { useState, useMemo } from 'react';
import { SyllabusCourse, Unit, KnowledgePoint, KnowledgePointType } from '../types';
import { cascadeDeleteSyllabusKnowledgePoint, cascadeDeleteSyllabusUnit } from '../utils/storage';
import { 
  Folder, FolderOpen, FileText, ChevronRight, ChevronDown, 
  Plus, Edit2, Trash2, Check, X, Book,
  Puzzle, BookA, AlignLeft, Square, CheckSquare, MinusSquare, AlertCircle
} from 'lucide-react';

// --- SHARED MODAL COMPONENT (Local Definition for Encapsulation) ---
const CustomConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "确认删除", 
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in" onClick={(e) => e.stopPropagation()}>
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}>
            {type === 'danger' ? <Trash2 size={32} /> : <AlertCircle size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t dark:border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all">{cancelText}</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-[1.5] py-3 text-sm font-black text-white rounded-xl shadow-lg transition-all active:scale-95 ${type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-100 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

interface SyllabusManagerProps {
  courses: SyllabusCourse[];
  onUpdateCourse: (course: SyllabusCourse) => void;
  onDeleteCourse: (id: string) => void;
  onRefresh: () => void;
  onSelectionChange: (selectedIds: string[]) => void;
  selectedIds: string[];
  operatorId?: string;
}

const SyllabusManager: React.FC<SyllabusManagerProps> = ({ 
  courses, 
  onUpdateCourse, 
  onDeleteCourse,
  onRefresh,
  onSelectionChange,
  selectedIds,
  operatorId
}) => {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  
  // New Item State
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [isAddingUnitTo, setIsAddingUnitTo] = useState<string | null>(null); // courseId
  const [isAddingPointTo, setIsAddingPointTo] = useState<string | null>(null); // unitId
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<KnowledgePointType>('grammar');

  // Confirmation State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditValue(name);
  };

  // --- Selection Logic ---

  const handleSelectPoint = (pointId: string) => {
    if (selectedIds.includes(pointId)) {
        onSelectionChange(selectedIds.filter(id => id !== pointId));
    } else {
        onSelectionChange([...selectedIds, pointId]);
    }
  };

  const handleSelectUnit = (unit: Unit) => {
    const pointIds = unit.knowledgePoints.map(p => p.id);
    const allSelected = pointIds.every(id => selectedIds.includes(id));
    
    if (allSelected) {
        // Deselect all
        onSelectionChange(selectedIds.filter(id => !pointIds.includes(id)));
    } else {
        // Select all (union)
        const newIds = Array.from(new Set([...selectedIds, ...pointIds]));
        onSelectionChange(newIds);
    }
  };

  const handleSelectCourse = (course: SyllabusCourse) => {
    const pointIds = course.units.flatMap(u => u.knowledgePoints.map(p => p.id));
    const allSelected = pointIds.length > 0 && pointIds.every(id => selectedIds.includes(id));

    if (allSelected) {
        onSelectionChange(selectedIds.filter(id => !pointIds.includes(id)));
    } else {
        const newIds = Array.from(new Set([...selectedIds, ...pointIds]));
        onSelectionChange(newIds);
    }
  };

  // Helper to determine checkbox state for containers
  const getContainerSelectionState = (pointIds: string[]) => {
      if (pointIds.length === 0) return 'none';
      const selectedCount = pointIds.filter(id => selectedIds.includes(id)).length;
      if (selectedCount === 0) return 'none';
      if (selectedCount === pointIds.length) return 'all';
      return 'partial';
  };

  const Checkbox = ({ state, onClick }: { state: 'all' | 'partial' | 'none', onClick: (e: React.MouseEvent) => void }) => (
      <div onClick={(e) => { e.stopPropagation(); onClick(e); }} className="cursor-pointer text-indigo-500 dark:text-indigo-400 hover:text-indigo-600 mr-2 shrink-0">
          {state === 'all' && <CheckSquare size={16} fill="currentColor" className="text-indigo-100 dark:text-indigo-900/50" />}
          {state === 'partial' && <MinusSquare size={16} fill="currentColor" className="text-indigo-100 dark:text-indigo-900/50" />}
          {state === 'none' && <Square size={16} className="text-slate-300 dark:text-slate-600" />}
      </div>
  );

  // --- CRUD Handlers ---

  const handleAddCourse = () => {
    if (!newItemName.trim()) return;
    const newCourse: SyllabusCourse = {
      id: `course-${Date.now()}`,
      name: newItemName,
      userId: 'current', 
      createdAt: Date.now(),
      units: []
    };
    onUpdateCourse(newCourse);
    setIsAddingCourse(false);
    setNewItemName('');
  };

  const handleAddUnit = (course: SyllabusCourse) => {
    if (!newItemName.trim()) return;
    const newUnit: Unit = {
      id: `unit-${Date.now()}`,
      name: newItemName,
      knowledgePoints: []
    };
    const updatedCourse = { ...course, units: [...course.units, newUnit] };
    onUpdateCourse(updatedCourse);
    setIsAddingUnitTo(null);
    setNewItemName('');
    setExpandedItems(prev => ({ ...prev, [course.id]: true }));
  };

  const handleAddPoint = (course: SyllabusCourse, unit: Unit) => {
    if (!newItemName.trim()) return;
    const names = newItemName.split(/[;；]/).map(s => s.trim()).filter(s => s.length > 0);
    if (names.length === 0) return;

    const newPoints: KnowledgePoint[] = names.map((name, index) => ({
      id: `kp-${Date.now()}-${index}`,
      name: name,
      type: newItemType
    }));

    const updatedUnits = course.units.map(u => 
      u.id === unit.id ? { ...u, knowledgePoints: [...u.knowledgePoints, ...newPoints] } : u
    );
    onUpdateCourse({ ...course, units: updatedUnits });
    setIsAddingPointTo(null);
    setNewItemName('');
    setExpandedItems(prev => ({ ...prev, [unit.id]: true }));
  };

  const handleRename = (id: string, type: 'course' | 'unit' | 'point', course: SyllabusCourse, unit?: Unit) => {
    if (!editValue.trim()) return;
    
    if (type === 'course') {
      onUpdateCourse({ ...course, name: editValue });
    } else if (type === 'unit') {
      const updatedUnits = course.units.map(u => u.id === id ? { ...u, name: editValue } : u);
      onUpdateCourse({ ...course, units: updatedUnits });
    } else if (type === 'point' && unit) {
      const updatedUnits = course.units.map(u => {
        if (u.id === unit.id) {
          const updatedPoints = u.knowledgePoints.map(p => p.id === id ? { ...p, name: editValue } : p);
          return { ...u, knowledgePoints: updatedPoints };
        }
        return u;
      });
      onUpdateCourse({ ...course, units: updatedUnits });
    }
    setEditingId(null);
  };

  const confirmDelete = (title: string, message: string, onConfirm: () => void) => {
      setConfirmConfig({
          isOpen: true,
          title,
          message,
          onConfirm
      });
  };

  const handleDelete = (id: string, type: 'course' | 'unit' | 'point', course: SyllabusCourse, unit?: Unit) => {
    if (type === 'course') {
      onDeleteCourse(id);
    } else if (type === 'unit') {
      const unitToDelete = course.units.find(u => u.id === id);
      const pointIds = unitToDelete?.knowledgePoints?.map(p => p.id) || [];
      confirmDelete(
        '删除单元（级联软删除）',
        '确定要删除该单元吗？将级联软删除该单元及其知识点，并软删除关联题库题目（30天内可在回收站恢复）。',
        () => {
          cascadeDeleteSyllabusUnit(course.id, id, operatorId);
          if (pointIds.length > 0) {
            onSelectionChange(selectedIds.filter(sid => !pointIds.includes(sid)));
          }
          onRefresh();
        }
      );
    } else if (type === 'point' && unit) {
      confirmDelete(
        '删除知识点（级联软删除）',
        '确定要删除该知识点吗？将软删除关联题库题目（30天内可在回收站恢复）。',
        () => {
          cascadeDeleteSyllabusKnowledgePoint(course.id, unit.id, id, operatorId);
          if (selectedIds.includes(id)) {
            onSelectionChange(selectedIds.filter(sid => sid !== id));
          }
          onRefresh();
        }
      );
    }
  };

  const getTypeConfig = (type: string) => {
    switch(type) {
        case 'grammar': return { icon: Puzzle, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', label: '语法' };
        case 'vocabulary': return { icon: BookA, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: '词汇' };
        case 'reading': return { icon: AlignLeft, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', label: '阅读' };
        default: return { icon: FileText, color: 'text-slate-500', bg: 'bg-slate-100', label: '其它' };
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 w-80 shrink-0 transition-colors">
      <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 transition-colors">
        <h3 className="font-black text-slate-700 dark:text-slate-200 flex items-center gap-2">
          <Book size={18} className="text-indigo-600" /> 教学大纲
        </h3>
        <button onClick={() => setIsAddingCourse(true)} className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition">
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 no-scrollbar">
        {isAddingCourse && (
          <div className="p-2 mb-2 bg-white dark:bg-slate-900 rounded-lg border border-indigo-200 dark:border-indigo-800 shadow-sm animate-fade-in-down">
            <input 
              autoFocus
              className="w-full text-sm p-1.5 border border-slate-200 dark:border-slate-700 rounded mb-2 outline-none focus:border-indigo-500 dark:bg-slate-800 dark:text-white"
              placeholder="输入课程名称..."
              value={newItemName}
              onChange={e => setNewItemName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCourse()}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setIsAddingCourse(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><X size={14} /></button>
              <button onClick={handleAddCourse} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Check size={14} /></button>
            </div>
          </div>
        )}

        {courses.map(course => {
          const coursePointIds = course.units.flatMap(u => u.knowledgePoints.map(p => p.id));
          const selectionState = getContainerSelectionState(coursePointIds);

          return (
            <div key={course.id} className="mb-2">
                {/* Course Node */}
                <div className="group flex items-center justify-between p-2 rounded-lg hover:bg-white dark:hover:bg-slate-900 cursor-pointer select-none transition-colors">
                <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => toggleExpand(course.id)}>
                    <Checkbox state={selectionState} onClick={() => handleSelectCourse(course)} />
                    {expandedItems[course.id] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    <FolderOpen size={16} className="text-indigo-500 shrink-0" />
                    {editingId === course.id ? (
                    <input 
                        autoFocus
                        className="flex-1 text-sm bg-transparent border-b border-indigo-500 outline-none dark:text-white"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleRename(course.id, 'course', course)}
                        onBlur={() => handleRename(course.id, 'course', course)}
                        onClick={e => e.stopPropagation()}
                    />
                    ) : (
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{course.name}</span>
                    )}
                </div>
                <div className="hidden group-hover:flex items-center gap-1">
                    <button onClick={() => setIsAddingUnitTo(course.id)} className="p-1 text-slate-400 hover:text-indigo-600"><Plus size={12} /></button>
                    <button onClick={() => handleStartEdit(course.id, course.name)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 size={12} /></button>
                    <button onClick={() => handleDelete(course.id, 'course', course)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={12} /></button>
                </div>
                </div>

                {/* Course Children (Units) */}
                {expandedItems[course.id] && (
                <div className="ml-4 pl-2 border-l border-slate-200 dark:border-slate-800 space-y-1 mt-1">
                    {isAddingUnitTo === course.id && (
                    <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in-down">
                        <input 
                        autoFocus
                        className="w-full text-xs p-1.5 border border-slate-200 dark:border-slate-700 rounded mb-2 outline-none dark:bg-slate-800 dark:text-white"
                        placeholder="单元名称..."
                        value={newItemName}
                        onChange={e => setNewItemName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddUnit(course)}
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsAddingUnitTo(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><X size={12} /></button>
                            <button onClick={() => handleAddUnit(course)} className="p-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Check size={12} /></button>
                        </div>
                    </div>
                    )}

                    {course.units.map(unit => {
                        const unitPointIds = unit.knowledgePoints.map(p => p.id);
                        const unitSelectionState = getContainerSelectionState(unitPointIds);

                        return (
                        <div key={unit.id}>
                            {/* Unit Node */}
                            <div className="group flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer select-none transition-colors">
                            <div className="flex items-center gap-2 flex-1 min-w-0" onClick={() => toggleExpand(unit.id)}>
                                <Checkbox state={unitSelectionState} onClick={() => handleSelectUnit(unit)} />
                                {expandedItems[unit.id] ? <ChevronDown size={12} className="text-slate-400" /> : <ChevronRight size={12} className="text-slate-400" />}
                                <Folder size={14} className="text-sky-500 shrink-0" />
                                {editingId === unit.id ? (
                                <input 
                                    autoFocus
                                    className="flex-1 text-xs bg-transparent border-b border-indigo-500 outline-none dark:text-white"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleRename(unit.id, 'unit', course)}
                                    onBlur={() => handleRename(unit.id, 'unit', course)}
                                    onClick={e => e.stopPropagation()}
                                />
                                ) : (
                                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">{unit.name}</span>
                                )}
                            </div>
                            <div className="hidden group-hover:flex items-center gap-1">
                                <button onClick={() => setIsAddingPointTo(unit.id)} className="p-1 text-slate-400 hover:text-indigo-600"><Plus size={10} /></button>
                                <button onClick={() => handleStartEdit(unit.id, unit.name)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 size={10} /></button>
                                <button onClick={() => handleDelete(unit.id, 'unit', course)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 size={10} /></button>
                            </div>
                            </div>

                            {/* Unit Children (Points) */}
                            {expandedItems[unit.id] && (
                                <div className="ml-4 pl-2 border-l border-slate-200 dark:border-slate-800 mt-1 space-y-0.5">
                                    {isAddingPointTo === unit.id && (
                                        <div className="p-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm animate-fade-in-down mb-1">
                                            <div className="flex gap-1 mb-2">
                                                {(['grammar', 'vocabulary', 'reading'] as const).map(t => {
                                                    const config = getTypeConfig(t);
                                                    const Icon = config.icon;
                                                    const isSelected = newItemType === t;
                                                    return (
                                                        <button 
                                                            key={t}
                                                            onClick={() => setNewItemType(t)}
                                                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded text-[10px] font-bold border transition-all ${isSelected ? `${config.bg} ${config.color} border-current` : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'}`}
                                                        >
                                                            <Icon size={10} /> {config.label}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            <input 
                                                autoFocus
                                                className="w-full text-xs p-1.5 border border-slate-200 dark:border-slate-700 rounded mb-2 outline-none dark:bg-slate-800 dark:text-white"
                                                placeholder="知识点名称 (支持批量添加，用分号;隔开)..."
                                                value={newItemName}
                                                onChange={e => setNewItemName(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddPoint(course, unit)}
                                            />
                                            <div className="flex justify-end gap-2">
                                                <button onClick={() => setIsAddingPointTo(null)} className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><X size={12} /></button>
                                                <button onClick={() => handleAddPoint(course, unit)} className="p-0.5 bg-indigo-600 text-white rounded hover:bg-indigo-700"><Check size={12} /></button>
                                            </div>
                                        </div>
                                    )}
                                    {unit.knowledgePoints.map(point => {
                                        const config = getTypeConfig(point.type);
                                        const TypeIcon = config.icon;
                                        const isSelected = selectedIds.includes(point.id);
                                        return (
                                            <div 
                                                key={point.id} 
                                                className={`group flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 dark:bg-indigo-900/30' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                onClick={() => handleSelectPoint(point.id)}
                                            >
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <Checkbox state={isSelected ? 'all' : 'none'} onClick={() => handleSelectPoint(point.id)} />
                                                    <TypeIcon size={12} className={isSelected ? 'text-indigo-600 dark:text-indigo-400' : config.color} />
                                                    {editingId === point.id ? (
                                                        <input 
                                                            autoFocus
                                                            className="flex-1 text-xs bg-transparent border-b border-indigo-500 outline-none dark:text-white"
                                                            value={editValue}
                                                            onChange={e => setEditValue(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleRename(point.id, 'point', course, unit)}
                                                            onBlur={() => handleRename(point.id, 'point', course, unit)}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                    ) : (
                                                        <span className={`text-xs truncate ${isSelected ? 'font-bold text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}`}>{point.name}</span>
                                                    )}
                                                </div>
                                                <div className="hidden group-hover:flex items-center gap-1">
                                                    <button onClick={(e) => { e.stopPropagation(); handleStartEdit(point.id, point.name); }} className="p-0.5 text-slate-400 hover:text-indigo-600"><Edit2 size={10} /></button>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(point.id, 'point', course, unit); }} className="p-0.5 text-slate-400 hover:text-red-500"><Trash2 size={10} /></button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )})}
                </div>
                )}
            </div>
        )})}
      </div>

      <CustomConfirmModal 
        isOpen={!!confirmConfig}
        onClose={() => setConfirmConfig(null)}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
      />
    </div>
  );
};

export default SyllabusManager;
