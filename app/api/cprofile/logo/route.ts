import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { NextRequest, NextResponse } from 'next/server';

import { getCompanyProfileByUserId, updateCompanyLogoByUserId } from '@/db/repository/cprofile';
import s3 from '@/utils/s3/s3Client';
import getMe from '@/utils/middlewares/useMe';

const BUCKET = process.env.AWS_S3_BUCKET || '';

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as { logoUrl?: string; logoKey?: string };
    const logoUrl = (body.logoUrl || '').trim();
    const logoKey = (body.logoKey || '').trim();

    if (!logoUrl || !logoKey) {
      return NextResponse.json(
        { success: false, message: 'logoUrl and logoKey are required' },
        { status: 400 }
      );
    }

    const existing = await getCompanyProfileByUserId(me.user.id);
    if (
      existing.success &&
      existing.profile &&
      'logoKey' in existing.profile &&
      existing.profile.logoKey &&
      existing.profile.logoKey !== logoKey
    ) {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: existing.profile.logoKey as string,
        })
      );
    }

    const result = await updateCompanyLogoByUserId(me.user.id, logoUrl, logoKey);
    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Logo updated', logoUrl, logoKey });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error updating logo: ${String(error)}` },
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
