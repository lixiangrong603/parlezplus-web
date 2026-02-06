
export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  username: string;
  password?: string; // 添加密码字段
  role: UserRole;
  name: string;
  avatar?: string;
  isBlocked?: boolean;
  classId?: string; // Link student to a specific class
}

// [FIX] 添加缺失的 PitchDataPoint 接口定义以修复 PitchVisualizer.tsx 的编译错误
export interface PitchDataPoint {
  time: number;
  standardPitch: number;
  userPitch: number | null;
}

export interface WordTiming {
  word: string;
  startTime: number;
  endTime: number;
  needsLiaison?: boolean;
  isCloze?: boolean; // New: Marks word for Cloze/Fill-in-the-blank exercise
}

export interface AzureWord {
  word: string;
  offset: number; 
  duration: number;
}

export interface TranscriptSegment {
  id: string;
  text: string;
  translation: string;
  startTime: number;
  endTime: number;
  words: WordTiming[]; 
}

// --- Question Bank & Syllabus Types ---

export type KnowledgePointType = 'grammar' | 'vocabulary' | 'reading' | 'other';

export interface KnowledgePoint {
  id: string;
  name: string;
  type: KnowledgePointType;
}

export interface Unit {
  id: string;
  name: string;
  knowledgePoints: KnowledgePoint[];
}

export interface SyllabusCourse {
  id: string;
  name: string;
  units: Unit[];
  userId: string; // 关联到教师
  createdAt: number;
}

export type QuestionType = 'multiple-choice' | 'fill-in-the-blank' | 'reading-comprehension' | 'cloze-test' | 'compound-fill';

export interface QuestionOption {
  id: string;
  text: string;
  imageUrl?: string;
}

export interface Question {
  id: string;
  gapId?: string;
  // Core fields
  text: string;
  imageUrl?: string;
  options: QuestionOption[];
  correctOptionId: string;
  explanation?: string;
  
  // Extended fields for Question Bank
  type?: QuestionType; // Defaults to 'multiple-choice'
  level?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  knowledgePointIds?: string[]; // Links to KnowledgePoint.id
  knowledgePointName?: string; // Optional: AI 标注的单一知识点名称
  tags?: string[];
  
  // For Reading Comprehension / Complex types
  readingPassage?: string; 
  subQuestions?: Question[]; 
  
  // Metadata
  createdAt?: number;
  createdBy?: 'ai' | 'manual';
  teacherId?: string; // 关联的教师ID，用于权限隔离
}

// --- End Question Bank Types ---

export interface Channel {
  id: string;
  userId?: string; 
  name: string;
  createdAt: number;
}

export interface MediaResource {
  id: string;
  userId?: string;
  teacherId?: string; // 关联的教师ID，用于权限隔离
  channelId: string;
  title: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  videoUrl: string;
  audioUrl?: string; 
  backingTrackUrl?: string; 
  vocalTrackUrl?: string;   
  transcriptUrl?: string;   
  coverImage: string;
  transcript: TranscriptSegment[];
  rawAzureWords?: AzureWord[];
  questions?: Question[]; // New: Quiz questions
  status: 'draft' | 'ready';
  createdAt: number;
  deadline?: number; // 新增：任务截止时间 (timestamp)
  isCompleted?: boolean;
  assignedClassIds?: string[]; // New: IDs of classrooms this resource is assigned to
  grammarTags?: string[]; // New: Grammar topics
  vocabTags?: string[];   // New: Vocabulary themes
}

// Updated to match new Gemini Schema (Removed per-word feedback for speed)
export interface AIResponse {
  overallScore: number;
  correctness: number;  // Was accuracy_score
  completeness: number; // Was completeness_score
  fluency: number;      // Was fluency_score
  prosody: number;      // New field
  generalFeedback: string; // Was feedback
  words?: { 
    word: string; 
    score: number; 
    // feedback removed to optimize speed
  }[];
}

export interface Student {
  id: string;
  name: string;
  avatar: string;
  overallProgress: number;
  userId?: string; // Link back to the User record
}

export interface Submission {
  id: string;
  studentId: string;
  resourceId: string; 
  submittedAt: string;
  audioUrl: string;
  aiScore?: AIResponse; // [MODIFIED] Changed to optional
  aiSegmentEvals?: (AIResponse & { id: string })[]; // NEW: Detailed per-segment evaluations
  teacherFeedback?: string; // [NEW] Manual feedback from teacher
  quizResult?: {
    score: number;
    total: number;
    answers: Record<string, string>; // questionId -> optionId
  };
  clozeResult?: {
    score: number;
    total: number;
    answers: Record<string, string>;
  };
  status: 'pending_review' | 'graded';
}

export interface Classroom {
  id: string;
  userId: string; // Mandatory Teacher ID
  name: string;
  studentCount: number;
  students: Student[];
}

export enum RecorderState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  REVIEWING_AUDIO = 'REVIEWING_AUDIO'
}

export type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error';

export interface SegmentAnalysisResult {
  status: AnalysisStatus;
  data?: AIResponse;
}

// --- Exam Paper Types ---
export interface ExamItem {
  questionId?: string; // Optional for consignes
  points: number;
  subPoints?: number[]; // For reading comprehension/cloze with sub-questions
  type?: 'question' | 'consigne'; // 'question' (default) or 'consigne' (text instruction)
  consigneText?: string; // Text content for consigne items
}

export interface ExamSection {
  id: string;
  title: string;
  instructions: string;
  items: ExamItem[];
}

export interface ExamPaper {
  id: string;
  title: string;
  sections: ExamSection[];
  totalScore: number;
  teacherId: string;
  createdAt: number;
  sharedWith?: string[]; // Class IDs or student IDs
  folderId?: string; // Optional: Folder organization
  assignedClassIds?: string[]; // Classes that this exam is assigned to
  assignedClassDeadlines?: Record<string, number>; // classId -> deadline timestamp (ms)

  // [NEW] Online exam runtime settings (teacher-configurable)
  examTakerSettings?: ExamTakerSettings;
}

export interface ExamTakerResourcePlaybackSettings {
  playCount?: number; // times to play (>= 1)
  playbackRate?: 0.5 | 0.75 | 1;
  preCountdownSec?: number;
  postCountdownSec?: number;
  pauseBetweenPlaysSec?: number;
}

export interface ExamTakerSectionSettings {
  durationSec?: number; // section duration; when exceeded, auto advance
}

export interface ExamTakerSettings {
  durationSec?: number; // total exam duration; when exceeded, auto submit
  sections?: Record<string, ExamTakerSectionSettings>; // sectionId -> settings
  resources?: Record<string, ExamTakerResourcePlaybackSettings>; // resourceId -> settings
}
// --- Exam Session Types (for online testing) ---
export interface ExamSession {
  id: string;
  examPaperId: string;
  examTitle: string;
  studentId: string;
  studentName: string;
  answers: Record<string, string>; // questionId -> answer (optionId or text)
  startTime: number;
  submitTime?: number;
  elapsedTime: number; // in milliseconds
  score?: number;
  totalScore: number;
  isSubmitted: boolean;
}