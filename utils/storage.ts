
import { Channel, MediaResource, Classroom, User, AIResponse, Submission, SyllabusCourse, Question, ExamPaper, ExamSession, OperationLog } from '../types';
import { CURRENT_USER_ID, MOCK_RESOURCES } from '../constants';

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
  EXAM_SESSIONS: 'parlezplus_exam_sessions',
  OPERATION_LOGS: 'parlezplus_operation_logs'
};

// --- INITIAL DATA SEEDS ---
const INITIAL_USERS: User[] = [
  { id: 'u-admin', username: 'admin', password: 'admin123', role: 'admin', name: '系统管理员' },
  { id: 'teacher_sophie', username: 'teacher', password: 'teacher123', role: 'teacher', name: 'Sophie Dubois' },
  { id: 'u-student', username: 'student', password: 'student123', role: 'student', name: 'Alice Zhang', classId: 'default-class' },
];

const INITIAL_CLASSROOMS: Classroom[] = [{
  id: 'default-class',
  userId: 'teacher_sophie',
  name: '法语零基础 A1 班',
  studentCount: 1,
  students: [
    { id: 's1', userId: 'u-student', name: 'Alice Zhang', overallProgress: 88 }
  ]
}];

const INITIAL_SYLLABUS: SyllabusCourse[] = [
  {
    id: 'course-1',
    name: 'TCF/TEF 备考全攻略',
    userId: 'teacher_sophie',
    createdAt: Date.now(),
    units: [
      {
        id: 'unit-1',
        name: 'A1 基础语法',
        knowledgePoints: [
          { id: 'kp-1', name: 'Le Présent (现在时)', type: 'grammar' },
          { id: 'kp-2', name: 'Les Articles (冠词)', type: 'grammar' }
        ]
      },
      {
        id: 'unit-2',
        name: 'B1 进阶表达',
        knowledgePoints: [
          { id: 'kp-3', name: 'Subjonctif (虚拟式)', type: 'grammar' },
          { id: 'kp-4', name: 'Cause et Conséquence (因果表达)', type: 'vocabulary' }
        ]
      }
    ]
  },
  {
    id: 'course-2',
    name: '商务法语 (Français des Affaires)',
    userId: 'teacher_sophie',
    createdAt: Date.now(),
    units: [
      {
        id: 'unit-3',
        name: '求职与面试',
        knowledgePoints: [
          { id: 'kp-5', name: 'CV et Lettre de motivation', type: 'reading' },
          { id: 'kp-6', name: 'Entretien (面试词汇)', type: 'vocabulary' }
        ]
      }
    ]
  }
];

// --- QUESTION BANK & SYLLABUS ---

export const getSyllabusCourses = (teacherId?: string, includeDeleted: boolean = false): SyllabusCourse[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SYLLABUS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(INITIAL_SYLLABUS));
    return INITIAL_SYLLABUS;
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
};

export const saveSyllabusCourse = (course: SyllabusCourse) => {
  const courses = getSyllabusCourses();
  const index = courses.findIndex(c => c.id === course.id);
  if (index >= 0) {
    courses[index] = course;
  } else {
    courses.push(course);
  }
  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));
};

export const deleteSyllabusCourse = (id: string, operatorId?: string, reason?: string) => {
  const courses = getSyllabusCourses(undefined, true);
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
};

