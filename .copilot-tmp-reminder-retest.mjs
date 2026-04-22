import 'dotenv/config';
import dayjs from 'dayjs';

import ConnectDb from './db/connectDb.ts';
import ReminderSettings from './db/models/ReminderSettings.ts';
import Invoice from './db/models/Invoice.ts';
import Payment from './db/models/Payment.ts';
import CompanyProfile from './db/models/CompanyProfile.ts';
import { buildInvoicePayUrl, isTokenExpired } from './lib/tokens.ts';

const LEVEL_KEYS = { 1: 'soft', 2: 'medium', 3: 'firm', 4: 'formalNotice' };
const STAGE_KEYS = ['soft', 'medium', 'firm', 'formalNotice'];

function normalizeReminderLocale(value) {
	if (typeof value === 'string' && value.toLowerCase().startsWith('en')) {
		return 'en';
	}

	return 'fr';
}

function normalizeLateFeeStageConfig(stage) {
	return {
		enabled: stage?.enabled === true,
		type: stage?.type === 'fixed' ? 'fixed' : 'percentage',
		value: Math.max(0, Number(stage?.value ?? 0)),
	};
}

function hasConfiguredLateFeeStages(stages) {
	if (!stages) {
		return false;
	}

	return STAGE_KEYS.some((key) => {
		const stage = stages[key];
		if (!stage) {
			return false;
		}

		return stage.enabled === true || Math.max(0, Number(stage.value ?? 0)) > 0;
	});
}

function normalizeLateFeeStages(lateFee) {
	const stages = lateFee?.stages;
	if (stages && hasConfiguredLateFeeStages(stages)) {
		return {
			soft: normalizeLateFeeStageConfig(stages.soft),
			medium: normalizeLateFeeStageConfig(stages.medium),
			firm: normalizeLateFeeStageConfig(stages.firm),
			formalNotice: normalizeLateFeeStageConfig(stages.formalNotice),
		};
	}

	const thresholdMap = { medium: 2, firm: 3, formalNotice: 4 };
	const legacyEnabled = lateFee?.enabled === true;
	const threshold = thresholdMap[lateFee?.applyFrom ?? 'formalNotice'];
	const legacyType = lateFee?.type === 'fixed' ? 'fixed' : 'percentage';
	const legacyValue = Math.max(0, Number(lateFee?.value ?? 0));

	return {
		soft: { enabled: false, type: 'percentage', value: 0 },
		medium: { enabled: legacyEnabled && 2 >= threshold, type: legacyType, value: legacyValue },
		firm: { enabled: legacyEnabled && 3 >= threshold, type: legacyType, value: legacyValue },
		formalNotice: { enabled: legacyEnabled && 4 >= threshold, type: legacyType, value: legacyValue },
	};
}

function computeLateFeeAmountCents(remainingAmountCents, level, lateFee) {
	const stageConfig = normalizeLateFeeStages(lateFee)[LEVEL_KEYS[level]];
	if (!stageConfig.enabled) {
		return 0;
	}

	if (stageConfig.type === 'fixed') {
		return Math.max(0, Math.round(stageConfig.value * 100));
	}

	return Math.max(0, Math.round((remainingAmountCents * stageConfig.value) / 100));
}

function formatCurrency(amountCents, locale) {
	return new Intl.NumberFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
		style: 'currency',
		currency: 'EUR',
	}).format(amountCents / 100);
}

function asDate(value) {
	if (!value) {
		return null;
	}

	const parsed = new Date(value);
	return Number.isFinite(parsed.getTime()) ? parsed : null;
}

function formatDateByLocale(value, locale) {
	if (!value) {
		return '';
	}

	return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	}).format(value);
}

function buildReminderVars(invoice, companyProfile, locale, amountPaid) {
	const dueDate = asDate(invoice.dueDate);
	const invoiceDate = asDate(invoice.date);
	const invoiceTotal = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0));
	const paidAmount = Math.max(0, Math.round(amountPaid ?? 0));
	const amountDueCents = Math.max(0, invoiceTotal - paidAmount);
	const daysOverdue = dueDate ? Math.max(0, dayjs().diff(dueDate, 'day')) : 0;
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
	const hasValidToken =
		typeof invoice.paymentToken === 'string' &&
		invoice.paymentToken.trim().length > 0 &&
		!isTokenExpired(asDate(invoice.paymentTokenExpiry));
	const paymentLink = hasValidToken && appUrl ? buildInvoicePayUrl(invoice.paymentToken.trim(), appUrl) : '';

	return {
		clientName: invoice.clientSnapshot?.fullName?.trim() || 'Client',
		companyName: companyProfile?.companyName?.trim() || companyProfile?.ownerName?.trim() || 'CRM',
		invoiceNumber: invoice.invoiceNumber?.trim() || '',
		invoiceDate: formatDateByLocale(invoiceDate, locale),
		dueDate: formatDateByLocale(dueDate, locale),
		daysOverdue,
		amountDue: formatCurrency(amountDueCents, locale),
		amountOriginal: formatCurrency(invoiceTotal, locale),
		lateFees: '',
		paymentLink,
		legalDeadline: '',
		__amountDueCents: amountDueCents,
	};
}

function mergeLateFeeIntoVariables(vars, lateFeeAmountCents, locale) {
	const baseAmountDueCents = typeof vars.__amountDueCents === 'number' ? Math.max(0, Math.round(vars.__amountDueCents)) : null;

	return {
		...vars,
		amountDue:
			baseAmountDueCents === null
				? vars.amountDue
				: formatCurrency(baseAmountDueCents + Math.max(0, lateFeeAmountCents), locale),
		lateFees: lateFeeAmountCents > 0 ? formatCurrency(lateFeeAmountCents, locale) : '',
	};
}

