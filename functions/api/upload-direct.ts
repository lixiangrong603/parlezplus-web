import type { Env } from '../../types/worker';
import { errorResponse, getUserFromRequest, jsonResponse } from '../utils';

type DirectUploadRequest = {
  folder: string;
  fileName: string;
  contentType?: string;
};

const VALID_FOLDERS = ['avatars', 'videos', 'audios', 'covers', 'recordings', 'questions'];

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return toHex(digest);
}

async function hmacSha256(key: Uint8Array, message: string): Promise<ArrayBuffer> {
  const keyBuffer = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer;
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return sig;
}

function encodePathSegment(segment: string): string {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`);
}

function buildCanonicalUri(bucket: string, key: string): string {
  const keyParts = key.split('/').map(encodePathSegment).join('/');
  return `/${encodePathSegment(bucket)}/${keyParts}`;
}

function extractVersionFromKey(key: string): string {
  const fileName = key.split('/').pop() || '';
  const match = fileName.match(/^(\d{10,})[_-]/);
  return match ? match[1] : Date.now().toString();
}

export async function onRequestPost(context: any): Promise<Response> {
  const { request, env } = context as { request: Request; env: Env };

  try {
    const user = await getUserFromRequest(request, env);
    if (!user) return errorResponse('未授权', 401);

    if ((env.R2_DIRECT_UPLOAD_ENABLED || '').toLowerCase() !== 'true') {
      return errorResponse('直传未启用', 400);
    }

    const accountId = env.R2_ACCOUNT_ID || '';
    const accessKeyId = env.R2_ACCESS_KEY_ID || '';
    const secretAccessKey = env.R2_SECRET_ACCESS_KEY || '';

    if (!accountId || !accessKeyId || !secretAccessKey) {
      return errorResponse('直传配置不完整，请设置 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY', 500);
    }

    let payload: DirectUploadRequest;
    try {
      payload = (await request.json()) as DirectUploadRequest;
    } catch {
      return errorResponse('请求体必须是 JSON', 400);
    }
    const folder = payload?.folder;
    const fileName = (payload?.fileName || '').trim();
    const contentType = (payload?.contentType || 'application/octet-stream').trim();

    if (!folder || !VALID_FOLDERS.includes(folder)) {
      return errorResponse('无效的文件夹类型', 400);
    }

    if (!fileName) {
      return errorResponse('缺少文件名', 400);
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).slice(2, 8);
    const extension = fileName.split('.').pop() || 'bin';
    const r2Key = `${folder}/${user.id}/${timestamp}_${randomId}.${extension}`;

    let cacheControl = 'public, max-age=3600';
    if (folder === 'avatars' || folder === 'covers') {
      cacheControl = 'public, max-age=31536000, immutable';
    } else if (folder === 'videos' || folder === 'audios') {
      cacheControl = 'public, max-age=2592000, immutable';
    }

    const host = `${accountId}.r2.cloudflarestorage.com`;
    const bucket = 'fluide';
    const canonicalUri = buildCanonicalUri(bucket, r2Key);

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/auto/s3/aws4_request`;

    const queryParams = new URLSearchParams({
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${accessKeyId}/${scope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': '900',
      'X-Amz-SignedHeaders': 'host',
    });

    const canonicalQueryString = queryParams.toString();
    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      scope,
      await sha256Hex(canonicalRequest),
    ].join('\n');

    const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateStamp);
    const kRegion = await hmacSha256(new Uint8Array(kDate), 'auto');
    const kService = await hmacSha256(new Uint8Array(kRegion), 's3');
    const kSigning = await hmacSha256(new Uint8Array(kService), 'aws4_request');
    const signature = toHex(await hmacSha256(new Uint8Array(kSigning), stringToSign));

    const uploadUrl = `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;

    const mediaBaseUrl = (env.MEDIA_BASE_URL || '').trim().replace(/\/$/, '');
    const version = extractVersionFromKey(r2Key);
    const cdnUrl = mediaBaseUrl
      ? `${mediaBaseUrl}/${r2Key}?v=${version}`
      : `/api/media/${r2Key}?v=${version}`;

    return jsonResponse({
      r2_key: r2Key,
      upload_url: uploadUrl,
      upload_headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      },
      cdn_url: cdnUrl,
      expires_in: 900,
    });
  } catch (error) {
    console.error('upload-direct error:', error);
    const message = error instanceof Error ? error.message : '未知错误';
    return errorResponse(`生成直传链接失败: ${message}`, 500);
  }
}
