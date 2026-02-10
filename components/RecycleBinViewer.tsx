import React, { useEffect, useMemo, useState } from 'react';
import { X, RotateCcw, Trash2 } from 'lucide-react';
import { useModal } from '../contexts/ModalContext';
import {
  getRecycleBinItems,
  getRecycleBinItemsForTeacher,
  permanentlyDeleteRecord,
  RecycleBinItem,
  restoreDeletedRecord
} from '../utils/storage';

interface RecycleBinViewerProps {
  onClose: () => void;
  teacherId?: string;
}

const typeLabel = (type: RecycleBinItem['type']): string => {
  const map: Record<RecycleBinItem['type'], string> = {
    User: '用户',
    Classroom: '班级',
    Channel: '频道',
    Resource: '资源',
    ExamPaper: '试卷',
    ExamSession: '考试记录',
    Question: '题目',
    SyllabusCourse: '课程',
    SyllabusUnit: '单元',
    SyllabusKnowledgePoint: '知识点',
  };
  return map[type] || type;
};

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
};

const RecycleBinViewer: React.FC<RecycleBinViewerProps> = ({ onClose, teacherId }) => {
  const modal = useModal();
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const load = async () => {
    const nextItems = teacherId
      ? await getRecycleBinItemsForTeacher(teacherId)
      : await getRecycleBinItems();
    setItems(nextItems);
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    // items变化时，清理已不存在的选中项
    const validKeys = new Set(items.map(it => `${it.type}:${it.id}`));
    setSelectedKeys(prev => {
      const next = new Set<string>();
      prev.forEach(k => {
        if (validKeys.has(k)) next.add(k);
      });
      return next;
    });
  }, [items]);

  const groupedCount = useMemo(() => {
    return items.reduce<Record<string, number>>((acc, it) => {
      acc[it.type] = (acc[it.type] || 0) + 1;
      return acc;
    }, {});
  }, [items]);

  const handleRestore = async (item: RecycleBinItem) => {
    setRestoringId(item.id);
    try {
      restoreDeletedRecord(item.type, item.id);
      await load();
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async (item: RecycleBinItem) => {
    const ok = await modal.confirm({
      title: '永久删除',
      message: `确定要永久删除该${typeLabel(item.type)}吗？\n\n「${item.name}」\n\n此操作不可撤销。将删除数据库记录和相关的媒体文件。`,
      type: 'danger',
      confirmText: '永久删除',
      cancelText: '取消'
    });
    if (!ok) return;

    setDeletingId(item.id);
    try {
      await permanentlyDeleteRecord(item.type, item.id);
      await load();
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelect = (item: RecycleBinItem) => {
    const key = `${item.type}:${item.id}`;
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedItems = useMemo(() => {
    if (selectedKeys.size === 0) return [] as RecycleBinItem[];
    const keySet = selectedKeys;
    return items.filter(it => keySet.has(`${it.type}:${it.id}`));
  }, [items, selectedKeys]);

  const allSelected = items.length > 0 && selectedKeys.size === items.length;

  const toggleSelectAll = () => {
    if (items.length === 0) return;
    if (allSelected) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(items.map(it => `${it.type}:${it.id}`)));
    }
  };

  const restoreSelected = async () => {
    if (selectedItems.length === 0) return;
    selectedItems.forEach(it => restoreDeletedRecord(it.type, it.id));
    setSelectedKeys(new Set());
    await load();
  };

  const deleteSelected = async () => {
    if (selectedItems.length === 0) return;
    const ok = await modal.confirm({
      title: '批量永久删除',
      message: `确定要永久删除选中的 ${selectedItems.length} 项吗？\n\n此操作不可撤销。将删除数据库记录和相关的媒体文件。`,
      type: 'danger',
      confirmText: '永久删除',
      cancelText: '取消'
    });
    if (!ok) return;

    for (const it of selectedItems) {
      try {
        await permanentlyDeleteRecord(it.type, it.id);
      } catch (error) {
        console.error(`Failed to delete ${it.type} ${it.id}:`, error);
      }
    }
    setSelectedKeys(new Set());
    await load();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-[min(1100px,92vw)] max-h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">回收站</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">显示近30天软删除内容，超过30天将自动清理</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="关闭"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2">
          {Object.entries(groupedCount).length === 0 ? null : (
            <>
              {Object.entries(groupedCount).map(([t, c]) => (
                <span
                  key={t}
                  className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  {typeLabel(t as RecycleBinItem['type'])}：{c}
                </span>
              ))}
            </>
          )}
        </div>

        <div className="px-6 pb-6 overflow-auto max-h-[70vh]">
          {items.length === 0 ? (
            <div className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">
              回收站为空
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-white dark:bg-slate-900">
                <tr className="text-[10px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  <th className="py-3 w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-indigo-600"
                      aria-label="全选"
                    />
                  </th>
                  <th className="py-3">类型</th>
                  <th className="py-3">名称</th>
                  <th className="py-3">删除时间</th>
                  <th className="py-3">剩余天数</th>
                  <th className="py-3 text-center">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map(it => (
                  <tr key={`${it.type}-${it.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                    <td className="py-4 pr-3">
                      <input
                        type="checkbox"
                        checked={selectedKeys.has(`${it.type}:${it.id}`)}
                        onChange={() => toggleSelect(it)}
                        className="w-4 h-4 accent-indigo-600"
                        aria-label="选择"
                      />
                    </td>
                    <td className="py-4 pr-3 text-xs font-bold text-slate-700 dark:text-slate-200">{typeLabel(it.type)}</td>
                    <td className="py-4 pr-3">
                      <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{it.name}</div>
                      {it.deletedReason ? (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">原因：{it.deletedReason}</div>
                      ) : null}
                    </td>
                    <td className="py-4 pr-3 text-xs text-slate-600 dark:text-slate-300">{formatTime(it.deletedAt)}</td>
                    <td className="py-4 pr-3 text-xs text-slate-600 dark:text-slate-300">{it.daysRemaining}</td>
                    <td className="py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleRestore(it)}
                          disabled={restoringId === it.id || deletingId === it.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-60 transition"
                        >
                          <RotateCcw size={14} />
                          {restoringId === it.id ? '恢复中…' : '恢复'}
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(it)}
                          disabled={deletingId === it.id || restoringId === it.id}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-60 transition"
                        >
                          <Trash2 size={14} />
                          {deletingId === it.id ? '删除中…' : '永久删除'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            已选 {selectedItems.length} 项
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={restoreSelected}
              disabled={selectedItems.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
            >
              批量恢复
            </button>
            <button
              onClick={deleteSelected}
              disabled={selectedItems.length === 0}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition"
            >
              批量永久删除
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecycleBinViewer;
