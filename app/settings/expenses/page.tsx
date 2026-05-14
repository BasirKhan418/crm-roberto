'use client';

import { Loader2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useExpenseCategories } from '@/hooks/useExpenses';

export default function ExpenseCategoriesSettingsPage() {
  const { categories, loading, error, refetch } = useExpenseCategories();

  return (
    <div className="space-y-5">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Expense Categories</CardTitle>
          <CardDescription>
            Sprint 2 placeholder: manage enabled categories and ordering here. Full create/update actions will be wired once Sprint 3 APIs are available.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-end">
            <Button variant="outline" onClick={() => void refetch()} disabled={loading}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex min-h-28 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories found.</p>
          ) : (
            <div className="space-y-2">
              {categories.map((category) => (
                <div
                  key={category._id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">{category.name}</p>
                    <p className="text-xs text-muted-foreground">Slug: {category.slug}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {category.isDefault ? <Badge variant="outline">Default</Badge> : null}
                    <Badge variant={category.isEnabled ? 'default' : 'secondary'}>
                      {category.isEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
