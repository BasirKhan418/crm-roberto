import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createAttachment, listClientAttachments } from '@/db/repository/attachment';
import { getClientById } from '@/db/repository/client';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { createI18nKey as i18nKey } from '@/lib/i18n/messages';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createAttachmentSchema = z.object({
  fileName: z.string().trim().min(1, i18nKey('validation.fileNameRequired')),
  fileUrl: z.string().trim().url(i18nKey('validation.invalidFileUrl')),
  fileType: z.string().trim().optional().nullable(),
  fileSize: z.number().positive().optional().nullable(),
  s3Key: z.string().trim().optional().nullable(),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const client = await getClientById(me.user.id, id);
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    const attachments = await listClientAttachments(me.user.id, id);

    return NextResponse.json({ success: true, data: attachments });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching attachments: ${String(error)}` },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const client = await getClientById(me.user.id, id);
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createAttachmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error, i18nKey('validation.validationError')), { status: 400 });
    }

    const attachment = await createAttachment(me.user.id, id, parsed.data);

    return NextResponse.json({ success: true, data: attachment }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating attachment: ${String(error)}` },
      { status: 500 },
    );
  }
}
