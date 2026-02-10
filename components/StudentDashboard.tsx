
import React, { useState, useMemo, useEffect, useRef, useContext } from 'react';
import { MediaResource, Classroom, Submission, ExamPaper, User, ExamSession } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, ChevronRight, Lock, BookOpen, CheckCircle, Clock, Eye, EyeOff, Save, Play, ChevronDown, Layers, Sun, Moon, AlertCircle, FileCheck, FileText, LayoutGrid, List, Camera, Trash2, Loader2, User as UserIcon } from 'lucide-react';
import AvatarEditor from './AvatarEditor';
import { getClassroomById, getClassrooms, getSubmissions, getExamPapers, getExamSessions, saveUser } from '../utils/storage';
import { generateRandomCoverArt, getInitials, getColorFromString, compressImage, validateImageFile } from '../utils/mediaUtils';
import { ThemeContext } from '../App';
import ExamTaker from './ExamTaker';
import { ChangePasswordForm } from './ChangePasswordForm';

// Icons used in StudentDashboard
const MenuIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>;
const CheckCircleIcon = ({ size = 16, className = "" }: { size?: number, className?: string }) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>;
const XIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>;
const SparklesIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M9 3v4"/><path d="M3 5h4"/><path d="M3 9h4"/></svg>;

interface StudentDashboardProps {
  resources: MediaResource[];
  onSelectResource: (resource: MediaResource) => void;
  onEnterTeacherMode: () => void;
}

