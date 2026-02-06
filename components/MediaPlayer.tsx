
import React, { useState, useEffect } from 'react';
import { MediaResource, RecorderState } from '../types';
import { Download, Film } from 'lucide-react';

// Icons needed for MediaPlayer
const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="6 3 20 12 6 21 6 3"/></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;

interface MediaPlayerProps {
  resource: MediaResource;
  videoRef: React.RefObject<HTMLVideoElement>;
  bgmRef: React.RefObject<HTMLAudioElement>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  isPreviewingMovie: boolean;
  userAudioUrl: string | null;
  recorderState: RecorderState;

  // Optional UI/behavior controls
  hideExportButton?: boolean;
  hideMoviePreviewButton?: boolean;
  controlsDisabled?: boolean;
  
  // Handlers
  onTimeUpdate: () => void;
  onLoadedMetadata: (e: React.SyntheticEvent<HTMLVideoElement>) => void;
  onEnded: () => void;
  onTogglePlay: () => void;
  onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onToggleSpeed: (e: React.MouseEvent) => void;
  onExport: (e: React.MouseEvent) => void;
  onToggleMoviePreview: (e: React.MouseEvent) => void;
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({
  resource,
  videoRef,
  bgmRef,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  isPreviewingMovie,
  userAudioUrl,
  recorderState,
  hideExportButton = false,
  hideMoviePreviewButton = false,
  controlsDisabled = false,
  onTimeUpdate,
  onLoadedMetadata,
  onEnded,
  onTogglePlay,
  onSeek,
  onToggleSpeed,
  onExport,
  onToggleMoviePreview
}) => {
  const [isAudioDetected, setIsAudioDetected] = useState(false);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Robust detection for Audio files
  useEffect(() => {
    if (!resource.videoUrl) {
      setIsAudioDetected(false);
      return;
    }
    const hasAudioExtension = /\.(mp3|wav|ogg|m4a|aac)(\?.*)?$/i.test(resource.videoUrl);
    if (hasAudioExtension) {
      setIsAudioDetected(true);
    } else {
      setIsAudioDetected(false);
    }
  }, [resource.videoUrl]);

  const handleLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const el = e.currentTarget;
    if (el.videoHeight === 0 || el.videoWidth === 0) {
      setIsAudioDetected(true);
    }
    if (onLoadedMetadata) {
      onLoadedMetadata(e);
    }
  };

  return (
    <>
      {/* Hidden BGM Audio */}
      {resource.backingTrackUrl && (
        <audio ref={bgmRef} src={resource.backingTrackUrl} preload="auto" />
      )}

      {/* Media Container: ALWAYS aspect-video */}
      <div className="relative bg-black w-full flex-shrink-0 group overflow-hidden transition-all duration-500 aspect-video select-none">
        
        {/* Actual Video Element */}
        <video 
          ref={videoRef}
          src={resource.videoUrl} 
          className={`w-full h-full object-contain ${isAudioDetected ? 'hidden' : 'block'}`}
          poster={resource.coverImage}
          onTimeUpdate={onTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={onEnded}
          playsInline
        />

        {/* REFINED VINYL VIEW FOR AUDIO */}
        {isAudioDetected && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#09090b] overflow-hidden">
             {/* Disc Container */}
             <div className="relative h-[88%] aspect-square z-10">
                <div 
                    className="w-full h-full rounded-full shadow-[0_0_50px_rgba(0,0,0,0.8)] flex items-center justify-center relative overflow-hidden"
                    style={{ 
                      animation: `spin 4s linear infinite`, 
                      animationPlayState: isPlaying ? 'running' : 'paused' 
                    }}
                >
                    <img 
                      src={resource.coverImage} 
                      className="w-full h-full object-cover rounded-full" 
                      alt="Vinyl Disc"
                    />
                    <div className="absolute inset-0 rounded-full border border-white/5 pointer-events-none"></div>
                </div>
             </div>

             {/* Tone Arm */}
             <div 
                className={`absolute -top-[12%] right-[5%] w-[20%] h-[75%] z-20 origin-[60%_15%] transition-transform duration-1000 ease-in-out ${isPlaying ? 'rotate-[25deg]' : '-rotate-[30deg]'}`}
                style={{ filter: 'drop-shadow(4px 12px 8px rgba(0,0,0,0.7))' }}
             >
                <svg viewBox="0 0 100 300" className="w-full h-full overflow-visible">
                    <circle cx="60" cy="40" r="24" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
                    <circle cx="60" cy="40" r="8" fill="#1e293b" />
                    <path d="M60 40 L60 200 Q60 250 20 260" fill="none" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />
                    <g transform="translate(5, 250) rotate(15)">
                        <rect x="0" y="0" width="28" height="42" rx="6" fill="#f8fafc" stroke="#94a3b8" strokeWidth="1" />
                        <path d="M24 10 L34 8 Q40 6 42 12" fill="none" stroke="#cbd5e1" strokeWidth="3" strokeLinecap="round" />
                        <rect x="10" y="32" width="8" height="12" fill="#334155" rx="1" />
                    </g>
                </svg>
             </div>
          </div>
        )}
        
        {/* MOVIE PREVIEW OVERLAY INDICATOR - Highest Z-Index Layer 1 */}
        {isPreviewingMovie && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-[90] animate-pulse pointer-events-none">
            PREVIEW MODE (FULL)
          </div>
        )}

