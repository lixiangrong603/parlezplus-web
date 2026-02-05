
import { Channel, MediaResource, Classroom, User, AIResponse, Submission, SyllabusCourse, Question, ExamPaper } from '../types';
import { CURRENT_USER_ID, MOCK_RESOURCES } from '../constants';

const STORAGE_KEYS = {
  CHANNELS: 'parlezplus_channels',
  RESOURCES: 'parlezplus_resources',
  CLASSROOMS: 'parlezplus_classrooms',
  MOCK_CDN: 'parlezplus_cdn_bucket',
  USERS: 'parlezplus_users',
  STUDENT_DATA: 'parlezplus_student_practice_data',
  SUBMISSIONS: 'parlezplus_submissions',
  SYLLABUS: 'parlezplus_syllabus', // New
  QUESTION_BANK: 'parlezplus_question_bank', // New
  EXAM_PAPERS: 'parlezplus_exam_papers', // New
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
    { id: 's1', userId: 'u-student', name: 'Alice Zhang', avatar: 'https://i.pravatar.cc/150?u=u-student', overallProgress: 88 }
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

// --- QUESTION BANK & SYLLABUS (NEW) ---

export const getSyllabusCourses = (teacherId?: string): SyllabusCourse[] => {
  const data = localStorage.getItem(STORAGE_KEYS.SYLLABUS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(INITIAL_SYLLABUS));
    return INITIAL_SYLLABUS;
  }
  const courses: SyllabusCourse[] = JSON.parse(data);
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

export const deleteSyllabusCourse = (id: string) => {
  const courses = getSyllabusCourses();
  const filtered = courses.filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.SYLLABUS, JSON.stringify(filtered));
};

export const getBankQuestions = (): Question[] => {
  const data = localStorage.getItem(STORAGE_KEYS.QUESTION_BANK);
  return data ? JSON.parse(data) : [];
};

export const saveBankQuestion = (question: Question) => {
  const questions = getBankQuestions();
  const index = questions.findIndex(q => q.id === question.id);
  if (index >= 0) {
    questions[index] = question;
  } else {
    questions.push(question);
  }
  localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(questions));
};

export const deleteBankQuestion = (id: string) => {
  const questions = getBankQuestions();
  const filtered = questions.filter(q => q.id !== id);
  localStorage.setItem(STORAGE_KEYS.QUESTION_BANK, JSON.stringify(filtered));
};

// --- SUBMISSIONS ---
export const submitAssignment = (submission: Submission) => {
  const allSubmissions: Submission[] = JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
  
  // Replace existing submission for same student+resource if exists
  const index = allSubmissions.findIndex(s => s.studentId === submission.studentId && s.resourceId === submission.resourceId);
  
  if (index >= 0) {
    allSubmissions[index] = submission;
  } else {
    allSubmissions.push(submission);
  }
  
  localStorage.setItem(STORAGE_KEYS.SUBMISSIONS, JSON.stringify(allSubmissions));
};

export const getSubmissions = (): Submission[] => {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SUBMISSIONS) || '[]');
};

export const getSubmissionForResource = (studentId: string, resourceId: string): Submission | undefined => {
    const subs = getSubmissions();
    return subs.find(s => s.studentId === studentId && s.resourceId === resourceId);
};

// --- STUDENT PRACTICE DATA ---
export interface StudentPracticeData {
  userId: string;
  resourceId: string;
  quizAnswers?: Record<string, string>; // questionId -> optionId
  quizScore?: { score: number; total: number };
  clozeAnswers?: Record<string, string>; // [NEW] segmentIndex-wordIndex -> input string
  clozeScore?: { correct: number; total: number }; // [NEW]
  segmentRecordings?: Record<string, string>; // segmentId -> Base64 Audio String
  segmentScores?: Record<string, AIResponse>; // [NEW] segmentId -> AI Score
  fullRecording?: string; // Base64 Audio String
  overallScore?: AIResponse; // [NEW] Full Text AI Score
  lastUpdated: number;
}

