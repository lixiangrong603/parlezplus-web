
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Folder, Plus, Upload, Trash2, Edit3, Send,
  ChevronLeft, X, CheckCircle,
  FileVideo, Eye, Calendar,
  FileAudio, ImageIcon,
  Users, Check, Loader2, AlertTriangle
} from 'lucide-react';
import { MediaResource, TranscriptSegment, Channel, AzureWord } from '../types';
import { 
  getChannels, saveChannel,
  getResources, saveResource,
  uploadResourceToMockCDN, getClassrooms,
  checkChannelReferences, cascadeDeleteChannel, cascadeDeleteResource, checkResourceReferences, ReferenceInfo
} from '../utils/storage';
import { uploadVideo, uploadAudio, uploadCover, getMediaUrl } from '../services/api/client';
import { parseSubtitleJson } from '../utils/textAnalysis';
import { extractVideoFrame, generateRandomCoverArt } from '../utils/mediaUtils';
import SubtitleEditor from './SubtitleEditor';
import { useModal } from '../contexts/ModalContext';

// --- SHARED MODAL COMPONENT ---
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
        <div className="p-8 flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 ${type === 'danger' ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600'}`}>
            {type === 'danger' ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
          </div>
          <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{message}</p>
        </div>
        <div className="flex p-4 gap-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-all">{cancelText}</button>
          <button onClick={() => { onConfirm(); onClose(); }} className={`flex-[1.5] py-3 text-sm font-black text-white rounded-xl shadow-lg transition-all active:scale-95 ${type === 'danger' ? 'bg-red-500 hover:bg-red-600 shadow-red-100 dark:shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100 dark:shadow-none'}`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

// DEPRECATED: 不再使用 Base64 存储，改用 R2 上传
// const fileToBase64 = (file: File): Promise<string> => {
//     return new Promise((resolve, reject) => {
//         const reader = new FileReader();
//         reader.readAsDataURL(file);
//         reader.onload = () => resolve(reader.result as string);
//         reader.onerror = error => reject(error);
//     });
// };

// --- MAIN CONTAINER ---
export const ResourceManagement = ({ onExit, onPreview }: { onExit: () => void, onPreview: (resource: MediaResource) => void }) => {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingResource, setEditingResource] = useState<MediaResource | null>(null);

  const handleEdit = (resource: MediaResource) => {
    setEditingResource(resource);
    setView('editor');
  };

  const handleCreateResources = (newResources: MediaResource[]) => {
    newResources.forEach(r => saveResource(r));
    if (newResources.length === 1) {
        setEditingResource(newResources[0]);
        setView('editor');
    } else {
        setView('list');
    }
  };

  if (view === 'editor' && editingResource) {
    return (
      <SubtitleEditor 
        resource={editingResource} 
        onBack={() => setView('list')} 
        onSave={(r) => { saveResource(r); setView('list'); }} 
      />
    );
  }

  return (
    <div className="h-full w-full bg-white dark:bg-slate-900 transition-colors duration-300">
      <ResourceList 
        onEdit={handleEdit} 
        onCreateWithFiles={handleCreateResources} 
        onBack={onExit} 
        onPreview={onPreview}
      />
    </div>
  );
};

// --- SUB-COMPONENTS ---

import { useAuth } from '../contexts/AuthContext';

const ResourceList = ({ onEdit, onCreateWithFiles, onBack, onPreview }: { onEdit: (r: MediaResource) => void, onCreateWithFiles: (resources: MediaResource[]) => void, onBack: () => void, onPreview: (r: MediaResource) => void }) => {
  const { user } = useAuth();
  const modal = useModal();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>('default');
  const [resources, setResources] = useState<MediaResource[]>([]);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');

  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [editingChannelName, setEditingChannelName] = useState('');
  
  const [publishingResource, setPublishingResource] = useState<MediaResource | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean, title: string, message: string, onConfirm: () => void
  } | null>(null);

  const [channelDeleteConfirmState, setChannelDeleteConfirmState] = useState<{
    channelId: string;
    channelName: string;
    references: ReferenceInfo[];
  } | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (user) {
        const loadedChannels = getChannels(user.id);
        setChannels(loadedChannels);
        const loadedResources = await getResources(user.id);
        setResources(loadedResources);
        
        // 默认选中第一个频道
        if (loadedChannels.length > 0) {
          setActiveChannelId(loadedChannels[0].id);
        }
      }
    };
    loadData();
  }, [user]);

  const activeResources = resources.filter(r => r.channelId === activeChannelId);

  const beginRenameChannel = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingChannelId(id);
    setEditingChannelName(currentName);
  };

  const cancelRenameChannel = () => {
    setEditingChannelId(null);
    setEditingChannelName('');
  };

  const commitRenameChannel = async (id: string) => {
    if (!user) return;
    const channel = channels.find(c => c.id === id);
    if (!channel) return;

    const nextName = editingChannelName.trim();
    if (!nextName) {
      await modal.alert({ message: '频道名称不能为空' });
      return;
    }

    if (nextName === channel.name) {
      cancelRenameChannel();
      return;
    }

    saveChannel({ ...channel, name: nextName }, user.id);
    setChannels(getChannels(user.id));
    cancelRenameChannel();
  };

  const handleAddChannel = () => {
    if (!newChannelName || !user) return;
    const nc: Channel = { id: Date.now().toString(), userId: user.id, name: newChannelName, createdAt: Date.now() };
    saveChannel(nc, user.id);
    setChannels(getChannels(user.id));
    setNewChannelName('');
    setShowAddChannel(false);
    setActiveChannelId(nc.id);
  };

  const handleDeleteChannel = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const channel = channels.find(c => c.id === id);
    if (!channel) return;

    const checkResult = await checkChannelReferences(id);
    setChannelDeleteConfirmState({
      channelId: id,
      channelName: channel.name,
      references: checkResult.references
    });
  };

  const executeDeleteChannel = async () => {
    if (!user) return;
    if (!channelDeleteConfirmState) return;

    await cascadeDeleteChannel(channelDeleteConfirmState.channelId, user.id);

    const deletedId = channelDeleteConfirmState.channelId;
    setChannelDeleteConfirmState(null);

    const updatedChannels = getChannels(user.id);
    setChannels(updatedChannels);
    const allResources = await getResources(user.id);
    setResources(allResources);
    if (activeChannelId === deletedId) setActiveChannelId(updatedChannels[0]?.id || '');
  };

  const getLevelBadgeStyle = (level: string) => {
    switch (level) {
      case 'A1': return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800';
      case 'A2': return 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-800';
      case 'B1': return 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-800';
      case 'B2': return 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800';
      case 'C1': return 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-100 dark:border-purple-800';
      default: return 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700';
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-slate-900">
      {channelDeleteConfirmState && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800">
            <div className="p-6 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-lg font-black text-slate-800 dark:text-slate-100">删除频道</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                频道「{channelDeleteConfirmState.channelName}」可能包含资源。
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
                <div className="text-sm font-bold text-amber-800 dark:text-amber-200">关联资源</div>
                {channelDeleteConfirmState.references.length === 0 ? (
                  <div className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/90">未发现关联资源。</div>
                ) : (
                  <>
                    {channelDeleteConfirmState.references.map((ref, idx) => (
                      <div key={idx} className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/90">
                        <div className="font-semibold">{ref.type}：{ref.count}</div>
                        {ref.items?.length ? (
                          <ul className="mt-1 space-y-1 list-disc list-inside">
                            {ref.items.map(it => (
                              <li key={it.id} className="truncate">{it.name}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                    <div className="text-xs text-amber-700 dark:text-amber-300 mt-3">
                      本次删除将级联软删除频道下的资源（可在回收站恢复）。
                    </div>
                  </>
                )}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                删除后可在回收站恢复，超过30天将自动清理。
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex gap-3 justify-end">
              <button
                onClick={() => setChannelDeleteConfirmState(null)}
                className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl transition"
              >
                取消
              </button>
              <button
                onClick={() => executeDeleteChannel()}
                className="px-4 py-2 text-sm font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition"
              >
                级联删除（软删除）
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="w-64 bg-slate-50 dark:bg-slate-950 flex flex-col border-r border-slate-200 dark:border-slate-800 shrink-0 transition-colors">
        <div className="h-16 px-4 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center justify-between">
            <h2 className="text-sm font-black text-slate-800 dark:text-slate-100">资源频道</h2>
            <button 
                onClick={() => setShowAddChannel(true)} 
                className="p-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 transition-all shadow-sm"
            >
              <Plus size={18} />
            </button>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="space-y-1 p-2">
          {channels.map(c => (
            <div key={c.id} 
                onClick={() => setActiveChannelId(c.id)}
                className={`group p-3 rounded-xl cursor-pointer transition-all ${activeChannelId === c.id ? 'bg-indigo-600 text-white shadow-md' : 'hover:bg-white dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300'}`}
            >
              <div className="flex items-center justify-between gap-2">
                 <div className="flex items-center gap-3 min-w-0">
                    <Folder size={16} className={activeChannelId === c.id ? "text-indigo-200" : "text-slate-400"} />
                    {editingChannelId === c.id ? (
                      <input
                        autoFocus
                        value={editingChannelName}
                        onChange={(e) => setEditingChannelName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRenameChannel(c.id);
                          }
                          if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelRenameChannel();
                          }
                        }}
                        onBlur={() => commitRenameChannel(c.id)}
                        className={`text-sm font-bold truncate w-full bg-white/80 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500 ${activeChannelId === c.id ? 'text-slate-800' : 'text-slate-800 dark:text-slate-100'}`}
                      />
                    ) : (
                      <span
                        className="text-sm font-bold truncate"
                        onDoubleClick={(e) => beginRenameChannel(c.id, c.name, e)}
                        title="双击重命名"
                      >
                        {c.name}
                      </span>
                    )}
                 </div>
                 <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                   <button 
                      onClick={(e) => beginRenameChannel(c.id, c.name, e)}
                      className={`p-1.5 rounded-lg mr-1 ${activeChannelId === c.id ? 'hover:bg-indigo-500 text-indigo-200 hover:text-white' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-400 hover:text-indigo-600'}`}
                      title="重命名"
                   >
                      <Edit3 size={14} />
                   </button>
                   <button 
                      onClick={(e) => handleDeleteChannel(c.id, e)}
                      className={`p-1.5 rounded-lg ${activeChannelId === c.id ? 'hover:bg-red-500 text-white' : 'hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-500 dark:text-slate-400 hover:text-red-500'}`}
                      title="删除频道"
                   >
                      <Trash2 size={14} />
                   </button>
                 </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 px-8 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
             <button onClick={onBack} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
               <ChevronLeft size={20} />
             </button>
             <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
               {channels.find(c => c.id === activeChannelId)?.name || '未选择频道'}
             </h2>
          </div>
          <button 
            disabled={!activeChannelId}
            onClick={() => setShowUploadModal(true)} 
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <Upload size={16} /> 上传新资源
          </button>
        </header>
        
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30 dark:bg-slate-900/50 no-scrollbar">
          {activeResources.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900/50">
              <Upload size={48} className="mb-4 opacity-10" />
              <p>该频道暂无内容，点击上方按钮开始制作</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm transition-colors">
              <table className="w-full text-left border-collapse table-fixed">
                <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="w-[40%] px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">资源内容</th>
                    <th className="w-[10%] px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">难度</th>
                    <th className="w-[18%] px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">创建时间</th>
                    <th className="w-[15%] px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">状态</th>
                    <th className="w-[17%] px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {activeResources.map(resource => (
                    <tr key={resource.id} className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-10 rounded-lg overflow-hidden border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shrink-0 flex items-center justify-center relative">
                            <img 
                                src={resource.coverImage || generateRandomCoverArt(resource.id)} 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement?.classList.add('bg-slate-200');
                                    const icon = e.currentTarget.parentElement?.querySelector('.fallback-icon');
                                    if (icon) (icon as HTMLElement).style.display = 'block';
                                }}
                            />
                            <div className="fallback-icon hidden absolute inset-0 flex items-center justify-center text-slate-400">
                                <ImageIcon size={16} />
                            </div>
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate" title={resource.title}>{resource.title}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate">ID: {resource.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded font-black border transition-transform group-hover:scale-110 ${getLevelBadgeStyle(resource.level)}`}>
                            {resource.level}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          <Calendar size={14} />
                          <span className="text-xs font-medium">
                            {new Date(resource.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${resource.status === 'ready' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-100 dark:border-orange-800'}`}>
                          {resource.status === 'ready' ? `已发布 (${resource.assignedClassIds?.length || 0})` : '草稿'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button 
                            onClick={() => onPreview(resource)}
                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all" 
                            title="预览 (学生视角)"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => onEdit(resource)} 
                            className="p-2 text-slate-400 dark:text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all" 
                            title="编辑内容"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button 
                            onClick={() => setPublishingResource(resource)} 
                            className={`p-2 rounded-lg transition-all ${resource.status === 'ready' ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-400 dark:text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30'}`} 
                            title="发布到班级"
                          >
                            <Send size={16} />
                          </button>
                          <button 
                            onClick={() => { 
                              setConfirmConfig({
                                isOpen: true,
                                title: "删除资源（级联软删除）",
                                message: `确定要删除“${resource.title}”吗？\n\n将级联软删除该资源相关的提交记录与练习数据，可在回收站恢复，超过30天将自动清理。`,
                                onConfirm: async () => { 
                                  if (user) { 
                                    cascadeDeleteResource(resource.id, user.id); 
                                    const updatedResources = await getResources(user.id);
                                    setResources(updatedResources);
                                  } 
                                }
                              });
                            }} 
                            className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all" 
                            title="删除"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showAddChannel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-2xl w-80 animate-fade-in-up border border-transparent dark:border-slate-800 transition-colors">
            <h3 className="text-lg font-bold mb-4 dark:text-slate-100">新建频道</h3>
            <input autoFocus className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 mb-4 focus:ring-2 focus:ring-indigo-500 outline-none dark:text-white" placeholder="例如：商务法语" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddChannel()} />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddChannel(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 text-sm font-bold">取消</button>
              <button onClick={handleAddChannel} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold">创建</button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <UploadModal 
          channelId={activeChannelId} 
          onClose={() => setShowUploadModal(false)} 
          onConfirm={async (newResources) => {
            onCreateWithFiles(newResources);
            setShowUploadModal(false);
            if (user) {
              const updatedResources = await getResources(user.id);
              setResources(updatedResources);
            }
          }}
          userId={user?.id}
        />
      )}

      {publishingResource && (
        <PublishToClassModal 
          resource={publishingResource}
          onClose={() => setPublishingResource(null)}
          onSuccess={async () => {
            setPublishingResource(null);
            if (user) {
              const updatedResources = await getResources(user.id);
              setResources(updatedResources);
            }
          }}
          userId={user?.id}
        />
      )}

      <CustomConfirmModal 
        isOpen={!!confirmConfig && confirmConfig.isOpen}
        onClose={() => setConfirmConfig(null)}
        onConfirm={confirmConfig?.onConfirm || (() => {})}
        title={confirmConfig?.title || ""}
        message={confirmConfig?.message || ""}
      />
    </div>
  );
};

const PublishToClassModal = ({ resource, onClose, onSuccess, userId }: { resource: MediaResource, onClose: () => void, onSuccess: () => void, userId?: string }) => {
  const classrooms = userId ? getClassrooms(userId) : [];
  const [selectedIds, setSelectedIds] = useState<string[]>(resource.assignedClassIds || []);
  const [isSaving, setIsSaving] = useState(false);

  const toggleClass = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handlePublish = async () => {
    if (!userId) return;
    setIsSaving(true);
    const updated: MediaResource = {
      ...resource,
      status: selectedIds.length > 0 ? 'ready' : 'draft',
      assignedClassIds: selectedIds
    };
    saveResource(updated, userId);
    if (updated.status === 'ready' && !updated.transcriptUrl) {
      await uploadResourceToMockCDN(updated);
    }
    setTimeout(() => {
      setIsSaving(false);
      onSuccess();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in-up border border-transparent dark:border-slate-800 transition-colors">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
          <div>
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">发布到班级</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 italic">“{resource.title}”</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition text-slate-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 max-h-80 overflow-y-auto space-y-3 no-scrollbar">
           {classrooms.length === 0 ? (
             <div className="text-center py-8">
               <p className="text-sm text-slate-400 dark:text-slate-600">您名下暂无班级，请先创建班级。</p>
             </div>
           ) : classrooms.map(cls => (
             <div 
               key={cls.id} 
               onClick={() => toggleClass(cls.id)}
               className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-center justify-between ${selectedIds.includes(cls.id) ? 'border-indigo-50 dark:border-indigo-900/20' : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800/50 hover:border-slate-200 dark:hover:border-slate-700'}`}
             >
               <div className="flex items-center gap-3">
                 <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedIds.includes(cls.id) ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}`}>
                   <Users size={20} />
                 </div>
                 <div>
                    <p className={`font-bold text-sm ${selectedIds.includes(cls.id) ? 'text-indigo-900 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'}`}>{cls.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest">{cls.students.length} 名学生</p>
                 </div>
               </div>
               {selectedIds.includes(cls.id) && <Check size={20} className="text-indigo-600 dark:text-indigo-400" />}
             </div>
           ))}
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex gap-3">
           <button onClick={onClose} className="flex-1 py-3 text-slate-500 dark:text-slate-400 text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">取消</button>
           <button 
             onClick={handlePublish}
             disabled={isSaving}
             className="flex-[2] py-3 bg-indigo-600 text-white text-sm font-black rounded-xl shadow-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2"
           >
             {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
             确认分发任务
           </button>
        </div>
      </div>
    </div>
  );
};

const UploadModal = ({ channelId, onClose, onConfirm, userId }: { channelId: string, onClose: () => void, onConfirm: (resources: MediaResource[]) => void, userId?: string }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{current: number, total: number, message: string} | null>(null);
  const [groupedResources, setGroupedResources] = useState<string[]>([]);

  const groupsMap = useMemo(() => {
    const map: Record<string, { video?: File, audio?: File, srt?: File, json?: File, image?: File }> = {};
    files.forEach(file => {
      const name = file.name.substring(0, file.name.lastIndexOf('.'));
      const ext = file.name.substring(file.name.lastIndexOf('.') + 1).toLowerCase();
      if (!map[name]) map[name] = {};
      if (['mp4', 'mov', 'webm'].includes(ext)) map[name].video = file;
      else if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext)) map[name].audio = file;
      else if (['srt', 'vtt'].includes(ext)) map[name].srt = file;
      else if (['json'].includes(ext)) map[name].json = file; 
      else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) map[name].image = file;
    });
    return map;
  }, [files]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files) as File[];
      setFiles(newFiles);
      
      const groups: Set<string> = new Set();
      newFiles.forEach(f => {
        const name = f.name.substring(0, f.name.lastIndexOf('.'));
        groups.add(name);
      });
      setGroupedResources(Array.from(groups));
    }
  };

  const processUpload = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setProgress({ current: 0, total: groupedResources.length, message: '初始化队列...' });

    const newResources: MediaResource[] = [];
    const groupNames = Object.keys(groupsMap);
    const total = groupNames.length;

    for (let i = 0; i < total; i++) {
        const name = groupNames[i];
        const group = groupsMap[name];
        
        setProgress({ current: i + 1, total: total, message: `正在处理: ${name} (${i+1}/${total})` });

        const resourceId = `temp-${Date.now()}-${i}`; // 使用临时 ID，保存时后端生成真实 ID
        
        // 上传视频/音频到 R2
        let mainMediaUrl = '';
        try {
          if (group.video) {
            setProgress({ current: i + 1, total: total, message: `上传视频: ${name}...` });
            mainMediaUrl = await uploadVideo(group.video);
          } else if (group.audio) {
            setProgress({ current: i + 1, total: total, message: `上传音频: ${name}...` });
            mainMediaUrl = await uploadAudio(group.audio);
          }
        } catch (err) {
          console.error('Failed to upload media:', err);
          // Fallback to Blob URL for preview
          mainMediaUrl = group.video ? URL.createObjectURL(group.video) : group.audio ? URL.createObjectURL(group.audio) : '';
        }

        let transcript: TranscriptSegment[] = [];
        let rawAzureWords: AzureWord[] = [];

        if (group.json) {
           try {
             const jsonText = await group.json.text();
             const parsed = parseSubtitleJson(jsonText);
             if (parsed) {
               transcript = parsed.transcript;
               rawAzureWords = parsed.rawAzureWords;
             }
           } catch (e) { console.error(`Failed to parse JSON for ${name}`, e); }
        }

        // 上传封面到 R2
        let coverImage = "";
        try {
          if (group.image) {
            setProgress({ current: i + 1, total: total, message: `上传封面: ${name}...` });
            coverImage = await uploadCover(group.image);
          } else if (group.video) {
            // 从视频提取帧，然后上传
            try {
              const frameDataUrl = await extractVideoFrame(group.video);
              // 将 Data URL 转换为 File
              const blob = await (await fetch(frameDataUrl)).blob();
              const frameFile = new File([blob], `${name}-cover.jpg`, { type: 'image/jpeg' });
              coverImage = await uploadCover(frameFile);
            } catch (err) {
              console.error('Failed to extract/upload video frame:', err);
            }
          }
        } catch (err) {
          console.error('Failed to upload cover:', err);
        }
        
        if (!coverImage) {
            // Fallback: 生成随机封面（Base64）
            coverImage = generateRandomCoverArt(name + resourceId);
        }

        const newResource: MediaResource = {
            id: resourceId,
          userId: userId || '',
            teacherId: userId,
            channelId,
            title: name,
            level: 'A1',
            videoUrl: mainMediaUrl,
            coverImage: coverImage, 
            transcript: transcript,
            rawAzureWords: rawAzureWords,
            status: 'draft',
            createdAt: Date.now(),
            assignedClassIds: []
        };
        newResources.push(newResource);
    }

    setProgress({ current: total, total: total, message: '处理完成！' });
    setTimeout(() => { onConfirm(newResources); setIsProcessing(false); }, 800);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh] border border-transparent dark:border-slate-800 transition-colors">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-950 shrink-0">
          <div>
            <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">上传新资源</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mt-1">智能分析：自动生成黑胶封面</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-full transition shadow-sm border border-slate-200 dark:border-slate-700 text-slate-400">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-8 flex-1 overflow-y-auto no-scrollbar space-y-6">
          {!isProcessing ? (
            <>
                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-indigo-100 dark:border-indigo-900 rounded-3xl p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all group">
                    <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-4 group-hover:scale-110 transition-transform"><Upload size={32} /></div>
                    <p className="font-bold text-slate-700 dark:text-slate-200">点击或拖拽文件到这里</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 text-center max-w-xs leading-relaxed">支持 MP4, MP3, JSON, PNG 等<br/><span className="text-indigo-500 dark:text-indigo-400 text-[10px] uppercase font-bold tracking-wider">自动为音频/视频资源生成专属封面</span></p>
                    <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} accept="video/*,audio/*,image/*,.srt,.json" />
                </div>
                
                {files.length > 0 && (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle size={14} className="text-emerald-500" /> 已选择 {files.length} 个文件
                            </h4>
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded">
                                预计生成 {groupedResources.length} 个资源
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto pr-2 no-scrollbar">
                            {groupedResources.map((name, i) => (
                                <div key={i} className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700 p-2.5 rounded-xl">
                                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">{i+1}</div>
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate flex-1">{name}</span>
                                    <div className="flex gap-1">
                                      {groupsMap[name].video && <div className="w-4 h-4 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded flex items-center justify-center"><FileVideo size={10} /></div>}
                                      {groupsMap[name].audio && <div className="w-4 h-4 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded flex items-center justify-center"><FileAudio size={10} /></div>}
                                      {groupsMap[name].json && <div className="w-4 h-4 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded flex items-center justify-center text-[8px] font-bold">J</div>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 space-y-6">
                <div className="relative w-24 h-24">
                    <svg className="animate-spin w-full h-full text-indigo-100 dark:text-indigo-900/30" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75 text-indigo-600 dark:text-indigo-400" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center font-black text-indigo-600 dark:text-indigo-400 text-lg tabular-nums">
                        {Math.round((progress?.current || 0) / (progress?.total || 1) * 100)}%
                    </div>
                </div>
                <div className="text-center space-y-1">
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg">正在生成封面并持久化资源</h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400 h-5 italic">{progress?.message}</p>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 transition-all duration-300 shadow-[0_0_10px_rgba(79,70,229,0.5)]" style={{ width: `${(progress?.current || 0) / (progress?.total || 1) * 100}%` }}></div>
                </div>
            </div>
          )}
        </div>
        
        {!isProcessing && (
            <div className="p-6 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex gap-3 shrink-0">
                <button onClick={onClose} className="flex-1 py-3 text-slate-500 dark:text-slate-400 text-sm font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-700 transition">取消</button>
                <button disabled={files.length === 0} onClick={processUpload} className={`flex-[2] py-3 text-sm font-bold rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 ${files.length > 0 ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'}`}>
                    开始处理并上传
                </button>
            </div>
        )}
      </div>
    </div>
  );
};
