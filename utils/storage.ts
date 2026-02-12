
import { Channel, MediaResource, Classroom, User, AIResponse, Submission, SyllabusCourse, Question, ExamPaper, ExamSession, OperationLog, ExamFolder, ExamSection } from '../types';
import { 
  getResources as apiGetResources, 
  createResource as apiCreateResource, 
  updateResource as apiUpdateResource, 
  deleteResource as apiDeleteResource,
  permanentlyDeleteWithR2Cleanup,
  restoreFromRecycleBin,
  // 班级 API
  getClassrooms as apiGetClassrooms,
  createClassroom as apiCreateClassroom,
  updateClassroom as apiUpdateClassroom,
  deleteClassroom as apiDeleteClassroom,
  // 频道 API
  getChannels as apiGetChannels,
  createChannel as apiCreateChannel,
  updateChannel as apiUpdateChannel,
  deleteChannel as apiDeleteChannel,
  // 课程大纲 API
  getSyllabusCourses as apiGetSyllabusCourses,
  createSyllabusCourse as apiCreateSyllabusCourse,
  updateSyllabusCourse as apiUpdateSyllabusCourse,
  deleteSyllabusCourse as apiDeleteSyllabusCourse,
  // 题库 API
  getQuestions as apiGetQuestions,
  getQuestionById as apiGetQuestionById,
  createQuestion as apiCreateQuestion,
  updateQuestion as apiUpdateQuestion,
  deleteQuestion as apiDeleteQuestion,
  // 试卷 API
  getExamPapers as apiGetExamPapers,
  createExamPaper as apiCreateExamPaper,
  updateExamPaper as apiUpdateExamPaper,
  deleteExamPaper as apiDeleteExamPaper,
  // 试卷文件夹 API
  getExamFolders as apiGetExamFolders,
  createExamFolder as apiCreateExamFolder,
  updateExamFolder as apiUpdateExamFolder,
  deleteExamFolder as apiDeleteExamFolder,
  // 考试会话 API
  getExamSessions as apiGetExamSessions,
  getExamSessionsByExamsAndClass as apiGetExamSessionsByExamsAndClass,
  createExamSession as apiCreateExamSession,
  updateExamSession as apiUpdateExamSession,
  deleteExamSession as apiDeleteExamSession,
  // 练习数据 API
  getPracticeData as apiGetPracticeData,
  savePracticeData as apiSavePracticeData,
  // 作业提交 API
  getSubmissions as apiGetSubmissions,
  createSubmission as apiCreateSubmission,
  updateSubmission as apiUpdateSubmission,
  deleteSubmission as apiDeleteSubmission,
  // 用户 API
  getUsers as apiGetUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
  // 操作日志 API
  getOperationLogs as apiGetOperationLogs,
  createOperationLog as apiCreateOperationLog,
  getMediaUrl,
} from '../services/api/client';

const STORAGE_KEYS = {
  CHANNELS: 'parlezplus_channels',
  RESOURCES: 'parlezplus_resources',
  CLASSROOMS: 'parlezplus_classrooms',
  MOCK_CDN: 'parlezplus_cdn_bucket',
  USERS: 'parlezplus_users',
  STUDENT_DATA: 'parlezplus_student_practice_data',
  SUBMISSIONS: 'parlezplus_submissions',
  SYLLABUS: 'parlezplus_syllabus',
  QUESTION_BANK: 'parlezplus_question_bank',
  EXAM_PAPERS: 'parlezplus_exam_papers',
  EXAM_FOLDERS: 'parlezplus_exam_folders',
  EXAM_SESSIONS: 'parlezplus_exam_sessions',
  OPERATION_LOGS: 'parlezplus_operation_logs'
};

// --- 注意：以下已迁移至云端数据库，本地只作为API失败时的空数据兜底 ---

// --- API Response → Frontend Type Mapping Helpers ---
// D1 returns snake_case, frontend types use camelCase

const mapApiToChannel = (raw: any): Channel => ({
  id: raw.id,
  name: raw.name,
  userId: raw.user_id ?? raw.userId ?? '',
  createdAt: raw.created_at ?? raw.createdAt ?? 0,
  isDeleted: !!(raw.is_deleted ?? raw.isDeleted),
  deletedAt: raw.deleted_at ?? raw.deletedAt,
  deletedBy: raw.deleted_by ?? raw.deletedBy,
});

const mapApiToSyllabusCourse = (raw: any): SyllabusCourse => ({
  id: raw.id,
  name: raw.name,
  units: raw.units || [],
  userId: raw.user_id ?? raw.userId ?? '',
  createdAt: raw.created_at ?? raw.createdAt ?? 0,
  isDeleted: !!(raw.is_deleted ?? raw.isDeleted),
  deletedAt: raw.deleted_at ?? raw.deletedAt,
  deletedBy: raw.deleted_by ?? raw.deletedBy,
});

const mapApiToQuestion = (raw: any): Question => ({
  id: raw.id,
  text: raw.text,
  imageUrl: getMediaUrl(raw.image_r2_key ?? raw.imageUrl ?? undefined) || undefined,
  options: raw.options || [],
  correctOptionId: raw.correct_option_id ?? raw.correctOptionId ?? '',
  explanation: raw.explanation ?? undefined,
  type: raw.type ?? 'multiple-choice',
  level: raw.level ?? undefined,
  knowledgePointIds: raw.knowledge_point_ids ?? raw.knowledgePointIds ?? [],
  tags: raw.tags ?? [],
  readingPassage: raw.reading_passage ?? raw.readingPassage ?? undefined,
  subQuestions: raw.sub_questions ?? raw.subQuestions ?? undefined,
  createdAt: raw.created_at ?? raw.createdAt,
  createdBy: raw.created_by ?? raw.createdBy,
  teacherId: raw.teacher_id ?? raw.teacherId,
  isDeleted: !!(raw.is_deleted ?? raw.isDeleted),
  deletedAt: raw.deleted_at ?? raw.deletedAt,
  deletedBy: raw.deleted_by ?? raw.deletedBy,
});

const mapApiToMediaResource = (raw: any): MediaResource => ({
  id: raw.id,
  userId: raw.user_id ?? raw.userId ?? undefined,
  teacherId: raw.teacher_id ?? raw.teacherId ?? undefined,
  channelId: raw.channel_id ?? raw.channelId ?? '',
  title: raw.title ?? '',
  level: raw.level ?? 'A1',
  videoUrl: getMediaUrl(raw.video_r2_key ?? raw.videoUrl ?? ''),
  audioUrl: getMediaUrl(raw.audio_r2_key ?? raw.audioUrl ?? undefined) || undefined,
  backingTrackUrl: getMediaUrl(raw.backing_track_r2_key ?? raw.backingTrackUrl ?? undefined) || undefined,
  vocalTrackUrl: getMediaUrl(raw.vocal_track_r2_key ?? raw.vocalTrackUrl ?? undefined) || undefined,
  coverImage: getMediaUrl(raw.cover_r2_key ?? raw.coverImage ?? ''),
  transcript: raw.transcript ?? [],
  rawAzureWords: raw.raw_azure_words ?? raw.rawAzureWords ?? undefined,
  questions: raw.questions ?? [],
  status: raw.status ?? 'draft',
  createdAt: raw.created_at ?? raw.createdAt ?? 0,
  deadline: raw.deadline ?? undefined,
  assignedClassIds: raw.assigned_class_ids ?? raw.assignedClassIds ?? [],
  grammarTags: raw.grammar_tags ?? raw.grammarTags ?? [],
  vocabTags: raw.vocab_tags ?? raw.vocabTags ?? [],
  isDeleted: !!(raw.is_deleted ?? raw.isDeleted),
  deletedAt: raw.deleted_at ?? raw.deletedAt,
  deletedBy: raw.deleted_by ?? raw.deletedBy,
});

const mapApiToClassroom = (raw: any): Classroom => ({
  id: raw.id,
  userId: raw.user_id ?? raw.userId ?? '',
  name: raw.name ?? '',
  studentCount: raw.student_count ?? raw.studentCount ?? 0,
  students: raw.students || [],
  createdAt: raw.created_at ?? raw.createdAt,
  isDeleted: !!(raw.is_deleted ?? raw.isDeleted),
  deletedAt: raw.deleted_at ?? raw.deletedAt,
  deletedBy: raw.deleted_by ?? raw.deletedBy,
});

const mapApiToExamPaper = (raw: any): ExamPaper => ({
  id: raw.id,
  title: raw.title ?? '',
  sections: raw.sections || [],
  totalScore: raw.total_score ?? raw.totalScore ?? 0,
  teacherId: raw.teacher_id ?? raw.teacherId ?? '',
  createdAt: raw.created_at ?? raw.createdAt ?? 0,
  folderId: raw.folder_id ?? raw.folderId ?? undefined,
  assignedClassIds: raw.assigned_class_ids ?? raw.assignedClassIds ?? [],
  assignedClassDeadlines: raw.assigned_class_deadlines ?? raw.assignedClassDeadlines ?? {},
  examTakerSettings: raw.exam_taker_settings ?? raw.examTakerSettings ?? undefined,
  instructions: raw.instructions ?? undefined,
  isDeleted: !!(raw.is_deleted ?? raw.isDeleted),
  deletedAt: raw.deleted_at ?? raw.deletedAt,
  deletedBy: raw.deleted_by ?? raw.deletedBy,
});

const mapApiToExamFolder = (raw: any): ExamFolder => ({
  id: raw.id,
  userId: raw.user_id ?? raw.userId ?? '',
  name: raw.name ?? '',
  createdAt: raw.created_at ?? raw.createdAt ?? 0,
  isDeleted: !!(raw.is_deleted ?? raw.isDeleted),
  deletedAt: raw.deleted_at ?? raw.deletedAt,
  deletedBy: raw.deleted_by ?? raw.deletedBy,
});

const mapApiToExamSession = (raw: any): ExamSession => ({
  id: raw.id,
  examPaperId: raw.exam_paper_id ?? raw.examPaperId ?? '',
  examTitle: raw.exam_title ?? raw.examTitle ?? '',
  studentId: raw.student_id ?? raw.studentId ?? '',
  studentName: raw.student_name ?? raw.studentName ?? '',
  answers: raw.answers || {},
  startTime: raw.start_time ?? raw.startTime ?? 0,
  submitTime: raw.submit_time ?? raw.submitTime,
  elapsedTime: raw.elapsed_time ?? raw.elapsedTime ?? 0,
  score: raw.score ?? undefined,
  totalScore: raw.total_score ?? raw.totalScore ?? 0,
  isSubmitted: !!(raw.is_submitted ?? raw.isSubmitted),
  teacherFeedback: raw.teacher_feedback ?? raw.teacherFeedback,
  manualScore: raw.manual_score ?? raw.manualScore,
  itemScores: raw.item_scores ?? raw.itemScores,
  gradedBy: raw.graded_by ?? raw.gradedBy,
  gradedAt: raw.graded_at ?? raw.gradedAt,
  status: raw.status,
  isDeleted: !!(raw.is_deleted ?? raw.isDeleted),
  deletedAt: raw.deleted_at ?? raw.deletedAt,
  deletedBy: raw.deleted_by ?? raw.deletedBy,
  deletedReason: raw.deleted_reason ?? raw.deletedReason,
  redoMode: raw.redo_mode ?? raw.redoMode,
});

// --- QUESTION BANK & SYLLABUS ---

export const getSyllabusCourses = async (teacherId?: string, includeDeleted: boolean = false): Promise<SyllabusCourse[]> => {
  try {
    const raw = await apiGetSyllabusCourses(teacherId, includeDeleted);
    const courses = raw.map(mapApiToSyllabusCourse);
    
    // 更新本地缓存
    localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));
    
    // 过滤已删除数据（如果后端未过滤）
    if (!includeDeleted) {
      return courses.filter(c => !c.isDeleted);
    }
    
    return courses;
  } catch (error) {
    console.error('Failed to fetch syllabus courses from API:', error);
    // Fallback to localStorage
    const data = localStorage.getItem(STORAGE_KEYS.SYLLABUS);
    if (!data) {
      return [];
    }
    let courses: SyllabusCourse[] = JSON.parse(data);
    
    // 过滤已删除数据
    if (!includeDeleted) {
      courses = courses.filter(c => !c.isDeleted);

      // 进一步过滤课程内被软删除的单元/知识点（避免 UI 直接硬删除造成不可恢复）
      courses = courses.map(c => ({
        ...c,
        units: (c.units || [])
          .filter(u => !(u as any).isDeleted)
          .map(u => ({
            ...u,
            knowledgePoints: (u.knowledgePoints || []).filter(p => !(p as any).isDeleted)
          }))
      }));
    }
    
    return teacherId ? courses.filter(c => c.userId === teacherId) : courses;
  }
};

// 同步版本用于需要同步调用的地方（使用 localStorage 缓存）
export const getSyllabusCoursesSync = (teacherId?: string, includeDeleted: boolean = false): SyllabusCourse[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SYLLABUS);
  if (!data) {
    return [];
  }
  let courses: SyllabusCourse[] = JSON.parse(data);
  
  if (!includeDeleted) {
    courses = courses.filter(c => !c.isDeleted);
    courses = courses.map(c => ({
      ...c,
      units: (c.units || [])
        .filter(u => !(u as any).isDeleted)
        .map(u => ({
          ...u,
          knowledgePoints: (u.knowledgePoints || []).filter(p => !(p as any).isDeleted)
        }))
    }));
  }
  
  return teacherId ? courses.filter(c => c.userId === teacherId) : courses;
};

export const saveSyllabusCourse = async (course: SyllabusCourse): Promise<void> => {
  try {
    const isNew = !course.id || course.id.startsWith('temp-');
    
    if (isNew) {
      const result = await apiCreateSyllabusCourse({
        name: course.name,
        units: course.units
      });
      course.id = result.id;
    } else {
      await apiUpdateSyllabusCourse(course.id, {
        name: course.name,
        units: course.units
      });
    }
    
    // 更新本地缓存
    const courses = getSyllabusCoursesSync(undefined, true);
    const index = courses.findIndex(c => c.id === course.id);
    if (index >= 0) {
      courses[index] = course;
    } else {
      courses.push(course);
    }
    localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));
  } catch (error) {
    console.error('Failed to save syllabus course via API:', error);
    // Fallback to localStorage only
    const courses = getSyllabusCoursesSync(undefined, true);
    const index = courses.findIndex(c => c.id === course.id);
    if (index >= 0) {
      courses[index] = course;
    } else {
      courses.push(course);
    }
    localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));
  }
};

export const deleteSyllabusCourse = async (id: string, operatorId?: string, reason?: string): Promise<void> => {
  try {
    await apiDeleteSyllabusCourse(id);
    
    // 更新本地缓存
    const courses = getSyllabusCoursesSync(undefined, true);
    const courseIndex = courses.findIndex(c => c.id === id);
    if (courseIndex >= 0) {
      courses[courseIndex].isDeleted = true;
      courses[courseIndex].deletedAt = Date.now();
      courses[courseIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));
    }
  } catch (error) {
    console.error('Failed to delete syllabus course via API:', error);
    // Fallback to localStorage
    const courses = getSyllabusCoursesSync(undefined, true);
    const courseIndex = courses.findIndex(c => c.id === id);
    if (courseIndex >= 0) {
      courses[courseIndex].isDeleted = true;
      courses[courseIndex].deletedAt = Date.now();
      courses[courseIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));
      
      // 记录操作日志
      if (operatorId) {
        logOperation({
          operatorId,
          operationType: 'delete_question',
          targetId: id,
          targetType: 'SyllabusCourse',
          targetName: courses[courseIndex].name,
          reason
        });
      }
    }
  }
};

// 课程引用检查：找出该课程下知识点关联到的题库题目
export const checkSyllabusCourseQuestionReferences = (courseId: string): DeleteCheckResult => {
  const courses = getSyllabusCoursesSync(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) {
    return { canDelete: true, references: [], hasReferences: false };
  }

  const knowledgePointIds = new Set(
    course.units.flatMap(u => u.knowledgePoints.map(kp => kp.id))
  );

  if (knowledgePointIds.size === 0) {
    return { canDelete: true, references: [], hasReferences: false };
  }

  const questions = getBankQuestionsSync(course.userId, false);
  const related = questions.filter(q =>
    Array.isArray(q.knowledgePointIds) && q.knowledgePointIds.some(id => knowledgePointIds.has(id))
  );

  const hasReferences = related.length > 0;
  const references: ReferenceInfo[] = hasReferences
    ? [{
        type: 'Question',
        count: related.length,
        items: related.slice(0, 5).map(q => ({ id: q.id, name: q.text?.slice(0, 30) + '...' }))
      }]
    : [];

  return {
    canDelete: true,
    references,
    hasReferences,
    message: hasReferences
      ? `该课程关联 ${related.length} 道题目（通过知识点），仅删除课程会造成题目引用悬空。`
      : undefined
  };
};

