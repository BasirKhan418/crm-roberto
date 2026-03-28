import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NextRequest, NextResponse } from 'next/server';

import s3 from '@/utils/s3/s3Client';
import getMe from '@/utils/middlewares/useMe';

const BUCKET = process.env.AWS_S3_BUCKET || '';
const REGION = process.env.AWS_REGION || 'eu-west-3';
const URL_EXPIRES_IN_SECONDS = 60 * 5;

interface PresignBody {
  fileName?: string;
  fileType?: string;
  folder?: string;
}

function sanitizeFolder(rawFolder: string | undefined): string {
  const fallback = 'uploads';
  const folder = (rawFolder || fallback).trim();

  if (!folder) return fallback;

  const cleaned = folder
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');

  if (!cleaned || cleaned.includes('..')) {
    return fallback;
  }

  return /^[a-zA-Z0-9/_-]+$/.test(cleaned) ? cleaned : fallback;
}

function buildExtension(fileName: string, fileType: string): string {
  const fromName = fileName.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) {
    return fromName;
  }

  if (fileType === 'image/svg+xml') {
    return 'svg';
  }

  const fromType = fileType.split('/')[1]?.toLowerCase();
  return fromType && /^[a-z0-9.+-]+$/.test(fromType) ? fromType.replace('svg+xml', 'svg') : 'bin';
}

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    if (!BUCKET) {
      return NextResponse.json({ success: false, message: 'AWS_S3_BUCKET is not configured' }, { status: 500 });
    }

    const body = (await request.json()) as PresignBody;
    const fileName = (body.fileName || '').trim();
    const fileType = (body.fileType || '').trim();
    const folder = sanitizeFolder(body.folder);

    if (!fileName || !fileType) {
      return NextResponse.json({ success: false, message: 'fileName and fileType are required' }, { status: 400 });
    }

    const extension = buildExtension(fileName, fileType);
    const key = `${folder}/${me.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const putCommand = new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: fileType,
      CacheControl: 'max-age=31536000',
    });

    const uploadUrl = await getSignedUrl(s3, putCommand, { expiresIn: URL_EXPIRES_IN_SECONDS });
    const fileUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      uploadUrl,
      fileUrl,
      key,
      expiresIn: URL_EXPIRES_IN_SECONDS,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error generating upload url: ${String(error)}` },
      { status: 500 }
    );
  }
}
