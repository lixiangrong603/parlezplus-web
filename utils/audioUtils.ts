
import { TranscriptSegment } from "../types";

export function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples.length * 2, true);

    const length = samples.length;
    let offset = 44;
    for (let i = 0; i < length; i++) {
        let s = Math.max(-1, Math.min(1, samples[i]));
        s = s < 0 ? s * 0x8000 : s * 0x7FFF;
        view.setInt16(offset, s, true);
        offset += 2;
    }

    return new Blob([view], { type: 'audio/wav' });
}

export function resampleAudio(audioBuffer: Float32Array, sourceRate: number, targetRate: number): Float32Array {
  if (sourceRate === targetRate) return audioBuffer;

  const ratio = sourceRate / targetRate;
  const newLength = Math.round(audioBuffer.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const position = i * ratio;
    const index = Math.floor(position);
    const fraction = position - index;
    
    if (index + 1 < audioBuffer.length) {
      result[i] = audioBuffer[index] * (1 - fraction) + audioBuffer[index + 1] * fraction;
    } else {
      result[i] = audioBuffer[index] || 0;
    }
  }
  
  return result;
}

export const convertToWav = async (file: File | Blob): Promise<Blob> => {
  const arrayBuffer = await file.arrayBuffer();
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  
  const targetRate = 16000;
  const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
      1, audioBuffer.duration * targetRate, targetRate
  );
  
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  
  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0);
  
  return encodeWAV(channelData, targetRate);
};

export const concatenateAudioBlobs = async (blobs: Blob[]): Promise<Blob> => {
    if (blobs.length === 0) throw new Error("No blobs to concatenate");
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffers = await Promise.all(blobs.map(blob => blob.arrayBuffer().then(b => audioContext.decodeAudioData(b))));
    
    let totalLength = 0;
    audioBuffers.forEach(buffer => { totalLength += buffer.length; });

    const outputBuffer = audioContext.createBuffer(1, totalLength, audioBuffers[0].sampleRate);
    const outputData = outputBuffer.getChannelData(0);

    let offset = 0;
    audioBuffers.forEach(buffer => {
        outputData.set(buffer.getChannelData(0), offset);
        offset += buffer.length;
    });

    return encodeWAV(outputData, outputBuffer.sampleRate);
};

const findEndOfSpeech = (audioData: Float32Array, threshold: number, sampleRate: number): number => {
    const endBufferSamples = Math.floor(0.15 * sampleRate); // 150ms buffer
    for (let i = audioData.length - 1; i >= 0; i--) {
        if (Math.abs(audioData[i]) > threshold) {
            return Math.min(audioData.length, i + endBufferSamples);
        }
    }
    return 0;
};

export const stitchAudioSegments = async (
  segments: TranscriptSegment[],
  recordings: Record<string, { blob: Blob, url: string }>,
  totalDuration: number, 
  recordingDelay: number, 
  playbackRate: number, 
): Promise<Blob> => {
    const targetRate = 16000;
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const SILENCE_THRESHOLD = 0.01;

    // 1. 先进行一次预扫描，计算最终录音结束的时间点，确保 buffer 足够长
    let maxRecordedEndTime = totalDuration / playbackRate;
    
    const processedSegments = [];
    for (const segment of segments) {
        const recording = recordings[segment.id];
        if (!recording) continue;
        
        const arrayBuffer = await recording.blob.arrayBuffer();
        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        const originalData = audioBuffer.getChannelData(0);
        const resampledData = resampleAudio(originalData, audioBuffer.sampleRate, targetRate);

        const trimStartSample = Math.floor(recordingDelay * targetRate);
        const trimEndSample = findEndOfSpeech(resampledData, SILENCE_THRESHOLD, targetRate);
        const trimmedData = resampledData.slice(trimStartSample, trimEndSample);

        const stretchedStartTime = segment.startTime / playbackRate;
        const endTimeInStretchedTimeline = stretchedStartTime + (trimmedData.length / targetRate);
        
        if (endTimeInStretchedTimeline > maxRecordedEndTime) {
            maxRecordedEndTime = endTimeInStretchedTimeline;
        }

        processedSegments.push({ data: trimmedData, startTime: stretchedStartTime });
    }

    // 2. 创建动态长度的轨道
    const totalSamples = Math.ceil(maxRecordedEndTime * targetRate);
    const fullTrack = new Float32Array(totalSamples).fill(0);

    // 3. 填充数据
    for (const item of processedSegments) {
        const startSample = Math.floor(item.startTime * targetRate);
        fullTrack.set(item.data, startSample);
    }

    return encodeWAV(fullTrack, targetRate);
};

export const mixAudio = async (mainAudioBlob: Blob, bgmAudioBlob: Blob): Promise<Blob> => {
  const targetRate = 16000;
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const [mainBuffer, bgmBuffer] = await Promise.all([
    ctx.decodeAudioData(await mainAudioBlob.arrayBuffer()),
    ctx.decodeAudioData(await bgmAudioBlob.arrayBuffer())
  ]);

  const longestDurationInSamples = Math.ceil(Math.max(mainBuffer.duration, bgmBuffer.duration) * targetRate);

  const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    1, longestDurationInSamples, targetRate
  );

  const mainSource = offlineCtx.createBufferSource();
  mainSource.buffer = mainBuffer;

  const bgmSource = offlineCtx.createBufferSource();
  bgmSource.buffer = bgmBuffer;

  const bgmGain = offlineCtx.createGain();
  bgmGain.gain.value = 0.3;

  mainSource.connect(offlineCtx.destination);
  bgmSource.connect(bgmGain);
  bgmGain.connect(offlineCtx.destination);

  mainSource.start(0);
  bgmSource.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const mixedChannelData = renderedBuffer.getChannelData(0);

  return encodeWAV(mixedChannelData, targetRate);
};

// [NEW] Helper to convert Data URL to Blob
export const dataURLtoBlob = (dataurl: string): Blob => {
    const arr = dataurl.split(',');
    const match = arr[0].match(/:(.*?);/);
    const mime = match ? match[1] : 'audio/wav';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};