        {/* TOP ACTION BAR - Highest Z-Index Layer 2 (Separated from auto-hide overlay for reliability) */}
        <div className="absolute top-4 right-4 z-[90] flex items-center gap-2 pointer-events-none">
            {!hideExportButton && (
              <button
                onClick={(e) => { e.stopPropagation(); onExport(e); }}
                disabled={!userAudioUrl || controlsDisabled}
                className="backdrop-blur text-white p-2.5 rounded-full border border-white/20 bg-black/50 hover:bg-black/70 transition-all disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto active:scale-90"
                title={userAudioUrl ? "导出合成音轨 (WAV)" : "请先录音"}
              >
                <Download size={20} />
              </button>
            )}

            {!hideMoviePreviewButton && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleMoviePreview(e); }}
                disabled={!userAudioUrl || controlsDisabled}
                className={`backdrop-blur text-white text-xs font-bold px-4 py-2 rounded-full border flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed pointer-events-auto active:scale-95 ${isPreviewingMovie ? 'bg-indigo-600 border-indigo-400 shadow-lg shadow-indigo-500/30' : 'bg-black/50 hover:bg-black/70 border-white/20'}`}
              >
                <Film size={20} />
                <span className="hidden sm:inline">{isPreviewingMovie ? '停止预览' : '预览全部'}</span>
              </button>
            )}
        </div>

        {/* Controls Overlay - Main Container */}
        <div 
           className={`absolute inset-0 bg-black/40 flex flex-col justify-between z-50 transition-opacity duration-300 pointer-events-none ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}
        >
           {/* Center Play Button */}
           <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <button 
                  onClick={onTogglePlay}
                  disabled={controlsDisabled}
                  className={`w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/30 hover:scale-105 transition-all shadow-lg border border-white/10 pointer-events-auto active:scale-90 disabled:opacity-50 disabled:cursor-not-allowed ${controlsDisabled ? 'hover:scale-100 hover:bg-white/20' : ''}`}
              >
                 {isPlaying ? <PauseIcon /> : <PlayIcon />}
              </button>
           </div>
           
           {/* Bottom Progress Bar Container */}
           <div className="mt-auto p-4 bg-gradient-to-t from-black/90 to-transparent z-20 pointer-events-auto">
              <div className="flex items-center gap-3 text-xs font-medium text-white/90">
                <span className="w-8 text-right tabular-nums">{formatTime(currentTime)}</span>
                <input 
                   type="range" 
                   min="0" max={duration || 100} step="0.1" 
                   value={currentTime} onChange={onSeek}
                   disabled={controlsDisabled}
                   className={`flex-1 h-1.5 bg-white/30 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed ${controlsDisabled ? 'hover:h-1.5' : ''}`}
                 />
                 <span className="w-8 tabular-nums">{formatTime(duration)}</span>
                 
                 <button 
                   onClick={(e) => { e.stopPropagation(); onToggleSpeed(e); }} 
                   disabled={controlsDisabled}
                   className={`ml-1 bg-white/20 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-white/30 border border-white/10 min-w-[36px] active:scale-90 transition-transform disabled:opacity-50 disabled:cursor-not-allowed ${controlsDisabled ? 'hover:bg-white/20' : ''}`}
                 >
                   {playbackRate}x
                 </button>
              </div>
           </div>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default MediaPlayer;
