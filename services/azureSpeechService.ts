
import { AzureWord } from '../types';
import { convertToWav } from '../utils/audioUtils';
import { createAiWorker } from './aiWorkerFactory';

/**
 * 结果接口更新：包含单词时间戳和格式化后的全文
 */
export interface AzureTranscribeResult {
    words: AzureWord[];
    formattedText: string;
}

/**
 * 将任意音频/视频 Blob 转换为 Azure 词级时间戳数据。
 * 使用 Web Worker 避免阻塞主线程。
 */
export const transcribeAudioWithAzure = async (
    audioFile: File | Blob, 
    apiKey: string, 
    region: string,
    onProgress: (text: string) => void
): Promise<AzureTranscribeResult> => {
    
    onProgress("正在进行格式转换 (16kHz WAV)...");
    
    let wavBlob: Blob;
    try {
        // Convert input media to the required 16kHz Mono WAV format for Azure
        wavBlob = await convertToWav(audioFile);
    } catch (e: any) {
        throw new Error(`音频转换失败: ${e.message}`);
    }
    
    onProgress("初始化 AI Worker...");

    return new Promise((resolve, reject) => {
        const worker = createAiWorker();
        const id = Date.now().toString();

        worker.onmessage = (e) => {
            const { type, id: msgId, result, error, payload } = e.data;
            if (msgId !== id) return;

            if (type === 'PROGRESS') {
                onProgress(payload);
            } else if (type === 'SUCCESS') {
                worker.terminate();
                resolve({
                    words: result.words,
                    formattedText: result.fullText
                });
            } else if (type === 'ERROR') {
                worker.terminate();
                reject(new Error(error));
            }
        };

        worker.onerror = (err) => {
            worker.terminate();
            // Handle loading errors (Event) vs runtime errors (ErrorEvent)
            const msg = (err instanceof ErrorEvent) ? err.message : 'Failed to load worker script (404 Not Found or Syntax Error). Check file paths.';
            reject(new Error(`Worker System Error: ${msg}`));
        };

        // Post message to worker with the WAV Blob directly
        // The worker will handle ArrayBuffer extraction and PushStream
        worker.postMessage({
            type: 'AZURE_TRANSCRIBE',
            id,
            payload: {
                audioBlob: wavBlob,
                key: apiKey,
                region: region
            }
        });
    });
};