// 课程引用检查：找出该课程下知识点关联到的题库题目
export const checkSyllabusCourseQuestionReferences = (courseId: string): DeleteCheckResult => {
  const courses = getSyllabusCourses(undefined, true);
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

  const questions = getBankQuestions(course.userId, false);
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
  const courses = getSyllabusCourses(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;

  const knowledgePointIds = new Set(
    course.units.flatMap(u => u.knowledgePoints.map(kp => kp.id))
  );

  if (knowledgePointIds.size > 0) {
    const questions = getBankQuestions(course.userId, true);
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
  const questions = getBankQuestions(teacherId, true);
  questions
    .filter(q => !q.isDeleted && Array.isArray(q.knowledgePointIds) && q.knowledgePointIds.some(id => kpSet.has(id)))
    .forEach(q => deleteBankQuestion(q.id, operatorId, reason));
};

const restoreQuestionsByKnowledgePointIds = (teacherId: string, knowledgePointIds: string[]) => {
  if (knowledgePointIds.length === 0) return;
  const kpSet = new Set(knowledgePointIds);
  const questions = getBankQuestions(teacherId, true);
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
  const courses = getSyllabusCourses(undefined, true);
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
  const courses = getSyllabusCourses(undefined, true);
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
  const courses = getSyllabusCourses(undefined, true);
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
  const courses = getSyllabusCourses(undefined, true);
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
  const courses = getSyllabusCourses(undefined, true);
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
  const courses = getSyllabusCourses(undefined, true);
  const course = courses.find(c => c.id === courseId);
  if (!course) return;
  const unit = course.units.find(u => u.id === unitId);
  if (!unit) return;
  unit.knowledgePoints = unit.knowledgePoints.filter(p => p.id !== knowledgePointId);
  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(courses));

  permanentlyDeleteQuestionsByKnowledgePointIds(course.userId, [knowledgePointId]);
};

// 内部函数：读取所有题目（不过滤）
const getAllBankQuestionsRaw = (): Question[] => {
  const data = localStorage.getItem(STORAGE_KEYS.QUESTION_BANK);
  return data ? JSON.parse(data) : [];
};

export const getBankQuestions = (teacherId?: string, includeDeleted: boolean = false): Question[] => {
  let questions = getAllBankQuestionsRaw();

  // 过滤已删除数据
  if (!includeDeleted) {
    questions = questions.filter(q => !q.isDeleted);
  }

  // 如果提供了 teacherId，只返回该教师的题目；兼容旧题目：如果题目没有 teacherId，将其视为属于 CURRENT_USER_ID
  if (teacherId) {
    questions = questions.filter(q => (q.teacherId || CURRENT_USER_ID) === teacherId);
  }

  return questions;
};

export const saveBankQuestion = (question: Question, teacherId?: string) => {
  const questions = getAllBankQuestionsRaw();
  // 确保保存时关联 teacherId
  const questionToSave = {
    ...question,
    teacherId: teacherId || question.teacherId || CURRENT_USER_ID
  };
  const index = questions.findIndex(q => q.id === question.id);
  if (index >= 0) {
    questions[index] = questionToSave;
  } else {
    questions.push(questionToSave);
  }
  localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(questions));
};

export const deleteBankQuestion = (id: string, operatorId?: string, reason?: string) => {
  const questions = getBankQuestions(undefined, true);
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
};

// --- SUBMISSIONS ---
export const submitAssignment = (submission: Submission) => {
  const allSubmissions: Submission[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
  
  // Replace existing submission for same student+resource if exists
  const index = allSubmissions.findIndex(s => s.studentId === submission.studentId && s.resourceId === submission.resourceId);
  
  if (index >= 0) {
    // 如果之前软删除过该提交，重新提交视为恢复/覆盖
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

export const getSubmissions = (includeDeleted: boolean = false): Submission[] => {
  const subs: Submission[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
  if (includeDeleted) return subs;
  return subs.filter(s => !s.isDeleted);
};

export const deleteSubmission = (id: string, operatorId?: string, reason?: string) => {
  const subs = getSubmissions(true);
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

const restoreSubmissionById = (id: string) => {
  const subs = getSubmissions(true);
  const s = subs.find(x => x.id === id);
  if (!s || !s.isDeleted) return;
  s.isDeleted = false;
  delete s.deletedAt;
  delete s.deletedBy;
  delete s.deletedReason;
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(subs));
};

const deleteSubmissionsByResource = (resourceId: string, operatorId?: string, reason?: string) => {
  const subs = getSubmissions(true);
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
  const subs = getSubmissions(true);
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
  const subs = getSubmissions(true);
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
  const subs = getSubmissions(true);
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
  clozeScore?: { correct: number; total: number };
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
  const subs = getSubmissions(true);
  const filtered = subs.filter(s => s.resourceId !== resourceId);
  if (filtered.length !== subs.length) {
    localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(filtered));
  }
};

const permanentlyDeleteSubmissionsByStudentIds = (studentIds: string[]) => {
  if (studentIds.length === 0) return;
  const set = new Set(studentIds);
  const subs = getSubmissions(true);
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
  const sessions = getExamSessions(undefined, true);
  const filtered = sessions.filter(s => s.examPaperId !== examPaperId);
  if (filtered.length !== sessions.length) {
    localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(filtered));
  }
};

const permanentlyDeleteExamSessionsByStudentIds = (studentIds: string[]) => {
  if (studentIds.length === 0) return;
  const set = new Set(studentIds);
  const sessions = getExamSessions(undefined, true);
  const filtered = sessions.filter(s => !set.has(s.studentId));
  if (filtered.length !== sessions.length) {
    localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(filtered));
  }
};

const permanentlyDeleteQuestionsByKnowledgePointIds = (teacherId: string | undefined, knowledgePointIds: string[]) => {
  if (!teacherId) return;
  if (knowledgePointIds.length === 0) return;
  const kpSet = new Set(knowledgePointIds);
  const questions = getBankQuestions(undefined, true);
  const filtered = questions.filter(q => {
    const owner = (q.teacherId || CURRENT_USER_ID) === teacherId;
    if (!owner) return true;
    const ids = q.knowledgePointIds || [];
    return !ids.some(id => kpSet.has(id));
  });
  if (filtered.length !== questions.length) {
    localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(filtered));
  }
};