// 级联删除课程：软删除课程，同时软删除关联题库题目（通过知识点关联）
export const cascadeDeleteSyllabusCourse = (courseId: string, operatorId?: string) => {
  const courses = getSyllabusCoursesSync(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;

  const knowledgePointIds = new Set(
    course.units.flatMap(u => u.knowledgePoints.map(kp => kp.id))
  );

  if (knowledgePointIds.size > 0) {
    const questions = getBankQuestionsSync(course.userId, true);
    const related = questions.filter(q =>
      !q.isDeleted && Array.isArray(q.knowledgePointIds) && q.knowledgePointIds.some(id => knowledgePointIds.has(id))
    );
    related.forEach(q => deleteBankQuestion(q.id, operatorId, '级联删除（课程）'));
  }

  deleteSyllabusCourse(courseId, operatorId, '级联删除（课程）');
};

const SYLLABUS_ID_SEP = '::';

const parseSyllabusUnitId = (compositeId: string) => {
  const [courseId, unitId] = compositeId.split(SYLLABUS_ID_SEP);
  return { courseId, unitId };
};

const parseKnowledgePointId = (compositeId: string) => {
  const [courseId, unitId, knowledgePointId] = compositeId.split(SYLLABUS_ID_SEP);
  return { courseId, unitId, knowledgePointId };
};

const softDeleteQuestionsByKnowledgePointIds = (teacherId: string, knowledgePointIds: string[], operatorId?: string, reason?: string) => {
  if (knowledgePointIds.length === 0) return;
  const kpSet = new Set(knowledgePointIds);
  const questions = getBankQuestionsSync(teacherId, true);
  questions
    .filter(q => !q.isDeleted && Array.isArray(q.knowledgePointIds) && q.knowledgePointIds.some(id => kpSet.has(id)))
    .forEach(q => deleteBankQuestion(q.id, operatorId, reason));
};

const restoreQuestionsByKnowledgePointIds = (teacherId: string, knowledgePointIds: string[]) => {
  if (knowledgePointIds.length === 0) return;
  const kpSet = new Set(knowledgePointIds);
  const questions = getBankQuestionsSync(teacherId, true);
  let changed = false;
  questions.forEach(q => {
    if (!q.isDeleted) return;
    if (!Array.isArray(q.knowledgePointIds)) return;
    if (!q.knowledgePointIds.some(id => kpSet.has(id))) return;
    q.isDeleted = false;
    delete q.deletedAt;
    delete q.deletedBy;
    delete (q as any).deletedReason;
    changed = true;
  });
  if (changed) localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(questions));
};

export const cascadeDeleteSyllabusUnit = (courseId: string, unitId: string, operatorId?: string) => {
  const courses = getSyllabusCoursesSync(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;
  const unit = course.units.find(u => u.id === unitId);
  if (!unit) return;
  if ((unit as any).isDeleted) return;

  (unit as any).isDeleted = true;
  (unit as any).deletedAt = Date.now();
  (unit as any).deletedBy = operatorId;

  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));

  const kpIds = unit.knowledgePoints.map(k => k.id);
  softDeleteQuestionsByKnowledgePointIds(course.userId, kpIds, operatorId, '级联删除（单元）');
};

export const cascadeDeleteSyllabusKnowledgePoint = (courseId: string, unitId: string, knowledgePointId: string, operatorId?: string) => {
  const courses = getSyllabusCoursesSync(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;
  const unit = course.units.find(u => u.id === unitId);
  if (!unit) return;
  const kp = unit.knowledgePoints.find(p => p.id === knowledgePointId);
  if (!kp) return;
  if ((kp as any).isDeleted) return;

  (kp as any).isDeleted = true;
  (kp as any).deletedAt = Date.now();
  (kp as any).deletedBy = operatorId;
  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));

  softDeleteQuestionsByKnowledgePointIds(course.userId, [knowledgePointId], operatorId, '级联删除（知识点）');
};

const restoreSyllabusUnitByCompositeId = (compositeId: string) => {
  const { courseId, unitId } = parseSyllabusUnitId(compositeId);
  if (!courseId || !unitId) return;
  const courses = getSyllabusCoursesSync(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;
  const unit = course.units.find(u => u.id === unitId);
  if (!unit) return;
  if (!(unit as any).isDeleted) return;

  (unit as any).isDeleted = false;
  delete (unit as any).deletedAt;
  delete (unit as any).deletedBy;
  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));

  const kpIds = unit.knowledgePoints.map(k => k.id);
  restoreQuestionsByKnowledgePointIds(course.userId, kpIds);
};

const restoreKnowledgePointByCompositeId = (compositeId: string) => {
  const { courseId, unitId, knowledgePointId } = parseKnowledgePointId(compositeId);
  if (!courseId || !unitId || !knowledgePointId) return;
  const courses = getSyllabusCoursesSync(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;
  const unit = course.units.find(u => u.id === unitId);
  if (!unit) return;
  const kp = unit.knowledgePoints.find(p => p.id === knowledgePointId);
  if (!kp) return;
  if (!(kp as any).isDeleted) return;

  (kp as any).isDeleted = false;
  delete (kp as any).deletedAt;
  delete (kp as any).deletedBy;
  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));

  restoreQuestionsByKnowledgePointIds(course.userId, [knowledgePointId]);
};

const permanentlyDeleteSyllabusUnitByCompositeId = (compositeId: string) => {
  const { courseId, unitId } = parseSyllabusUnitId(compositeId);
  if (!courseId || !unitId) return;
  const courses = getSyllabusCoursesSync(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;
  const unit = course.units.find(u => u.id === unitId);
  const kpIds = unit?.knowledgePoints?.map(k => k.id) || [];
  course.units = course.units.filter(u => u.id !== unitId);
  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));

  permanentlyDeleteQuestionsByKnowledgePointIds(course.userId, kpIds);
};

const permanentlyDeleteKnowledgePointByCompositeId = (compositeId: string) => {
  const { courseId, unitId, knowledgePointId } = parseKnowledgePointId(compositeId);
  if (!courseId || !unitId || !knowledgePointId) return;
  const courses = getSyllabusCoursesSync(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;
  const unit = course.units.find(u => u.id === unitId);
  if (!unit) return;
  unit.knowledgePoints = unit.knowledgePoints.filter(p => p.id !== knowledgePointId);
  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));

  permanentlyDeleteQuestionsByKnowledgePointIds(course.userId, [knowledgePointId]);
};

// 内部函数：读取所有题目（不过滤）- 同步版本用于本地缓存
const getAllBankQuestionsRaw = (): Question[] => {
  const data = localStorage.getItem(STORAGE_KEYS.QUESTION_BANK);
  return data ? JSON.parse(data) : [];
};

export const getBankQuestions = async (teacherId?: string, includeDeleted: boolean = false): Promise<Question[]> => {
  try {
    const raw = await apiGetQuestions(teacherId, undefined, undefined, includeDeleted);
    const questions = raw.map(mapApiToQuestion);
    
    // Update local cache so synchronous readers (like ExamBuilder initial load) can see them
    localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(questions));

    return questions;
  } catch (error) {
    console.error('Failed to fetch questions from API:', error);
    // Fallback to localStorage
    let questions = getAllBankQuestionsRaw();

    // 过滤已删除数据
    if (!includeDeleted) {
      questions = questions.filter(q => !q.isDeleted);
    }

    // 如果提供了 teacherId，只返回该教师的题目
    if (teacherId) {
      questions = questions.filter(q => q.teacherId === teacherId);
    }

    return questions;
  }
};

// 同步版本用于需要同步调用的地方
export const getBankQuestionsSync = (teacherId?: string, includeDeleted: boolean = false): Question[] => {
  let questions = getAllBankQuestionsRaw();

  if (!includeDeleted) {
    questions = questions.filter(q => !q.isDeleted);
  }

  if (teacherId) {
    questions = questions.filter(q => q.teacherId === teacherId);
  }

  return questions;
};

export const saveBankQuestion = async (question: Question, teacherId?: string): Promise<void> => {
  try {
    const isNew = !question.id || question.id.startsWith('temp-') || question.id.startsWith('gen-');
    
    if (isNew) {
      const result = await apiCreateQuestion({
        text: question.text,
        image_r2_key: question.imageUrl,
        options: question.options,
        correct_option_id: question.correctOptionId,
        explanation: question.explanation,
        type: question.type,
        level: question.level,
        knowledge_point_ids: question.knowledgePointIds,
        tags: question.tags,
        reading_passage: question.readingPassage,
        sub_questions: question.subQuestions,
        created_by: question.createdBy
      });
      question.id = result.id;
    } else {
      await apiUpdateQuestion(question.id, {
        text: question.text,
        image_r2_key: question.imageUrl,
        options: question.options,
        correct_option_id: question.correctOptionId,
        explanation: question.explanation,
        type: question.type,
        level: question.level,
        knowledge_point_ids: question.knowledgePointIds,
        tags: question.tags,
        reading_passage: question.readingPassage,
        sub_questions: question.subQuestions
      });
    }
    
    // 更新本地缓存
    const questions = getAllBankQuestionsRaw();
    const questionToSave = {
      ...question,
      teacherId: teacherId || question.teacherId || ''
    };
    const index = questions.findIndex(q => q.id === question.id);
    if (index >= 0) {
      questions[index] = questionToSave;
    } else {
      questions.push(questionToSave);
    }
    localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(questions));
  } catch (error) {
    console.error('Failed to save question via API:', error);
    // Fallback to localStorage
    const questions = getAllBankQuestionsRaw();
    const questionToSave = {
      ...question,
      teacherId: teacherId || question.teacherId || ''
    };
    const index = questions.findIndex(q => q.id === question.id);
    if (index >= 0) {
      questions[index] = questionToSave;
    } else {
      questions.push(questionToSave);
    }
    localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(questions));
  }
};

// 辅助函数：计算试卷总分
const calculateExamTotalScore = (sections: ExamSection[]): number => {
  return sections.reduce((total, section) => {
    return total + section.items.reduce((sectionTotal, item) => {
      if (item.type === 'consigne') return sectionTotal;
      return sectionTotal + item.points;
    }, 0);
  }, 0);
};

// 辅助函数：从试卷中移除指定的题目ID，并重新计算总分
const removeQuestionsFromExamPapers = async (questionIds: string[]): Promise<void> => {
  const questionIdSet = new Set(questionIds);
  const papers = getExamPapersSync(undefined, false); // 只处理未删除的试卷
  let hasChanges = false;

  for (const paper of papers) {
    let paperModified = false;
    
    // 遍历每个section，移除引用的题目
    for (const section of paper.sections) {
      const originalLength = section.items.length;
      section.items = section.items.filter(item => {
        if (item.type === 'consigne') return true; // 保留consigne
        return !questionIdSet.has(item.questionId || '');
      });
      
      if (section.items.length !== originalLength) {
        paperModified = true;
      }
    }
    
    // 如果试卷有变化，重新计算总分并保存
    if (paperModified) {
      paper.totalScore = calculateExamTotalScore(paper.sections);
      await saveExamPaper(paper);
      hasChanges = true;
      console.log(`试卷 "${paper.title}" 已更新：移除了 ${questionIds.length} 道题目，新总分: ${paper.totalScore}`);
    }
  }
  
  if (hasChanges) {
    console.log(`已更新 ${papers.length} 份试卷，移除了被删除的题目`);
  }
};

export const deleteBankQuestion = async (id: string, operatorId?: string, reason?: string): Promise<void> => {
  try {
    await apiDeleteQuestion(id);
    
    // 更新本地缓存
    const questions = getBankQuestionsSync(undefined, true);
    const questionIndex = questions.findIndex(q => q.id === id);
    if (questionIndex >= 0) {
      questions[questionIndex].isDeleted = true;
      questions[questionIndex].deletedAt = Date.now();
      questions[questionIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(questions));
    }
    
    // 从引用该题目的试卷中移除该题目并重新计算总分
    await removeQuestionsFromExamPapers([id]);
  } catch (error) {
    console.error('Failed to delete question via API:', error);
    // Fallback to localStorage
    const questions = getBankQuestionsSync(undefined, true);
    const questionIndex = questions.findIndex(q => q.id === id);
    if (questionIndex >= 0) {
      questions[questionIndex].isDeleted = true;
      questions[questionIndex].deletedAt = Date.now();
      questions[questionIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(questions));
      
      // 记录操作日志
      if (operatorId) {
        logOperation({
          operatorId,
          operationType: 'delete_question',
          targetId: id,
          targetType: 'Question',
          targetName: questions[questionIndex].text.substring(0, 50),
          reason
        });
      }
    }
    
    // 从引用该题目的试卷中移除该题目并重新计算总分
    await removeQuestionsFromExamPapers([id]);
  }
};

// --- SUBMISSIONS ---
// Sync version for internal use
const submitAssignmentSync = (submission: Submission) => {
  const allSubmissions: Submission[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
  
  const index = allSubmissions.findIndex(s => s.studentId === submission.studentId && s.resourceId === submission.resourceId);
  
  if (index >= 0) {
    allSubmissions[index] = {
      ...submission,
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined
    };
  } else {
    allSubmissions.push({
      ...submission,
      isDeleted: false,
      deletedAt: undefined,
      deletedBy: undefined,
      deletedReason: undefined
    });
  }
  
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(allSubmissions));
};

// Async version with API
export const submitAssignment = async (submission: Submission): Promise<void> => {
  try {
    // Convert to API format
    const apiSubmission = {
      student_id: submission.studentId,
      resource_id: submission.resourceId,
      audio_r2_key: submission.audioUrl,
      ai_score: submission.aiScore,
      ai_segment_evals: submission.aiSegmentEvals,
      quiz_result: submission.quizResult,
      cloze_result: submission.clozeResult
    };
    
    await apiCreateSubmission(apiSubmission);
    submitAssignmentSync(submission);
  } catch (error) {
    console.error('Failed to submit assignment to API:', error);
    submitAssignmentSync(submission);
  }
};

// Sync version for internal use
const getSubmissionsSync = (includeDeleted: boolean = false): Submission[] => {
  const subs: Submission[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
  if (includeDeleted) return subs;
  return subs.filter(s => !s.isDeleted);
};

// Async version with API
export const getSubmissions = async (includeDeleted: boolean = false): Promise<Submission[]> => {
  try {
    const submissions = await apiGetSubmissions();
    
    // Convert from API format to local format
    const converted: Submission[] = submissions.map((s: any) => ({
      id: s.id,
      studentId: s.student_id,
      resourceId: s.resource_id,
      submittedAt: typeof s.submitted_at === 'number'
        ? new Date(s.submitted_at).toLocaleString()
        : String(s.submitted_at || ''),
      audioUrl: getMediaUrl(s.audio_r2_key),
      aiScore: s.ai_score || undefined,
      aiSegmentEvals: s.ai_segment_evals || undefined,
      teacherFeedback: s.teacher_feedback || undefined,
      quizResult: s.quiz_result || undefined,
      clozeResult: s.cloze_result || undefined,
      status: s.status || 'pending_review',
      isDeleted: s.is_deleted === 1,
      deletedAt: s.deleted_at || undefined,
      deletedBy: s.deleted_by || undefined,
      deletedReason: s.deleted_reason || undefined
    }));
    
    // Update localStorage cache
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(converted));
    
    if (!includeDeleted) {
      return converted.filter(s => !s.isDeleted);
    }
    
    return converted;
  } catch (error) {
    console.error('Failed to fetch submissions from API:', error);
    return getSubmissionsSync(includeDeleted);
  }
};

// Sync version for internal delete operations
const deleteSubmissionSync = (id: string, operatorId?: string, reason?: string) => {
  const subs = getSubmissionsSync(true);
  const idx = subs.findIndex(s => s.id === id);
  if (idx < 0) return;
  if (subs[idx].isDeleted) return;
  subs[idx].isDeleted = true;
  subs[idx].deletedAt = Date.now();
  subs[idx].deletedBy = operatorId;
  subs[idx].deletedReason = reason;
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));

  if (operatorId) {
    logOperation({
      operatorId,
      operationType: 'delete_submission' as any,
      targetId: id,
      targetType: 'Submission',
      targetName: `${subs[idx].studentId} -> ${subs[idx].resourceId}`,
      reason
    });
  }
};

// Async version with API
export const deleteSubmission = async (id: string, operatorId?: string, reason?: string): Promise<void> => {
  try {
    await apiDeleteSubmission(id, operatorId, reason);
    deleteSubmissionSync(id, operatorId, reason);
  } catch (error) {
    console.error('Failed to delete submission from API:', error);
    deleteSubmissionSync(id, operatorId, reason);
  }
};

const restoreSubmissionById = (id: string) => {
  const subs = getSubmissionsSync(true);
  const s = subs.find(x => x.id === id);
  if (!s || !s.isDeleted) return;
  s.isDeleted = false;
  delete s.deletedAt;
  delete s.deletedBy;
  delete s.deletedReason;
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
};

const deleteSubmissionsByResource = (resourceId: string, operatorId?: string, reason?: string) => {
  const subs = getSubmissionsSync(true);
  let changed = false;
  subs.forEach(s => {
    if (s.resourceId !== resourceId) return;
    if (s.isDeleted) return;
    s.isDeleted = true;
    s.deletedAt = Date.now();
    s.deletedBy = operatorId;
    s.deletedReason = reason;
    changed = true;
  });
  if (changed) localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
};

const restoreSubmissionsByResource = (resourceId: string) => {
  const subs = getSubmissionsSync(true);
  let changed = false;
  subs.forEach(s => {
    if (s.resourceId !== resourceId) return;
    if (!s.isDeleted) return;
    s.isDeleted = false;
    delete s.deletedAt;
    delete s.deletedBy;
    delete s.deletedReason;
    changed = true;
  });
  if (changed) localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
};

const deleteSubmissionsByStudentIds = (studentIds: string[], operatorId?: string, reason?: string) => {
  if (studentIds.length === 0) return;
  const set = new Set(studentIds);
  const subs = getSubmissionsSync(true);
  let changed = false;
  subs.forEach(s => {
    if (!set.has(s.studentId)) return;
    if (s.isDeleted) return;
    s.isDeleted = true;
    s.deletedAt = Date.now();
    s.deletedBy = operatorId;
    s.deletedReason = reason;
    changed = true;
  });
  if (changed) localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
};

