
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

/**
 * === 头像工具函数 ===
 */

/**
 * 根据名称生成首字母（中文取第一个字，英文取第一个字母）
 * @param name 用户姓名
 * @returns 首字母
 */
export const getInitials = (name: string): string => {
  if (!name) return '?';
  
  const trimmed = name.trim();
  if (!trimmed) return '?';
  
  // 中文字符检测
  const isChinese = /[\u4e00-\u9fa5]/.test(trimmed[0]);
  
  if (isChinese) {
    // 中文：返回第一个字
    return trimmed[0];
  } else {
    // 英文：返回第一个字母的大写
    return trimmed[0].toUpperCase();
  }
};

/**
 * 根据字符串生成一致的颜色（用于头像背景）
 * @param str 输入字符串（通常是用户ID或姓名）
 * @returns HSL颜色字符串
 */
export const getColorFromString = (str: string): string => {
  if (!str) return '#6366f1'; // indigo-500
  
  // 预设的协调配色方案，与网站主题相匹配
  const themeColors = [
    '#6366f1', // indigo-500
    '#8b5cf6', // violet-500
    '#a855f7', // purple-500
    '#ec4899', // pink-500
    '#f43f5e', // rose-500
    '#10b981', // emerald-500
    '#14b8a6', // teal-500
    '#06b6d4', // cyan-500
    '#3b82f6', // blue-500
    '#6366f1', // indigo-500（重复一次增加权重）
    '#f59e0b', // amber-500
    '#ef4444', // red-500
  ];
  
  // 使用简单哈希算法确保同一字符串总是返回相同颜色
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  
  // 从预设颜色中选择一个
  const index = Math.abs(hash) % themeColors.length;
  return themeColors[index];
};

/**
 * 将文件转换为Base64字符串
 * @param file 文件对象
 * @returns Promise<string> Base64字符串
 */
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * 验证图片文件
 * @param file 文件对象
 * @returns 验证结果和错误信息
 */
export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: '仅支持 JPG、PNG 或 WEBP 格式的图片'
    };
  }
  
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    return {
      valid: false,
      error: '图片大小不能超过 5MB'
    };
  }
  
  return { valid: true };
};

/**
 * 压缩图片到指定大小
 * @param file 原始图片文件
 * @param maxWidth 最大宽度
 * @param maxHeight 最大高度
 * @param quality 质量 (0-1)
 * @returns Promise<string> 压缩后的Base64字符串
 */
export const compressImage = (
  file: File,
  maxWidth: number = 400,
  maxHeight: number = 400,
  quality: number = 0.8
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // 计算缩放比例
        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法获取canvas context'));
          return;
        }
        
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', quality);
        resolve(base64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