export const saveStudentProgress = (data: StudentPracticeData) => {
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

export const getStudentProgress = (userId: string, resourceId: string): StudentPracticeData | null => {
  const allData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENT_DATA) || '{}');
  const key = `${userId}_${resourceId}`;
  return allData[key] || null;
};

// --- USERS (ADMIN FUNCTIONS) ---
export const getUsers = (includeDeleted: boolean = false): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  const users: User[] = JSON.parse(data);
  return includeDeleted ? users : users.filter(u => !u.isDeleted);
};

export const getUserById = (id: string): User | undefined => {
  return getUsers().find(u => u.id === id);
};

export const saveUser = (user: User) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index >= 0) {
    users[index] = user;
  } else {
    users.push(user);
  }
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
};

export const deleteUser = (id: string, operatorId?: string, reason?: string) => {
  const users = getUsers(true); // 包含已删除数据
  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex >= 0) {
    users[userIndex].isDeleted = true;
    users[userIndex].deletedAt = Date.now();
    users[userIndex].deletedBy = operatorId;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    
    // 记录操作日志
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

// 永久删除用户（内部函数，仅供系统清理使用）
const permanentlyDeleteUser = (id: string) => {
  const users = getUsers(true);
  const filtered = users.filter(u => u.id !== id);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(filtered));
};

export const toggleBlockUser = (id: string) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === id);
  if (index >= 0) {
    users[index].isBlocked = !users[index].isBlocked;
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }
};

// --- CHANNELS ---
export const getChannels = (userId?: string, includeDeleted: boolean = false): Channel[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CHANNELS);
  let allChannels: Channel[] = data ? JSON.parse(data) : [];
  
  if (allChannels.length === 0) {
      const defaultChannel = { id: 'default', userId: CURRENT_USER_ID, name: '法语基础资源', createdAt: Date.now() };
      return userId ? (defaultChannel.userId === userId ? [defaultChannel] : []) : [defaultChannel];
  }
  
  // 过滤已删除数据
  if (!includeDeleted) {
    allChannels = allChannels.filter(c => !c.isDeleted);
  }
  
  // 添加 userId 过滤，兼容旧频道：如果没有 userId，默认归属于 CURRENT_USER_ID
  return userId 
    ? allChannels.filter(c => (c.userId || CURRENT_USER_ID) === userId) 
    : allChannels;
};

export const saveChannel = (channel: Channel, userId?: string) => {
  const allChannels = localStorage.getItem(STORAGE_KEYS.CHANNELS) 
      ? JSON.parse(localStorage.getItem(STORAGE_KEYS.CHANNELS)!) 
      : [];
  // 确保 channel 有 userId
  const channelToSave = {
    ...channel,
    userId: userId || channel.userId || CURRENT_USER_ID
  };
  const index = allChannels.findIndex((c: Channel) => c.id === channel.id);
  if (index >= 0) {
      allChannels[index] = channelToSave;
  } else {
      allChannels.push(channelToSave);
  }
  localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(allChannels));
};

export const deleteChannel = (id: string, operatorId?: string, reason?: string) => {
  const data = localStorage.getItem(STORAGE_KEYS.CHANNELS);
  if (!data) return;
  const allChannels: Channel[] = JSON.parse(data);
  const channelIndex = allChannels.findIndex(c => c.id === id);
  if (channelIndex >= 0) {
    allChannels[channelIndex].isDeleted = true;
    allChannels[channelIndex].deletedAt = Date.now();
    allChannels[channelIndex].deletedBy = operatorId;
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(allChannels));
    
    // 记录操作日志
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

// --- MEDIA RESOURCES ---
export const getResources = (teacherId?: string, includeDeleted: boolean = false): MediaResource[] => {
  const data = localStorage.getItem(STORAGE_KEYS.RESOURCES);
  let resources: MediaResource[] = [];
  
  if (!data) {
    const seeded = MOCK_RESOURCES.map(r => ({
       ...r,
       assignedClassIds: ['default-class'],
       channelId: r.channelId || 'default'
    }));
    localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(seeded));
    resources = seeded;
  } else {
    resources = JSON.parse(data);
  }
  
  // 过滤已删除数据
  if (!includeDeleted) {
    resources = resources.filter(r => !r.isDeleted);
  }
  
  // 如果提供了 teacherId，过滤该教师的频道下的资源
  if (teacherId) {
    const channels = getChannels(teacherId);
    const channelIds = channels.map(c => c.id);
    // 兼容旧资源：如果资源没有 teacherId，使用 channelId 推导
    return resources.filter(r => {
      // 如果资源在该教师的频道中，显示它
      if (channelIds.includes(r.channelId || 'default')) return true;
      // 兼容：如果资源明确有 teacherId 匹配，也显示
      if (r.teacherId && r.teacherId === teacherId) return true;
      return false;
    });
  }
  
  return resources;
};