const restoreSubmissionsByStudentIds = (studentIds: string[]) => {
  if (studentIds.length === 0) return;
  const set = new Set(studentIds);
  const subs = getSubmissionsSync(true);
  let changed = false;
  subs.forEach(s => {
    if (!set.has(s.studentId)) return;
    if (!s.isDeleted) return;
    s.isDeleted = false;
    delete s.deletedAt;
    delete s.deletedBy;
    delete s.deletedReason;
    changed = true;
  });
  if (changed) localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
};

// --- STUDENT PRACTICE DATA ---
export interface StudentPracticeData {
  userId: string;
  resourceId: string;
  quizAnswers?: Record<string, string>; // questionId -> optionId
  quizScore?: { score: number; total: number };
  clozeAnswers?: Record<string, string>; // segmentIndex-wordIndex -> input string
  clozeScore?: { correct: number; total: number; attempts?: number }; // ADDED: attempts
  segmentRecordings?: Record<string, string>; // segmentId -> Base64 Audio String
  segmentScores?: Record<string, AIResponse>; // segmentId -> AI Score
  fullRecording?: string; // Base64 Audio String
  overallScore?: AIResponse; // Full Text AI Score
  lastUpdated: number;

  // 软删除字段
  isDeleted?: boolean;
  deletedAt?: number;
  deletedBy?: string;
  deletedReason?: string;
}

const getStudentPracticeDataMap = (): Record<string, StudentPracticeData> => {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENT_DATA) || '{}');
};

const setStudentPracticeDataMap = (map: Record<string, StudentPracticeData>) => {
  localStorage.setItem(STORAGE_KEYS.STUDENT_DATA, JSON.stringify(map));
};

const deleteStudentPracticeDataByResource = (resourceId: string, operatorId?: string, reason?: string) => {
  const allData = getStudentPracticeDataMap();
  let changed = false;
  Object.keys(allData).forEach(key => {
    const v = allData[key];
    const rid = v?.resourceId;
    const hit = rid ? rid === resourceId : key.endsWith(`_${resourceId}`);
    if (!hit) return;
    if (v?.isDeleted) return;
    allData[key] = {
      ...v,
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: operatorId,
      deletedReason: reason
    };
    changed = true;
  });
  if (changed) setStudentPracticeDataMap(allData);
};

const restoreStudentPracticeDataByResource = (resourceId: string) => {
  const allData = getStudentPracticeDataMap();
  let changed = false;
  Object.keys(allData).forEach(key => {
    const v = allData[key];
    const rid = v?.resourceId;
    const hit = rid ? rid === resourceId : key.endsWith(`_${resourceId}`);
    if (!hit) return;
    if (!v?.isDeleted) return;
    const next = { ...v, isDeleted: false };
    delete next.deletedAt;
    delete next.deletedBy;
    delete next.deletedReason;
    allData[key] = next;
    changed = true;
  });
  if (changed) setStudentPracticeDataMap(allData);
};

const deleteStudentPracticeDataByUserIds = (userIds: string[], operatorId?: string, reason?: string) => {
  if (userIds.length === 0) return;
  const set = new Set(userIds);
  const allData = getStudentPracticeDataMap();
  let changed = false;
  Object.keys(allData).forEach(key => {
    const v = allData[key];
    const uid = v?.userId;
    const hit = uid ? set.has(uid) : userIds.some(id => key.startsWith(`${id}_`));
    if (!hit) return;
    if (v?.isDeleted) return;
    allData[key] = {
      ...v,
      isDeleted: true,
      deletedAt: Date.now(),
      deletedBy: operatorId,
      deletedReason: reason
    };
    changed = true;
  });
  if (changed) setStudentPracticeDataMap(allData);
};

const restoreStudentPracticeDataByUserIds = (userIds: string[]) => {
  if (userIds.length === 0) return;
  const set = new Set(userIds);
  const allData = getStudentPracticeDataMap();
  let changed = false;
  Object.keys(allData).forEach(key => {
    const v = allData[key];
    const uid = v?.userId;
    const hit = uid ? set.has(uid) : userIds.some(id => key.startsWith(`${id}_`));
    if (!hit) return;
    if (!v?.isDeleted) return;
    const next = { ...v, isDeleted: false };
    delete next.deletedAt;
    delete next.deletedBy;
    delete next.deletedReason;
    allData[key] = next;
    changed = true;
  });
  if (changed) setStudentPracticeDataMap(allData);
};

// --- PERMANENT DELETE HELPERS (物理级联删除) ---
const permanentlyDeleteSubmissionsByResource = (resourceId: string) => {
  const subs = getSubmissionsSync(true);
  const filtered = subs.filter(s => s.resourceId !== resourceId);
  if (filtered.length !== subs.length) {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(filtered));
  }
};

const permanentlyDeleteSubmissionsByStudentIds = (studentIds: string[]) => {
  if (studentIds.length === 0) return;
  const set = new Set(studentIds);
  const subs = getSubmissionsSync(true);
  const filtered = subs.filter(s => !set.has(s.studentId));
  if (filtered.length !== subs.length) {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(filtered));
  }
};

const permanentlyDeleteStudentPracticeDataByResource = (resourceId: string) => {
  const allData = getStudentPracticeDataMap();
  let changed = false;
  Object.keys(allData).forEach(key => {
    const v = allData[key];
    const rid = v?.resourceId;
    const hit = rid ? rid === resourceId : key.endsWith(`_${resourceId}`);
    if (!hit) return;
    delete allData[key];
    changed = true;
  });
  if (changed) setStudentPracticeDataMap(allData);
};

const permanentlyDeleteStudentPracticeDataByUserIds = (userIds: string[]) => {
  if (userIds.length === 0) return;
  const set = new Set(userIds);
  const allData = getStudentPracticeDataMap();
  let changed = false;
  Object.keys(allData).forEach(key => {
    const v = allData[key];
    const uid = v?.userId;
    const hit = uid ? set.has(uid) : userIds.some(id => key.startsWith(`${id}_`));
    if (!hit) return;
    delete allData[key];
    changed = true;
  });
  if (changed) setStudentPracticeDataMap(allData);
};

const permanentlyDeleteExamSessionsByExamPaperId = (examPaperId: string) => {
  const sessions = getExamSessionsSync(undefined, true);
  const filtered = sessions.filter(s => s.examPaperId !== examPaperId);
  if (filtered.length !== sessions.length) {
    localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(filtered));
  }
};

const permanentlyDeleteExamSessionsByStudentIds = (studentIds: string[]) => {
  if (studentIds.length === 0) return;
  const set = new Set(studentIds);
  const sessions = getExamSessionsSync(undefined, true);
  const filtered = sessions.filter(s => !set.has(s.studentId));
  if (filtered.length !== sessions.length) {
    localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(filtered));
  }
};

const permanentlyDeleteQuestionsByKnowledgePointIds = (teacherId: string | undefined, knowledgePointIds: string[]) => {
  if (!teacherId) return;
  if (knowledgePointIds.length === 0) return;
  const kpSet = new Set(knowledgePointIds);
  const questions = getBankQuestionsSync(undefined, true);
  const filtered = questions.filter(q => {
    const owner = q.teacherId === teacherId;
    if (!owner) return true;
    const ids = q.knowledgePointIds || [];
    return !ids.some(id => kpSet.has(id));
  });
  if (filtered.length !== questions.length) {
    localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(filtered));
  }
};

// Sync version for internal use
const saveStudentProgressSync = (data: StudentPracticeData) => {
  const allData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENT_DATA) || '{}');
  const key = `${data.userId}_${data.resourceId}`;
  
  const existingData = allData[key] || {};

  // Deep merge logic to prevent overwriting existing dictionaries
  allData[key] = {
    ...existingData,
    ...data,
    // Merge recordings map
    segmentRecordings: {
        ...(existingData.segmentRecordings || {}),
        ...(data.segmentRecordings || {})
    },
    // Merge scores map
    segmentScores: {
        ...(existingData.segmentScores || {}),
        ...(data.segmentScores || {})
    },
    // Quiz answers should also be merged
    quizAnswers: {
        ...(existingData.quizAnswers || {}),
        ...(data.quizAnswers || {})
    },
    // Cloze answers should also be merged
    clozeAnswers: {
        ...(existingData.clozeAnswers || {}),
        ...(data.clozeAnswers || {})
    },
    lastUpdated: Date.now()
  };
  
  try {
    localStorage.setItem(STORAGE_KEYS.STUDENT_DATA, JSON.stringify(allData));
  } catch (e) {
    console.error("Storage full, cannot save recording", e);
    window.dispatchEvent(
      new CustomEvent('parlezplus:alert', {
        detail: {
          title: '存储空间不足',
          message: '本地存储空间已满，无法保存更多录音。在真实环境中，这将上传至云端服务器。',
          type: 'info'
        }
      })
    );
  }
};

// Async version with API
export const saveStudentProgress = async (data: StudentPracticeData): Promise<void> => {
  try {
    // Convert to API format
    const apiData = {
      resource_id: data.resourceId,
      quiz_answers: data.quizAnswers,
      quiz_score: data.quizScore,
      cloze_answers: data.clozeAnswers,
      cloze_score: data.clozeScore,
      segment_recordings: data.segmentRecordings,
      segment_scores: data.segmentScores,
      overall_score: data.overallScore
    };
    
    await apiSavePracticeData(apiData);
    saveStudentProgressSync(data);
  } catch (error) {
    console.error('Failed to save student progress to API:', error);
    saveStudentProgressSync(data);
  }
};

// Sync version for internal use
const getStudentProgressSync = (userId: string, resourceId: string): StudentPracticeData | null => {
  const allData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENT_DATA) || '{}');
  const key = `${userId}_${resourceId}`;
  return allData[key] || null;
};

// Async version with API
export const getStudentProgress = async (userId: string, resourceId: string): Promise<StudentPracticeData | null> => {
  try {
    const results = await apiGetPracticeData(userId, resourceId);
    
    if (results && results.length > 0) {
      const practice = results[0];
      // Convert from API format to local format
      const data: StudentPracticeData = {
        userId: practice.user_id,
        resourceId: practice.resource_id,
        quizAnswers: practice.quiz_answers,
        quizScore: practice.quiz_score,
        clozeAnswers: practice.cloze_answers,
        clozeScore: practice.cloze_score,
        segmentRecordings: practice.segment_recordings || {},
        segmentScores: practice.segment_scores || {},
        overallScore: practice.overall_score,
        lastUpdated: practice.last_updated
      };
      
      // Update localStorage cache
      saveStudentProgressSync(data);
      
      return data;
    }
    
    // Fallback to localStorage
    return getStudentProgressSync(userId, resourceId);
  } catch (error) {
    console.error('Failed to get student progress from API:', error);
    return getStudentProgressSync(userId, resourceId);
  }
};

// --- USERS (ADMIN FUNCTIONS) ---
// Sync versions for internal use and backward compatibility
export const getUsers = (includeDeleted: boolean = false): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!data) {
    return [];
  }
  const users: User[] = JSON.parse(data);
  return includeDeleted ? users : users.filter(u => !u.isDeleted);
};

// Async version with API
export const getUsersAsync = async (includeDeleted: boolean = false): Promise<User[]> => {
  try {
    const users = await apiGetUsers(undefined, undefined, includeDeleted);
    
    // Convert from API format to local format
    const converted = users.map((u: any) => ({
      id: u.id,
      username: u.username,
      role: u.role,
      name: u.name,
      avatar: getMediaUrl(u.avatar_r2_key),
      classId: u.class_id,
      needsPasswordChange: u.needs_password_change === 1,
      isBlocked: u.is_blocked === 1,
      isDeleted: u.is_deleted === 1,
      deletedAt: u.deleted_at,
      deletedBy: u.deleted_by,
      createdAt: u.created_at
    }));
    
    // Update localStorage cache
    const existingUsers = getUsers(true);
    const merged = [...existingUsers];
    for (const user of converted) {
      const index = merged.findIndex(u => u.id === user.id);
      if (index >= 0) {
        merged[index] = user;
      } else {
        merged.push(user);
      }
    }
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(merged));
    
    if (!includeDeleted) {
      return converted.filter((u: User) => !u.isDeleted);
    }
    
    return converted;
  } catch (error) {
    console.error('Failed to fetch users from API:', error);
    return getUsers(includeDeleted);
  }
};

export const getUserById = (id: string): User | undefined => {
  return getUsers().find(u => u.id === id);
};

const emitDataChanged = () => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('parlezplus:data-changed'));
};

const syncUserAvatarToClassrooms = (user: User): boolean => {
  const classrooms = getClassroomsSync(undefined, true);
  let changed = false;

  const updated = classrooms.map(cls => {
    let classChanged = false;
    const updatedStudents = cls.students.map(student => {
      const matches = student.userId === user.id || student.id === user.id;
      if (!matches) return student;

      if (student.avatar === user.avatar) return student;
      classChanged = true;

      if (user.avatar) {
        return { ...student, avatar: user.avatar };
      }

      const { avatar: _avatar, ...studentWithoutAvatar } = student;
      return studentWithoutAvatar;
    });

    if (!classChanged) return cls;
    changed = true;
    return { ...cls, students: updatedStudents };
  });

  if (!changed) return false;
  localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(updated));
  return true;
};

// Sync version for internal use
const saveUserSync = (user: User) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index >= 0) {
    users[index] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));

  syncUserAvatarToClassrooms(user);
  emitDataChanged();
};

// Async version with API
export const saveUser = async (user: User): Promise<void> => {
  try {
    const apiUser = {
      id: user.id,
      username: user.username,
      role: user.role,
      name: user.name,
      avatar_r2_key: user.avatar,
      class_id: user.classId,
      needs_password_change: user.needsPasswordChange,
      is_blocked: user.isBlocked
    };
    
    // Check if user exists
    const existingUsers = getUsers(true);
    const exists = existingUsers.some(u => u.id === user.id);
    
    if (exists) {
      await apiUpdateUser(user.id, apiUser);
    } else {
      await apiCreateUser(apiUser);
    }
    
    saveUserSync(user);
  } catch (error) {
    console.error('Failed to save user to API:', error);
    saveUserSync(user);
  }
};

// Sync version for internal use
const deleteUserSync = (id: string, operatorId?: string, reason?: string) => {
  const users = getUsers(true);
  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex >= 0) {
    users[userIndex].isDeleted = true;
    users[userIndex].deletedAt = Date.now();
    users[userIndex].deletedBy = operatorId;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    
    if (operatorId) {
      logOperation({
        operatorId,
        operationType: 'delete_user',
        targetId: id,
        targetType: 'User',
        targetName: users[userIndex].name,
        reason
      });
    }
  }
};

// Async version with API
export const deleteUser = async (id: string, operatorId?: string, reason?: string): Promise<void> => {
  try {
    await apiDeleteUser(id);
    deleteUserSync(id, operatorId, reason);
  } catch (error) {
    console.error('Failed to delete user from API:', error);
    deleteUserSync(id, operatorId, reason);
  }
};

// 永久删除用户（内部函数，仅供系统清理使用）
const permanentlyDeleteUser = (id: string) => {
  const users = getUsers(true);
  const filtered = users.filter(u => u.id !== id);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
};

// --- CHANNELS ---
// Sync version for internal use
const getChannelsSync = (userId?: string, includeDeleted: boolean = false): Channel[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CHANNELS);
  let allChannels: Channel[] = data ? JSON.parse(data) : [];
  
  if (allChannels.length === 0) return [];
  
  if (!includeDeleted) {
    allChannels = allChannels.filter(c => !c.isDeleted);
  }
  
  return userId 
    ? allChannels.filter(c => c.userId === userId) 
    : allChannels;
};

// Async version with API
export const getChannels = async (userId?: string, includeDeleted: boolean = false): Promise<Channel[]> => {
  try {
    const raw = await apiGetChannels(userId, includeDeleted);
    const channels = raw.map(mapApiToChannel);
    
    // Update localStorage cache
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(channels));
    
    if (!includeDeleted) {
      return channels.filter(c => !c.isDeleted);
    }
    
    return channels;
  } catch (error) {
    console.error('Failed to fetch channels from API:', error);
    return getChannelsSync(userId, includeDeleted);
  }
};

// Sync version for internal use
const saveChannelSync = (channel: Channel, userId?: string) => {
  const allChannels = localStorage.getItem(STORAGE_KEYS.CHANNELS) 
      ? JSON.parse(localStorage.getItem(STORAGE_KEYS.CHANNELS)!) 
      : [];
  const channelToSave = {
    ...channel,
    userId: userId || channel.userId || ''
  };
  const index = allChannels.findIndex((c: Channel) => c.id === channel.id);
  if (index >= 0) {
      allChannels[index] = channelToSave;
  } else {
      allChannels.push(channelToSave);
  }
  localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(allChannels));
};

// Async version with API
export const saveChannel = async (channel: Channel, userId?: string): Promise<Channel> => {
  const channelToSave: Channel = {
    ...channel,
    userId: userId || channel.userId || ''
  };

  try {
    const isNew = !channelToSave.id || channelToSave.id.startsWith('temp-');
    if (isNew) {
      const created = await apiCreateChannel({ name: channelToSave.name });
      channelToSave.id = created.id;
      channelToSave.createdAt = created.created_at ?? channelToSave.createdAt;
      channelToSave.userId = created.user_id ?? channelToSave.userId;
    } else {
      await apiUpdateChannel(channelToSave.id, { name: channelToSave.name });
    }

    saveChannelSync(channelToSave, userId);
    return channelToSave;
  } catch (error) {
    console.error('Failed to save channel to API:', error);
    saveChannelSync(channelToSave, userId);
    return channelToSave;
  }
};