const StudentDashboard: React.FC<StudentDashboardProps> = ({ resources, onSelectResource, onEnterTeacherMode }) => {
  const { user, logout } = useAuth();
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);
  const [activeClass, setActiveClass] = useState<Classroom | null>(null);
  const [allClassrooms, setAllClassrooms] = useState<Classroom[]>([]);
  const [isClassSwitcherOpen, setIsClassSwitcherOpen] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'incomplete'>('incomplete'); 
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [settingsTab, setSettingsTab] = useState<'profile' | 'security'>('profile');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [examSessions, setExamSessions] = useState<ExamSession[]>([]);
  const [assignedExams, setAssignedExams] = useState<ExamPaper[]>([]);
  const [takingExam, setTakingExam] = useState<ExamPaper | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const [candidateImage, setCandidateImage] = useState<string | null>(null);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  const classSwitcherRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateImageFile(file);
    if (!validation.valid) {
      alert(validation.error);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setCandidateImage(event.target?.result as string);
      setShowAvatarEditor(true);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleCropComplete = (croppedImage: string) => {
    setAvatarPreview(croppedImage);
    setShowAvatarEditor(false);
    setCandidateImage(null);
    
    // Save to server/storage
    if (user) {
      const updatedUser = { ...user, avatar: croppedImage };
      saveUser(updatedUser);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarPreview(null);
    if (user) {
      const updatedUser = { ...user, avatar: undefined };
      saveUser(updatedUser);
    }
  };

  useEffect(() => {
    if (user) {
        let active = true;
        const loadStudentData = async () => {
          const allClasses = await getClassrooms();
          if (!active) return;
          // 学生只能看到包含他们的班级
          const myClassrooms = allClasses.filter(classroom => 
            classroom.students.some(student => student.userId === user.id)
          );
          setAllClassrooms(myClassrooms);
          const [subs, sessions] = await Promise.all([
            getSubmissions(),
            getExamSessions(user.id)
          ]);
          if (!active) return;
          setSubmissions(subs);
          setExamSessions(sessions);
        };
        loadStudentData();
        return () => {
          active = false;
        };
    }
  }, [user]);

  // Prefer the stable session id (session_<examId>_<userId>) and otherwise the latest submitted session.
  const examSessionMap = useMemo(() => {
    const map = new Map<string, ExamSession>();
    if (!user) return map;

    const grouped = new Map<string, ExamSession[]>();
    for (const s of examSessions) {
      if (s.studentId !== user.id) continue;
      const list = grouped.get(s.examPaperId) || [];
      list.push(s);
      grouped.set(s.examPaperId, list);
    }

    for (const [examId, list] of grouped.entries()) {
      const stableId = `session_${examId}_${user.id}`;
      const stable = list.find(x => x.id === stableId);
      if (stable) {
        map.set(examId, stable);
        continue;
      }

      const submitted = list.filter(x => x.isSubmitted);
      const candidates = submitted.length > 0 ? submitted : list;
      candidates.sort((a, b) => {
        const aT = (a.submitTime ?? a.startTime ?? 0);
        const bT = (b.submitTime ?? b.startTime ?? 0);
        return bT - aT;
      });
      map.set(examId, candidates[0]);
    }

    return map;
  }, [examSessions, user]);

  // [FIX] 监控 activeClass 变化，动态加载分配给该班级的考试
  useEffect(() => {
    if (activeClass) {
        let active = true;
        const loadAssigned = async () => {
          const allExams = await getExamPapers();
          if (!active) return;
          const assigned = allExams.filter(exam => 
            exam.assignedClassIds && exam.assignedClassIds.includes(activeClass.id)
          );
          setAssignedExams(assigned);
        };
        loadAssigned();
        return () => {
          active = false;
        };
    } else if (user?.classId) {
        let active = true;
        const loadClassroom = async () => {
          // 初始加载：如果没有 activeClass 但用户有 classId，先设置它
          const assignedClass = await getClassroomById(user.classId);
          if (!active) return;
          if (assignedClass) {
              setActiveClass(assignedClass);
          }
        };
        loadClassroom();
        return () => {
          active = false;
        };
    }
  }, [user?.classId, activeClass?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (classSwitcherRef.current && !classSwitcherRef.current.contains(event.target as Node)) {
        setIsClassSwitcherOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayedResources = useMemo(() => {
    let result = resources.filter(r => {
        if (activeClass?.id && r.assignedClassIds?.includes(activeClass.id)) return true;
        if (r.status === 'ready' && (!r.assignedClassIds || r.assignedClassIds.length === 0)) return true;
        return false;
    });
    
    if (filterTab === 'incomplete') {
      result = result.filter(r => {
          // Check explicit submission status first
          const sub = submissions.find(s => s.resourceId === r.id && s.studentId === user?.id);
          const isGraded = sub?.status === 'graded';
          return !r.isCompleted && !isGraded;
      });
    } else {
      result = result.sort((a, b) => {
        if (a.isCompleted === b.isCompleted) return 0;
        return a.isCompleted ? 1 : -1;
      });
    }
    return result;
  }, [resources, filterTab, activeClass?.id, submissions, user]);

  const incompleteCount = resources.filter(r => {
      const isAssigned = (activeClass?.id && r.assignedClassIds?.includes(activeClass.id)) || (!r.assignedClassIds || r.assignedClassIds.length === 0);
      const sub = submissions.find(s => s.resourceId === r.id && s.studentId === user?.id);
      const isGraded = sub?.status === 'graded';
      return isAssigned && !r.isCompleted && !isGraded && r.status === 'ready';
  }).length;
  
  const completedCount = resources.filter(r => {
      const isAssigned = (activeClass?.id && r.assignedClassIds?.includes(activeClass.id)) || (!r.assignedClassIds || r.assignedClassIds.length === 0);
      const sub = submissions.find(s => s.resourceId === r.id && s.studentId === user?.id);
      const isGraded = sub?.status === 'graded';
      return isAssigned && (r.isCompleted || isGraded) && r.status === 'ready';
  }).length;

  // 使用 ID 生成唯一的动态封面作为保底
  const getFallbackCover = (id: string) => {
    return generateRandomCoverArt(id);
  };

  // Handle exam taking
  if (takingExam && user) {
    return (
      <ExamTaker
        exam={takingExam}
        user={user}
        onExit={() => {
          setTakingExam(null);
          getExamSessions(user.id).then(setExamSessions);
        }}
      />
    );
  }

  return (
    <div className="h-[100dvh] w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center relative overflow-hidden transition-colors duration-300">
      
      {/* Universal Header */}
      <div className="w-full bg-white dark:bg-slate-900 h-14 md:h-16 shadow-sm border-b border-slate-100 dark:border-slate-800 z-50 flex-shrink-0 flex items-center">
        <div className="max-w-7xl w-full mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-none hidden sm:flex">
              <SparklesIcon />
            </div>
            
            <div className="flex flex-col">
              <div className="flex items-center gap-2 md:gap-3">
                <h1 className="text-lg md:text-xl font-black text-indigo-900 dark:text-indigo-400 leading-none tracking-tight">ParlezPlus</h1>
                
                <div className="relative" ref={classSwitcherRef}>
                  <button 
                    onClick={() => setIsClassSwitcherOpen(!isClassSwitcherOpen)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-100 dark:border-slate-700 rounded-full text-xs font-bold text-slate-600 dark:text-slate-300 transition-all active:scale-95"
                  >
                    <Layers size={14} className="text-indigo-500" />
                    <span className="max-w-[120px] truncate">{activeClass?.name || '选择班级'}</span>
                    <ChevronDown size={14} className={`text-slate-400 transition-transform ${isClassSwitcherOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isClassSwitcherOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 py-2 animate-fade-in-up z-[100]">
                      <p className="px-4 py-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">切换我的班级</p>
                      {allClassrooms.map((cls) => (
                        <button
                          key={cls.id}
                          onClick={() => {
                            setActiveClass(cls);
                            setIsClassSwitcherOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-sm flex items-center justify-between hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${activeClass?.id === cls.id ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}
                        >
                          {cls.name}
                          {activeClass?.id === cls.id && <CheckCircleIcon size={16} />}
                        </button>
                      ))}
                      {allClassrooms.length === 0 && (
                        <p className="px-4 py-3 text-xs text-slate-400 italic">暂无可选班级</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={toggleTheme}
              className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all active:scale-95"
              title={isDarkMode ? "切换到浅色模式" : "切换到深色模式"}
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            <div className="text-right hidden sm:block">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{user?.name}</p>
            </div>

            <button 
              onClick={() => setShowSettings(true)}
              className="w-9 h-9 rounded-full overflow-hidden border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-400 transition-all active:scale-95"
              title="我的设置"
            >
              {user?.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user?.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div 
                  className="w-full h-full flex items-center justify-center text-white text-sm font-black"
                  style={{ backgroundColor: getColorFromString(user?.id || user?.name || '') }}
                >
                  {getInitials(user?.name || '')}
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
      
      <div className="w-full flex-1 overflow-y-auto no-scrollbar pb-12">
        <div className="max-w-7xl mx-auto px-6 space-y-6 md:space-y-8">
          <div className="h-1 md:h-2" />
          
          <div className="sticky top-0 z-20 -mx-6 px-6 pb-3 pt-0 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md transition-all">
            <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1">
                 <button 
                   onClick={() => setViewMode('grid')}
                   className={`p-1.5 md:p-2 rounded-xl transition-all active:scale-95 ${viewMode === 'grid' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                   title="网格视图"
                 >
                   <LayoutGrid size={18} className="md:size-[20px]" />
                 </button>
                 <button 
                   onClick={() => setViewMode('list')}
                   className={`p-1.5 md:p-2 rounded-xl transition-all active:scale-95 ${viewMode === 'list' ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                   title="列表视图"
                 >
                   <List size={18} className="md:size-[20px]" />
                 </button>
              </div>

              <div className="flex items-center gap-0.5 md:gap-1 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl">
                 <button 
                   onClick={() => setFilterTab('incomplete')}
                   className={`px-3 py-1.5 md:px-4 rounded-lg text-xs md:text-sm font-bold transition-all active:scale-95 flex items-center gap-1.5 ${filterTab === 'incomplete' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                 >
                   待完成
                   {incompleteCount > 0 && (
                     <span className={`text-[9px] md:text-[10px] px-1.5 py-0.5 rounded-full font-bold ${filterTab === 'incomplete' ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400' : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400'}`}>
                       {incompleteCount}
                     </span>
                   )}
                 </button>
                 <button 
                   onClick={() => setFilterTab('all')}
                   className={`px-3 py-1.5 md:px-4 rounded-lg text-xs md:text-sm font-bold transition-all active:scale-95 ${filterTab === 'all' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}
                 >
                   全部任务
                 </button>
              </div>
            </div>
          </div>

          {!activeClass ? (
            <div className="py-20 text-center text-slate-400 dark:text-slate-500 text-sm bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 p-8">
               <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-600 mx-auto mb-4">
                  <Lock size={32} />
               </div>
               <p className="font-bold text-slate-600 dark:text-slate-300 text-base">请在上方切换您的班级</p>
               <p className="text-xs mt-1">若没有可选班级，请联系您的法语老师。</p>
            </div>
          ) : displayedResources.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex flex-col items-center">
               <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                 <CheckCircleIcon size={32} />
               </div>
               <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">暂无新任务</h3>
               <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">
                 {filterTab === 'incomplete' ? '太棒了！您已完成所有分配的任务 🎉' : '老师尚未给本班级发布跟读资源'}
               </p>
            </div>
          ) : (
            <>
              {/* Assigned Exams Section */}
              {assignedExams.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <FileText size={20} className="text-indigo-600" />
                    试卷任务
                  </h2>
                  
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                      {assignedExams.map((exam) => (
                        (() => {
                          const deadline = user?.classId ? exam.assignedClassDeadlines?.[user.classId] : undefined;
                          const isOverdue = !!deadline && Date.now() > deadline;
                          const session = examSessionMap.get(exam.id);
                          const submittedSession = session?.isSubmitted ? session : undefined;
                          return (
                        <div
                          key={exam.id}
                          className="bg-white dark:bg-slate-900 rounded-xl md:rounded-[1.5rem] shadow-sm overflow-hidden cursor-pointer transform transition-all hover:scale-[1.02] active:scale-[0.98] hover:shadow-md border border-slate-100 dark:border-slate-800 group relative flex flex-col font-sans"
                          onClick={() => setTakingExam(exam)}
                        >
                          <div className="relative h-24 md:h-36 bg-gradient-to-br from-indigo-500 to-purple-600 overflow-hidden shrink-0 rounded-t-xl md:rounded-t-[1.5rem]">
                            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMSkiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-30"></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                              <FileText size={48} className="text-white/20 md:size-[64px]" />
                            </div>
                            <div className="absolute top-3 left-3 md:top-4 md:left-4">
                              <div className="bg-white/20 backdrop-blur-md text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg">
                                试卷
                              </div>
                            </div>
                            {deadline && (
                              <div className="absolute top-3 right-3 md:top-4 md:right-4">
                                <div className={`backdrop-blur-md text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg flex items-center gap-1 ${isOverdue ? 'bg-red-600/80' : 'bg-black/30'}`}>
                                  <Clock size={10} className="md:size-[12px]" /> {new Date(deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </div>
                              </div>
                            )}
                            <div className="absolute bottom-3 left-3 right-3 md:bottom-4 md:left-4 md:right-4 text-left">
                              <h3 className="text-white font-bold text-base md:text-lg leading-tight line-clamp-2 drop-shadow-md">
                                {exam.title}
                              </h3>
                            </div>
                          </div>
                          <div className="p-2 md:p-3 flex-1 flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                <FileText size={10} className="text-indigo-400 md:size-[12px]" />
                                {exam.sections.length} 部分
                              </div>
                              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center transition-all group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-md">
                                <ChevronRight size={12} className="md:size-[14px]" />
                              </div>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-2.5 md:pt-3">
                              <div className="flex flex-col items-start gap-0.5">
                                <span className="text-[8px] md:text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">
                                  {submittedSession ? '得分' : (session ? '进度' : '满分')}
                                </span>
                                <span className="text-base md:text-lg font-black text-indigo-600 leading-none">
                                  {submittedSession
                                    ? `${submittedSession.score}/${submittedSession.totalScore}`
                                    : (session ? '进行中' : exam.totalScore)}
                                </span>
                              </div>
                              {isOverdue && !session ? (
                                <div className="text-[9px] md:text-[10px] font-bold text-red-500 flex items-center gap-1">
                                  <AlertCircle size={10} className="md:size-[12px]" /> 逾期
                                </div>
                              ) : submittedSession ? (
                                <div className="text-[9px] md:text-[10px] font-bold text-indigo-500 flex items-center gap-1">
                                  <FileCheck size={10} className="md:size-[12px]" /> 已交
                                </div>
                              ) : session ? (
                                <div className="text-[9px] md:text-[10px] font-bold text-orange-500 flex items-center gap-1">
                                  <Clock size={10} className="md:size-[12px]" /> 进行中
                                </div>
                              ) : (
                                <div className="text-[9px] md:text-[10px] font-bold text-emerald-500">
                                  开始
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                          );
                        })()
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                      <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
                        {assignedExams.map((exam) => {
                          const deadline = user?.classId ? exam.assignedClassDeadlines?.[user.classId] : undefined;
                          const isOverdue = !!deadline && Date.now() > deadline;
                          const session = examSessionMap.get(exam.id);
                          const submittedSession = session?.isSubmitted ? session : undefined;
                          return (
                            <div 
                              key={exam.id}
                              className="p-3.5 flex items-center gap-3.5 active:bg-slate-50 dark:active:bg-slate-800 active:scale-[0.98] transition-all cursor-pointer"
                              onClick={() => setTakingExam(exam)}
                            >
                              <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shrink-0">
                                <FileText size={20} />
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col items-start text-left">
                                <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate w-full">{exam.title}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[9px] font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                                    {deadline ? new Date(deadline).toLocaleDateString() : '无期限'}
                                  </span>
                                  <span className="text-[9px] font-black text-indigo-600 font-sans">
                                    {submittedSession
                                      ? `${submittedSession.score}/${submittedSession.totalScore}`
                                      : (session ? '进行中' : '未开始')}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {submittedSession ? (
                                  <FileCheck size={14} className="text-indigo-500" />
                                ) : session ? (
                                  <Clock size={14} className="text-orange-500" />
                                ) : isOverdue ? (
                                  <AlertCircle size={14} className="text-red-500" />
                                ) : (
                                  <ChevronRight size={16} className="text-slate-300" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <table className="hidden md:table w-full text-left border-collapse table-fixed">
                        <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">试卷名称</th>
                            <th className="w-24 px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">类型</th>
                            <th className="w-48 px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">截止时间</th>
                            <th className="w-32 px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">得分</th>
                            <th className="w-32 px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {assignedExams.map((exam) => {
                            const deadline = user?.classId ? exam.assignedClassDeadlines?.[user.classId] : undefined;
                            const isOverdue = !!deadline && Date.now() > deadline;
                            const session = examSessionMap.get(exam.id);
                            const submittedSession = session?.isSubmitted ? session : undefined;
                            return (
                              <tr 
                                key={exam.id} 
                                className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors cursor-pointer"
                                onClick={() => setTakingExam(exam)}
                              >
                                <td className="px-6 py-4 truncate text-left">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-indigo-500 flex items-center justify-center text-white shrink-0">
                                      <FileText size={20} />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{exam.title}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded uppercase">
                                    试卷
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {deadline ? new Date(deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '无限制'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center font-sans tracking-tight">
                                  <span className="text-sm font-black text-indigo-600">
                                    {submittedSession
                                      ? `${submittedSession.score}/${submittedSession.totalScore}`
                                      : (session ? '进行中' : `0/${exam.totalScore}`)}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {isOverdue && !session ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">
                                      <AlertCircle size={12} /> 已逾期
                                    </span>
                                  ) : submittedSession ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">
                                      <FileCheck size={12} /> 已提交
                                    </span>
                                  ) : session ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg">
                                      <Clock size={12} /> 进行中
                                    </span>
                                  ) : (
                                    <span className="text-xs font-bold text-indigo-600 group-hover:underline text-left">点击开始</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Resources Section */}
              {displayedResources.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                    <BookOpen size={20} className="text-indigo-600" />
                    跟读任务
                  </h2>
                  
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
                      {displayedResources.map((resource) => {
                        const isOverdue = resource.deadline && Date.now() > resource.deadline;
                        const submission = submissions.find(s => s.resourceId === resource.id && s.studentId === user?.id);
                        const status = submission?.status; // 'pending_review' | 'graded' | undefined

                        return (
                          <div 
                            key={resource.id}
                            className={`bg-white dark:bg-slate-900 rounded-[1.5rem] md:rounded-[2rem] shadow-sm overflow-hidden cursor-pointer transform transition-all hover:scale-[1.03] active:scale-[0.98] hover:shadow-xl border group relative flex flex-col isolate ${resource.isCompleted ? 'border-indigo-50 dark:border-indigo-900/30 opacity-90' : 'border-slate-100 dark:border-slate-800'}`}
                            onClick={() => onSelectResource(resource)}
                          >
                            <div className={`relative h-32 md:h-40 bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 rounded-t-lg md:rounded-t-[1.5rem] ${resource.isCompleted ? 'grayscale-[50%]' : ''}`}>
                              <img 
                                src={resource.coverImage || getFallbackCover(resource.id)} 
                                alt={resource.title} 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                onError={(e) => {
                                    e.currentTarget.src = getFallbackCover(resource.id);
                                }} 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                              
                              <div className="absolute top-3 left-3 md:top-4 md:left-4 flex flex-wrap gap-1.5 md:gap-2">
                                <div className={`text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shadow-lg backdrop-blur-md ${
                                  resource.level === 'A1' ? 'bg-emerald-500/80' :
                                  resource.level === 'A2' ? 'bg-blue-500/80' :
                                  resource.level === 'B1' ? 'bg-orange-500/80' : 'bg-red-500/80'
                                }`}>
                                  {resource.level}
                                </div>
                                
                                {/* Status Badges */}
                                {status === 'graded' ? (
                                    <div className="bg-indigo-600 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shadow-lg flex items-center gap-1 animate-fade-in text-left">
                                        <FileCheck size={10} className="md:size-[12px]" /> 已批
                                    </div>
                                ) : status === 'pending_review' ? (
                                    <div className="bg-orange-500 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shadow-lg flex items-center gap-1 animate-fade-in">
                                        <Clock size={10} className="md:size-[12px]" /> 待阅
                                    </div>
                                ) : resource.isCompleted && (
                                  <div className="bg-emerald-500 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shadow-lg flex items-center gap-1 animate-fade-in">
                                    <CheckCircleIcon size={10} className="md:size-[12px]" /> 达标
                                  </div>
                                )}

                                {isOverdue && !resource.isCompleted && !status && (
                                    <div className="bg-red-600 text-white text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 md:px-2 md:py-1 rounded-lg shadow-lg flex items-center gap-1 animate-pulse">
                                      <AlertCircle size={10} className="md:size-[12px]" /> 逾期
                                    </div>
                                )}
                              </div>

                              <div className="absolute bottom-3 left-3 right-3 md:bottom-4 md:left-4 md:right-4 text-left">
                                  <h3 className="text-white font-bold text-base md:text-lg leading-tight line-clamp-2 drop-shadow-md">
                                    {resource.title}
                                  </h3>
                              </div>
                            </div>

                            <div className="p-2 md:p-3 flex-1 flex flex-col justify-between">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                    <BookOpen size={10} className="text-indigo-400 md:size-[12px]" />
                                    {resource.transcript.length} 段落
                                </div>
                                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-50 dark:bg-slate-800 text-slate-300 dark:text-slate-600 flex items-center justify-center transition-all group-hover:bg-indigo-600 group-hover:text-white group-hover:shadow-md">
                                  <Play size={12} fill="currentColor" className="md:size-[14px]" />
                                </div>
                              </div>

                              <div className="flex items-center justify-between border-t border-slate-50 dark:border-slate-800 pt-2.5 md:pt-3">
                                <div className="flex flex-col items-start gap-0.5">
                                    <span className="text-[8px] md:text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">截止</span>
                                    <span className={`text-[9px] md:text-[10px] font-bold flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                      <Clock size={8} className="md:size-[10px]" />
                                      {resource.deadline ? new Date(resource.deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '无限制'}
                                    </span>
                                </div>
                                {status === 'graded' && submission?.aiScore ? (
                                    <div className="flex flex-col items-end">
                                        <span className="text-[8px] md:text-[9px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-tighter">得分</span>
                                        <span className="text-base md:text-lg font-black text-indigo-600 leading-none font-sans tracking-tight">{submission.aiScore.overallScore}</span>
                                    </div>
                                ) : resource.isCompleted && (
                                  <div className="flex items-center gap-1 text-[9px] md:text-[10px] font-bold text-emerald-500/80">
                                    已学完
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl overflow-hidden shadow-sm">
                      <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
                        {displayedResources.map((resource) => {
                          const isOverdue = resource.deadline && Date.now() > resource.deadline;
                          const submission = submissions.find(s => s.resourceId === resource.id && s.studentId === user?.id);
                          const status = submission?.status;
                          return (
                            <div 
                              key={resource.id}
                              className="p-3.5 flex items-center gap-3.5 active:bg-slate-50 dark:active:bg-slate-800 active:scale-[0.98] transition-all cursor-pointer"
                              onClick={() => onSelectResource(resource)}
                            >
                              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white shrink-0 overflow-hidden">
                                <img 
                                  src={resource.coverImage || getFallbackCover(resource.id)} 
                                  className="w-full h-full object-cover" 
                                  alt=""
                                />
                              </div>
                              <div className="flex-1 min-w-0 flex flex-col items-start text-left">
                                <h4 className="text-[13px] font-bold text-slate-700 dark:text-slate-200 truncate w-full">{resource.title}</h4>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded text-white ${
                                    resource.level === 'A1' ? 'bg-emerald-500' :
                                    resource.level === 'A2' ? 'bg-blue-500' :
                                    resource.level === 'B1' ? 'bg-orange-500' : 'bg-red-500'
                                  }`}>
                                    {resource.level}
                                  </span>
                                  <span className={`text-[9px] font-medium ${isOverdue ? 'text-red-500' : 'text-slate-400'}`}>
                                    {resource.deadline ? new Date(resource.deadline).toLocaleDateString() : '无期限'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {status === 'graded' ? (
                                  <span className="text-[13px] font-black text-indigo-600 font-sans">{submission?.aiScore?.overallScore}</span>
                                ) : resource.isCompleted ? (
                                  <CheckCircleIcon size={14} />
                                ) : (
                                  <ChevronRight size={16} className="text-slate-300" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <table className="hidden md:table w-full text-left border-collapse table-fixed">
                        <thead className="bg-slate-50/50 dark:bg-slate-950/50 border-b border-slate-100 dark:border-slate-800">
                          <tr>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">任务名称</th>
                            <th className="w-24 px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">等级</th>
                            <th className="w-48 px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">截止时间</th>
                            <th className="w-32 px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center">得分/进度</th>
                            <th className="w-32 px-6 py-4 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">状态</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                          {displayedResources.map((resource) => {
                            const isOverdue = resource.deadline && Date.now() > resource.deadline;
                            const submission = submissions.find(s => s.resourceId === resource.id && s.studentId === user?.id);
                            const status = submission?.status;

                            return (
                              <tr 
                                key={resource.id} 
                                className="group hover:bg-emerald-50/30 dark:hover:bg-emerald-900/20 transition-colors cursor-pointer"
                                onClick={() => onSelectResource(resource)}
                              >
                                <td className="px-6 py-4 truncate text-left">
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center text-white shrink-0 overflow-hidden">
                                      <img 
                                        src={resource.coverImage || getFallbackCover(resource.id)} 
                                        className="w-full h-full object-cover" 
                                        alt=""
                                      />
                                    </div>
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{resource.title}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${
                                    resource.level === 'A1' ? 'bg-emerald-500' :
                                    resource.level === 'A2' ? 'bg-blue-500' :
                                    resource.level === 'B1' ? 'bg-orange-500' : 'bg-red-500'
                                  }`}>
                                    {resource.level}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                  <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
                                    {resource.deadline ? new Date(resource.deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '无限制'}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-center font-sans tracking-tight">
                                  {status === 'graded' && submission?.aiScore ? (
                                    <span className="text-sm font-black text-indigo-600">{submission.aiScore.overallScore}</span>
                                  ) : resource.isCompleted ? (
                                    <span className="text-[10px] font-bold text-emerald-500">100%</span>
                                  ) : (
                                    <span className="text-xs text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex flex-col items-end gap-1">
                                    {status === 'graded' ? (
                                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-1 rounded-lg">已批改</span>
                                    ) : status === 'pending_review' ? (
                                      <span className="text-[10px] font-bold text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-lg">批改中</span>
                                    ) : resource.isCompleted ? (
                                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded-lg">已达标</span>
                                    ) : isOverdue ? (
                                      <span className="text-[10px] font-bold text-red-500 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-lg">已逾期</span>
                                    ) : (
                                      <span className="text-xs font-bold text-emerald-600 group-hover:underline">点击开始</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <div className="text-center pt-8 pb-12 border-t border-slate-100 dark:border-slate-800">
          </div>
        </div>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex h-[500px] border border-slate-200 dark:border-slate-800">
            <div className="w-48 bg-slate-50 dark:bg-slate-950/50 border-r border-slate-100 dark:border-slate-800 flex flex-col p-4 shrink-0">
              <nav className="space-y-1">
                <button onClick={() => setSettingsTab('profile')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold ${settingsTab === 'profile' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                  <Camera size={18} /> 个人资料
                </button>
                <button onClick={() => setSettingsTab('security')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold ${settingsTab === 'security' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-200/50'}`}>
                  <Lock size={18} /> 安全设置
                </button>
              </nav>
              <button onClick={logout} className="mt-auto w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50">
                <LogOut size={18} /> 退出登录
              </button>
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <h2 className="text-lg font-black text-slate-800 dark:text-slate-100">{settingsTab === 'profile' ? '个人资料' : '安全与密码'}</h2>
                <button onClick={() => setShowSettings(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition text-slate-400">
                  <XIcon />
                </button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto no-scrollbar">
                {settingsTab === 'profile' ? (
                  <div className="max-w-md mx-auto text-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">个人头像</h3>
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative group">
                        {avatarPreview ? (
                          <img 
                            src={avatarPreview} 
                            alt="Avatar" 
                            className="w-32 h-32 rounded-full object-cover border-4 border-slate-100 dark:border-slate-800 shadow-lg"
                          />
                        ) : (
                          <div 
                            className="w-32 h-32 rounded-full flex items-center justify-center text-white text-4xl font-black shadow-lg border-4 border-slate-100 dark:border-slate-800"
                            style={{ backgroundColor: getColorFromString(user?.id || user?.name || '') }}
                          >
                            {getInitials(user?.name || '')}
                          </div>
                        )}
                        {isUploadingAvatar && (
                          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                            <Loader2 size={32} className="text-white animate-spin" />
                          </div>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                      <div className="flex gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isUploadingAvatar}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                          <Camera size={16} />
                          {avatarPreview ? '更换头像' : '上传头像'}
                        </button>
                        {avatarPreview && (
                          <button
                            onClick={handleRemoveAvatar}
                            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-all active:scale-95"
                          >
                            <Trash2 size={16} />
                            删除
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        支持 JPG、PNG 或 WEBP 格式，最大 5MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-md mx-auto">
                    <div className="mb-6">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">修改密码</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">为了您的账户安全，建议定期更新密码</p>
                    </div>
                    <ChangePasswordForm onSuccess={() => setShowSettings(false)} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAvatarEditor && candidateImage && (
        <AvatarEditor 
          image={candidateImage}
          onCrop={handleCropComplete}
          onCancel={() => {
            setShowAvatarEditor(false);
            setCandidateImage(null);
          }}
        />
      )}
    </div>
  );
};

export default StudentDashboard;