export const saveResource = (resource: MediaResource, teacherId?: string) => {
  const rawData = localStorage.getItem(STORAGE_KEYS.RESOURCES);
  let allResources: MediaResource[] = rawData ? JSON.parse(rawData) : [];
  
  const isNew = !allResources.some(r => r.id === resource.id);
  if (isNew) {
      const siblings = allResources.filter(r => r.channelId === resource.channelId);
      let newTitle = resource.title;
      let counter = 1;
      while (siblings.some(r => r.title === newTitle)) {
          newTitle = `${resource.title} (${counter})`;
          counter++;
      }
      resource.title = newTitle;
  }

  // 确保 resource 有 teacherId（通过 channelId 所属教师推导）
  const resourceToSave = {
    ...resource,
    teacherId: teacherId || resource.teacherId || CURRENT_USER_ID
  };

  const index = allResources.findIndex(r => r.id === resource.id);
  if (index >= 0) {
      allResources[index] = resourceToSave;
  } else {
      allResources.push(resourceToSave);
  }
  localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(allResources));
};

export const deleteResource = (id: string, operatorId?: string, reason?: string) => {
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

export const getClassrooms = (teacherId?: string, includeDeleted: boolean = false): Classroom[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CLASSROOMS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(INITIAL_CLASSROOMS));
    return teacherId ? INITIAL_CLASSROOMS.filter(c => c.userId === teacherId) : INITIAL_CLASSROOMS;
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
};

export const getClassroomById = (classId: string): Classroom | undefined => {
  const classes = getClassrooms();
  return classes.find(c => c.id === classId);
};

export const saveClassroom = (classroom: Classroom) => {
  const classes = getClassrooms();
  const index = classes.findIndex(c => c.id === classroom.id);
  if (index >= 0) {
      classes[index] = classroom;
  } else {
      classes.push(classroom);
  }
  localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(classes));
};

export const deleteClassroom = (id: string, operatorId?: string, reason?: string) => {
  const classes = getClassrooms(undefined, true); // 包含已删除数据
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
};

// --- EXAM PAPERS ---
export const getExamPapers = (teacherId?: string, includeDeleted: boolean = false): ExamPaper[] => {
  const data = localStorage.getItem(STORAGE_KEYS.EXAM_PAPERS);
  if (!data) return [];
  let allPapers: ExamPaper[] = JSON.parse(data);
  
  // 过滤已删除数据
  if (!includeDeleted) {
    allPapers = allPapers.filter(p => !p.isDeleted);
  }
  
  return teacherId ? allPapers.filter(p => p.teacherId === teacherId) : allPapers;
};

export const getExamPaperById = (id: string): ExamPaper | undefined => {
  const papers = getExamPapers();
  return papers.find(p => p.id === id);
};

export const saveExamPaper = (exam: ExamPaper): ExamPaper => {
  const papers = getExamPapers();
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
};

export const updateExamPaper = (exam: ExamPaper) => {
  saveExamPaper(exam);
};

export const deleteExamPaper = (id: string, operatorId?: string, reason?: string) => {
  const papers = getExamPapers(undefined, true); // 包含已删除数据
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
};

export const getQuestionsByIds = async (ids: string[]): Promise<Question[]> => {
  const allQuestions = getBankQuestions();
  const allResources = getResources();
  
  const results: Question[] = [];
  
  for (const id of ids) {
    // Try from question bank first
    const bankQ = allQuestions.find(q => q.id === id);
    if (bankQ) {
      results.push(bankQ);
      continue;
    }
    
    // Try from media resources
    for (const resource of allResources) {
      if (resource.questions) {
        const resourceQ = resource.questions.find(q => q.id === id);
        if (resourceQ) {
          results.push(resourceQ);
          break;
        }
      }
    }
  }
  
  return results;
};

// Get questions with their resource info
export const getQuestionsWithResourceInfo = async (ids: string[]): Promise<Array<{ question: Question; resourceId?: string; resourceTitle?: string }>> => {
  const allQuestions = getBankQuestions();
  const allResources = getResources();
  
  const results: Array<{ question: Question; resourceId?: string; resourceTitle?: string }> = [];
  
  for (const id of ids) {
    // Try from question bank first
    const bankQ = allQuestions.find(q => q.id === id);
    if (bankQ) {
      results.push({ question: bankQ });
      continue;
    }
    
    // Try from media resources
    for (const resource of allResources) {
      if (resource.questions) {
        const resourceQ = resource.questions.find(q => q.id === id);
        if (resourceQ) {
          results.push({ 
            question: resourceQ, 
            resourceId: resource.id,
            resourceTitle: resource.title
          });
          break;
        }
      }
    }
  }
  
  return results;
};