// Sync version for internal use
const deleteChannelSync = (id: string, operatorId?: string, reason?: string) => {
  const data = localStorage.getItem(STORAGE_KEYS.CHANNELS);
  if (!data) return;
  const allChannels: Channel[] = JSON.parse(data);
  const channelIndex = allChannels.findIndex(c => c.id === id);
  if (channelIndex >= 0) {
    allChannels[channelIndex].isDeleted = true;
    allChannels[channelIndex].deletedAt = Date.now();
    allChannels[channelIndex].deletedBy = operatorId;
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(allChannels));
    
    if (operatorId) {
      logOperation({
        operatorId,
        operationType: 'delete_channel',
        targetId: id,
        targetType: 'Channel',
        targetName: allChannels[channelIndex].name,
        reason
      });
    }
  }
};

// Async version with API
export const deleteChannel = async (id: string, operatorId?: string, reason?: string): Promise<void> => {
  try {
    await apiDeleteChannel(id, operatorId, reason);
    deleteChannelSync(id, operatorId, reason);
  } catch (error) {
    console.error('Failed to delete channel from API:', error);
    deleteChannelSync(id, operatorId, reason);
  }
};

// --- MEDIA RESOURCES ---
// 重构：使用 Cloudflare D1 数据库 + R2 存储
export const getResources = async (teacherId?: string, includeDeleted: boolean = false, summary: boolean = false): Promise<MediaResource[]> => {
  try {
    const raw = await apiGetResources(teacherId, includeDeleted, summary);
    const resources = raw.map(mapApiToMediaResource);
    
    // 只有完整模式才更新本地缓存
    if (!summary) {
      localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(resources));
    }
    
    // 过滤已删除数据（如果后端未过滤）
    if (!includeDeleted) {
      return resources.filter(r => !r.isDeleted);
    }
    
    return resources;
  } catch (error) {
    console.error('Failed to fetch resources from API:', error);
    // Fallback to localStorage if API fails
    const data = localStorage.getItem(STORAGE_KEYS.RESOURCES);
    let resources: MediaResource[] = [];
    
    if (!data) {
      localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify([]));
      resources = [];
    } else {
      resources = JSON.parse(data);
    }
    
    // 过滤已删除数据
    if (!includeDeleted) {
      resources = resources.filter(r => !r.isDeleted);
    }
    
    // 如果提供了 teacherId，过滤该教师的频道下的资源
    if (teacherId) {
      const channels = getChannelsSync(teacherId);
      const channelIds = channels.map(c => c.id);
      return resources.filter(r => {
        if (channelIds.includes(r.channelId || 'default')) return true;
        if (r.teacherId && r.teacherId === teacherId) return true;
        return false;
      });
    }
    
    return resources;
  }
};

export const getResourceById = async (id: string, teacherId?: string, includeDeleted: boolean = false): Promise<MediaResource | undefined> => {
  const resources = await getResources(teacherId, includeDeleted);
  return resources.find(r => r.id === id);
};

export const saveResource = async (resource: MediaResource, teacherId?: string): Promise<MediaResource> => {
  try {
    // 检查是否是新建还是更新
    const isNew = !resource.id || resource.id.startsWith('temp-');
    const mediaUrl = resource.videoUrl || '';
    const isAudioOnly = !!mediaUrl && /\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(mediaUrl);
    // 注意：D1 schema 中 video_r2_key 为 NOT NULL，音频资源也需要填充该字段（可复用同一个 URL/key）
    const videoKey = mediaUrl || null;
    const audioKey = resource.audioUrl || (isAudioOnly ? mediaUrl : null);
    const level = resource.level || 'A1';
    
    let savedResource = { ...resource };
    
    if (isNew) {
      // 创建新资源
      const result = await apiCreateResource({
        title: resource.title,
        teacher_id: teacherId || resource.teacherId || '',
        classroom_id: resource.assignedClassIds?.[0] || '',
        channel_id: resource.channelId,
        level,
        video_r2_key: videoKey,
        audio_r2_key: audioKey,
        cover_r2_key: resource.coverImage || '',
        transcript: resource.transcript || [],
        raw_azure_words: (resource as any).rawAzureWords || null,
        questions: resource.questions || [],
        status: resource.status || 'draft',
        deadline: resource.deadline || null,
        assigned_class_ids: resource.assignedClassIds || [],
        grammar_tags: resource.grammarTags || [],
        vocab_tags: resource.vocabTags || [],
      });
      
      console.log('Resource created:', result);
      // 更新资源ID为服务器返回的ID
      savedResource.id = result.id;
      savedResource.createdAt = result.created_at;
    } else {
      // 更新现有资源
      await apiUpdateResource(resource.id, {
        title: resource.title,
        level,
        video_r2_key: videoKey,
        audio_r2_key: audioKey,
        cover_r2_key: resource.coverImage || '',
        transcript: resource.transcript || [],
        raw_azure_words: (resource as any).rawAzureWords || null,
        questions: resource.questions || [],
        status: resource.status || 'draft',
        deadline: resource.deadline || null,
        assigned_class_ids: resource.assignedClassIds || [],
        grammar_tags: resource.grammarTags || [],
        vocab_tags: resource.vocabTags || [],
      });
      
      console.log('Resource updated:', resource.id);
    }
    
    // 更新本地缓存（使用新ID）
    const rawData = localStorage.getItem(STORAGE_KEYS.RESOURCES);
    let allResources: MediaResource[] = rawData ? JSON.parse(rawData) : [];
    
    // 如果是新建，删除旧的temp-ID记录
    if (isNew && resource.id.startsWith('temp-')) {
      allResources = allResources.filter(r => r.id !== resource.id);
    }
    
    const resourceToSave = {
      ...savedResource,
      teacherId: teacherId || savedResource.teacherId || ''
    };
    
    const index = allResources.findIndex(r => r.id === savedResource.id);
    if (index >= 0) {
      allResources[index] = resourceToSave;
    } else {
      allResources.push(resourceToSave);
    }
    localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(allResources));
    
    return savedResource;
  } catch (error) {
    console.error('Failed to save resource via API:', error);
    // Fallback to localStorage
    const rawData = localStorage.getItem(STORAGE_KEYS.RESOURCES);
    let allResources: MediaResource[] = rawData ? JSON.parse(rawData) : [];
    
    let savedResource = { ...resource };
    const isNew = !allResources.some(r => r.id === resource.id);
    
    if (isNew) {
        // 生成新ID（fallback情况）
        if (!savedResource.id || savedResource.id.startsWith('temp-')) {
          savedResource.id = `res-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          savedResource.createdAt = Date.now();
        }
        
        const siblings = allResources.filter(r => r.channelId === resource.channelId);
        let newTitle = savedResource.title;
        let counter = 1;
        while (siblings.some(r => r.title === newTitle)) {
            newTitle = `${savedResource.title} (${counter})`;
            counter++;
        }
        savedResource.title = newTitle;
    }

    const resourceToSave = {
      ...savedResource,
      teacherId: teacherId || savedResource.teacherId || ''
    };

    const index = allResources.findIndex(r => r.id === savedResource.id);
    if (index >= 0) {
        allResources[index] = resourceToSave;
    } else {
        allResources.push(resourceToSave);
    }
    localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(allResources));
    
    return savedResource;
  }
};

export const deleteResource = async (id: string, operatorId?: string, reason?: string): Promise<void> => {
  // 先获取资源信息，以便获取其quiz题目ID
  let resourceQuestionIds: string[] = [];
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RESOURCES);
    if (data) {
      const allResources: MediaResource[] = JSON.parse(data);
      const resource = allResources.find(r => r.id === id);
      if (resource && resource.questions) {
        resourceQuestionIds = resource.questions.map(q => q.id).filter(Boolean);
      }
    }
  } catch (err) {
    console.error('Error extracting resource question IDs:', err);
  }
  
  try {
    await apiDeleteResource(id);
    console.log('Resource deleted via API:', id);
    
    // 记录操作日志（如果后端未记录）
    if (operatorId) {
      logOperation({
        operatorId,
        operationType: 'delete_resource',
        targetId: id,
        targetType: 'MediaResource',
        targetName: id, // API 不返回 title
        reason
      });
    }
  } catch (error) {
    console.error('Failed to delete resource via API:', error);
    // Fallback to localStorage
    const data = localStorage.getItem(STORAGE_KEYS.RESOURCES);
    if (!data) return;
    const allResources: MediaResource[] = JSON.parse(data);
    const resourceIndex = allResources.findIndex(r => r.id === id);
    if (resourceIndex >= 0) {
      allResources[resourceIndex].isDeleted = true;
      allResources[resourceIndex].deletedAt = Date.now();
      allResources[resourceIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(allResources));
      
      // 记录操作日志
      if (operatorId) {
        logOperation({
          operatorId,
          operationType: 'delete_resource',
          targetId: id,
          targetType: 'MediaResource',
          targetName: allResources[resourceIndex].title,
          reason
        });
      }
    }
  }
  
  // 从引用该资源quiz题目的试卷中移除这些题目并重新计算总分
  if (resourceQuestionIds.length > 0) {
    await removeQuestionsFromExamPapers(resourceQuestionIds);
  }
};

// --- MOCK CDN ---
export const uploadResourceToMockCDN = async (resource: MediaResource): Promise<string> => {
  await new Promise(resolve => setTimeout(resolve, 800));
  const studentPackage = {
    id: resource.id,
    title: resource.title,
    videoUrl: resource.videoUrl,
    transcript: resource.transcript,
    generatedAt: Date.now()
  };
  const fileId = `resource_${resource.id}_v${Date.now()}.json`;
  const mockUrl = `mock-cdn://${fileId}`;
  const bucket = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOCK_CDN) || '{}');
  bucket[mockUrl] = JSON.stringify(studentPackage);
  localStorage.setItem(STORAGE_KEYS.MOCK_CDN, JSON.stringify(bucket));
  return mockUrl;
};

export const fetchResourceFromCDN = async (url: string): Promise<Partial<MediaResource> | null> => {
  await new Promise(resolve => setTimeout(resolve, 300));
  if (url.startsWith('mock-cdn://')) {
    const bucket = JSON.parse(localStorage.getItem(STORAGE_KEYS.MOCK_CDN) || '{}');
    const data = bucket[url];
    return data ? JSON.parse(data) : null;
  }
  try {
    const res = await fetch(url);
    return await res.json();
  } catch (e) {
    console.error("Fetch CDN failed", e);
    return null;
  }
};

// --- CLASSROOMS ---

export const getClassrooms = async (teacherId?: string, includeDeleted: boolean = false): Promise<Classroom[]> => {
  try {
    const raw = await apiGetClassrooms(teacherId, includeDeleted);
    const classrooms = raw.map(mapApiToClassroom);
    
    // 更新本地缓存
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classrooms));
    
    // 过滤已删除数据（如果后端未过滤）
    if (!includeDeleted) {
      return classrooms.filter(c => !c.isDeleted);
    }
    
    return classrooms;
  } catch (error) {
    console.error('Failed to fetch classrooms from API:', error);
    // Fallback to localStorage
    const data = localStorage.getItem(STORAGE_KEYS.CLASSROOMS);
    if (!data) {
      return [];
    }
    
    let allClassrooms: Classroom[] = JSON.parse(data);
    
    // 过滤已删除数据
    if (!includeDeleted) {
      allClassrooms = allClassrooms.filter(c => !c.isDeleted);
    }
    
    if (teacherId) {
      return allClassrooms.filter(c => c.userId === teacherId);
    }
    return allClassrooms;
  }
};

// 同步版本用于需要同步调用的地方
export const getClassroomsSync = (teacherId?: string, includeDeleted: boolean = false): Classroom[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CLASSROOMS);
  if (!data) {
    return [];
  }
  
  let allClassrooms: Classroom[] = JSON.parse(data);
  
  if (!includeDeleted) {
    allClassrooms = allClassrooms.filter(c => !c.isDeleted);
  }
  
  if (teacherId) {
    return allClassrooms.filter(c => c.userId === teacherId);
  }
  return allClassrooms;
};

export const getClassroomById = async (classId: string): Promise<Classroom | undefined> => {
  const classes = await getClassrooms();
  return classes.find(c => c.id === classId);
};

// 同步版本
export const getClassroomByIdSync = (classId: string): Classroom | undefined => {
  const classes = getClassroomsSync();
  return classes.find(c => c.id === classId);
};

export const saveClassroom = async (classroom: Classroom): Promise<void> => {
  try {
    const isNew = !classroom.id || classroom.id.startsWith('temp-');
    
    if (isNew) {
      const result = await apiCreateClassroom({
        name: classroom.name,
        teacherId: classroom.userId
      });
      classroom.id = result.id;
    } else {
      await apiUpdateClassroom(classroom.id, {
        name: classroom.name,
        students: classroom.students
      });
    }
    
    // 更新本地缓存
    const classes = getClassroomsSync(undefined, true);
    const index = classes.findIndex(c => c.id === classroom.id);
    if (index >= 0) {
        classes[index] = classroom;
    } else {
        classes.push(classroom);
    }
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classes));

    emitDataChanged();
  } catch (error) {
    console.error('Failed to save classroom via API:', error);
    // Fallback to localStorage
    const classes = getClassroomsSync();
    const index = classes.findIndex(c => c.id === classroom.id);
    if (index >= 0) {
        classes[index] = classroom;
    } else {
        classes.push(classroom);
    }
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classes));

    emitDataChanged();
  }
};

export const deleteClassroom = async (id: string, operatorId?: string, reason?: string): Promise<void> => {
  try {
    await apiDeleteClassroom(id);
    
    // 更新本地缓存
    const classes = getClassroomsSync(undefined, true);
    const classIndex = classes.findIndex(c => c.id === id);
    if (classIndex >= 0) {
      classes[classIndex].isDeleted = true;
      classes[classIndex].deletedAt = Date.now();
      classes[classIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classes));
    }
  } catch (error) {
    console.error('Failed to delete classroom via API:', error);
    // Fallback to localStorage
    const classes = getClassroomsSync(undefined, true);
    const classIndex = classes.findIndex(c => c.id === id);
    if (classIndex >= 0) {
      classes[classIndex].isDeleted = true;
      classes[classIndex].deletedAt = Date.now();
      classes[classIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classes));
      
      // 记录操作日志
      if (operatorId) {
        logOperation({
          operatorId,
          operationType: 'delete_classroom',
          targetId: id,
          targetType: 'Classroom',
          targetName: classes[classIndex].name,
          reason
        });
      }
    }
  }
};

// --- EXAM PAPERS ---
export const getExamPapers = async (teacherId?: string, includeDeleted: boolean = false): Promise<ExamPaper[]> => {
  try {
    const raw = await apiGetExamPapers(teacherId, includeDeleted);
    const papers = raw.map(mapApiToExamPaper);
    
    // 更新本地缓存
    localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(papers));
    
    // 过滤已删除数据（如果后端未过滤）
    if (!includeDeleted) {
      return papers.filter(p => !p.isDeleted);
    }
    
    return papers;
  } catch (error) {
    console.error('Failed to fetch exam papers from API:', error);
    // Fallback to localStorage
    const data = localStorage.getItem(STORAGE_KEYS.EXAM_PAPERS);
    if (!data) return [];
    let allPapers: ExamPaper[] = JSON.parse(data);
    
    // 过滤已删除数据
    if (!includeDeleted) {
      allPapers = allPapers.filter(p => !p.isDeleted);
    }
    
    return teacherId ? allPapers.filter(p => p.teacherId === teacherId) : allPapers;
  }
};

// 同步版本
export const getExamPapersSync = (teacherId?: string, includeDeleted: boolean = false): ExamPaper[] => {
  const data = localStorage.getItem(STORAGE_KEYS.EXAM_PAPERS);
  if (!data) return [];
  let allPapers: ExamPaper[] = JSON.parse(data);
  
  if (!includeDeleted) {
    allPapers = allPapers.filter(p => !p.isDeleted);
  }
  
  return teacherId ? allPapers.filter(p => p.teacherId === teacherId) : allPapers;
};

export const getExamPaperById = async (id: string): Promise<ExamPaper | undefined> => {
  const papers = await getExamPapers();
  return papers.find(p => p.id === id);
};

// 同步版本
export const getExamPaperByIdSync = (id: string): ExamPaper | undefined => {
  const papers = getExamPapersSync();
  return papers.find(p => p.id === id);
};

export const saveExamPaper = async (exam: ExamPaper): Promise<ExamPaper> => {
  try {
    const isNew = !exam.id || exam.id.startsWith('temp-');
    
    const examToSave = {
      ...exam,
      id: exam.id || `exam-${Date.now()}`,
      createdAt: exam.createdAt || Date.now()
    };
    
    if (isNew) {
      const result = await apiCreateExamPaper({
        title: examToSave.title,
        sections: examToSave.sections,
        total_score: examToSave.totalScore,
        folder_id: examToSave.folderId,
        assigned_class_ids: examToSave.assignedClassIds,
        assigned_class_deadlines: examToSave.assignedClassDeadlines,
        exam_taker_settings: examToSave.examTakerSettings,
        instructions: examToSave.instructions
      });
      examToSave.id = result.id;
    } else {
      await apiUpdateExamPaper(examToSave.id, {
        title: examToSave.title,
        sections: examToSave.sections,
        total_score: examToSave.totalScore,
        folder_id: examToSave.folderId,
        assigned_class_ids: examToSave.assignedClassIds,
        assigned_class_deadlines: examToSave.assignedClassDeadlines,
        exam_taker_settings: examToSave.examTakerSettings,
        instructions: examToSave.instructions
      });
    }
    
    // 更新本地缓存
    const papers = getExamPapersSync();
    const index = papers.findIndex(p => p.id === examToSave.id);
    if (index >= 0) {
      papers[index] = examToSave;
    } else {
      papers.push(examToSave);
    }
    localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(papers));
    return examToSave;
  } catch (error) {
    console.error('Failed to save exam paper via API:', error);
    // Fallback to localStorage
    const papers = getExamPapersSync();
    const index = papers.findIndex(p => p.id === exam.id);
    
    const examToSave = {
      ...exam,
      id: exam.id || `exam-${Date.now()}`,
      createdAt: exam.createdAt || Date.now()
    };
    
    if (index >= 0) {
      papers[index] = examToSave;
    } else {
      papers.push(examToSave);
    }
    localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(papers));
    return examToSave;
  }
};

