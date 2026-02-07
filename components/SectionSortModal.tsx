import React, { useState } from 'react';
import { X, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';

export type SortCriterion = {
  type: 'TYPE' | 'DIFFICULTY' | 'RANDOM';
  order: 'ASC' | 'DESC';
};

interface SectionSortModalProps {
  onClose: () => void;
  onApply: (criteria: SortCriterion[]) => void;
}

const SectionSortModal: React.FC<SectionSortModalProps> = ({ onClose, onApply }) => {
  const modal = useModal();
  const [criteria, setCriteria] = useState<SortCriterion[]>([
    { type: 'TYPE', order: 'ASC' }
  ]);

  const addCriterion = () => {
    setCriteria([...criteria, { type: 'DIFFICULTY', order: 'ASC' }]);
  };

  const removeCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const updateCriterion = (index: number, field: 'type' | 'order', value: string) => {
    const newCriteria = [...criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    setCriteria(newCriteria);
  };

  const moveCriterion = (index: number, direction: 'up' | 'down') => {
    const newCriteria = [...criteria];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newCriteria.length) return;
    [newCriteria[index], newCriteria[targetIndex]] = [newCriteria[targetIndex], newCriteria[index]];
    setCriteria(newCriteria);
  };

  const handleApply = () => {
    if (criteria.length === 0) {
      void modal.alert({ message: '请至少添加一个排序条件' });
      return;
    }
    onApply(criteria);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">题目排序</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">设置多级排序条件，优先级从上到下</p>
        </div>

        <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
          {criteria.map((criterion, index) => (
            <div key={index} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveCriterion(index, 'up')}
                  disabled={index === 0}
                  className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={() => moveCriterion(index, 'down')}
                  disabled={index === criteria.length - 1}
                  className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-20 transition-colors"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>

              <select
                value={criterion.type}
                onChange={e => updateCriterion(index, 'type', e.target.value)}
                className="flex-1 px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="TYPE">题型/类别</option>
                <option value="DIFFICULTY">难度</option>
                <option value="RANDOM">随机</option>
              </select>

              {criterion.type !== 'RANDOM' && (
                <select
                  value={criterion.order}
                  onChange={e => updateCriterion(index, 'order', e.target.value)}
                  className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="ASC">升序</option>
                  <option value="DESC">降序</option>
                </select>
              )}

              <button
                onClick={() => removeCriterion(index)}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <button
            onClick={addCriterion}
            className="w-full py-2.5 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg text-slate-400 hover:border-blue-300 hover:text-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 text-sm font-bold flex items-center justify-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            添加排序条件
          </button>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            取消
          </button>
          <button
            onClick={handleApply}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg transition-all active:scale-95"
          >
            应用排序
          </button>
        </div>
      </div>
    </div>
  );
};

export default SectionSortModal;