// --- Exam Session Management ---
export const getExamSessions = (studentId?: string, includeDeleted: boolean = false): ExamSession[] => {
  let allSessions: ExamSession[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.EXAM_SESSIONS) || '[]');
  
  // 过滤已删除数据
  if (!includeDeleted) {
    allSessions = allSessions.filter(s => !s.isDeleted);
  }
  
  if (studentId) {
    return allSessions.filter(s => s.studentId === studentId);
  }
  return allSessions;
};

export const getExamSessionById = (id: string): ExamSession | undefined => {
  const sessions = getExamSessions();
  return sessions.find(s => s.id === id);
};

export const saveExamSession = (session: ExamSession) => {
  const sessions = getExamSessions();
  const index = sessions.findIndex(s => s.id === session.id);
  if (index !== -1) {
    sessions[index] = session;
  } else {
    sessions.push(session);
  }
  localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(sessions));
};

export const deleteExamSession = (id: string, operatorId?: string, reason?: string) => {
  const sessions = getExamSessions(undefined, true); // 包含已删除数据
  const sessionIndex = sessions.findIndex(s => s.id === id);
  if (sessionIndex >= 0) {
    sessions[sessionIndex].isDeleted = true;
    sessions[sessionIndex].deletedAt = Date.now();
    sessions[sessionIndex].deletedBy = operatorId;
    sessions[sessionIndex].deletedReason = reason;
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
};

// Get exam sessions by exam paper and class
export const getExamSessionsByExamAndClass = (examId: string, classId: string): ExamSession[] => {
  const allSessions = getExamSessions();
  const classroom = getClassroomById(classId);
  if (!classroom) return [];
  
  const studentUserIds = new Set(classroom.students.map(s => s.userId).filter((id): id is string => !!id));
  return allSessions.filter(s => s.examPaperId === examId && studentUserIds.has(s.studentId));
};

// Update exam session (alias for saveExamSession for clarity)
export const updateExamSession = (session: ExamSession) => {
  saveExamSession(session);
};

// Delete exam sessions by exam and student IDs (for "return to redo" feature)
export const deleteExamSessionsByExam = (examId: string, studentIds: string[], operatorId?: string, reason?: string) => {
  const sessions = getExamSessions(undefined, true); // 包含已删除数据
  const studentIdSet = new Set(studentIds);
  
  sessions.forEach(session => {
    if (session.examPaperId === examId && studentIdSet.has(session.studentId)) {
      session.isDeleted = true;
      session.deletedAt = Date.now();
      session.deletedBy = operatorId;
      session.deletedReason = reason;
      
      // 记录操作日志
      if (operatorId) {
        logOperation({
          operatorId,
          operationType: 'return_to_redo',
          targetId: session.id,
          targetType: 'ExamSession',
          targetName: `${session.studentName} - ${session.examTitle}`,
          reason,
          details: { examId, studentId: session.studentId }
        });
      }
    }
  });
  
  localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(sessions));
};

// --- OPERATION LOGS (审计日志) ---
export const getOperationLogs = (operatorId?: string): OperationLog[] => {
  const data = localStorage.getItem(STORAGE_KEYS.OPERATION_LOGS);
  if (!data) return [];
  const logs: OperationLog[] = JSON.parse(data);
  return operatorId ? logs.filter(log => log.operatorId === operatorId) : logs;
};

export const logOperation = (params: {
  operatorId: string;
  operationType: OperationLog['operationType'];
  targetId: string;
  targetType: string;
  targetName?: string;
  reason?: string;
  details?: Record<string, any>;
}) => {
  const logs = getOperationLogs();
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
};