export const saveStudentProgress = (data: StudentPracticeData) => {
  const allData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENT_DATA) || '{}');
  const key = `${data.userId}_${data.resourceId}`;
  
  const existingData = allData[key] || {};

  // [FIX] Deep merge logic to prevent overwriting existing dictionaries
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
    alert("本地存储空间已满，无法保存更多录音。在真实环境中，这将上传至云端服务器。");
  }
};

export const getStudentProgress = (userId: string, resourceId: string): StudentPracticeData | null => {
  const allData = JSON.parse(localStorage.getItem(STORAGE_KEYS.STUDENT_DATA) || '{}');
  const key = `${userId}_${resourceId}`;
  return allData[key] || null;
};

// --- USERS (ADMIN FUNCTIONS) ---
export const getUsers = (): User[] => {
  const data = localStorage.getItem(STORAGE_KEYS.USERS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
    return INITIAL_USERS;
  }
  return JSON.parse(data);
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

export const deleteUser = (id: string) => {
  const users = getUsers();
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
export const getChannels = (): Channel[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CHANNELS);
  const allChannels: Channel[] = data ? JSON.parse(data) : [];
  if (allChannels.length === 0) {
      return [{ id: 'default', userId: CURRENT_USER_ID, name: '法语基础资源', createdAt: Date.now() }];
  }
  return allChannels;
};

export const saveChannel = (channel: Channel) => {
  const allChannels = localStorage.getItem(STORAGE_KEYS.CHANNELS) 
      ? JSON.parse(localStorage.getItem(STORAGE_KEYS.CHANNELS)!) 
      : [];
  const index = allChannels.findIndex((c: Channel) => c.id === channel.id);
  if (index >= 0) {
      allChannels[index] = channel;
  } else {
      allChannels.push(channel);
  }
  localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(allChannels));
};

export const deleteChannel = (id: string) => {
  const data = localStorage.getItem(STORAGE_KEYS.CHANNELS);
  if (!data) return;
  const allChannels: Channel[] = JSON.parse(data);
  const newChannels = allChannels.filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.CHANNELS, JSON.stringify(newChannels));
};

// --- MEDIA RESOURCES ---
export const getResources = (): MediaResource[] => {
  const data = localStorage.getItem(STORAGE_KEYS.RESOURCES);
  if (!data) {
    const seeded = MOCK_RESOURCES.map(r => ({
       ...r,
       assignedClassIds: ['default-class'] 
    }));
    localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(seeded));
    return seeded;
  }
  return JSON.parse(data);
};

export const saveResource = (resource: MediaResource) => {
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

  const index = allResources.findIndex(r => r.id === resource.id);
  if (index >= 0) {
      allResources[index] = resource;
  } else {
      allResources.push(resource);
  }
  localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(allResources));
};

export const deleteResource = (id: string) => {
  const data = localStorage.getItem(STORAGE_KEYS.RESOURCES);
  if (!data) return;
  const allResources: MediaResource[] = JSON.parse(data);
  const newResources = allResources.filter(r => r.id !== id);
  localStorage.setItem(STORAGE_KEYS.RESOURCES, JSON.stringify(newResources));
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

export const getClassrooms = (teacherId?: string): Classroom[] => {
  const data = localStorage.getItem(STORAGE_KEYS.CLASSROOMS);
  if (!data) {
    localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(INITIAL_CLASSROOMS));
    return teacherId ? INITIAL_CLASSROOMS.filter(c => c.userId === teacherId) : INITIAL_CLASSROOMS;
  }
  
  const allClassrooms: Classroom[] = JSON.parse(data);
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

export const deleteClassroom = (id: string) => {
  const classes = getClassrooms();
  const filtered = classes.filter(c => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.CLASSROOMS, JSON.stringify(filtered));
};

// --- EXAM PAPERS ---
export const getExamPapers = (teacherId?: string): ExamPaper[] => {
  const data = localStorage.getItem(STORAGE_KEYS.EXAM_PAPERS);
  if (!data) return [];
  const allPapers: ExamPaper[] = JSON.parse(data);
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

export const deleteExamPaper = (id: string) => {
  const papers = getExamPapers();
  const filtered = papers.filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEYS.EXAM_PAPERS, JSON.stringify(filtered));
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