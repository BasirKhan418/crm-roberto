import { DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

import { getCompanyProfileByUserId, updateCompanyLogoByUserId } from '@/db/repository/cprofile';
import s3 from '@/utils/s3/s3Client';
import getMe from '@/utils/middlewares/useMe';

const BUCKET = process.env.AWS_S3_BUCKET || '';
const REGION = process.env.AWS_REGION || 'eu-west-3';
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('logo');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Invalid file type. Accepted: JPEG, PNG, WebP, SVG' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    if (buffer.byteLength > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { success: false, message: 'File too large. Maximum size is 2 MB' },
        { status: 400 }
      );
    }

    // Delete existing logo from S3 if present
    const existing = await getCompanyProfileByUserId(me.user.id);
    if (existing.success && existing.profile && 'logoKey' in existing.profile && existing.profile.logoKey) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: existing.profile.logoKey as string,
        })
      );
    }

    const ext = file.type.split('/')[1].replace('svg+xml', 'svg');
    const key = `logos/${me.user.id}/${Date.now()}.${ext}`;

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: buffer,
        ContentType: file.type,
        CacheControl: 'max-age=31536000',
      })
    );

    const logoUrl = `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

    const result = await updateCompanyLogoByUserId(me.user.id, logoUrl, key);
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Logo uploaded', logoUrl });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error uploading logo: ${String(error)}` },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const existing = await getCompanyProfileByUserId(me.user.id);
    if (!existing.success || !existing.profile) {
      return NextResponse.json({ success: false, message: 'Company profile not found' }, { status: 404 });
    }

    const logoKey = 'logoKey' in existing.profile ? (existing.profile.logoKey as string | null) : null;

    if (!logoKey) {
      return NextResponse.json({ success: false, message: 'No logo to delete' }, { status: 400 });
    }

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: logoKey }));

    const result = await updateCompanyLogoByUserId(me.user.id, null, null);
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Logo deleted' });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error deleting logo: ${String(error)}` },
      { status: 500 }
    );
  }
}