export const updateExamPaper = async (exam: ExamPaper): Promise<void> => {
  await saveExamPaper(exam);
};

export const deleteExamPaper = async (id: string, operatorId?: string, reason?: string): Promise<void> => {
  try {
    await apiDeleteExamPaper(id);
    
    // 更新本地缓存
    const papers = getExamPapersSync(undefined, true);
    const paperIndex = papers.findIndex(p => p.id === id);
    if (paperIndex >= 0) {
      papers[paperIndex].isDeleted = true;
      papers[paperIndex].deletedAt = Date.now();
      papers[paperIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(papers));
    }
  } catch (error) {
    console.error('Failed to delete exam paper via API:', error);
    // Fallback to localStorage
    const papers = getExamPapersSync(undefined, true);
    const paperIndex = papers.findIndex(p => p.id === id);
    if (paperIndex >= 0) {
      papers[paperIndex].isDeleted = true;
      papers[paperIndex].deletedAt = Date.now();
      papers[paperIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(papers));
      
      // 记录操作日志
      if (operatorId) {
        logOperation({
          operatorId,
          operationType: 'delete_exam',
          targetId: id,
          targetType: 'ExamPaper',
          targetName: papers[paperIndex].title,
          reason
        });
      }
    }
  }
};

// ===== Exam Folders =====
export const getExamFolders = async (userId?: string, includeDeleted: boolean = false): Promise<ExamFolder[]> => {
  try {
    const data = await apiGetExamFolders(userId);
    const folders = data.map(mapApiToExamFolder);
    
    // 更新本地缓存
    localStorage.setItem(STORAGE_KEYS.EXAM_FOLDERS, JSON.stringify(folders));
    
    return includeDeleted ? folders : folders.filter(f => !f.isDeleted);
  } catch (error) {
    console.error('Failed to fetch exam folders from API:', error);
    // Fallback to localStorage
    const cached = localStorage.getItem(STORAGE_KEYS.EXAM_FOLDERS);
    if (cached) {
      const folders: ExamFolder[] = JSON.parse(cached);
      return includeDeleted ? folders : folders.filter(f => !f.isDeleted);
    }
    return [];
  }
};

export const getExamFoldersSync = (userId?: string, includeDeleted: boolean = false): ExamFolder[] => {
  const cached = localStorage.getItem(STORAGE_KEYS.EXAM_FOLDERS);
  if (!cached) return [];
  
  try {
    const folders: ExamFolder[] = JSON.parse(cached);
    let filtered = folders;
    
    if (userId) {
      filtered = filtered.filter(f => f.userId === userId);
    }
    
    if (!includeDeleted) {
      filtered = filtered.filter(f => !f.isDeleted);
    }
    
    return filtered;
  } catch {
    return [];
  }
};

