# 媒体文件加载优化指南

## 已实施的优化

### 1. R2 存储优化 ✅
- ✅ 切换到亚太地区 R2 bucket（fluide）
- ✅ 绑定自定义域名 `https://media.fluide.top`
- ✅ 生产环境直连 CDN，不经过 Worker
- ✅ 上传时设置合理的 Cache-Control 头

### 2. 前端加载优化 ✅
- ✅ Video 元素添加 `preload="metadata"` - 预加载元数据（时长、尺寸等）
- ✅ 添加 `crossOrigin="anonymous"` - 允许 CDN 跨域缓存
- ✅ 添加 `<link rel="prefetch">` - 浏览器预取资源
- ✅ Audio BGM 使用 `preload="auto"` - 完全预加载音频

## 进一步优化建议

### 3. 视频文件编码优化（最重要）

**检查当前视频编码：**
```bash
# 使用 ffprobe 检查视频信息
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,bit_rate,r_frame_rate -of default=noprint_wrappers=1 your-video.mp4
```

**推荐编码设置：**
```bash
# 使用 H.264 + AAC，优化 Web 播放
ffmpeg -i input.mp4 -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k -movflags +faststart output.mp4
```

**关键参数说明：**
- `-crf 23`: 质量控制（18-28，数字越小质量越高，文件越大）
- `-preset medium`: 编码速度（ultrafast/fast/medium/slow/veryslow）
- `-movflags +faststart`: **关键！** 将元数据移到文件开头，允许边下载边播放
- `-b:a 128k`: 音频码率（通常 128k 足够）

### 4. 视频分辨率优化

**根据使用场景选择合适分辨率：**
```bash
# 移动端优先：720p (省流量)
ffmpeg -i input.mp4 -vf scale=-2:720 -c:v libx264 -crf 23 -movflags +faststart output_720p.mp4

# 桌面端：1080p
ffmpeg -i input.mp4 -vf scale=-2:1080 -c:v libx264 -crf 23 -movflags +faststart output_1080p.mp4
```

### 5. 自适应码率流（HLS/DASH）

如果视频较多且用户群体网络条件差异大，可以考虑 HLS：

```bash
# 生成 HLS 多码率流
ffmpeg -i input.mp4 \
  -vf scale=-2:720 -c:v libx264 -b:v 2500k -c:a aac -b:a 128k -hls_time 4 -hls_playlist_type vod output_720p.m3u8 \
  -vf scale=-2:480 -c:v libx264 -b:v 1000k -c:a aac -b:a 96k -hls_time 4 -hls_playlist_type vod output_480p.m3u8
```

然后使用 hls.js 播放器（需要额外集成）。

### 6. 封面图片优化

**使用 WebP 格式 + 适当压缩：**
```bash
# 转换为 WebP
ffmpeg -i cover.jpg -quality 85 cover.webp

# 或者生成多尺寸
convert cover.jpg -resize 800x800\> -quality 85 cover_800.webp
convert cover.jpg -resize 400x400\> -quality 85 cover_400.webp
```

### 7. CDN 缓存预热

首次访问总是慢（CDN 未缓存），可以预热：

```bash
# 批量请求所有媒体 URL，让 CDN 缓存
curl -I https://media.fluide.top/videos/xxx.mp4
curl -I https://media.fluide.top/covers/yyy.jpg
```

### 8. 检查实际网络情况

**浏览器开发者工具诊断：**
1. 打开 DevTools → Network 标签
2. 播放视频，观察：
   - **TTFB (Time To First Byte)**: 应该 < 500ms
   - **Content Download**: 取决于文件大小和带宽
   - **Status Code**: 应该是 200（首次）或 304（缓存）
   - **Response Headers**: 检查 `Cache-Control`、`CF-Cache-Status`

**如果 TTFB 过高（> 1s）：**
- 可能是 R2 到用户之间的网络路由问题
- 尝试在不同地区/网络测试
- 考虑使用 Cloudflare Images（自动优化）或其他专业视频 CDN

### 9. 前端体验优化

**添加加载状态提示：**
```tsx
const [isLoading, setIsLoading] = useState(true);

<video 
  onLoadStart={() => setIsLoading(true)}
  onCanPlay={() => setIsLoading(false)}
  // ... other props
/>

{isLoading && (
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white"></div>
  </div>
)}
```

**使用 Intersection Observer 懒加载：**
只有视频进入视口时才加载，节省带宽。

### 10. 监控和分析

**添加性能监控：**
```tsx
videoRef.current?.addEventListener('loadstart', () => {
  console.time('video-load-time');
});

videoRef.current?.addEventListener('canplay', () => {
  console.timeEnd('video-load-time');
});
```

## 快速诊断清单

- [ ] 视频是否使用了 `-movflags +faststart`？（最重要）
- [ ] 视频码率是否合理？（720p 建议 2-3Mbps，1080p 4-5Mbps）
- [ ] 视频时长是否过长？（建议分段或使用 HLS）
- [ ] 封面图是否过大？（建议 < 200KB）
- [ ] 是否在正确的域名加载？（应该是 `media.fluide.top`）
- [ ] CDN 缓存是否生效？（查看 `CF-Cache-Status` 响应头）
- [ ] 用户网络环境如何？（移动网络 vs WiFi）

## 部署新优化

```bash
# 1. 重新构建
npm run build

# 2. 部署到 Cloudflare Pages
npx wrangler pages deploy dist --project-name=fluide --commit-dirty=true

# 3. 等待部署完成，测试实际加载速度
```

## 下一步行动

1. **立即生效**：重新部署前端（应用刚才的 preload/crossOrigin 优化）
2. **中期优化**：用 ffmpeg 重新编码现有视频（添加 `-movflags +faststart`）
3. **长期优化**：考虑 HLS 自适应流或专业视频 CDN（如 Cloudflare Stream）
