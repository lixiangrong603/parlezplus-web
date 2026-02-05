
import { TranscriptSegment } from "../types";
import { createAiWorker } from './aiWorkerFactory';

/**
 * Batch translation for the Teacher Editor - Web Worker Version (Non-blocking)
 */
export const translateSegmentsWithWorker = (segments: TranscriptSegment[], apiKey: string): Promise<TranscriptSegment[]> => {
  return new Promise((resolve, reject) => {
    if (segments.length === 0) {
      resolve([]);
      return;
    }

    const worker = createAiWorker();
    const id = Date.now().toString();

    worker.onmessage = (e) => {
      const { type, id: msgId, result, error } = e.data;
      if (msgId !== id) return;

      if (type === 'SUCCESS') {
        worker.terminate();
        const translationMap = new Map<string, string>();
        if (Array.isArray(result)) {
           result.forEach((r: any) => {
             if (r && r.id !== undefined) {
                translationMap.set(String(r.id), String(r.translation || ""));
             }
           });
        }
        const updatedSegments = segments.map(seg => ({
          ...seg,
          translation: translationMap.get(seg.id) || seg.translation
        }));
        resolve(updatedSegments);
      } else if (type === 'ERROR') {
        worker.terminate();
        console.error("Worker translation error:", error);
        reject(new Error(error));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      // Handle loading errors (Event) vs runtime errors (ErrorEvent)
      const msg = (err instanceof ErrorEvent) ? err.message : 'Failed to load worker script (404 Not Found or Syntax Error). Check file paths.';
      reject(new Error(`Worker System Error: ${msg}`));
    };

    worker.postMessage({
      type: 'GEMINI_CORRECT',
      id,
      payload: {
        segments,
        apiKey: apiKey
      }
    });
  });
};
