import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AccountantPortalExportsPage() {
  return (
    <Card className="border-border/70 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>Exports</CardTitle>
        <CardDescription>Accounting exports and bulk downloads are scheduled in Sprint 4.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">The navigation entry is live so portal users have a stable place for the upcoming CSV, VAT, ledger, and ZIP export tools.</p>
      </CardContent>
    </Card>
  );
}