import React, { useState } from 'react';
import { Student } from '../types';
import { Users, UserPlus, RotateCcw, UserMinus, FileSpreadsheet, ChevronDown, ChevronUp } from 'lucide-react';
import { getInitials, getColorFromString } from '../utils/mediaUtils';
import { getUserById } from '../utils/storage';
import LazyImage, { DEFAULT_AVATAR_FALLBACK } from './LazyImage';

interface StudentRosterProps {
  classId: string;
  students: Student[];
  onAddStudent: () => void;
  onBatchImport: () => void;
  onResetPassword: (studentId: string) => void;
  onRemoveStudent: (studentId: string) => void;
  isExpanded: boolean;
  onToggleExpanded: (expanded: boolean) => void;
}

export const StudentRoster: React.FC<StudentRosterProps> = ({
  classId,
  students,
  onAddStudent,
  onBatchImport,
  onResetPassword,
  onRemoveStudent,
  isExpanded,
  onToggleExpanded
}) => {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-all">
      <div className="p-5 flex justify-between items-center border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
        <button 
          onClick={() => onToggleExpanded(!isExpanded)} 
          className="flex items-center gap-3 group"
        >
          <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 transition-colors">
            <Users size={20} />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              学生名册 ({students.length})
              {isExpanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
            </h3>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Manage class members</p>
          </div>
        </button>
        <div className="flex gap-2">
          <button 
            onClick={onBatchImport}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition shadow-sm text-xs font-bold"
          >
            <FileSpreadsheet size={16} /> 批量导入
          </button>
          <button 
            onClick={onAddStudent}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition shadow-md"
          >
            <UserPlus size={18} />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[400px] overflow-y-auto no-scrollbar animate-fade-in-down">
          {students.length === 0 ? (
            <p className="col-span-full text-center text-xs text-slate-400 py-4 italic">班级暂无学生</p>
          ) : (
            students.map(student => (
              <div 
                key={student.id} 
                className="flex flex-col items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 relative group transition-all hover:shadow-md"
              >
                {(() => {
                  const userAvatar = student.userId ? getUserById(student.userId)?.avatar : undefined;
                  const avatar = userAvatar || student.avatar;
                  return avatar ? (
                  <LazyImage
                    src={avatar}
                    fallbackSrc={DEFAULT_AVATAR_FALLBACK}
                    alt={student.name}
                    containerClassName="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow-sm"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <div 
                    className="w-12 h-12 rounded-full border-2 border-white dark:border-slate-700 shadow-sm flex items-center justify-center text-white text-sm font-black"
                    style={{ backgroundColor: getColorFromString(student.userId || student.name) }}
                  >
                    {getInitials(student.name)}
                  </div>
                  );
                })()}
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate w-full text-center">
                  {student.name}
                </span>
                
                <div className="absolute top-1 right-1 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onResetPassword(student.id)}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-lg text-slate-400 hover:text-amber-500 shadow-sm transition-colors border border-slate-200 dark:border-slate-600"
                    title="重置密码"
                  >
                    <RotateCcw size={12} />
                  </button>
                  <button 
                    onClick={() => onRemoveStudent(student.id)}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-lg text-slate-400 hover:text-red-500 shadow-sm transition-colors border border-slate-200 dark:border-slate-600"
                    title="移出班级"
                  >
                    <UserMinus size={12} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default StudentRoster;
