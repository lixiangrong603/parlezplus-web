/**
 * R2 Bucket 迁移脚本
 * 将 parlezplus-media bucket 中的所有对象复制到 fluide bucket
 * 
 * 使用前请先设置环境变量或在下方填入 credentials
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// ============================================
// 配置 - 请填入你的 R2 credentials
// ============================================
const CONFIG = {
  accountId: '65f30ce18e94f4485a7ed7dff78a3915', // 你的 Cloudflare Account ID
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '', // 通过环境变量提供
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '', // 通过环境变量提供
  sourceBucket: 'parlezplus-media',
  targetBucket: 'fluide',
};

// S3 客户端配置
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: CONFIG.accessKeyId,
    secretAccessKey: CONFIG.secretAccessKey,
  },
});

async function listAllObjects(bucket) {
  const objects = [];
  let continuationToken = undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: bucket,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);
    
    if (response.Contents) {
      objects.push(...response.Contents);
    }
    
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return objects;
}

async function copyObject(key) {
  try {
    // 从源 bucket 获取对象
    const getCommand = new GetObjectCommand({
      Bucket: CONFIG.sourceBucket,
      Key: key,
    });
    
    const getResponse = await s3Client.send(getCommand);
    
    // 读取对象内容
    const bodyContents = await streamToBuffer(getResponse.Body);
    
    // 上传到目标 bucket
    const putCommand = new PutObjectCommand({
      Bucket: CONFIG.targetBucket,
      Key: key,
      Body: bodyContents,
      ContentType: getResponse.ContentType,
    });
    
    await s3Client.send(putCommand);
    
    console.log(`✓ 已复制: ${key}`);
    return true;
  } catch (error) {
    console.error(`✗ 复制失败: ${key} - ${error.message}`);
    return false;
  }
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function migrate() {
  console.log('=== R2 Bucket 迁移工具 ===\n');
  
  // 验证 credentials
  if (!CONFIG.accessKeyId || !CONFIG.secretAccessKey) {
    console.error('错误: 请先设置 R2 API credentials');
    console.log('\n设置方式:');
    console.log('1. 编辑此脚本，填入 accessKeyId 和 secretAccessKey');
    console.log('2. 或设置环境变量: R2_ACCESS_KEY_ID 和 R2_SECRET_ACCESS_KEY');
    console.log('\n获取 Token: https://dash.cloudflare.com/?to=/:account/r2/api-tokens');
    process.exit(1);
  }

  console.log(`源 Bucket: ${CONFIG.sourceBucket}`);
  console.log(`目标 Bucket: ${CONFIG.targetBucket}\n`);

  // 列出所有对象
  console.log('正在列出源 bucket 中的对象...');
  const objects = await listAllObjects(CONFIG.sourceBucket);
  
  if (objects.length === 0) {
    console.log('源 bucket 为空，无需迁移');
    return;
  }
  
  console.log(`找到 ${objects.length} 个对象\n`);
  
  // 显示对象列表
  console.log('对象列表:');
  objects.forEach((obj, index) => {
    const sizeMB = (obj.Size / 1024 / 1024).toFixed(2);
    console.log(`  ${index + 1}. ${obj.Key} (${sizeMB} MB)`);
  });
  
  console.log('\n开始迁移...\n');
  
  // 复制所有对象
  let successCount = 0;
  let failCount = 0;
  
  for (const obj of objects) {
    const success = await copyObject(obj.Key);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
  }
  
  console.log('\n=== 迁移完成 ===');
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);
  
  if (failCount === 0) {
    console.log('\n所有对象已成功迁移到新 bucket！');
    console.log('你现在可以安全地删除旧 bucket: npx wrangler r2 bucket delete parlezplus-media');
  }
}

migrate().catch(console.error);
