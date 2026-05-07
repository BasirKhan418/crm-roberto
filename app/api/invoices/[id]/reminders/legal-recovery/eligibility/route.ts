import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';

import ConnectDb from '@/db/connectDb';
import Invoice from '@/db/models/Invoice';
import Payment from '@/db/models/Payment';
import ReminderSettings from '@/db/models/ReminderSettings';
import {
  evaluateLegalRecoveryEligibility,
  isLegalRecoveryCourtConfigured,
  LEGAL_RECOVERY_COURT_LOCATIONS,
  resolveClaimThresholdCents,
  resolveLegalRecoveryCourtConfig,
  type LegalRecoveryCourtLocation,
  type LegalRecoverySettings,
} from '@/lib/reminders/legal-recovery';
import getMe from '@/utils/middlewares/useMe';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type InvoiceDoc = {
  _id: mongoose.Types.ObjectId;
  status?: 'unpaid' | 'partial_paid' | 'paid' | 'overdue';
  totalIncludingTax?: number | null;
  legalRecoveryCourtLocation?: LegalRecoveryCourtLocation | null;
  reminderState?: {
    level?: number | null;
    lateFeeAmount?: number | null;
    formalNoticeSentAt?: Date | null;
    formalNoticeDeadline?: Date | null;
    legalRecoveryInitiatedAt?: Date | null;
    legalRecoverySentToCourtAt?: Date | null;
    legalRecoveryRegisteredMailNumber?: string | null;
    legalRecoveryRegisteredMailDate?: Date | null;
  } | null;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const me = await getMe(true);
    if (!me.success || !me.user) {
      return NextResponse.json({ success: false, message: me.message || 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    await ConnectDb();

    const invoice = await Invoice.findOne({ _id: id, userId: me.user.id })
      .select('_id status totalIncludingTax legalRecoveryCourtLocation reminderState')
      .lean<InvoiceDoc | null>();

    if (!invoice) {
      return NextResponse.json({ success: false, message: 'Invoice not found' }, { status: 404 });
    }

    const [settingsDoc, totals] = await Promise.all([
      ReminderSettings.findOne({ userId: me.user.id }).lean<{
        legalRecovery?: LegalRecoverySettings | null;
      } | null>(),
      Payment.aggregate<{ _id: null; totalPaid: number }>([
        { $match: { invoiceId: invoice._id, userId: new mongoose.Types.ObjectId(me.user.id), status: 'succeeded' } },
        { $group: { _id: null, totalPaid: { $sum: '$amount' } } },
      ]),
    ]);

    const totalPaid = Math.max(0, Math.round(totals[0]?.totalPaid ?? 0));
    const totalIncludingTax = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
    const remainingAmount = Math.max(0, totalIncludingTax - totalPaid);
    const lateFeeAmount = Math.max(0, Math.round(invoice.reminderState?.lateFeeAmount ?? 0));
    const claimThresholdCents = resolveClaimThresholdCents(settingsDoc?.legalRecovery);

    const eligibility = evaluateLegalRecoveryEligibility({
      invoiceStatus: invoice.status ?? null,
      reminderLevel: invoice.reminderState?.level ?? 0,
      formalNoticeSentAt: invoice.reminderState?.formalNoticeSentAt ?? null,
      formalNoticeDeadline: invoice.reminderState?.formalNoticeDeadline ?? null,
      remainingAmountCents: remainingAmount + lateFeeAmount,
      claimThresholdCents,
    });

    const selectedCourtLocation = invoice.legalRecoveryCourtLocation ?? null;
    const selectedCourt = resolveLegalRecoveryCourtConfig(settingsDoc?.legalRecovery, selectedCourtLocation);
    const selectedCourtConfigured = selectedCourtLocation
      ? isLegalRecoveryCourtConfigured(selectedCourt)
      : false;

    const courts = LEGAL_RECOVERY_COURT_LOCATIONS.reduce<
      Record<LegalRecoveryCourtLocation, ReturnType<typeof resolveLegalRecoveryCourtConfig> & { configured: boolean }>
    >((accumulator, location) => {
      const court = resolveLegalRecoveryCourtConfig(settingsDoc?.legalRecovery, location);
      accumulator[location] = {
        ...court,
        configured: isLegalRecoveryCourtConfigured(court),
      };
      return accumulator;
    }, {
      luxembourg: { configured: false },
      esch_sur_alzette: { configured: false },
      diekirch: { configured: false },
    });

    return NextResponse.json({
      success: true,
      data: {
        eligible: eligibility.eligible,
        reason: eligibility.reason ?? null,
        warningReason: eligibility.warningReason ?? null,
        claimAmountCents: eligibility.claimAmountCents,
        claimThresholdCents: eligibility.claimThresholdCents,
        formalNoticeSentAt: invoice.reminderState?.formalNoticeSentAt ?? null,
        formalNoticeDeadline: invoice.reminderState?.formalNoticeDeadline ?? null,
        legalRecoveryInitiatedAt: invoice.reminderState?.legalRecoveryInitiatedAt ?? null,
        legalRecoverySentToCourtAt: invoice.reminderState?.legalRecoverySentToCourtAt ?? null,
        legalRecoveryRegisteredMailNumber: invoice.reminderState?.legalRecoveryRegisteredMailNumber ?? null,
        legalRecoveryRegisteredMailDate: invoice.reminderState?.legalRecoveryRegisteredMailDate ?? null,
        jurisdiction: settingsDoc?.legalRecovery?.jurisdiction ?? 'justice_of_peace',
        courtLocation: selectedCourtLocation,
        courtSelectionRequired: true,
        courtSelected: Boolean(selectedCourtLocation),
        courtConfigured: selectedCourtConfigured,
        selectedCourt,
        courts,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: `Error evaluating legal recovery eligibility: ${String(error)}` },
      { status: 500 }
    );
  }
}
