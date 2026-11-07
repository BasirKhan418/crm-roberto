import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createInteraction, listClientInteractions } from '@/db/repository/interaction';
import { getClientById } from '@/db/repository/client';
import { buildValidationError } from '@/utils/api/validation';
import { createI18nKey as i18nKey } from '@/lib/i18n/messages';
import { authorizeCompanyRoute } from '@/lib/company-route-access';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const createInteractionSchema = z.object({
  type: z.enum(['call', 'meeting', 'email', 'discussion']),
  title: z.string().trim().min(1, i18nKey('validation.titleRequired')),
  notes: z.string().trim().optional().nullable(),
  date: z.string().min(1, i18nKey('validation.dateRequired')),
  followUpDate: z.string().optional().nullable(),
});

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const access = await authorizeCompanyRoute({ moduleKey: 'clients', action: 'view' });
    if (!access.success) {
      return access.response;
    }
    const companyUserIds = access.companyUserIds.map(String);

    const { id } = await params;

    const client = await getClientById(companyUserIds, id);
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    const interactions = await listClientInteractions(companyUserIds, id);

    return NextResponse.json({ success: true, data: interactions });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error fetching interactions: ${String(error)}` },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const access = await authorizeCompanyRoute({ moduleKey: 'clients', action: 'edit' });
    if (!access.success) {
      return access.response;
    }
    const { user } = access;
    const companyUserIds = access.companyUserIds.map(String);

    const { id } = await params;

    const client = await getClientById(companyUserIds, id);
    if (!client) {
      return NextResponse.json({ success: false, message: 'Client not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createInteractionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error, i18nKey('validation.validationError')), { status: 400 });
    }

    const interaction = await createInteraction(user.id, companyUserIds, id, parsed.data);

    return NextResponse.json({ success: true, data: interaction }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error creating interaction: ${String(error)}` },
      { status: 500 },
    );
  }
}
