import React, { useState, useEffect } from 'react';
import { X, Clock, User, FileText, AlertCircle, Download, Filter, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { OperationLog, OperationType } from '../types';
import { getOperationLogs } from '../utils/storage';

interface OperationLogViewerProps {
  onClose: () => void;
  currentUserId?: string;
}

const OperationLogViewer: React.FC<OperationLogViewerProps> = ({ onClose, currentUserId }) => {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<OperationLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<OperationType | 'all'>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    loadLogs();
  }, []);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, typeFilter]);

  const loadLogs = async () => {
    try {
      const allLogs = await getOperationLogs();
      // 按时间倒序排列
      const sortedLogs = allLogs.sort((a, b) => b.timestamp - a.timestamp);
      setLogs(sortedLogs);
    } catch (error) {
      console.error('Failed to load operation logs:', error);
      setLogs([]);
    }
  };

  const filterLogs = () => {
    let filtered = [...logs];

    // 类型过滤
    if (typeFilter !== 'all') {
      filtered = filtered.filter(log => log.operationType === typeFilter);
    }

    // 搜索过滤
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.operatorName.toLowerCase().includes(term) ||
        log.targetName?.toLowerCase().includes(term) ||
        log.reason?.toLowerCase().includes(term)
      );
    }

    setFilteredLogs(filtered);
  };

  const getOperationTypeLabel = (type: OperationType): string => {
    const labels: Record<OperationType, string> = {
      delete_user: '删除用户',
      delete_classroom: '删除班级',
      delete_exam: '删除试卷',
      delete_exam_folder: '删除试卷文件夹',
      delete_resource: '删除资源',
      delete_channel: '删除频道',
      delete_question: '删除题目',
      return_to_redo: '打回重做',
      withdraw_task: '撤回任务',
      withdraw_exam: '撤回试卷'
    };
    return labels[type] || type;
  };

  const getOperationTypeColor = (type: OperationType): string => {
    if (type.startsWith('delete')) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
    if (type.startsWith('withdraw')) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
    if (type === 'return_to_redo') return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
    return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;
    
    // 小于1小时显示分钟
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}分钟前`;
    }
    
    // 小于24小时显示小时
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}小时前`;
    }
    
    // 否则显示完整日期
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportLogs = () => {
    const csv = [
      ['时间', '操作者', '操作类型', '目标类型', '目标名称', '原因'].join(','),
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString('zh-CN'),
        log.operatorName,
        getOperationTypeLabel(log.operationType),
        log.targetType,
        log.targetName || '',
        log.reason || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `操作日志_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <FileText className="text-purple-600 dark:text-purple-400" size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">操作审计日志</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                共 {filteredLogs.length} 条记录
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportLogs}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition flex items-center gap-2"
            >
              <Download size={16} />
              导出
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="搜索操作者、目标或原因..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg flex items-center gap-2 hover:bg-white dark:hover:bg-slate-900 transition"
            >
              <Filter size={16} />
              筛选
              {showFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap gap-2">
              {(['all', 'delete_user', 'delete_classroom', 'delete_exam', 'delete_resource', 'delete_channel', 'delete_question', 'return_to_redo', 'withdraw_task', 'withdraw_exam'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition ${
                    typeFilter === type
                      ? 'bg-purple-600 text-white'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {type === 'all' ? '全部' : getOperationTypeLabel(type as OperationType)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Log List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <AlertCircle className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 dark:text-slate-400">暂无操作记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getOperationTypeColor(log.operationType)}`}>
                          {getOperationTypeLabel(log.operationType)}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {log.targetType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <User size={14} />
                          <span className="font-medium">{log.operatorName}</span>
                        </div>
                        <span className="text-slate-400">→</span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {log.targetName || log.targetId}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <Clock size={14} />
                      {formatTimestamp(log.timestamp)}
                    </div>
                  </div>

                  {log.reason && (
                    <div className="mt-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-2">
                      <span className="font-medium">原因：</span>
                      {log.reason}
                    </div>
                  )}

                  {log.details && (
                    <button
                      onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                      className="mt-2 text-xs text-purple-600 dark:text-purple-400 hover:underline"
                    >
                      {expandedLog === log.id ? '收起详情' : '查看详情'}
                    </button>
                  )}

                  {expandedLog === log.id && log.details && (
                    <div className="mt-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                      <pre className="whitespace-pre-wrap font-mono">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OperationLogViewer;
