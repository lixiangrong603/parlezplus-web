import React, { useState } from 'react';
import { Classroom } from '../types';
import { Plus, Edit2, Trash2 } from 'lucide-react';

interface ClassSidebarProps {
  classrooms: Classroom[];
  selectedClassId: string | null;
  onSelectClass: (id: string) => void;
  onCreateClass: () => void;
  onEditClass: (id: string, newName: string) => void;
  onDeleteClass: (id: string) => void;
}

export const ClassSidebar: React.FC<ClassSidebarProps> = ({
  classrooms,
  selectedClassId,
  onSelectClass,
  onCreateClass,
  onEditClass,
  onDeleteClass
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const handleStartEdit = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingName.trim()) {
      onEditClass(id, editingName);
    }
    setEditingId(null);
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteClass(id);
  };

  return (
    <div className="w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shrink-0 flex flex-col overflow-hidden">
      {/* Header with Create Button */}
      <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
        <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">班级列表</h2>
        <button
          onClick={onCreateClass}
          className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-all shadow-sm"
          title="新建班级"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* Class List */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="space-y-1 p-2">
          {classrooms.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400 italic">
              暂无班级
            </div>
          ) : (
            classrooms.map(cls => (
              <div
                key={cls.id}
                onClick={() => onSelectClass(cls.id)}
                className={`group p-3 rounded-xl cursor-pointer transition-all ${
                  selectedClassId === cls.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    {editingId === cls.id ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleSaveEdit(cls.id, e as any);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full px-2 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-bold border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    ) : (
                      <>
                        <p className="text-sm font-bold truncate">{cls.name}</p>
                        <p className={`text-[10px] font-semibold ${selectedClassId === cls.id ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'}`}>
                          {cls.students.length} 名学生
                        </p>
                      </>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {editingId === cls.id ? (
                      <>
                        <button
                          onClick={(e) => handleSaveEdit(cls.id, e)}
                          className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg transition"
                          title="保存"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg transition"
                          title="取消"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => handleStartEdit(cls.id, cls.name, e)}
                          className={`p-1.5 rounded-lg transition ${
                            selectedClassId === cls.id
                              ? 'hover:bg-indigo-700 text-white'
                              : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'
                          }`}
                          title="编辑"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(cls.id, e)}
                          className={`p-1.5 rounded-lg transition ${
                            selectedClassId === cls.id
                              ? 'hover:bg-red-500 text-white'
                              : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 dark:text-slate-400 hover:text-red-500'
                          }`}
                          title="删除"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassSidebar;
