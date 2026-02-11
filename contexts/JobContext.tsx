
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { MediaResource, TranscriptSegment, AzureWord, Question, AIResponse, KnowledgePoint } from '../types';
import { transcribeAudioWithAzure } from '../services/azureSpeechService';
import { translateSegmentsWithWorker } from '../services/geminiService';
import { createAiWorker } from '../services/aiWorkerFactory';
import { alignTextToAzureWords } from '../utils/textAnalysis';

export type JobType = 'azure' | 'gemini' | 'audioshake' | 'quiz' | 'eval';
export type JobStatus = 'idle' | 'processing' | 'completed' | 'error';

interface JobResult {
  segments?: TranscriptSegment[];
  rawAzureWords?: AzureWord[];
  fullText?: string;
  questions?: Question[];
  evaluationResult?: {
    segmentEvaluations: (AIResponse & { id: string })[];
  };
}

interface Job {
  resourceId: string; // Acts as the unique key for the job
  type: JobType;
  status: JobStatus;
  message?: string;
  result?: JobResult;
  error?: string;
  // Persist the audio blob so we can restore the player state if user navigates back
  audioBlob?: Blob; 
}

interface JobContextType {
  jobs: Record<string, Job>; // Keyed by Job ID
  startAzureJob: (resource: MediaResource, apiKey: string, region: string) => Promise<void>;
  startGeminiJob: (resourceId: string, segments: TranscriptSegment[], authToken: string) => Promise<void>;
  startAudioShakeJob: (resourceId: string) => Promise<void>;
  startQuizGeneration: (resourceId: string, fullText: string, count: number, difficulty: string, authToken: string) => Promise<void>;
  startSyllabusQuizGeneration: (jobId: string, knowledgePoints: KnowledgePoint[], count: number, difficulty: string, type: string, subQuestionCount: number, authToken: string, customPrompt?: string) => Promise<void>;
  startBatchEvaluationJob: (submissionId: string, segments: { id: string, text: string }[], audioBlob: Blob, azureKey: string, azureRegion: string, authToken: string) => Promise<void>;
  clearJob: (jobId: string) => void;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export const useJobs = () => {
  const context = useContext(JobContext);
  if (!context) throw new Error('useJobs must be used within a JobProvider');
  return context;
};

// [FIX] 使用 React.FC 并明确定义 children 属性，解决 TSX 中使用该组件时提示 children 缺失的编译错误
export const JobProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jobs, setJobs] = useState<Record<string, Job>>({});

  const updateJob = (jobId: string, updates: Partial<Job>) => {
    setJobs(prev => ({
      ...prev,
      [jobId]: { ...prev[jobId], ...updates }
    }));
  };

  const startAzureJob = useCallback(async (resource: MediaResource, apiKey: string, region: string) => {
    const jobId = resource.id; // Using resourceId as jobId for editing tasks
    
    setJobs(prev => ({
      ...prev,
      [jobId]: { resourceId: resource.id, type: 'azure', status: 'processing', message: 'Azure Speech: 初始化转写服务...' }
    }));

    try {
      if (!resource.videoUrl) throw new Error("Resource has no video URL");

      const response = await fetch(resource.videoUrl);
      const blob = await response.blob();

      const { words, formattedText } = await transcribeAudioWithAzure(blob, apiKey, region, (progressMsg) => {
        updateJob(jobId, { message: `Azure Speech: ${progressMsg}` });
      });

      updateJob(jobId, { message: '正在对齐时间轴...' });
      
      const sentences = formattedText.match(/[^.!?]+[.!?]+["']?|[^.!?]+$/g) || [formattedText];
      const cleanSentences = sentences.map(s => s.trim()).filter(s => s.length > 0);
      // [FIX] Removed incorrect parameter labels (rawAzureWords:, textWithNewlines:) which caused TS errors
      const alignedSegments = alignTextToAzureWords(words, cleanSentences.join('\n'));

      updateJob(jobId, {
        status: 'completed',
        message: '转写完成',
        result: {
          segments: alignedSegments,
          rawAzureWords: words,
          fullText: formattedText
        }
      });

    } catch (error: any) {
      console.error(error);
      updateJob(jobId, { status: 'error', error: error.message || 'Azure transcription failed' });
    }
  }, []);

  const startGeminiJob = useCallback(async (resourceId: string, segments: TranscriptSegment[], authToken: string) => {
    const jobId = resourceId;
    setJobs(prev => ({
      ...prev,
      [jobId]: { resourceId, type: 'gemini', status: 'processing', message: 'Gemini 3 Flash: AI 翻译引擎启动中...' }
    }));

    try {
      if (segments.length === 0) throw new Error("No segments to translate");

      const translatedSegments = await translateSegmentsWithWorker(segments, authToken);

      updateJob(jobId, {
        status: 'completed',
        message: '翻译完成',
        result: {
          segments: translatedSegments
        }
      });

    } catch (error: any) {
      console.error(error);
      updateJob(jobId, { status: 'error', error: error.message || 'Gemini translation failed' });
    }
  }, []);

  const startAudioShakeJob = useCallback(async (resourceId: string) => {
    const jobId = resourceId;
    setJobs(prev => ({
      ...prev,
      [jobId]: { resourceId, type: 'audioshake', status: 'processing', message: 'AudioShake: 正在进行人声分离...' }
    }));

    setTimeout(() => {
        updateJob(jobId, { 
            status: 'completed', 
            message: '分离完成', 
            result: {} 
        });
    }, 3000);
  }, []);

  const startQuizGeneration = useCallback(async (resourceId: string, fullText: string, count: number, difficulty: string, authToken: string) => {
    const jobId = resourceId;
    setJobs(prev => ({
      ...prev,
      [jobId]: { resourceId, type: 'quiz', status: 'processing', message: `Gemini: 正在生成 ${count} 道 ${difficulty} 级题目...` }
    }));

    const worker = createAiWorker();
    const wId = Date.now().toString();

    worker.onmessage = (e) => {
      const { type, id: msgId, result, error } = e.data;
      if (msgId !== wId) return;

      if (type === 'SUCCESS') {
        worker.terminate();
        updateJob(jobId, {
          status: 'completed',
          message: '题库生成完成',
          result: {
            questions: result
          }
        });
      } else if (type === 'ERROR') {
        worker.terminate();
        updateJob(jobId, { status: 'error', error: error || 'Quiz generation failed' });
      }
    };

    worker.postMessage({
      type: 'GEMINI_GENERATE_QUIZ',
      id: wId,
      payload: { fullText, count, difficulty, apiKey: authToken }
    });

  }, []);

  const startSyllabusQuizGeneration = useCallback(async (jobId: string, knowledgePoints: KnowledgePoint[], count: number, difficulty: string, type: string, subQuestionCount: number, authToken: string, customPrompt?: string) => {
    setJobs(prev => ({
      ...prev,
      [jobId]: { resourceId: jobId, type: 'quiz', status: 'processing', message: `Gemini: 正在针对知识点生成 ${count} 道题目...` }
    }));

    const worker = createAiWorker();
    const wId = Date.now().toString();

    const timeoutMs = 180_000;
    const timeoutHandle: ReturnType<typeof setTimeout> = setTimeout(() => {
      worker.terminate();
      updateJob(jobId, {
        status: 'error',
        error: `生成超时（>${timeoutMs / 1000}s）。可能是 Gemini 请求失败、网络受限或 Worker 脚本异常。请刷新页面后重试。`
      });
    }, timeoutMs);

    worker.onmessage = (e) => {
      const { type, id: msgId, result, error, progress, payload } = e.data;
      if (msgId !== wId) return;

      if (type === 'PROGRESS') {
        updateJob(jobId, { message: progress || payload || '生成中...' });
        return;
      }

      clearTimeout(timeoutHandle);

      if (type === 'SUCCESS') {
        worker.terminate();
        updateJob(jobId, {
          status: 'completed',
          message: '题库生成完成',
          result: {
            questions: result
          }
        });
      } else if (type === 'ERROR') {
        worker.terminate();
        updateJob(jobId, { status: 'error', error: error || 'Syllabus quiz generation failed' });
      }
    };

    worker.onerror = (err) => {
      clearTimeout(timeoutHandle);
      worker.terminate();
      const msg = (err instanceof ErrorEvent) ? err.message : 'Worker failed to load/execute.';
      updateJob(jobId, { status: 'error', error: `Worker 错误：${msg}` });
    };

    worker.postMessage({
      type: 'GEMINI_GENERATE_SYLLABUS_QUIZ',
      id: wId,
      payload: { knowledgePoints, count, difficulty, type, subQuestionCount, apiKey: authToken, customPrompt }
    });
  }, []);

  const startBatchEvaluationJob = useCallback(async (submissionId: string, segments: { id: string, text: string }[], audioBlob: Blob, azureKey: string, azureRegion: string, authToken: string) => {
    const jobId = `eval-${submissionId}`;
    setJobs(prev => ({
      ...prev,
      [jobId]: { resourceId: submissionId, type: 'eval', status: 'processing', message: 'Azure Speech: 正在进行语音多维度评分...' }
    }));

    const worker = createAiWorker();
    const wId = Date.now().toString();

    // Combine all segment texts into one reference text for full assessment
    const fullReferenceText = segments.map(s => s.text).join(' ');

    worker.onmessage = (e) => {
      const { type, id: msgId, result, error, progress } = e.data;
      if (msgId !== wId) return;

      if (type === 'PROGRESS') {
          updateJob(jobId, { message: progress });
      } else if (type === 'SUCCESS') {
        worker.terminate();
        updateJob(jobId, {
          status: 'completed',
          message: '评分完成',
          result: result
        });
      } else if (type === 'ERROR') {
        worker.terminate();
        updateJob(jobId, { status: 'error', error: error || 'Evaluation failed' });
      }
    };

    worker.postMessage({
      type: 'AZURE_ASSESS_FULL',
      id: wId,
      payload: { 
          audioBlob, 
          referenceText: fullReferenceText,
          key: azureKey,
          region: azureRegion,
          geminiKey: authToken
      }
    });
  }, []);

  const clearJob = useCallback((jobId: string) => {
    setJobs(prev => {
      const copy = { ...prev };
      delete copy[jobId];
      return copy;
    });
  }, []);

  return (
    <JobContext.Provider value={{ jobs, startAzureJob, startGeminiJob, startAudioShakeJob, startQuizGeneration, startSyllabusQuizGeneration, startBatchEvaluationJob, clearJob }}>
      {children}
    </JobContext.Provider>
  );
};