// 清理超过30天的已删除记录
export const cleanupOldDeletedRecords = () => {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  
  // 清理用户
  const users = getUsers(true);
  const activeUsers = users.filter(u => !u.isDeleted || (u.deletedAt && u.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(activeUsers));
  
  // 清理班级
  const classrooms = getClassrooms(undefined, true);
  const activeClassrooms = classrooms.filter(c => !c.isDeleted || (c.deletedAt && c.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(activeClassrooms));
  
  // 清理试卷
  const papers = getExamPapers(undefined, true);
  const activePapers = papers.filter(p => !p.isDeleted || (p.deletedAt && p.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(activePapers));
  
  // 清理考试会话
  const sessions = getExamSessions(undefined, true);
  const activeSessions = sessions.filter(s => !s.isDeleted || (s.deletedAt && s.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(activeSessions));
  
  // 清理频道
  const channels = getChannels(undefined, true);
  const activeChannels = channels.filter(c => !c.isDeleted || (c.deletedAt && c.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(activeChannels));
  
  // 清理资源
  const resources = getResources(undefined, true);
  const activeResources = resources.filter(r => !r.isDeleted || (r.deletedAt && r.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(activeResources));

  // 清理提交记录
  const submissions = getSubmissions(true);
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
  const questions = getBankQuestions(undefined, true);
  const activeQuestions = questions.filter(q => !q.isDeleted || (q.deletedAt && q.deletedAt > thirtyDaysAgo));
  localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(activeQuestions));

  // 清理课程大纲
  const courses = getSyllabusCourses(undefined, true);
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
  const sessions = getExamSessions(undefined, true);
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
  const sessions = getExamSessions(undefined, true);
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

const cascadeRestoreResourceInternal = (resourceId: string) => {
  const resources = getResources(undefined, true);
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

const cascadeRestoreChannelInternal = (channelId: string) => {
  const channels = getChannels(undefined, true);
  const channel = channels.find(c => c.id === channelId);
  if (channel && channel.isDeleted) {
    channel.isDeleted = false;
    delete channel.deletedAt;
    delete channel.deletedBy;
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(channels));
  }

  const resources = getResources(undefined, true)
    .filter(r => r.channelId === channelId);
  resources.forEach(r => cascadeRestoreResourceInternal(r.id));
};

const cascadeRestoreClassroomInternal = (classId: string) => {
  const classrooms = getClassrooms(undefined, true);
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
  const courses = getSyllabusCourses(undefined, true);
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
  getChannels(userId, true).forEach(c => cascadeRestoreChannelInternal(c.id));
  getClassrooms(userId, true).forEach(c => cascadeRestoreClassroomInternal(c.id));
  getExamPapers(userId, true).forEach(p => {
    const papers = getExamPapers(undefined, true);
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
  const questions = getBankQuestions(undefined, true);
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
  getSyllabusCourses(undefined, true)
    .filter(c => (c.userId || CURRENT_USER_ID) === userId)
    .forEach(c => cascadeRestoreSyllabusCourseInternal(c.id));
};

const cascadePermanentlyDeleteResourceInternal = (resourceId: string) => {
  permanentlyDeleteSubmissionsByResource(resourceId);
  permanentlyDeleteStudentPracticeDataByResource(resourceId);

  const resources = getResources(undefined, true);
  const filtered = resources.filter(r => r.id !== resourceId);
  if (filtered.length !== resources.length) {
    localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(filtered));
  }
};

const cascadePermanentlyDeleteChannelInternal = (channelId: string) => {
  const resources = getResources(undefined, true)
    .filter(r => r.channelId === channelId);
  resources.forEach(r => cascadePermanentlyDeleteResourceInternal(r.id));

  const channels = getChannels(undefined, true);
  const filtered = channels.filter(c => c.id !== channelId);
  if (filtered.length !== channels.length) {
    localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(filtered));
  }
};

const cascadePermanentlyDeleteClassroomInternal = (classId: string) => {
  const classrooms = getClassrooms(undefined, true);
  const classroom = classrooms.find(c => c.id === classId);
  const studentIds = (classroom?.students || []).map(s => s.userId).filter((x): x is string => !!x);

  // 重要：ExamSession/Submission/PracticeData 没有 classId 维度。
  // 为避免误删学生在其它班级的记录，这里只物理删除“由删除该班级触发的级联软删项”。
  const operatorId = classroom?.deletedBy;

  if (studentIds.length > 0) {
    const studentIdSet = new Set(studentIds);

    // ExamSession：仅删除已软删且原因匹配的
    const sessions = getExamSessions(undefined, true);
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
    const subs = getSubmissions(true);
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

  const papers = getExamPapers(undefined, true);
  const filtered = papers.filter(p => p.id !== examPaperId);
  if (filtered.length !== papers.length) {
    localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(filtered));
  }
};

const cascadePermanentlyDeleteSyllabusCourseInternal = (courseId: string) => {
  const courses = getSyllabusCourses(undefined, true);
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
    getChannels(userId, true).forEach(c => cascadePermanentlyDeleteChannelInternal(c.id));
    getClassrooms(userId, true).forEach(c => cascadePermanentlyDeleteClassroomInternal(c.id));
    getExamPapers(userId, true).forEach(p => cascadePermanentlyDeleteExamPaperInternal(p.id));

    // 题库题目：按 teacherId 物理删除
    const questions = getBankQuestions(undefined, true);
    const filteredQuestions = questions.filter(q => (q.teacherId || CURRENT_USER_ID) !== userId);
    if (filteredQuestions.length !== questions.length) {
      localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(filteredQuestions));
    }

    // 课程：物理删除课程 + 关联题目
    getSyllabusCourses(undefined, true)
      .filter(c => (c.userId || CURRENT_USER_ID) === userId)
      .forEach(c => cascadePermanentlyDeleteSyllabusCourseInternal(c.id));
  }

  // 最后物理删除用户本体
  permanentlyDeleteUser(userId);
};

// 恢复已删除的记录（包含自动级联恢复）
export const restoreDeletedRecord = (type: 'User' | 'Classroom' | 'ExamPaper' | 'ExamSession' | 'Channel' | 'Resource' | 'Question' | 'SyllabusCourse' | 'SyllabusUnit' | 'SyllabusKnowledgePoint', id: string) => {
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
      const papers = getExamPapers(undefined, true);
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
      const sessions = getExamSessions(undefined, true);
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
      const questions = getBankQuestions(undefined, true);
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

export const getRecycleBinItems = (): RecycleBinItem[] => {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const items: RecycleBinItem[] = [];

  getUsers(true)
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

  getClassrooms(undefined, true)
    .filter(c => c.isDeleted && c.deletedAt && c.deletedAt > thirtyDaysAgo)
    .forEach(c => items.push({
      id: c.id,
      type: 'Classroom',
      name: c.name,
      deletedAt: c.deletedAt!,
      deletedBy: c.deletedBy,
      daysRemaining: calcDaysRemaining(c.deletedAt!),
    }));

  getChannels(undefined, true)
    .filter(c => c.isDeleted && c.deletedAt && c.deletedAt > thirtyDaysAgo)
    .forEach(c => items.push({
      id: c.id,
      type: 'Channel',
      name: c.name,
      deletedAt: c.deletedAt!,
      deletedBy: c.deletedBy,
      daysRemaining: calcDaysRemaining(c.deletedAt!),
    }));

  getResources(undefined, true)
    .filter(r => r.isDeleted && r.deletedAt && r.deletedAt > thirtyDaysAgo)
    .forEach(r => items.push({
      id: r.id,
      type: 'Resource',
      name: r.title,
      deletedAt: r.deletedAt!,
      deletedBy: r.deletedBy,
      daysRemaining: calcDaysRemaining(r.deletedAt!),
    }));

  getExamPapers(undefined, true)
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

  getExamSessions(undefined, true)
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

  getBankQuestions(undefined, true)
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

  getSyllabusCourses(undefined, true)
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
  getSyllabusCourses(undefined, true)
    .forEach(course => {
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

  return items.sort((a, b) => b.deletedAt - a.deletedAt);
};

// 从回收站永久删除（立即从存储中移除）
export const permanentlyDeleteRecord = (type: RecycleBinItemType, id: string) => {
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
      cascadePermanentlyDeleteChannelInternal(id);
      break;
    }
    case 'Resource': {
      cascadePermanentlyDeleteResourceInternal(id);
      break;
    }
    case 'ExamPaper': {
      cascadePermanentlyDeleteExamPaperInternal(id);
      break;
    }
    case 'ExamSession': {
      const sessions = getExamSessions(undefined, true);
      const filtered = sessions.filter(s => s.id !== id);
      localStorage.setItem(STORAGE_KEYS.EXAM_SESSIONS, JSON.stringify(filtered));
      break;
    }
    case 'Question': {
      const questions = getBankQuestions(undefined, true);
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
};

// 教师回收站：只返回该教师“自己名下”的内容，以及由该教师触发删除的 ExamSession
export const getRecycleBinItemsForTeacher = (teacherId: string): RecycleBinItem[] => {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
  const items: RecycleBinItem[] = [];

  getClassrooms(teacherId, true)
    .filter(c => c.isDeleted && c.deletedAt && c.deletedAt > thirtyDaysAgo)
    .forEach(c => items.push({
      id: c.id,
      type: 'Classroom',
      name: c.name,
      deletedAt: c.deletedAt!,
      deletedBy: c.deletedBy,
      daysRemaining: calcDaysRemaining(c.deletedAt!),
    }));

  getChannels(teacherId, true)
    .filter(c => c.isDeleted && c.deletedAt && c.deletedAt > thirtyDaysAgo)
    .forEach(c => items.push({
      id: c.id,
      type: 'Channel',
      name: c.name,
      deletedAt: c.deletedAt!,
      deletedBy: c.deletedBy,
      daysRemaining: calcDaysRemaining(c.deletedAt!),
    }));

  getResources(teacherId, true)
    .filter(r => r.isDeleted && r.deletedAt && r.deletedAt > thirtyDaysAgo)
    .forEach(r => items.push({
      id: r.id,
      type: 'Resource',
      name: r.title,
      deletedAt: r.deletedAt!,
      deletedBy: r.deletedBy,
      daysRemaining: calcDaysRemaining(r.deletedAt!),
    }));

  getExamPapers(teacherId, true)
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

  // 题库题目：按 teacherId 过滤（兼容旧数据）
  getBankQuestions(teacherId, true)
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

  getSyllabusCourses(teacherId, true)
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

  getSyllabusCourses(teacherId, true)
    .forEach(course => {
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

  // ExamSession：不严格属于教师，但如果是教师执行了“打回重做/级联删除”导致删除，则展示出来便于恢复
  getExamSessions(undefined, true)
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
export const checkUserReferences = (userId: string): DeleteCheckResult => {
  const references: ReferenceInfo[] = [];
  
  // 检查频道
  const channels = getChannels(userId, false);
  if (channels.length > 0) {
    references.push({
      type: 'Channel',
      count: channels.length,
      items: channels.slice(0, 5).map(c => ({ id: c.id, name: c.name }))
    });
  }
  
  // 检查资源
  const resources = getResources(userId, false);
  if (resources.length > 0) {
    references.push({
      type: 'MediaResource',
      count: resources.length,
      items: resources.slice(0, 5).map(r => ({ id: r.id, name: r.title }))
    });
  }
  
  // 检查班级
  const classrooms = getClassrooms(userId, false);
  if (classrooms.length > 0) {
    references.push({
      type: 'Classroom',
      count: classrooms.length,
      items: classrooms.slice(0, 5).map(c => ({ id: c.id, name: c.name }))
    });
  }
  
  // 检查题目
  const questions = getBankQuestions(userId);
  if (questions.length > 0) {
    references.push({
      type: 'Question',
      count: questions.length,
      items: questions.slice(0, 5).map(q => ({ id: q.id, name: q.text.substring(0, 30) + '...' }))
    });
  }
  
  // 检查试卷
  const examPapers = getExamPapers(userId, false);
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
    const classroom = getClassroomById(classId);
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
  const submissions = getSubmissions();
  const classroom = getClassroomById(classId);
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
  const sessions = getExamSessions(undefined, false);
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
  const examPapers = getExamPapers(undefined, false);
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
  const submissions = getSubmissions();
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
export const checkChannelReferences = (channelId: string): DeleteCheckResult => {
  const references: ReferenceInfo[] = [];
  
  // 检查频道下的资源
  const resources = getResources(undefined, false);
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
  const sessions = getExamSessions(undefined, false);
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

export const cascadeDeleteClassroom = (classId: string, operatorId?: string) => {
  const classroom = getClassroomById(classId);
  if (!classroom) return;
  
  const studentIds = classroom.students.map(s => s.userId).filter((id): id is string => !!id);
  if (studentIds.length === 0) {
    deleteClassroom(classId, operatorId, '级联删除');
    return;
  }
  const studentIdSet = new Set(studentIds);

  // 只删除分配给该班级的试卷产生的考试会话
  const examPapers = getExamPapers(undefined, false);
  const classExamIds = new Set(
    examPapers
      .filter(p => p.assignedClassIds?.includes(classId))
      .map(p => p.id)
  );
  
  const sessions = getExamSessions(undefined, false);
  sessions.forEach(session => {
    if (studentIdSet.has(session.studentId) && classExamIds.has(session.examPaperId)) {
      deleteExamSession(session.id, operatorId, '级联删除');
    }
  });
  
  // 只删除分配给该班级的资源产生的提交和练习数据
  const resources = getResources(undefined, false);
  const classResourceIds = new Set(
    resources
      .filter(r => r.assignedClassIds?.includes(classId))
      .map(r => r.id)
  );

  // 删除作业提交（只删除该班级学生在该班级资源上的提交）
  const submissions = getSubmissions(true);
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

export const cascadeDeleteChannel = (channelId: string, operatorId?: string) => {
  // 删除频道下的所有资源
  const resources = getResources(undefined, false);
  const channelResources = resources.filter(r => r.channelId === channelId);

  channelResources.forEach(r => cascadeDeleteResource(r.id, operatorId));
  
  // 删除频道
  deleteChannel(channelId, operatorId, '级联删除');
};

export const cascadeDeleteExamPaper = (examId: string, operatorId?: string) => {
  // 删除所有考试会话
  const sessions = getExamSessions(undefined, false);
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
    const sessions = getExamSessions(undefined, false);
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
  const channels = getChannels(userId, false);
  channels.forEach(c => cascadeDeleteChannel(c.id, operatorId));

  // 班级（会级联删除学生数据）
  const classrooms = getClassrooms(userId, false);
  classrooms.forEach(c => cascadeDeleteClassroom(c.id, operatorId));

  // 试卷（建议级联删除考试会话，避免孤儿 ExamSession）
  const examPapers = getExamPapers(userId, false);
  examPapers.forEach(e => cascadeDeleteExamPaper(e.id, operatorId));

  // 题库中心题目：按 teacherId 软删除（包含不在课程知识点中的题目）
  const questions = getBankQuestions(undefined, true);
  questions
    .filter(q => q.teacherId === userId && !q.isDeleted)
    .forEach(q => deleteBankQuestion(q.id, operatorId, '级联删除用户(教师)'));

  // 课程：级联删除课程 + 关联题库题目
  const courses = getSyllabusCourses(undefined, true)
    .filter(c => (c.userId || CURRENT_USER_ID) === userId && !c.isDeleted);
  courses.forEach(c => cascadeDeleteSyllabusCourse(c.id, operatorId));

  // 最后删除用户
  deleteUser(userId, operatorId, '级联删除');
};