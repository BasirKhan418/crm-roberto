import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function AccountantPortalTicketsPage() {
  return (
    <Card className="border-border/70 bg-white/90 shadow-sm">
      <CardHeader>
        <CardTitle>Tickets</CardTitle>
        <CardDescription>Portal ticket thread and reply actions are scheduled in Sprint 4.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">This route is intentionally present now so the portal navigation is complete for Sprint 3, while the interactive ticket workflow lands in the next sprint.</p>
      </CardContent>
    </Card>
  );
}