import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const isProduction = mode === 'production';
    
    return {
      base: '/', // Cloudflare Pages 部署路径
      
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      
      plugins: [
        react(),
        tailwindcss(), // Tailwind CSS v4 插件
        // 打包体积分析 (生产构建后查看 dist/stats.html)
        visualizer({
          open: false,
          filename: 'dist/stats.html',
          gzipSize: true,
          brotliSize: true
        })
      ],
      
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        '__APP_VERSION__': JSON.stringify(process.env.npm_package_version || '1.0.0'),
      },
      
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      
      build: {
        // Cloudflare Pages 推荐配置
        target: 'es2020',
        outDir: 'dist',
        assetsDir: 'static',
        
        // 代码分割策略 (关键优化!)
        rollupOptions: {
          output: {
            manualChunks: {
              // 核心框架单独打包
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              
              // 图标库单独打包
              'vendor-icons': ['lucide-react'],
              
              // 图表库懒加载 chunk (仅教师统计页面使用)
              'charts': ['recharts'],
              
              // 文档导出库懒加载 chunk
              'export': ['docx', 'exceljs', 'xlsx', 'file-saver'],
              
              // AI SDK 单独 chunk
              'ai-sdk': ['@google/genai'],
            },
            
            // 文件命名 (使用 hash 确保缓存更新)
            chunkFileNames: 'static/js/[name]-[hash].js',
            entryFileNames: 'static/js/[name]-[hash].js',
            assetFileNames: 'static/[ext]/[name]-[hash].[ext]'
          }
        },
        
        // 压缩配置
        minify: isProduction ? 'terser' : false,
        terserOptions: isProduction ? {
          compress: {
            drop_console: true, // 生产环境移除 console
            drop_debugger: true,
            pure_funcs: ['console.log', 'console.debug']
          }
        } : {},
        
        // sourcemap
        sourcemap: !isProduction,
        
        // chunk 大小告警阈值
        chunkSizeWarningLimit: 500 // KB
      },
      
      // 依赖预构建优化
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'react-router-dom',
          'lucide-react'
        ],
        exclude: [
          'microsoft-cognitiveservices-speech-sdk' // Worker 中使用，不需要预构建
        ]
      }
    };
});