export const saveExamFolder = async (folder: ExamFolder, userId?: string): Promise<ExamFolder> => {
  try {
    const isNew = folder.id.startsWith('temp-');
    
    let saved: any;
    if (isNew) {
      const payload = {
        name: folder.name
      };
      saved = await apiCreateExamFolder(payload);
    } else {
      const payload = {
        name: folder.name
      };
      saved = await apiUpdateExamFolder(folder.id, payload);
    }
    
    const mappedFolder = mapApiToExamFolder(saved);
    
    // 更新本地缓存
    const folders = getExamFoldersSync(undefined, true);
    const index = folders.findIndex(f => f.id === folder.id || f.id === mappedFolder.id);
    if (index >= 0) {
      folders[index] = mappedFolder;
    } else {
      folders.push(mappedFolder);
    }
    localStorage.setItem(STORAGE_KEYS.EXAM_FOLDERS, JSON.stringify(folders));
    
    return mappedFolder;
  } catch (error) {
    console.error('Failed to save exam folder via API:', error);
    // Fallback to localStorage
    const folderToSave = { ...folder };
    if (folderToSave.id.startsWith('temp-')) {
      folderToSave.id = `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      folderToSave.createdAt = Date.now();
      if (userId) {
        folderToSave.userId = userId;
      }
    }
    
    const folders = getExamFoldersSync(undefined, true);
    const index = folders.findIndex(f => f.id === folder.id || f.id === folderToSave.id);
    if (index >= 0) {
      folders[index] = folderToSave;
    } else {
      folders.push(folderToSave);
    }
    localStorage.setItem(STORAGE_KEYS.EXAM_FOLDERS, JSON.stringify(folders));
    return folderToSave;
  }
};

export const deleteExamFolder = async (id: string, operatorId?: string, reason?: string): Promise<void> => {
  try {
    await apiDeleteExamFolder(id);
    
    // 更新本地缓存
    const folders = getExamFoldersSync(undefined, true);
    const folderIndex = folders.findIndex(f => f.id === id);
    if (folderIndex >= 0) {
      folders[folderIndex].isDeleted = true;
      folders[folderIndex].deletedAt = Date.now();
      folders[folderIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.EXAM_FOLDERS, JSON.stringify(folders));
    }
  } catch (error) {
    console.error('Failed to delete exam folder via API:', error);
    // Fallback to localStorage
    const folders = getExamFoldersSync(undefined, true);
    const folderIndex = folders.findIndex(f => f.id === id);
    if (folderIndex >= 0) {
      folders[folderIndex].isDeleted = true;
      folders[folderIndex].deletedAt = Date.now();
      folders[folderIndex].deletedBy = operatorId;
      localStorage.setItem(STORAGE_KEYS.EXAM_FOLDERS, JSON.stringify(folders));
      
      // 记录操作日志
      if (operatorId) {
        logOperation({
          operatorId,
          operationType: 'delete_exam_folder',
          targetId: id,
          targetType: 'ExamFolder',
          targetName: folders[folderIndex].name,
          reason
        });
      }
    }
  }
};

export const getQuestionsByIds = async (ids: string[], teacherId?: string): Promise<Question[]> => {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  // 1) Fast path: local cached question bank
  let cachedBank = getBankQuestionsSync(undefined, true);

  // If cache is empty (fresh device/session), hydrate once via API to avoid N id-by-id calls.
  // This also prevents ExamBuilder from rendering nothing when localStorage hasn't been populated yet.
  if (cachedBank.length === 0 && teacherId) {
    try {
      cachedBank = await getBankQuestions(teacherId, true);
    } catch {
      // ignore; we'll fall back to per-id fetch below
    }
  }

  const bankById = new Map(cachedBank.map(q => [q.id, q]));

  const resultsById = new Map<string, Question>();
  const missing: string[] = [];

  for (const id of uniqueIds) {
    const q = bankById.get(id);
    if (q) resultsById.set(id, q);
    else missing.push(id);
  }

  // 2) Online path: hydrate missing bank questions via API (single fetch per id)
  // Keep concurrency small to avoid overwhelming the edge.
  const maxConcurrency = 6;
  const fetchedFromApi: Question[] = [];

  const worker = async (id: string) => {
    try {
      const raw = await apiGetQuestionById(id);
      const mapped = mapApiToQuestion(raw);
      fetchedFromApi.push(mapped);
      resultsById.set(id, mapped);
    } catch {
      // ignore; may be resource-embedded or deleted
    }
  };

  for (let i = 0; i < missing.length; i += maxConcurrency) {
    const batch = missing.slice(i, i + maxConcurrency);
    await Promise.all(batch.map(worker));
  }

  // Update local bank cache opportunistically
  if (fetchedFromApi.length > 0) {
    const merged = [...cachedBank];
    const existing = new Set(merged.map(q => q.id));
    for (const q of fetchedFromApi) {
      if (!existing.has(q.id)) merged.push(q);
    }
    localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(merged));
  }

  // 3) Resource fallback: try cached resources from localStorage (no network)
  const stillMissing = uniqueIds.filter(id => !resultsById.has(id));
  if (stillMissing.length > 0) {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RESOURCES);
      const cachedResources: MediaResource[] = data ? JSON.parse(data) : [];
      console.log('[getQuestionsByIds] Resource cache check:', {
        stillMissing,
        cachedResourcesCount: cachedResources.length,
        resourcesWithQuestions: cachedResources.filter(r => r.questions && r.questions.length > 0).length
      });
      for (const id of stillMissing) {
        for (const resource of cachedResources) {
          const rq = resource.questions?.find(q => q.id === id);
          if (rq) {
            console.log('[getQuestionsByIds] Found question in resource cache:', id, 'from resource:', resource.title);
            resultsById.set(id, { ...rq, type: rq.type || 'multiple-choice' } as Question);
            break;
          }
        }
      }
    } catch (err) {
      console.error('[getQuestionsByIds] Error reading resource cache:', err);
    }
  }

  // 4) Online resource fallback (teacher): if resource cache is empty on a fresh device/session,
  // we won't be able to resolve resource-embedded questions unless we fetch resources once.
  const stillMissingAfterCache = uniqueIds.filter(id => !resultsById.has(id));
  if (stillMissingAfterCache.length > 0) {
    // Always try to fetch resources if there are still missing questions, not just for teachers
    const effectiveTeacherId = teacherId || 'fallback';
    console.log('[getQuestionsByIds] Still missing after cache:', stillMissingAfterCache, 'fetching resources with teacherId:', effectiveTeacherId);
    try {
      const resources = await getResources(teacherId, true);
      console.log('[getQuestionsByIds] Fetched resources:', resources.length, 'with questions:', resources.filter(r => r.questions && r.questions.length > 0).length);
      for (const id of stillMissingAfterCache) {
        for (const resource of resources) {
          const rq = resource.questions?.find(q => q.id === id);
          if (rq) {
            console.log('[getQuestionsByIds] Found question via API:', id, 'from resource:', resource.title);
            resultsById.set(id, { ...rq, type: rq.type || 'multiple-choice' } as Question);
            break;
          }
        }
      }
    } catch (err) {
      console.error('[getQuestionsByIds] Error fetching resources:', err);
    }
  }
  
  // Final log
  const finalMissing = uniqueIds.filter(id => !resultsById.has(id));
  if (finalMissing.length > 0) {
    console.warn('[getQuestionsByIds] Questions still not found after all fallbacks:', finalMissing);
  }

  // Preserve original id order
  return uniqueIds.map(id => resultsById.get(id)).filter((q): q is Question => !!q);
};

/**
 * Pre-cache questions into the local question bank storage.
 * This is useful for resource-embedded questions that need to be accessible
 * before ensureQuestionsLoaded is called in ExamBuilder.
 */
export const preCacheQuestions = (questions: Question[]): void => {
  if (!questions || questions.length === 0) return;
  
  const data = localStorage.getItem(STORAGE_KEYS.QUESTION_BANK);
  const existing: Question[] = data ? JSON.parse(data) : [];
  const existingIds = new Set(existing.map(q => q.id));
  
  let changed = false;
  for (const q of questions) {
    if (q.id && !existingIds.has(q.id)) {
      existing.push(q);
      existingIds.add(q.id);
      changed = true;
    }
  }
  
  if (changed) {
    localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(existing));
    console.log('[preCacheQuestions] Cached', questions.length, 'questions');
  }
};

// Get questions with their resource info
export const getQuestionsWithResourceInfo = async (ids: string[]): Promise<Array<{ question: Question; resourceId?: string; resourceTitle?: string }>> => {
  let allQuestions = getBankQuestionsSync(undefined, true);
  const allResources = await getResources();
  
  const results: Array<{ question: Question; resourceId?: string; resourceTitle?: string }> = [];
  const missingIds: string[] = [];
  
  for (const id of ids) {
    let found = false;
    
    // Try from media resources FIRST (priority) to preserve resource association
    for (const resource of allResources) {
      if (resource.questions) {
        const resourceQ = resource.questions.find(q => q.id === id);
        if (resourceQ) {
          results.push({ 
            question: resourceQ, 
            resourceId: resource.id,
            resourceTitle: resource.title
          });
          found = true;
          break;
        }
      }
    }
    
    // Only fall back to question bank if not found in resources
    if (!found) {
      const bankQ = allQuestions.find(q => q.id === id);
      if (bankQ) {
        results.push({ question: bankQ });
      } else {
        missingIds.push(id);
      }
    }
  }

  // 跨浏览器场景：本地 QUESTION_BANK 可能为空，补拉后端题库再尝试一次
  if (missingIds.length > 0) {
    try {
      const fetchedQuestions = await getBankQuestions(undefined, true);
      allQuestions = fetchedQuestions;

      for (const missingId of missingIds) {
        const bankQ = allQuestions.find(q => q.id === missingId);
        if (bankQ) {
          results.push({ question: bankQ });
        }
      }
    } catch (error) {
      console.error('Failed to backfill missing questions from API:', error);
    }
  }
  
  return results;
};

// --- Exam Session Management ---
export const getExamSessions = async (studentId?: string, includeDeleted: boolean = false): Promise<ExamSession[]> => {
  try {
    const raw = await apiGetExamSessions(undefined, studentId, includeDeleted);
    const sessions = raw.map(mapApiToExamSession);
    
    // 更新本地缓存
    localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(sessions));
    
    // 过滤已删除数据（如果后端未过滤）
    if (!includeDeleted) {
      return sessions.filter(s => !s.isDeleted);
    }
    
    return sessions;
  } catch (error) {
    console.error('Failed to fetch exam sessions from API:', error);
    // Fallback to localStorage
    let allSessions: ExamSession[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAM_SESSIONS) || '[]');
    
    if (!includeDeleted) {
      allSessions = allSessions.filter(s => !s.isDeleted);
    }
    
    if (studentId) {
      return allSessions.filter(s => s.studentId === studentId);
    }
    return allSessions;
  }
};

// 同步版本
export const getExamSessionsSync = (studentId?: string, includeDeleted: boolean = false): ExamSession[] => {
  let allSessions: ExamSession[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAM_SESSIONS) || '[]');
  
  if (!includeDeleted) {
    allSessions = allSessions.filter(s => !s.isDeleted);
  }
  
  if (studentId) {
    return allSessions.filter(s => s.studentId === studentId);
  }
  return allSessions;
};

export const getExamSessionById = async (id: string): Promise<ExamSession | undefined> => {
  const sessions = await getExamSessions();
  return sessions.find(s => s.id === id);
};

// 获取某个考试的被删除会话（用于查询打回信息）
export const getDeletedExamSessionsByExam = async (examId: string, studentId?: string): Promise<ExamSession[]> => {
  try {
    const raw = await apiGetExamSessions(examId, studentId, true);
    const sessions = raw.map(mapApiToExamSession);
    // 按 examPaperId 和 isDeleted 过滤（API 对学生可能返回所有会话）
    return sessions.filter(s => s.isDeleted && s.examPaperId === examId);
  } catch (error) {
    console.error('Failed to fetch deleted exam sessions:', error);
    // Fallback to localStorage
    const allSessions: ExamSession[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAM_SESSIONS) || '[]');
    return allSessions.filter(s => s.isDeleted && s.examPaperId === examId && (!studentId || s.studentId === studentId));
  }
};

// 同步版本
export const getExamSessionByIdSync = (id: string): ExamSession | undefined => {
  const sessions = getExamSessionsSync();
  return sessions.find(s => s.id === id);
};

export const saveExamSession = async (session: ExamSession): Promise<void> => {
  try {
    // 直接更新会话（API 端点会在不存在时自动创建）
    await apiUpdateExamSession(session.id, {
      answers: session.answers,
      elapsed_time: session.elapsedTime,
      is_submitted: session.isSubmitted,
      submit_time: session.submitTime,
      score: session.score,
      teacher_feedback: session.teacherFeedback,
      manual_score: session.manualScore,
      item_scores: session.itemScores,
      status: session.status
    });
    
    // 更新本地缓存
    const sessions = getExamSessionsSync();
    const index = sessions.findIndex(s => s.id === session.id);
    if (index !== -1) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save exam session via API:', error);
    // 发生错误时抛出异常，让调用方知道保存失败
    throw error;
  }
};

export const deleteExamSession = async (id: string, operatorId?: string, reason?: string, redoMode?: 'clear' | 'revise'): Promise<void> => {
  try {
    await apiDeleteExamSession(id, reason, redoMode);
    
    // 更新本地缓存
    const sessions = getExamSessionsSync(undefined, true);
    const sessionIndex = sessions.findIndex(s => s.id === id);
    if (sessionIndex >= 0) {
      sessions[sessionIndex].isDeleted = true;
      sessions[sessionIndex].deletedAt = Date.now();
      sessions[sessionIndex].deletedBy = operatorId;
      sessions[sessionIndex].deletedReason = reason;
      sessions[sessionIndex].redoMode = redoMode;
      localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(sessions));
    }
  } catch (error) {
    console.error('Failed to delete exam session via API:', error);
    // Fallback to localStorage
    const sessions = getExamSessionsSync(undefined, true);
    const sessionIndex = sessions.findIndex(s => s.id === id);
    if (sessionIndex >= 0) {
      sessions[sessionIndex].isDeleted = true;
      sessions[sessionIndex].deletedAt = Date.now();
      sessions[sessionIndex].deletedBy = operatorId;
      sessions[sessionIndex].deletedReason = reason;
      sessions[sessionIndex].redoMode = redoMode;
      localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(sessions));
      
      // 记录操作日志
      if (operatorId) {
        logOperation({
          operatorId,
          operationType: 'return_to_redo',
          targetId: id,
          targetType: 'ExamSession',
          targetName: `${sessions[sessionIndex].studentName} - ${sessions[sessionIndex].examTitle}`,
          reason
        });
      }
    }
  }
};

// Get exam sessions by exam paper and class
export const getExamSessionsByExamAndClass = async (examId: string, classId: string): Promise<ExamSession[]> => {
  // 使用批量API获取单个考试的会话
  return getExamSessionsByExamsAndClass([examId], classId);
};

// 批量获取多个考试的会话（性能优化：一次API调用）
export const getExamSessionsByExamsAndClass = async (examIds: string[], classId: string): Promise<ExamSession[]> => {
  if (examIds.length === 0) return [];
  
  try {
    const raw = await apiGetExamSessionsByExamsAndClass(examIds, classId, false);
    return raw.map(mapApiToExamSession);
  } catch (error) {
    console.error('Failed to fetch exam sessions in batch:', error);
    // Fallback: 使用本地缓存数据
    const allSessions = getExamSessionsSync();
    const classroom = getClassroomByIdSync(classId);
    if (!classroom) return [];
    
    const studentUserIds = new Set(classroom.students.map(s => s.userId).filter((id): id is string => !!id));
    const examIdSet = new Set(examIds);
    return allSessions.filter(s => examIdSet.has(s.examPaperId) && studentUserIds.has(s.studentId));
  }
};

// Update exam session (alias for saveExamSession for clarity)
export const updateExamSession = async (session: ExamSession): Promise<void> => {
  await saveExamSession(session);
};

// Delete exam sessions by exam and student IDs (for "return to redo" feature)
export const deleteExamSessionsByExam = async (examId: string, studentIds: string[], operatorId?: string, reason?: string, redoMode?: 'clear' | 'revise'): Promise<void> => {
  const studentIdSet = new Set(studentIds);

  // 优先从后端拉取该试卷会话，避免仅依赖本地缓存导致“打回无效”
  try {
    const raw = await apiGetExamSessions(examId, undefined, true);
    const sessions = raw.map(mapApiToExamSession);

    for (const session of sessions) {
      if (studentIdSet.has(session.studentId)) {
        await deleteExamSession(session.id, operatorId, reason, redoMode);
      }
    }
    return;
  } catch (error) {
    console.error('Failed to fetch sessions for redo from API, fallback to cache:', error);
  }

  // Fallback: 本地缓存
  const cachedSessions = getExamSessionsSync(undefined, true);
  for (const session of cachedSessions) {
    if (session.examPaperId === examId && studentIdSet.has(session.studentId)) {
      await deleteExamSession(session.id, operatorId, reason, redoMode);
    }
  }
};

// --- OPERATION LOGS (审计日志) ---
// Sync version for internal use
const getOperationLogsSync = (operatorId?: string): OperationLog[] => {
  const data = localStorage.getItem(STORAGE_KEYS.OPERATION_LOGS);
  if (!data) return [];
  const logs: OperationLog[] = JSON.parse(data);
  return operatorId ? logs.filter(log => log.operatorId === operatorId) : logs;
};

// Async version with API
export const getOperationLogs = async (operatorId?: string): Promise<OperationLog[]> => {
  try {
    const logs = await apiGetOperationLogs({ operatorId });
    
    // Convert from API format
    const converted = logs.map((log: any) => ({
      id: log.id,
      operatorId: log.operator_id,
      operatorName: log.operator_name,
      operationType: log.operation_type,
      targetId: log.target_id,
      targetType: log.target_type,
      targetName: log.target_name,
      reason: log.reason,
      details: log.details ? JSON.parse(log.details) : undefined,
      timestamp: log.timestamp
    }));
    
    // Update localStorage cache
    localStorage.setItem(STORAGE_KEYS.OPERATION_LOGS, JSON.stringify(converted));
    
    return converted;
  } catch (error) {
    console.error('Failed to fetch operation logs from API:', error);
    return getOperationLogsSync(operatorId);
  }
};

// Sync version for internal use (non-blocking API call)
function logOperationSync(params: {
  operatorId: string;
  operationType: OperationLog['operationType'];
  targetId: string;
  targetType: string;
  targetName?: string;
  reason?: string;
  details?: Record<string, any>;
}) {
  const logs = getOperationLogsSync();
  const operator = getUserById(params.operatorId);
  
  const log: OperationLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    operatorId: params.operatorId,
    operatorName: operator?.name || 'Unknown',
    operationType: params.operationType,
    targetId: params.targetId,
    targetType: params.targetType,
    targetName: params.targetName,
    reason: params.reason,
    details: params.details,
    timestamp: Date.now()
  };
  
  logs.push(log);
  localStorage.setItem(STORAGE_KEYS.OPERATION_LOGS, JSON.stringify(logs));
  
  return log;
}

// Export function - logs locally and sends to API in background
export function logOperation(params: {
  operatorId: string;
  operationType: OperationLog['operationType'];
  targetId: string;
  targetType: string;
  targetName?: string;
  reason?: string;
  details?: Record<string, any>;
}) {
  // Log locally first (sync)
  const log = logOperationSync(params);
  
  // Then send to API in background (async, non-blocking)
  apiCreateOperationLog({
    operationType: params.operationType,
    targetId: params.targetId,
    targetType: params.targetType,
    targetName: params.targetName,
    reason: params.reason,
    details: params.details
  }).catch(error => {
    console.error('Failed to log operation to API:', error);
  });
  
  return log;
}

// 清理超过30天的已删除记录
export const cleanupOldDeletedRecords = async () => {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  // 清理用户
  const users = getUsers(true);
  const activeUsers = users.filter(u => !u.isDeleted || (u.deletedAt && u.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(activeUsers));
  
  // 清理班级
  const classrooms = getClassroomsSync(undefined, true);
  const activeClassrooms = classrooms.filter(c => !c.isDeleted || (c.deletedAt && c.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(activeClassrooms));
  
  // 清理试卷
  const papers = getExamPapersSync(undefined, true);
  const activePapers = papers.filter(p => !p.isDeleted || (p.deletedAt && p.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(activePapers));
  
  // 清理考试会话
  const sessions = getExamSessionsSync(undefined, true);
  const activeSessions = sessions.filter(s => !s.isDeleted || (s.deletedAt && s.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(activeSessions));
  
  // 清理频道
  const channels = getChannelsSync(undefined, true);
  const activeChannels = channels.filter(c => !c.isDeleted || (c.deletedAt && c.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(activeChannels));
  
  // 清理资源
  const resources = await getResources(undefined, true);
  const activeResources = resources.filter(r => !r.isDeleted || (r.deletedAt && r.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(activeResources));

  // 清理提交记录
  const submissions = getSubmissionsSync(true);
  const activeSubmissions = submissions.filter(s => !s.isDeleted || (s.deletedAt && s.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(activeSubmissions));

  // 清理练习/跟读数据（map 结构）
  const practiceMap = getStudentPracticeDataMap();
  let practiceChanged = false;
  Object.keys(practiceMap).forEach(key => {
    const item = practiceMap[key];
    if (!item?.isDeleted) return;
    if (item.deletedAt && item.deletedAt > thirtyDaysAgo) return;
    delete practiceMap[key];
    practiceChanged = true;
  });
  if (practiceChanged) setStudentPracticeDataMap(practiceMap);

  // 清理题库题目
  const questions = getBankQuestionsSync(undefined, true);
  const activeQuestions = questions.filter(q => !q.isDeleted || (q.deletedAt && q.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(activeQuestions));

  // 清理课程大纲
  const courses = getSyllabusCoursesSync(undefined, true);
  courses.forEach(c => {
    // 清理课程内超过30天的已删除单元/知识点
    c.units = c.units.filter(u => !u.isDeleted || (u.deletedAt && u.deletedAt > thirtyDaysAgo));
    c.units.forEach(u => {
      u.knowledgePoints = u.knowledgePoints.filter(kp => !kp.isDeleted || (kp.deletedAt && kp.deletedAt > thirtyDaysAgo));
    });
  });
  const activeCourses = courses.filter(c => !c.isDeleted || (c.deletedAt && c.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(activeCourses));
};

// --- 自动清理定时任务 ---
const CLEANUP_LAST_RUN_KEY = 'parlezplus_cleanup_last_run';
let cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
let cleanupVisibilityHandlerAttached = false;

const maybeRunCleanup = () => {
  const lastRunRaw = localStorage.getItem(CLEANUP_LAST_RUN_KEY);
  const lastRun = lastRunRaw ? Number(lastRunRaw) : 0;
  const oneDayMs = 24 * 60 * 60 * 1000;
  if (!lastRun || Number.isNaN(lastRun) || Date.now() - lastRun > oneDayMs) {
    cleanupOldDeletedRecords();
    localStorage.setItem(CLEANUP_LAST_RUN_KEY, String(Date.now()));
  }
};

// 初始化自动清理（幂等）：启动时尝试执行一次，并在前台运行期间定期检查
export const initializeAutomaticCleanup = () => {
  if (cleanupIntervalId) return;

  // 启动时立即检查一次
  maybeRunCleanup();

  // 每小时检查一次是否需要清理（避免setInterval漂移/页面休眠导致错过）
  cleanupIntervalId = setInterval(() => {
    try {
      maybeRunCleanup();
    } catch (e) {
      console.warn('cleanupOldDeletedRecords failed', e);
    }
  }, 60 * 60 * 1000);

  if (!cleanupVisibilityHandlerAttached) {
    cleanupVisibilityHandlerAttached = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        try {
          maybeRunCleanup();
        } catch (e) {
          console.warn('cleanupOldDeletedRecords failed', e);
        }
      }
    });
  }
};



const restoreExamSessionsByExamPaperId = (examPaperId: string) => {
  const sessions = getExamSessionsSync(undefined, true);
  let changed = false;
  sessions.forEach(s => {
    if (s.examPaperId !== examPaperId) return;
    if (!s.isDeleted) return;
    s.isDeleted = false;
    delete s.deletedAt;
    delete s.deletedBy;
    delete s.deletedReason;
    changed = true;
  });
  if (changed) localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(sessions));
};

const restoreExamSessionsByStudentIds = (studentIds: string[]) => {
  if (studentIds.length === 0) return;
  const set = new Set(studentIds);
  const sessions = getExamSessionsSync(undefined, true);
  let changed = false;
  sessions.forEach(s => {
    if (!set.has(s.studentId)) return;
    if (!s.isDeleted) return;
    s.isDeleted = false;
    delete s.deletedAt;
    delete s.deletedBy;
    delete s.deletedReason;
    changed = true;
  });
  if (changed) localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(sessions));
};

const cascadeRestoreResourceInternal = async (resourceId: string) => {
  const resources = await getResources(undefined, true);
  const resource = resources.find(r => r.id === resourceId);
  if (resource && resource.isDeleted) {
    resource.isDeleted = false;
    delete resource.deletedAt;
    delete resource.deletedBy;
    delete (resource as any).deletedReason;
    localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(resources));
  }
  restoreSubmissionsByResource(resourceId);
  restoreStudentPracticeDataByResource(resourceId);
};

const cascadeRestoreChannelInternal = async (channelId: string) => {
  const channels = getChannelsSync(undefined, true);
  const channel = channels.find(c => c.id === channelId);
  if (channel && channel.isDeleted) {
    channel.isDeleted = false;
    delete channel.deletedAt;
    delete channel.deletedBy;
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(channels));
  }

  const resources = await getResources(undefined, true)
    .then(res => res.filter(r => r.channelId === channelId));
  for (const r of resources) {
    await cascadeRestoreResourceInternal(r.id);
  }
};

const cascadeRestoreClassroomInternal = (classId: string) => {
  const classrooms = getClassroomsSync(undefined, true);
  const classroom = classrooms.find(c => c.id === classId);
  if (classroom && classroom.isDeleted) {
    classroom.isDeleted = false;
    delete classroom.deletedAt;
    delete classroom.deletedBy;
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classrooms));
  }

  const studentIds = (classroom?.students || []).map(s => s.userId).filter((x): x is string => !!x);
  restoreExamSessionsByStudentIds(studentIds);
  restoreSubmissionsByStudentIds(studentIds);
  restoreStudentPracticeDataByUserIds(studentIds);
};

const cascadeRestoreSyllabusCourseInternal = (courseId: string) => {
  const courses = getSyllabusCoursesSync(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (course && course.isDeleted) {
    course.isDeleted = false;
    delete course.deletedAt;
    delete course.deletedBy;
    delete (course as any).deletedReason;
    localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));
  }

  if (course) {
    const kpIds = course.units.flatMap(u => u.knowledgePoints.map(k => k.id));
    restoreQuestionsByKnowledgePointIds(course.userId, kpIds);
  }
};

const cascadeRestoreUserInternal = (userId: string) => {
  const users = getUsers(true);
  const user = users.find(u => u.id === userId);
  if (user && user.isDeleted) {
    user.isDeleted = false;
    delete user.deletedAt;
    delete user.deletedBy;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  const role = user?.role;
  if (role === 'student') {
    restoreExamSessionsByStudentIds([userId]);
    restoreSubmissionsByStudentIds([userId]);
    restoreStudentPracticeDataByUserIds([userId]);
    return;
  }

  // teacher/admin
  getChannelsSync(userId, true).forEach(c => cascadeRestoreChannelInternal(c.id));
  getClassroomsSync(userId, true).forEach(c => cascadeRestoreClassroomInternal(c.id));
  getExamPapersSync(userId, true).forEach(p => {
    const papers = getExamPapersSync(undefined, true);
    const paper = papers.find(x => x.id === p.id);
    if (paper && paper.isDeleted) {
      paper.isDeleted = false;
      delete paper.deletedAt;
      delete paper.deletedBy;
      delete (paper as any).deletedReason;
      localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(papers));
    }
    restoreExamSessionsByExamPaperId(p.id);
  });

  // 题库题目
  const questions = getBankQuestionsSync(undefined, true);
  let changed = false;
  questions.forEach(q => {
    if (q.teacherId !== userId) return;
    if (!q.isDeleted) return;
    q.isDeleted = false;
    delete q.deletedAt;
    delete q.deletedBy;
    delete (q as any).deletedReason;
    changed = true;
  });
  if (changed) localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(questions));

  // 课程
  getSyllabusCoursesSync(undefined, true)
    .filter(c => c.userId === userId)
    .forEach(c => cascadeRestoreSyllabusCourseInternal(c.id));
};

const cascadePermanentlyDeleteResourceInternal = async (resourceId: string) => {
  permanentlyDeleteSubmissionsByResource(resourceId);
  permanentlyDeleteStudentPracticeDataByResource(resourceId);

  const resources = await getResources(undefined, true);
  const filtered = resources.filter(r => r.id !== resourceId);
  if (filtered.length !== resources.length) {
    localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(filtered));
  }
};

const cascadePermanentlyDeleteChannelInternal = async (channelId: string) => {
  const resources = await getResources(undefined, true);
  const channelResources = resources.filter(r => r.channelId === channelId);
  for (const r of channelResources) {
    await cascadePermanentlyDeleteResourceInternal(r.id);
  }

  const channels = getChannelsSync(undefined, true);
  const filtered = channels.filter(c => c.id !== channelId);
  if (filtered.length !== channels.length) {
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(filtered));
  }
};

const cascadePermanentlyDeleteClassroomInternal = (classId: string) => {
  const classrooms = getClassroomsSync(undefined, true);
  const classroom = classrooms.find(c => c.id === classId);
  const studentIds = (classroom?.students || []).map(s => s.userId).filter((x): x is string => !!x);

  // 重要：ExamSession/Submission/PracticeData 没有 classId 维度。
  // 为避免误删学生在其它班级的记录，这里只物理删除“由删除该班级触发的级联软删项”。
  const operatorId = classroom?.deletedBy;

  if (studentIds.length > 0) {
    const studentIdSet = new Set(studentIds);

    // ExamSession：仅删除已软删且原因匹配的
    const sessions = getExamSessionsSync(undefined, true);
    const filteredSessions = sessions.filter(s => {
      if (!studentIdSet.has(s.studentId)) return true;
      if (!s.isDeleted) return true;
      if (s.deletedReason !== '级联删除') return true;
      if (operatorId && s.deletedBy && s.deletedBy !== operatorId) return true;
      return false;
    });
    if (filteredSessions.length !== sessions.length) {
      localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(filteredSessions));
    }

    // Submission：仅删除已软删且原因匹配的
    const subs = getSubmissionsSync(true);
    const filteredSubs = subs.filter(s => {
      if (!studentIdSet.has(s.studentId)) return true;
      if (!s.isDeleted) return true;
      if (s.deletedReason !== '级联删除班级') return true;
      if (operatorId && s.deletedBy && s.deletedBy !== operatorId) return true;
      return false;
    });
    if (filteredSubs.length !== subs.length) {
      localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(filteredSubs));
    }

    // StudentPracticeData：仅删除已软删且原因匹配的
    const practiceMap = getStudentPracticeDataMap();
    let practiceChanged = false;
    Object.keys(practiceMap).forEach(key => {
      const v = practiceMap[key];
      const uid = v?.userId;
      const hit = uid ? studentIdSet.has(uid) : studentIds.some(id => key.startsWith(`${id}_`));
      if (!hit) return;
      if (!v?.isDeleted) return;
      if (v.deletedReason !== '级联删除班级') return;
      if (operatorId && v.deletedBy && v.deletedBy !== operatorId) return;
      delete practiceMap[key];
      practiceChanged = true;
    });
    if (practiceChanged) setStudentPracticeDataMap(practiceMap);
  }

  const filtered = classrooms.filter(c => c.id !== classId);
  if (filtered.length !== classrooms.length) {
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(filtered));
  }
};

const cascadePermanentlyDeleteExamPaperInternal = (examPaperId: string) => {
  permanentlyDeleteExamSessionsByExamPaperId(examPaperId);

  const papers = getExamPapersSync(undefined, true);
  const filtered = papers.filter(p => p.id !== examPaperId);
  if (filtered.length !== papers.length) {
    localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(filtered));
  }
};

const cascadePermanentlyDeleteSyllabusCourseInternal = (courseId: string) => {
  const courses = getSyllabusCoursesSync(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;
  const kpIds = course.units.flatMap(u => u.knowledgePoints.map(k => k.id));

  const filtered = courses.filter(c => c.id !== courseId);
  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(filtered));

  permanentlyDeleteQuestionsByKnowledgePointIds(course.userId, kpIds);
};

const cascadePermanentlyDeleteUserInternal = (userId: string) => {
  const users = getUsers(true);
  const user = users.find(u => u.id === userId);
  const role = user?.role;

  if (role === 'student') {
    permanentlyDeleteExamSessionsByStudentIds([userId]);
    permanentlyDeleteSubmissionsByStudentIds([userId]);
    permanentlyDeleteStudentPracticeDataByUserIds([userId]);
  } else {
    // teacher/admin
    getChannelsSync(userId, true).forEach(c => cascadePermanentlyDeleteChannelInternal(c.id));
    getClassroomsSync(userId, true).forEach(c => cascadePermanentlyDeleteClassroomInternal(c.id));
    getExamPapersSync(userId, true).forEach(p => cascadePermanentlyDeleteExamPaperInternal(p.id));

    // 题库题目：按 teacherId 物理删除
    const questions = getBankQuestionsSync(undefined, true);
    const filteredQuestions = questions.filter(q => q.teacherId !== userId);
    if (filteredQuestions.length !== questions.length) {
      localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(filteredQuestions));
    }

    // 课程：物理删除课程 + 关联题目
    getSyllabusCoursesSync(undefined, true)
      .filter(c => c.userId === userId)
      .forEach(c => cascadePermanentlyDeleteSyllabusCourseInternal(c.id));
  }

  // 最后物理删除用户本体
  permanentlyDeleteUser(userId);
};

// 恢复已删除的记录（包含自动级联恢复）
export const restoreDeletedRecord = async (type: 'User' | 'Classroom' | 'ExamPaper' | 'ExamSession' | 'Channel' | 'Resource' | 'Question' | 'SyllabusCourse' | 'SyllabusUnit' | 'SyllabusKnowledgePoint', id: string): Promise<void> => {
  // 先调用 API 恢复服务器端数据（如果适用）
  let apiType: 'resource' | 'channel' | 'user' | 'question' | 'exam-paper' | 'classroom' | 'exam-session' | 'syllabus-course' | undefined;
  
  switch (type) {
    case 'Resource':
      apiType = 'resource';
      break;
    case 'Channel':
      apiType = 'channel';
      break;
    case 'User':
      apiType = 'user';
      break;
    case 'Question':
      apiType = 'question';
      break;
    case 'ExamPaper':
      apiType = 'exam-paper';
      break;
    case 'Classroom':
      apiType = 'classroom';
      break;
    case 'ExamSession':
      apiType = 'exam-session';
      break;
    case 'SyllabusCourse':
      apiType = 'syllabus-course';
      break;
  }
  
  // 先调用 API 恢复服务器端的数据
  if (apiType) {
    await restoreFromRecycleBin(apiType, id);
  }
  
  // API 调用成功后，再清理本地存储中的软删除标记
  switch (type) {
    case 'User': {
      cascadeRestoreUserInternal(id);
      break;
    }
    case 'Classroom': {
      cascadeRestoreClassroomInternal(id);
      break;
    }
    case 'ExamPaper': {
      const papers = getExamPapersSync(undefined, true);
      const paper = papers.find(p => p.id === id);
      if (paper && paper.isDeleted) {
        paper.isDeleted = false;
        delete paper.deletedAt;
        delete paper.deletedBy;
        delete (paper as any).deletedReason;
        localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(papers));
      }

      restoreExamSessionsByExamPaperId(id);
      break;
    }
    case 'ExamSession': {
      const sessions = getExamSessionsSync(undefined, true);
      const session = sessions.find(s => s.id === id);
      if (session && session.isDeleted) {
        session.isDeleted = false;
        delete session.deletedAt;
        delete session.deletedBy;
        delete session.deletedReason;
        localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(sessions));
      }
      break;
    }
    case 'Channel': {
      cascadeRestoreChannelInternal(id);
      break;
    }
    case 'Resource': {
      cascadeRestoreResourceInternal(id);
      break;
    }
    case 'Question': {
      const questions = getBankQuestionsSync(undefined, true);
      const question = questions.find(q => q.id === id);
      if (question && question.isDeleted) {
        question.isDeleted = false;
        delete question.deletedAt;
        delete question.deletedBy;
        delete (question as any).deletedReason;
        localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(questions));
      }
      break;
    }
    case 'SyllabusCourse': {
      cascadeRestoreSyllabusCourseInternal(id);
      break;
    }
    case 'SyllabusUnit': {
      restoreSyllabusUnitByCompositeId(id);
      break;
    }
    case 'SyllabusKnowledgePoint': {
      restoreKnowledgePointByCompositeId(id);
      break;
    }
  }
};

// --- 回收站（聚合所有软删除项） ---
export type RecycleBinItemType =
  | 'User'
  | 'Classroom'
  | 'ExamPaper'
  | 'ExamSession'
  | 'Channel'
  | 'Resource'
  | 'Question'
  | 'SyllabusCourse'
  | 'SyllabusUnit'
  | 'SyllabusKnowledgePoint';

export interface RecycleBinItem {
  id: string;
  type: RecycleBinItemType;
  name: string;
  deletedAt: number;
  deletedBy?: string;
  deletedReason?: string;
  daysRemaining: number;
}

const calcDaysRemaining = (deletedAt: number) => {
  const expireAt = deletedAt + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((expireAt - Date.now()) / (24 * 60 * 60 * 1000)));
};

export const getRecycleBinItems = async (): Promise<RecycleBinItem[]> => {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const items: RecycleBinItem[] = [];

  // 从 API 获取最新的被软删除数据，而不是依赖本地缓存
  try {
    const users = await getUsersAsync(true);
    users
      .filter(u => u.isDeleted && u.deletedAt && u.deletedAt > thirtyDaysAgo)
      .forEach(u => items.push({
        id: u.id,
        type: 'User',
        name: u.name || u.username,
        deletedAt: u.deletedAt!,
        deletedBy: u.deletedBy,
        deletedReason: (u as any).deletedReason,
        daysRemaining: calcDaysRemaining(u.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted users:', error);
  }

  try {
    const classrooms = await getClassrooms(undefined, true);
    classrooms
      .filter(c => c.isDeleted && c.deletedAt && c.deletedAt > thirtyDaysAgo)
      .forEach(c => items.push({
        id: c.id,
        type: 'Classroom',
        name: c.name,
        deletedAt: c.deletedAt!,
        deletedBy: c.deletedBy,
        daysRemaining: calcDaysRemaining(c.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted classrooms:', error);
  }

  try {
    const channels = await getChannels(undefined, true);
    channels
      .filter(c => c.isDeleted && c.deletedAt && c.deletedAt > thirtyDaysAgo)
      .forEach(c => items.push({
        id: c.id,
        type: 'Channel',
        name: c.name,
        deletedAt: c.deletedAt!,
        deletedBy: c.deletedBy,
        daysRemaining: calcDaysRemaining(c.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted channels:', error);
  }

  try {
    const resources = await getResources(undefined, true);
    resources
      .filter(r => r.isDeleted && r.deletedAt && r.deletedAt > thirtyDaysAgo)
      .forEach(r => items.push({
        id: r.id,
        type: 'Resource',
        name: r.title,
        deletedAt: r.deletedAt!,
        deletedBy: r.deletedBy,
        daysRemaining: calcDaysRemaining(r.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted resources:', error);
  }

  try {
    const examPapers = await getExamPapers(undefined, true);
    examPapers
      .filter(p => p.isDeleted && p.deletedAt && p.deletedAt > thirtyDaysAgo)
      .forEach(p => items.push({
        id: p.id,
        type: 'ExamPaper',
        name: p.title,
        deletedAt: p.deletedAt!,
        deletedBy: p.deletedBy,
        deletedReason: (p as any).deletedReason,
        daysRemaining: calcDaysRemaining(p.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted exam papers:', error);
  }

  try {
    const examSessions = await getExamSessions(undefined, true);
    examSessions
      .filter(s => s.isDeleted && s.deletedAt && s.deletedAt > thirtyDaysAgo)
      .forEach(s => items.push({
        id: s.id,
        type: 'ExamSession',
        name: `${s.studentName} - ${s.examTitle}`,
        deletedAt: s.deletedAt!,
        deletedBy: s.deletedBy,
        deletedReason: s.deletedReason,
        daysRemaining: calcDaysRemaining(s.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted exam sessions:', error);
  }

  try {
    const questions = await getBankQuestions(undefined, true);
    questions
      .filter(q => q.isDeleted && q.deletedAt && q.deletedAt > thirtyDaysAgo)
      .forEach(q => items.push({
        id: q.id,
        type: 'Question',
        name: q.text?.slice(0, 50) || '题目',
        deletedAt: q.deletedAt!,
        deletedBy: q.deletedBy,
        deletedReason: (q as any).deletedReason,
        daysRemaining: calcDaysRemaining(q.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted questions:', error);
  }

  try {
    const syllabuses = await getSyllabusCourses(undefined, true);
    syllabuses
      .filter(c => c.isDeleted && c.deletedAt && c.deletedAt > thirtyDaysAgo)
      .forEach(c => items.push({
        id: c.id,
        type: 'SyllabusCourse',
        name: c.name,
        deletedAt: c.deletedAt!,
        deletedBy: c.deletedBy,
        deletedReason: (c as any).deletedReason,
        daysRemaining: calcDaysRemaining(c.deletedAt!),
      }));

    // 单元 / 知识点：嵌套在课程内，以 compositeId 作为回收站 id
    syllabuses.forEach(course => {
      course.units
        .filter(u => u.isDeleted && u.deletedAt && u.deletedAt > thirtyDaysAgo)
        .forEach(u => items.push({
          id: `${course.id}${SYLLABUS_ID_SEP}${u.id}`,
          type: 'SyllabusUnit',
          name: `${course.name} / ${u.name}`,
          deletedAt: u.deletedAt!,
          deletedBy: u.deletedBy,
          daysRemaining: calcDaysRemaining(u.deletedAt!),
        }));

      course.units.forEach(u => {
        u.knowledgePoints
          .filter(kp => kp.isDeleted && kp.deletedAt && kp.deletedAt > thirtyDaysAgo)
          .forEach(kp => items.push({
            id: `${course.id}${SYLLABUS_ID_SEP}${u.id}${SYLLABUS_ID_SEP}${kp.id}`,
            type: 'SyllabusKnowledgePoint',
            name: `${course.name} / ${u.name} / ${kp.name}`,
            deletedAt: kp.deletedAt!,
            deletedBy: kp.deletedBy,
            daysRemaining: calcDaysRemaining(kp.deletedAt!),
          }));
      });
    });
  } catch (error) {
    console.error('Failed to fetch deleted syllabuses:', error);
  }

  return items.sort((a, b) => b.deletedAt - a.deletedAt);
};

// 从回收站永久删除（调用 API 删除 R2 文件，然后清空本地存储）
export const permanentlyDeleteRecord = async (type: RecycleBinItemType, id: string): Promise<void> => {
  try {
    // 先调用 API 删除 R2 文件（需要服务器端删除）
    let apiType: 'resource' | 'channel' | 'user' | 'question' | 'exam-paper' | 'classroom' | 'exam-session' | 'syllabus-course' | undefined;
    
    switch (type) {
      case 'Resource':
        apiType = 'resource';
        break;
      case 'Channel':
        apiType = 'channel';
        break;
      case 'User':
        apiType = 'user';
        break;
      case 'Question':
        apiType = 'question';
        break;
      case 'ExamPaper':
        apiType = 'exam-paper';
        break;
      case 'Classroom':
        apiType = 'classroom';
        break;
      case 'ExamSession':
        apiType = 'exam-session';
        break;
      case 'SyllabusCourse':
        apiType = 'syllabus-course';
        break;
    }
    
    // 先调用 API 删除服务器端数据和 R2 文件
    // 如果API调用失败，会抛出错误，阻止后续的本地存储清理
    if (apiType) {
      await permanentlyDeleteWithR2Cleanup(apiType, id);
    }
    
    // API 调用成功后，再清理本地存储
    switch (type) {
      case 'User': {
        cascadePermanentlyDeleteUserInternal(id);
        break;
      }
      case 'Classroom': {
        cascadePermanentlyDeleteClassroomInternal(id);
        break;
      }
      case 'Channel': {
        await cascadePermanentlyDeleteChannelInternal(id);
        break;
      }
      case 'Resource': {
        await cascadePermanentlyDeleteResourceInternal(id);
        break;
      }
      case 'ExamPaper': {
        cascadePermanentlyDeleteExamPaperInternal(id);
        break;
      }
      case 'ExamSession': {
        const sessions = getExamSessionsSync(undefined, true);
        const filtered = sessions.filter(s => s.id !== id);
        localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(filtered));
        break;
      }
      case 'Question': {
        const questions = getBankQuestionsSync(undefined, true);
        const filtered = questions.filter(q => q.id !== id);
        localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(filtered));
        break;
      }
      case 'SyllabusCourse': {
        cascadePermanentlyDeleteSyllabusCourseInternal(id);
        break;
      }
      case 'SyllabusUnit': {
        permanentlyDeleteSyllabusUnitByCompositeId(id);
        break;
      }
      case 'SyllabusKnowledgePoint': {
        permanentlyDeleteKnowledgePointByCompositeId(id);
        break;
      }
    }
  } catch (error) {
    console.error(`Error permanently deleting ${type} ${id}:`, error);
    throw error;
  }
};

// 教师回收站：只返回该教师“自己名下”的内容，以及由该教师触发删除的 ExamSession
export const getRecycleBinItemsForTeacher = async (teacherId: string): Promise<RecycleBinItem[]> => {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const items: RecycleBinItem[] = [];

  // 从 API 获取最新的被软删除数据，而不是依赖本地缓存
  try {
    const classrooms = await getClassrooms(teacherId, true);
    classrooms
      .filter(c => c.isDeleted && c.deletedAt && c.deletedAt > thirtyDaysAgo)
      .forEach(c => items.push({
        id: c.id,
        type: 'Classroom',
        name: c.name,
        deletedAt: c.deletedAt!,
        deletedBy: c.deletedBy,
        daysRemaining: calcDaysRemaining(c.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted classrooms for teacher:', error);
  }

  try {
    const channels = await getChannels(teacherId, true);
    channels
      .filter(c => c.isDeleted && c.deletedAt && c.deletedAt > thirtyDaysAgo)
      .forEach(c => items.push({
        id: c.id,
        type: 'Channel',
        name: c.name,
        deletedAt: c.deletedAt!,
        deletedBy: c.deletedBy,
        daysRemaining: calcDaysRemaining(c.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted channels for teacher:', error);
  }

  try {
    const resources = await getResources(teacherId, true);
    resources
      .filter(r => r.isDeleted && r.deletedAt && r.deletedAt > thirtyDaysAgo)
      .forEach(r => items.push({
        id: r.id,
        type: 'Resource',
        name: r.title,
        deletedAt: r.deletedAt!,
        deletedBy: r.deletedBy,
        daysRemaining: calcDaysRemaining(r.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted resources for teacher:', error);
  }

  try {
    const examPapers = await getExamPapers(teacherId, true);
    examPapers
      .filter(p => p.isDeleted && p.deletedAt && p.deletedAt > thirtyDaysAgo)
      .forEach(p => items.push({
        id: p.id,
        type: 'ExamPaper',
        name: p.title,
        deletedAt: p.deletedAt!,
        deletedBy: p.deletedBy,
        deletedReason: (p as any).deletedReason,
        daysRemaining: calcDaysRemaining(p.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted exam papers for teacher:', error);
  }

  // 题库题目：按 teacherId 过滤
  try {
    const questions = await getBankQuestions(teacherId, true);
    questions
      .filter(q => q.isDeleted && q.deletedAt && q.deletedAt > thirtyDaysAgo)
      .forEach(q => items.push({
        id: q.id,
        type: 'Question',
        name: q.text?.slice(0, 50) || '题目',
        deletedAt: q.deletedAt!,
        deletedBy: q.deletedBy,
        deletedReason: (q as any).deletedReason,
        daysRemaining: calcDaysRemaining(q.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted questions for teacher:', error);
  }

  try {
    const syllabuses = await getSyllabusCourses(teacherId, true);
    syllabuses
      .filter(c => c.isDeleted && c.deletedAt && c.deletedAt > thirtyDaysAgo)
      .forEach(c => items.push({
        id: c.id,
        type: 'SyllabusCourse',
        name: c.name,
        deletedAt: c.deletedAt!,
        deletedBy: c.deletedBy,
        deletedReason: (c as any).deletedReason,
        daysRemaining: calcDaysRemaining(c.deletedAt!),
      }));

    // 单元和知识点
    syllabuses.forEach(course => {
      course.units
        .filter(u => u.isDeleted && u.deletedAt && u.deletedAt > thirtyDaysAgo)
        .forEach(u => items.push({
          id: `${course.id}${SYLLABUS_ID_SEP}${u.id}`,
          type: 'SyllabusUnit',
          name: `${course.name} / ${u.name}`,
          deletedAt: u.deletedAt!,
          deletedBy: u.deletedBy,
          daysRemaining: calcDaysRemaining(u.deletedAt!),
        }));

      course.units.forEach(u => {
        u.knowledgePoints
          .filter(kp => kp.isDeleted && kp.deletedAt && kp.deletedAt > thirtyDaysAgo)
          .forEach(kp => items.push({
            id: `${course.id}${SYLLABUS_ID_SEP}${u.id}${SYLLABUS_ID_SEP}${kp.id}`,
            type: 'SyllabusKnowledgePoint',
            name: `${course.name} / ${u.name} / ${kp.name}`,
            deletedAt: kp.deletedAt!,
            deletedBy: kp.deletedBy,
            daysRemaining: calcDaysRemaining(kp.deletedAt!),
          }));
      });
    });
  } catch (error) {
    console.error('Failed to fetch deleted syllabuses for teacher:', error);
  }

  // ExamSession：不严格属于教师，但如果是教师执行了“打回重做/级联删除”导致删除，则展示出来便于恢复
  try {
    const examSessions = await getExamSessions(undefined, true);
    examSessions
      .filter(s => s.isDeleted && s.deletedAt && s.deletedAt > thirtyDaysAgo && s.deletedBy === teacherId)
      .forEach(s => items.push({
        id: s.id,
        type: 'ExamSession',
        name: `${s.studentName} - ${s.examTitle}`,
        deletedAt: s.deletedAt!,
        deletedBy: s.deletedBy,
        deletedReason: s.deletedReason,
        daysRemaining: calcDaysRemaining(s.deletedAt!),
      }));
  } catch (error) {
    console.error('Failed to fetch deleted exam sessions for teacher:', error);
  }

  return items.sort((a, b) => b.deletedAt - a.deletedAt);
};

// --- REFERENCE CHECKING (引用完整性检查) ---

// 引用信息接口
export interface ReferenceInfo {
  type: string;
  count: number;
  items: Array<{
    id: string;
    name: string;
  }>;
}

export interface DeleteCheckResult {
  canDelete: boolean;
  references: ReferenceInfo[];
  hasReferences: boolean;
  message?: string;
}

// 检查用户引用
export const checkUserReferences = async (userId: string): Promise<DeleteCheckResult> => {
  const references: ReferenceInfo[] = [];
  
  // 检查频道
  const channels = getChannelsSync(userId, false);
  if (channels.length > 0) {
    references.push({
      type: 'Channel',
      count: channels.length,
      items: channels.slice(0, 5).map(c => ({ id: c.id, name: c.name }))
    });
  }
  
  // 检查资源
  const resources = await getResources(userId, false);
  if (resources.length > 0) {
    references.push({
      type: 'MediaResource',
      count: resources.length,
      items: resources.slice(0, 5).map(r => ({ id: r.id, name: r.title }))
    });
  }
  
  // 检查班级
  const classrooms = getClassroomsSync(userId, false);
  if (classrooms.length > 0) {
    references.push({
      type: 'Classroom',
      count: classrooms.length,
      items: classrooms.slice(0, 5).map(c => ({ id: c.id, name: c.name }))
    });
  }
  
  // 检查题目
  const questions = getBankQuestionsSync(userId);
  if (questions.length > 0) {
    references.push({
      type: 'Question',
      count: questions.length,
      items: questions.slice(0, 5).map(q => ({ id: q.id, name: q.text.substring(0, 30) + '...' }))
    });
  }
  
  // 检查试卷
  const examPapers = getExamPapersSync(userId, false);
  if (examPapers.length > 0) {
    references.push({
      type: 'ExamPaper',
      count: examPapers.length,
      items: examPapers.slice(0, 5).map(e => ({ id: e.id, name: e.title }))
    });
  }
  
  const hasReferences = references.length > 0;
  
  return {
    canDelete: true, // 软删除允许删除，但需要提示
    references,
    hasReferences,
    message: hasReferences 
      ? `该用户有 ${references.reduce((sum, r) => sum + r.count, 0)} 个关联数据，删除后这些数据将变为"孤儿数据"` 
      : undefined
  };
};

// 检查班级引用
export const checkClassroomReferences = (classId: string): DeleteCheckResult => {
  const references: ReferenceInfo[] = [];
  
  // 检查学生练习数据
  const practiceData = localStorage.getItem(STORAGE_KEYS.STUDENT_DATA);
  if (practiceData) {
    const dataObj = JSON.parse(practiceData);
    const classroom = getClassroomByIdSync(classId);
    if (classroom) {
      const studentIds = new Set(classroom.students.map(s => s.userId).filter(Boolean));
      const matchingData = Object.keys(dataObj).filter(key => {
        const studentId = key.split('_')[0];
        return studentIds.has(studentId);
      });
      if (matchingData.length > 0) {
        references.push({
          type: 'StudentPracticeData',
          count: matchingData.length,
          items: matchingData.slice(0, 5).map(key => ({ id: key, name: '练习数据' }))
        });
      }
    }
  }
  
  // 检查作业提交
  const submissions = getSubmissionsSync();
  const classroom = getClassroomByIdSync(classId);
  if (classroom) {
    const studentIds = new Set(classroom.students.map(s => s.userId).filter(Boolean));
    const classSubmissions = submissions.filter(s => studentIds.has(s.studentId));
    if (classSubmissions.length > 0) {
      references.push({
        type: 'Submission',
        count: classSubmissions.length,
        items: classSubmissions.slice(0, 5).map(s => ({ id: s.id, name: '作业提交' }))
      });
    }
  }
  
  // 检查考试会话
  const sessions = getExamSessionsSync(undefined, false);
  const classSessions = sessions.filter(s => {
    const studentIds = classroom?.students.map(st => st.userId).filter(Boolean);
    return studentIds?.includes(s.studentId);
  });
  if (classSessions.length > 0) {
    references.push({
      type: 'ExamSession',
      count: classSessions.length,
      items: classSessions.slice(0, 5).map(s => ({ id: s.id, name: s.examTitle }))
    });
  }
  
  const hasReferences = references.length > 0;
  
  return {
    canDelete: true,
    references,
    hasReferences,
    message: hasReferences 
      ? `该班级有 ${references.reduce((sum, r) => sum + r.count, 0)} 个关联数据，这些数据将被保留但成为"孤儿数据"` 
      : undefined
  };
};

// 检查题目引用
export const checkQuestionReferences = (questionId: string): DeleteCheckResult => {
  const references: ReferenceInfo[] = [];
  
  // 检查试卷引用
  const examPapers = getExamPapersSync(undefined, false);
  const referencingExams = examPapers.filter(exam => 
    exam.sections.some(section => 
      section.items.some(item => item.questionId === questionId)
    )
  );
  
  if (referencingExams.length > 0) {
    references.push({
      type: 'ExamPaper',
      count: referencingExams.length,
      items: referencingExams.slice(0, 5).map(e => ({ id: e.id, name: e.title }))
    });
  }
  
  const hasReferences = references.length > 0;
  
  return {
    canDelete: !hasReferences, // 如果被引用，警告用户
    references,
    hasReferences,
    message: hasReferences 
      ? `该题目被 ${referencingExams.length} 份试卷引用，删除后试卷将无法正常显示该题目` 
      : undefined
  };
};

// 检查资源引用
export const checkResourceReferences = (resourceId: string): DeleteCheckResult => {
  const references: ReferenceInfo[] = [];
  
  // 检查学生练习数据
  const practiceData = localStorage.getItem(STORAGE_KEYS.STUDENT_DATA);
  if (practiceData) {
    const dataObj = JSON.parse(practiceData);
    const matchingData = Object.keys(dataObj).filter(key => key.includes(resourceId));
    if (matchingData.length > 0) {
      references.push({
        type: 'StudentPracticeData',
        count: matchingData.length,
        items: matchingData.slice(0, 5).map(key => ({ id: key, name: '练习数据' }))
      });
    }
  }
  
  // 检查提交记录
  const submissions = getSubmissionsSync();
  const resourceSubmissions = submissions.filter(s => s.resourceId === resourceId);
  if (resourceSubmissions.length > 0) {
    references.push({
      type: 'Submission',
      count: resourceSubmissions.length,
      items: resourceSubmissions.slice(0, 5).map(s => ({ id: s.id, name: '学生提交' }))
    });
  }
  
  const hasReferences = references.length > 0;
  
  return {
    canDelete: true,
    references,
    hasReferences,
    message: hasReferences 
      ? `该资源有 ${references.reduce((sum, r) => sum + r.count, 0)} 个学生数据，这些数据将被保留` 
      : undefined
  };
};

// 检查频道引用
export const checkChannelReferences = async (channelId: string): Promise<DeleteCheckResult> => {
  const references: ReferenceInfo[] = [];
  
  // 检查频道下的资源
  const resources = await getResources(undefined, false);
  const channelResources = resources.filter(r => r.channelId === channelId);
  
  if (channelResources.length > 0) {
    references.push({
      type: 'MediaResource',
      count: channelResources.length,
      items: channelResources.slice(0, 5).map(r => ({ id: r.id, name: r.title }))
    });
  }
  
  const hasReferences = references.length > 0;
  
  return {
    canDelete: true,
    references,
    hasReferences,
    message: hasReferences 
      ? `该频道包含 ${channelResources.length} 个资源` 
      : undefined
  };
};

// 检查试卷引用
export const checkExamPaperReferences = (examId: string): DeleteCheckResult => {
  const references: ReferenceInfo[] = [];
  
  // 检查考试会话
  const sessions = getExamSessionsSync(undefined, false);
  const examSessions = sessions.filter(s => s.examPaperId === examId);
  
  if (examSessions.length > 0) {
    references.push({
      type: 'ExamSession',
      count: examSessions.length,
      items: examSessions.slice(0, 5).map(s => ({ id: s.id, name: `${s.studentName} 的考试` }))
    });
  }
  
  const hasReferences = references.length > 0;
  
  return {
    canDelete: true,
    references,
    hasReferences,
    message: hasReferences 
      ? `该试卷有 ${examSessions.length} 个考试记录` 
      : undefined
  };
};

export const cascadeDeleteClassroom = async (classId: string, operatorId?: string) => {
  const classroom = getClassroomByIdSync(classId);
  if (!classroom) return;
  
  const studentIds = classroom.students.map(s => s.userId).filter((id): id is string => !!id);
  if (studentIds.length === 0) {
    deleteClassroom(classId, operatorId, '级联删除');
    return;
  }
  const studentIdSet = new Set(studentIds);

  // 只删除分配给该班级的试卷产生的考试会话
  const examPapers = getExamPapersSync(undefined, false);
  const classExamIds = new Set(
    examPapers
      .filter(p => p.assignedClassIds?.includes(classId))
      .map(p => p.id)
  );
  
  const sessions = getExamSessionsSync(undefined, false);
  sessions.forEach(session => {
    if (studentIdSet.has(session.studentId) && classExamIds.has(session.examPaperId)) {
      deleteExamSession(session.id, operatorId, '级联删除');
    }
  });
  
  // 只删除分配给该班级的资源产生的提交和练习数据
  const resources = await getResources(undefined, false);
  const classResourceIds = new Set(
    resources
      .filter(r => r.assignedClassIds?.includes(classId))
      .map(r => r.id)
  );

  // 删除作业提交（只删除该班级学生在该班级资源上的提交）
  const submissions = getSubmissionsSync(true);
  submissions.forEach(sub => {
    if (studentIdSet.has(sub.studentId) && classResourceIds.has(sub.resourceId)) {
      if (!sub.isDeleted) {
        sub.isDeleted = true;
        sub.deletedAt = Date.now();
        sub.deletedBy = operatorId;
        sub.deletedReason = '级联删除班级';
      }
    }
  });
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(submissions));

  // 删除学生练习/跟读数据（只删除该班级学生在该班级资源上的数据）
  const practiceMap = getStudentPracticeDataMap();
  let practiceChanged = false;
  Object.keys(practiceMap).forEach(key => {
    const v = practiceMap[key];
    const uid = v?.userId;
    const rid = v?.resourceId;
    const isClassStudent = uid ? studentIdSet.has(uid) : studentIds.some(id => key.startsWith(`${id}_`));
    const isClassResource = rid ? classResourceIds.has(rid) : Array.from(classResourceIds).some(id => key.endsWith(`_${id}`));
    
    if (isClassStudent && isClassResource && !v?.isDeleted) {
      practiceMap[key] = {
        ...v,
        isDeleted: true,
        deletedAt: Date.now(),
        deletedBy: operatorId,
        deletedReason: '级联删除班级'
      };
      practiceChanged = true;
    }
  });
  if (practiceChanged) setStudentPracticeDataMap(practiceMap);
  
  // 最后删除班级
  deleteClassroom(classId, operatorId, '级联删除');
};

export const cascadeDeleteResource = (resourceId: string, operatorId?: string) => {
  // 软删除学生提交
  deleteSubmissionsByResource(resourceId, operatorId, '级联删除资源');

  // 软删除学生练习/跟读数据
  deleteStudentPracticeDataByResource(resourceId, operatorId, '级联删除资源');

  // 软删除资源本体（包含音视频/字幕/翻译/背景音乐/题目等都在该对象中）
  deleteResource(resourceId, operatorId, '级联删除');
};

export const cascadeDeleteChannel = async (channelId: string, operatorId?: string) => {
  // 删除频道下的所有资源
  const resources = await getResources(undefined, false);
  const channelResources = resources.filter(r => r.channelId === channelId);

  channelResources.forEach(r => cascadeDeleteResource(r.id, operatorId));
  
  // 删除频道
  deleteChannel(channelId, operatorId, '级联删除');
};

export const cascadeDeleteExamPaper = (examId: string, operatorId?: string) => {
  // 删除所有考试会话
  const sessions = getExamSessionsSync(undefined, false);
  const examSessions = sessions.filter(s => s.examPaperId === examId);
  
  examSessions.forEach(s => deleteExamSession(s.id, operatorId, '级联删除'));
  
  // 删除试卷
  deleteExamPaper(examId, operatorId, '级联删除');
};

// 用户级联删除：尽量覆盖该用户相关的所有数据，避免孤儿数据
export const cascadeDeleteUser = (userId: string, operatorId?: string) => {
  const user = getUserById(userId);

  // 学生：删除其学习与提交数据
  if (user?.role === 'student') {
    // 考试会话
    const sessions = getExamSessionsSync(undefined, false);
    sessions.forEach(s => {
      if (s.studentId === userId) deleteExamSession(s.id, operatorId, '级联删除用户(学生)');
    });

    // 提交记录
    deleteSubmissionsByStudentIds([userId], operatorId, '级联删除用户(学生)');

    // 练习/跟读数据
    deleteStudentPracticeDataByUserIds([userId], operatorId, '级联删除用户(学生)');

    // 最后删除用户
    deleteUser(userId, operatorId, '级联删除');
    return;
  }

  // 教师/管理员：删除其名下内容
  // 频道（会级联删除频道下资源及其学生数据）
  const channels = getChannelsSync(userId, false);
  channels.forEach(c => cascadeDeleteChannel(c.id, operatorId));

  // 班级（会级联删除学生数据）
  const classrooms = getClassroomsSync(userId, false);
  classrooms.forEach(c => cascadeDeleteClassroom(c.id, operatorId));

  // 试卷（建议级联删除考试会话，避免孤儿 ExamSession）
  const examPapers = getExamPapersSync(userId, false);
  examPapers.forEach(e => cascadeDeleteExamPaper(e.id, operatorId));

  // 题库中心题目：按 teacherId 软删除（包含不在课程知识点中的题目）
  const questions = getBankQuestionsSync(undefined, true);
  questions
    .filter(q => q.teacherId === userId && !q.isDeleted)
    .forEach(q => deleteBankQuestion(q.id, operatorId, '级联删除用户(教师)'));

  // 课程：级联删除课程 + 关联题库题目
  const courses = getSyllabusCoursesSync(undefined, true)
    .filter(c => c.userId === userId && !c.isDeleted);
  courses.forEach(c => cascadeDeleteSyllabusCourse(c.id, operatorId));

  // 最后删除用户
  deleteUser(userId, operatorId, '级联删除');
};

// ======================== API KEY MANAGEMENT ========================

/**
 * 获取指定用户的 API 密钥
 */
export const getUserApiKeys = (userId: string) => {
  return {
    geminiKey: localStorage.getItem(`${userId}_gemini_api_key`) || '',
    azureKey: localStorage.getItem(`${userId}_azure_speech_key`) || '',
    azureRegion: localStorage.getItem(`${userId}_azure_speech_region`) || 'westeurope'
  };
};

/**
 * 保存用户的 API 密钥
 */
export const saveUserApiKeys = (userId: string, keys: {
  geminiKey?: string;
  azureKey?: string;
  azureRegion?: string;
}) => {
  if (keys.geminiKey !== undefined) {
    localStorage.setItem(`${userId}_gemini_api_key`, keys.geminiKey);
  }
  if (keys.azureKey !== undefined) {
    localStorage.setItem(`${userId}_azure_speech_key`, keys.azureKey);
  }
  if (keys.azureRegion !== undefined) {
    localStorage.setItem(`${userId}_azure_speech_region`, keys.azureRegion);
  }
};













