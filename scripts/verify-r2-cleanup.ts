/**
 * R2 清理验证工具
 * 用于验证数据库中已删除的记录对应的 R2 文件是否也被删除
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

interface Resource {
  id: string;
  title: string;
  video_r2_key: string | null;
  audio_r2_key: string | null;
  cover_r2_key: string | null;
  backing_track_r2_key: string | null;
  vocal_track_r2_key: string | null;
  is_deleted: number;
}

interface User {
  id: string;
  name: string;
  avatar_r2_key: string | null;
  is_deleted: number;
}

// 本地 R2 存储路径
const R2_LOCAL_PATH = join(process.cwd(), '.wrangler', 'state', 'v3', 'r2', 'fluide', 'blobs');

// 获取所有本地 R2 文件
function getLocalR2Files(): Set<string> {
  if (!existsSync(R2_LOCAL_PATH)) {
    console.log('本地 R2 存储路径不存在:', R2_LOCAL_PATH);
    return new Set();
  }
  
  const files = readdirSync(R2_LOCAL_PATH);
  console.log(`找到 ${files.length} 个本地 R2 文件`);
  return new Set(files);
}

// 解析 r2_key 获取文件名（移除路径前缀）
function getFileNameFromR2Key(r2Key: string | null): string | null {
  if (!r2Key) return null;
  // r2Key 格式如: "videos/xxx.mp4" 或 "avatars/xxx.jpg"
  // 本地存储使用 hash 作为文件名，所以我们需要检查完整路径
  return r2Key;
}

async function verifyR2Cleanup() {
  console.log('\n=== R2 清理验证工具 ===\n');
  
  // 1. 获取本地 R2 文件列表
  const localFiles = getLocalR2Files();
  console.log(`本地 R2 文件数: ${localFiles.size}\n`);
  
  // 2. 连接到本地 D1 数据库
  console.log('注意: 此工具需要在开发服务器运行时使用 API 检查');
  console.log('建议使用以下步骤验证:\n');
  
  console.log('1. 查看数据库中的软删除记录:');
  console.log('   npx wrangler d1 execute parlezplus_db --local --command="SELECT id, title, video_r2_key, is_deleted FROM resources WHERE is_deleted = 1 LIMIT 5"');
  
  console.log('\n2. 检查某个已删除资源的 R2 key:');
  console.log('   记录下 video_r2_key, audio_r2_key 等字段的值');
  
  console.log('\n3. 尝试通过 API 访问该文件:');
  console.log('   curl http://localhost:8788/api/media/{r2_key}');
  console.log('   如果返回 404，说明文件已被删除');
  
  console.log('\n4. 永久删除记录并验证:');
  console.log('   a) 在回收站中永久删除该记录');
  console.log('   b) 再次尝试访问文件 (应该返回 404)');
  console.log('   c) 检查控制台日志，查找 "Deleted R2 file:" 消息');
  
  console.log('\n5. 清空本地 R2 存储 (如果需要重新开始):');
  console.log('   rm -rf .wrangler/state/v3/r2/fluide/blobs/*');
  console.log('   或在 Windows: Remove-Item -Recurse -Force .wrangler\\state\\v3\\r2\\fluide\\blobs\\*');
  
  console.log('\n注意事项:');
  console.log('- 本地 R2 使用文件系统模拟，文件名是内容的 hash');
  console.log('- 删除操作会立即生效，但需要重启开发服务器才能看到文件系统变化');
  console.log('- 最准确的验证方式是通过 API 尝试访问文件');
  console.log('- 生产环境中，R2 删除是实时的\n');
}

verifyR2Cleanup();
