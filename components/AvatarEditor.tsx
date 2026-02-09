import React, { useState, useRef, useEffect } from 'react';
import { X, Check, Minus, Plus, Move, Loader2 } from 'lucide-react';
import { uploadAvatar } from '../services/api/client';

interface AvatarEditorProps {
  image: string; // Data URL
  onCrop: (croppedImage: string) => void; // 返回 CDN URL 或 DataURL（fallback）
  onCancel: () => void;
}

const AvatarEditor: React.FC<AvatarEditorProps> = ({ image, onCrop, onCancel }) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isUploading, setIsUploading] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleConfirm = async () => {
    if (!imageRef.current || !canvasRef.current) return;
    
    setIsUploading(true);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setIsUploading(false);
      return;
    }

    const size = 400; // Output size
    canvas.width = size;
    canvas.height = size;

    // Clear canvas
    ctx.clearRect(0, 0, size, size);

    // Calculate dimensions
    const img = imageRef.current;
    const container = containerRef.current!;
    const containerSize = container.offsetWidth;
    
    // Scale factor from container to final canvas
    const scale = size / containerSize;

    const drawWidth = img.naturalWidth * (img.offsetWidth / img.naturalWidth) * zoom * scale;
    const drawHeight = img.naturalHeight * (img.offsetHeight / img.naturalHeight) * zoom * scale;
    
    // dx/dy = offset from canvas top-left
    const dx = (position.x + (containerSize / 2) - (img.offsetWidth * zoom / 2)) * scale;
    const dy = (position.y + (containerSize / 2) - (img.offsetHeight * zoom / 2)) * scale;

    ctx.drawImage(img, dx, dy, drawWidth, drawHeight);

    // 转换为 Blob 并上传到 R2
    canvas.toBlob(async (blob) => {
      if (!blob) {
        console.error('Failed to create blob from canvas');
        const fallbackDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCrop(fallbackDataUrl);
        setIsUploading(false);
        return;
      }
      
      try {
        const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' });
        const cdnUrl = await uploadAvatar(file);
        onCrop(cdnUrl); // 返回 R2 CDN URL
      } catch (error) {
        console.error('Failed to upload avatar:', error);
        // Fallback to DataURL
        const fallbackDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onCrop(fallbackDataUrl);
      } finally {
        setIsUploading(false);
      }
    }, 'image/jpeg', 0.8);
  };

  // Center image on load
  useEffect(() => {
    if (imageRef.current) {
        // We don't need to do much here if we use CSS transform
    }
  }, [image]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col border dark:border-slate-800">
        <div className="p-6 border-b dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center text-indigo-600">
              <Move size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 dark:text-white">调整头像</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">拖动图片调整位置</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 flex flex-col items-center gap-8">
          {/* Circular Masking Area */}
          <div 
            ref={containerRef}
            className="relative w-64 h-64 rounded-full border-4 border-indigo-100 dark:border-slate-800 shadow-inner overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-move touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
          >
            <img 
              ref={imageRef}
              src={image} 
              alt="Avatar candidate"
              className="absolute pointer-events-none transition-transform duration-75"
              style={{
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                maxWidth: 'none',
                height: '100%',
                display: 'block'
              }}
              draggable={false}
            />
            {/* Guide Grid */}
            <div className="absolute inset-0 border border-white/20 pointer-events-none rounded-full"></div>
          </div>

          {/* Controls */}
          <div className="w-full space-y-6">
            <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border dark:border-slate-800">
              <Minus size={16} className="text-slate-400" />
              <input 
                type="range" 
                min="0.5" 
                max="3" 
                step="0.01" 
                value={zoom} 
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 h-1.5 bg-indigo-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <Plus size={16} className="text-slate-400" />
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={onCancel}
                disabled={isUploading}
                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                取消
              </button>
              <button 
                onClick={handleConfirm}
                disabled={isUploading}
                className="flex-[2] py-3 text-sm font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    上传中...
                  </>
                ) : (
                  <>
                    <Check size={18} />
                    确认保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Hidden Canvas */}
        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
};

export default AvatarEditor;
