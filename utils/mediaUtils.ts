
/**
 * 从视频文件中截取一帧作为封面图
 * @param file 视频文件
 * @returns Promise<string> Base64 格式的图片数据
 */
export const extractVideoFrame = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      const maxWidth = 800;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      canvas.width = video.videoWidth * scale;
      canvas.height = video.videoHeight * scale;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        URL.revokeObjectURL(video.src);
        resolve(dataUrl);
      } else {
        reject(new Error("Could not get canvas context"));
      }
    };

    video.onerror = (e) => {
      URL.revokeObjectURL(video.src);
      reject(e);
    };
  });
};

/**
 * 随机生成高保真黑胶唱片封面 (完全复用 MediaPlayer 视觉逻辑)
 * @param seedStr 随机种子字符串
 * @returns Base64 格式的图片数据
 */
export const generateRandomCoverArt = (seedStr: string): string => {
  const size = 800; // 提高分辨率以保证卡片显示清晰
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const cx = size / 2;
  const cy = size / 2;
  const vinylRadius = size * 0.48; // 唱片外圆半径

  // 1. 背景 (透明，方便在各种卡片背景下显示)
  ctx.clearRect(0, 0, size, size);

  // 2. 唱片基底 (深色唱片本体)
  ctx.beginPath();
  ctx.arc(cx, cy, vinylRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#111111';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // 3. 唱片纹理 (复用 MediaPlayer 的纹理密度)
  // 模拟 repeating-radial-gradient
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, vinylRadius, 0, Math.PI * 2);
  ctx.clip();
  
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 0.5;
  for (let r = vinylRadius * 0.35; r < vinylRadius; r += 2.5) {
     ctx.beginPath();
     ctx.arc(cx, cy, r, 0, Math.PI * 2);
     ctx.stroke();
  }
  ctx.restore();

  // 4. 生成彩色标签参数
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed << 5) - seed + seedStr.charCodeAt(i);
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };

  const labelRadius = vinylRadius * 0.45; // 标签比例
  const h = Math.floor(rand() * 360);
  const s = 50 + rand() * 30; 
  const l = 40 + rand() * 20;
  const h2 = (h + 30 + rand() * 60) % 360;

  // 5. 绘制彩色标签
  const labelGradient = ctx.createLinearGradient(cx - labelRadius, cy - labelRadius, cx + labelRadius, cy + labelRadius);
  labelGradient.addColorStop(0, `hsl(${h}, ${s}%, ${l}%)`);
  labelGradient.addColorStop(1, `hsl(${h2}, ${s}%, ${l - 15}%)`);

  ctx.beginPath();
  ctx.arc(cx, cy, labelRadius, 0, Math.PI * 2);
  ctx.fillStyle = labelGradient;
  ctx.fill();
  
  // 标签内描边
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 4;
  ctx.stroke();

  // 6. 黑胶高光反射 (复用 MediaPlayer 的 Conic Gradient 逻辑)
  // 在 Canvas 中使用 conic gradient 模拟真实盘面反射
  const glossGradient = ctx.createConicGradient(0, cx, cy);
  glossGradient.addColorStop(0, 'transparent');
  glossGradient.addColorStop(0.1, 'rgba(255,255,255,0.08)');
  glossGradient.addColorStop(0.2, 'transparent');
  glossGradient.addColorStop(0.45, 'transparent');
  glossGradient.addColorStop(0.5, 'rgba(255,255,255,0.12)');
  glossGradient.addColorStop(0.55, 'transparent');
  glossGradient.addColorStop(0.8, 'transparent');
  glossGradient.addColorStop(0.9, 'rgba(255,255,255,0.08)');
  glossGradient.addColorStop(1, 'transparent');

  ctx.globalCompositeOperation = 'screen';
  ctx.beginPath();
  ctx.arc(cx, cy, vinylRadius, 0, Math.PI * 2);
  ctx.fillStyle = glossGradient;
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // 7. 中心轴孔
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.015, 0, Math.PI * 2);
  ctx.fillStyle = '#09090b';
  ctx.fill();
  
  // 轴孔高光
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.006, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fill();

  return canvas.toDataURL('image/png');
};
