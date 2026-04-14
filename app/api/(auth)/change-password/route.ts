import { NextRequest, NextResponse } from 'next/server';

import { updateUserPasswordWithCurrent } from '@/db/repository/updateUserPassword';
import { buildValidationError } from '@/utils/api/validation';
import getMe from '@/utils/middlewares/useMe';
import { changePasswordSchema } from '@/validators/auth.schema';

export async function POST(request: NextRequest) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(buildValidationError(parsed.error), { status: 400 });
    }

    const result = await updateUserPasswordWithCurrent(
      me.user.email,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error changing password: ${String(error)}` },
      { status: 500 }
    );
  }
}