function substituteVariables(template, vars) {
	return template.replace(/\{\{\s*([a-zA-Z][\w]*)\s*\}\}|\{\s*([a-zA-Z][\w]*)\s*\}/g, (_full, keyA, keyB) => {
		const key = keyA || keyB;
		const value = vars[key];
		return value === undefined || value === null ? '' : String(value);
	});
}

function ensureReminderBodyHasPaymentLink({ renderedBody, paymentLink, locale }) {
	if (!paymentLink) {
		return renderedBody;
	}

	if (renderedBody.includes(paymentLink)) {
		return renderedBody;
	}

	const suffix = locale === 'fr' ? `Lien de paiement: ${paymentLink}` : `Payment link: ${paymentLink}`;
	const trimmed = renderedBody.trim();

	return trimmed ? `${trimmed}\n\n${suffix}` : suffix;
}

function computeLegalDeadline(now, delayDays) {
	return dayjs(now).add(delayDays, 'day').toDate();
}

function getTemplateForLevel(templates, locale, levelKey) {
	const localized = templates?.[locale]?.[levelKey];
	if (localized?.subject && localized?.body) {
		return localized;
	}

	const fallback = templates?.fr?.[levelKey] ?? templates?.en?.[levelKey];
	return {
		subject: fallback?.subject || '',
		body: fallback?.body || '',
	};
}

await ConnectDb();

const settingsDocs = await ReminderSettings.find({}).lean();
const rankedCandidates = settingsDocs
	.map((doc) => {
		const stages = normalizeLateFeeStages(doc.lateFee);
		const enabledCount = ['soft', 'firm', 'formalNotice'].filter((key) => stages[key].enabled).length;

		return { doc, stages, enabledCount };
	})
	.filter((item) => item.enabledCount > 0)
	.sort((a, b) => b.enabledCount - a.enabledCount);

if (rankedCandidates.length === 0) {
	console.log(JSON.stringify({ error: 'No live reminder settings with soft, firm, or formal-notice late fees enabled.' }, null, 2));
	process.exit(0);
}

const selected = rankedCandidates[0];
const settings = selected.doc;
const companyProfile = await CompanyProfile.findOne({ user: settings.userId }).select('companyName ownerName locale').lean();
const locale =
	settings.messageLocale === 'en' || settings.messageLocale === 'fr'
		? settings.messageLocale
		: normalizeReminderLocale(companyProfile?.locale);

const invoice = await Invoice.findOne({
	userId: settings.userId,
	status: { $in: ['unpaid', 'overdue', 'partial_paid'] },
	dueDate: { $ne: null },
	'clientSnapshot.email': { $nin: [null, ''] },
})
	.sort({ dueDate: 1 })
	.select('_id userId invoiceNumber date dueDate status totalIncludingTax clientSnapshot paymentToken paymentTokenExpiry')
	.lean();

if (!invoice) {
	console.log(JSON.stringify({ error: 'No eligible invoice found for the selected live settings document.' }, null, 2));
	process.exit(0);
}

const totals = await Payment.aggregate([
	{ $match: { invoiceId: invoice._id, status: 'succeeded' } },
	{ $group: { _id: null, totalPaid: { $sum: '$amount' } } },
]);

const totalPaid = Math.max(0, Math.round(totals[0]?.totalPaid ?? 0));
const remainingAmount = Math.max(0, Math.round(invoice.totalIncludingTax ?? 0) - totalPaid);
const levels = [
	{ key: 'soft', level: 1 },
	{ key: 'firm', level: 3 },
	{ key: 'formalNotice', level: 4 },
];

const results = levels.map(({ key, level }) => {
	const lateFeeAmountCents = computeLateFeeAmountCents(remainingAmount, level, settings.lateFee);
	const baseVars = buildReminderVars(invoice, companyProfile, locale, totalPaid);
	const vars = mergeLateFeeIntoVariables(baseVars, lateFeeAmountCents, locale);
	const template = getTemplateForLevel(settings.templates, locale, key);
	const runtimeVars =
		level === 4
			? {
					...vars,
					legalDeadline: formatDateByLocale(
						computeLegalDeadline(new Date(), settings.legalNotice?.delayDays === 15 ? 15 : 8),
						locale
					),
				}
			: vars;
	const body = ensureReminderBodyHasPaymentLink({
		renderedBody: substituteVariables(template.body || '', runtimeVars),
		paymentLink: runtimeVars.paymentLink,
		locale,
	});
	const subject = substituteVariables(template.subject || '', runtimeVars);

	return {
		level: key,
		stageConfig: selected.stages[key],
		templateHasLateFeesPlaceholder: /\{\{\s*lateFees\s*\}\}|\{\s*lateFees\s*\}/.test(template.body || ''),
		lateFeeAmountCents,
		amountOriginal: runtimeVars.amountOriginal,
		amountDue: runtimeVars.amountDue,
		lateFeesVar: runtimeVars.lateFees,
		bodyContainsLateFeesValue: runtimeVars.lateFees ? body.includes(runtimeVars.lateFees) : false,
		bodyContainsAmountDue: body.includes(runtimeVars.amountDue),
		unresolvedLateFeesToken: body.includes('{{lateFees}}') || body.includes('{lateFees}'),
		subject,
		bodySnippet: body.split('\n').slice(0, 8).join('\n'),
	};
});

console.log(
	JSON.stringify(
		{
			locale,
			invoiceNumber: invoice.invoiceNumber,
			remainingAmountCents: remainingAmount,
			totalPaid,
			selectedStages: selected.stages,
			results,
		},
		null,
		2
	)
);
