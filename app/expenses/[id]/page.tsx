'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useParams } from 'next/navigation';

import { ArrowLeftIcon, Loader2Icon, PaperclipIcon } from 'lucide-react';

import CrmShell from '@/components/crm-shell';
import { ExpenseMoneyDisplay } from '@/components/expenses/expense-money-display';
import { ExpenseStatusBadge } from '@/components/expenses/expense-status-badge';
import { useLocale } from '@/components/providers/locale-provider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import EmptyState from '@/components/ui/EmptyState';
import ErrorMessage from '@/components/ui/ErrorMessage';
import { useAuthMe } from '@/hooks/useAuthMe';
import { useExpenseDetail } from '@/hooks/useExpenseDetail';
import { hasPermission } from '@/lib/permissions';

function formatDate(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
}

export default function ExpenseDetailPage() {
  const params = useParams<{ id: string }>();
  const expenseId = typeof params?.id === 'string' ? params.id : '';
  const { locale } = useLocale();
  const { user, loading: authLoading } = useAuthMe();
  const { expense, loading, error, refetch } = useExpenseDetail(expenseId);

  const t = useMemo(
    () =>
      ({
        en: {
          shellTitle: 'Expense detail',
          forbiddenTitle: 'You do not have access to expenses',
          forbiddenHelp: 'Ask an administrator to grant expenses permissions.',
          back: 'Back to Expenses',
          summary: 'Summary',
          attachments: 'Attachments',
          noAttachments: 'No attachments linked to this expense yet.',
          refresh: 'Refresh',
          notFound: 'Expense not found or you do not have access to it.',
          amountInclVat: 'Amount incl. VAT',
          amountPaid: 'Amount paid',
          remaining: 'Remaining',
          reference: 'Reference',
          date: 'Date',
          openFile: 'Open file',
        },
        fr: {
          shellTitle: 'Detail depense',
          forbiddenTitle: "Vous n'avez pas acces aux depenses",
          forbiddenHelp: "Demandez a un administrateur d'activer les permissions depenses.",
          back: 'Retour aux depenses',
          summary: 'Resume',
          attachments: 'Pieces jointes',
          noAttachments: 'Aucune piece jointe sur cette depense.',
          refresh: 'Actualiser',
          notFound: "Depense introuvable ou acces refuse.",
          amountInclVat: 'Montant TTC',
          amountPaid: 'Montant paye',
          remaining: 'Reste',
          reference: 'Reference',
          date: 'Date',
          openFile: 'Ouvrir le fichier',
        },
      })[locale],
    [locale]
  );

  if (authLoading) {
    return (
      <CrmShell title={t.shellTitle}>
        <div className="flex min-h-52 items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      </CrmShell>
    );
  }

  if (!hasPermission(user?.role, 'expenses.view')) {
    return (
      <CrmShell title={t.shellTitle}>
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>{t.forbiddenTitle}</CardTitle>
            <CardDescription>{t.forbiddenHelp}</CardDescription>
          </CardHeader>
        </Card>
      </CrmShell>
    );
  }

  return (
    <CrmShell title={t.shellTitle}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild type="button" variant="outline" size="sm">
            <Link href="/expenses">
              <ArrowLeftIcon className="size-3.5" />
              {t.back}
            </Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void refetch()}>
            {t.refresh}
          </Button>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <ErrorMessage message={error} />
        ) : !expense ? (
          <EmptyState message={t.notFound} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="border-border/70 lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">{t.summary}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">{t.date}</p>
                  <p className="text-sm font-medium">{formatDate(expense.expenseDate)}</p>
                </div>

                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">{t.reference}</p>
                  <p className="text-sm font-medium">{expense.supplierRef || '-'}</p>
                </div>

                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">{t.amountInclVat}</p>
                  <ExpenseMoneyDisplay cents={expense.amountInclVatCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                </div>

                <div className="rounded-lg border border-border/60 p-3">
                  <p className="text-xs text-muted-foreground">{t.amountPaid}</p>
                  <ExpenseMoneyDisplay cents={expense.amountPaidCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                </div>

                <div className="rounded-lg border border-border/60 p-3 sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{t.remaining}</p>
                    <ExpenseStatusBadge status={expense.status} paymentStatus={expense.paymentStatus} />
                  </div>
                  <div className="mt-1">
                    <ExpenseMoneyDisplay cents={expense.remainingBalanceCents || 0} locale={locale === 'fr' ? 'fr-FR' : 'en-GB'} className="text-sm font-medium" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="text-base">{t.attachments}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!expense.attachments || expense.attachments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t.noAttachments}</p>
                ) : (
                  expense.attachments.map((attachment) => (
                    <div key={attachment._id} className="rounded-lg border border-border/60 p-2">
                      <p className="truncate text-sm font-medium">{attachment.displayName}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <PaperclipIcon className="size-3.5 text-muted-foreground" />
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {t.openFile}
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </CrmShell>
  );
}
