'use client';

import { useEffect, useMemo, useState } from 'react';

import {
  ArrowDownIcon,
  ArrowUpIcon,
  Loader2Icon,
  PlusIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SaveIcon,
} from 'lucide-react';

import { useLocale } from '@/components/providers/locale-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAuthMe } from '@/hooks/useAuthMe';
import { ExpenseCategoryItem, useExpenseCategories } from '@/hooks/useExpenses';
import { hasPermission } from '@/lib/permissions';

type RowDraft = {
  name: string;
  sortOrder: string;
  isEnabled: boolean;
};

type CategoryApiResponse = {
  success: boolean;
  message?: string;
  category?: ExpenseCategoryItem;
};

type Feedback = {
  type: 'success' | 'error';
  text: string;
};

const pageMessages = {
  en: {
    title: 'Expense Categories',
    description:
      'Manage the categories used by expense forms, filters, and reports. Changes are applied immediately across your workspace.',
    refresh: 'Refresh',
    loading: 'Loading categories...',
    empty: 'No categories found.',
    viewOnly: 'View only: you can review category setup but cannot edit it with your role.',
    addSectionTitle: 'Add category',
    addSectionDescription: 'Create a custom category for your expense workflow.',
    categoryName: 'Category name',
    categoryNamePlaceholder: 'Example: Office snacks',
    sortOrder: 'Sort order',
    enabled: 'Enabled',
    enabledDescription: 'Available in expense forms and filters.',
    add: 'Add category',
    adding: 'Adding...',
    save: 'Save',
    saving: 'Saving...',
    reset: 'Reset',
    moveUp: 'Move up',
    moveDown: 'Move down',
    defaultTag: 'Default',
    activeTag: 'Enabled',
    inactiveTag: 'Disabled',
    slugPrefix: 'Slug',
    noChanges: 'No pending changes',
    createSuccess: 'Category created successfully',
    updateSuccess: 'Category updated successfully',
    orderingSuccess: 'Category order updated',
    toggleSuccess: 'Category availability updated',
    createFailed: 'Failed to create category',
    updateFailed: 'Failed to update category',
    nameRequired: 'Category name is required',
    invalidSortOrder: 'Sort order must be a valid integer',
  },
  fr: {
    title: 'Catégories de dépenses',
    description:
      'Gérez les catégories utilisées par les formulaires, filtres et rapports de dépenses. Les changements sont appliqués immédiatement.',
    refresh: 'Actualiser',
    loading: 'Chargement des catégories...',
    empty: 'Aucune catégorie trouvée.',
    viewOnly: 'Lecture seule : vous pouvez consulter la configuration mais pas la modifier avec votre rôle.',
    addSectionTitle: 'Ajouter une catégorie',
    addSectionDescription: 'Créez une catégorie personnalisée pour votre workflow de dépenses.',
    categoryName: 'Nom de la catégorie',
    categoryNamePlaceholder: 'Exemple : Collations bureau',
    sortOrder: 'Ordre',
    enabled: 'Activée',
    enabledDescription: 'Disponible dans les formulaires et filtres de dépenses.',
    add: 'Ajouter catégorie',
    adding: 'Ajout...',
    save: 'Enregistrer',
    saving: 'Enregistrement...',
    reset: 'Réinitialiser',
    moveUp: 'Monter',
    moveDown: 'Descendre',
    defaultTag: 'Défaut',
    activeTag: 'Activée',
    inactiveTag: 'Désactivée',
    slugPrefix: 'Slug',
    noChanges: 'Aucun changement en attente',
    createSuccess: 'Catégorie créée avec succès',
    updateSuccess: 'Catégorie mise à jour avec succès',
    orderingSuccess: 'Ordre des catégories mis à jour',
    toggleSuccess: 'Disponibilité de la catégorie mise à jour',
    createFailed: 'Échec création catégorie',
    updateFailed: 'Échec mise à jour catégorie',
    nameRequired: 'Le nom de catégorie est requis',
    invalidSortOrder: "L'ordre doit être un entier valide",
  },
} as const;

function parseSortOrderInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
}

export default function ExpenseCategoriesSettingsPage() {
  const { locale } = useLocale();
  const t = pageMessages[locale];

  const { user } = useAuthMe();
  const canManageExpenses = hasPermission(user?.role, 'expenses.manage');

  const { categories, loading, error, refetch } = useExpenseCategories();

  const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategorySortOrder, setNewCategorySortOrder] = useState('');
  const [newCategoryEnabled, setNewCategoryEnabled] = useState(true);

  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    setRowDrafts(
      Object.fromEntries(
        categories.map((category) => [
          category._id,
          {
            name: category.name,
            sortOrder: String(category.sortOrder),
            isEnabled: category.isEnabled,
          },
        ])
      )
    );
  }, [categories]);

  function isBusy(actionKey: string) {
    return busyActionKey === actionKey;
  }

  function isRowBusy(categoryId: string) {
    return busyActionKey?.startsWith(`${categoryId}:`) || false;
  }

  function setRowDraft(categoryId: string, patch: Partial<RowDraft>) {
    setRowDrafts((previous) => {
      const current = previous[categoryId];
      if (!current) return previous;
      return {
        ...previous,
        [categoryId]: {
          ...current,
          ...patch,
        },
      };
    });
  }

  function getRowDraft(category: ExpenseCategoryItem): RowDraft {
    return (
      rowDrafts[category._id] || {
        name: category.name,
        sortOrder: String(category.sortOrder),
        isEnabled: category.isEnabled,
      }
    );
  }

  function setFeedbackMessage(next: Feedback) {
    setFeedback(next);
    window.setTimeout(() => {
      setFeedback((previous) => {
        if (!previous || previous.text !== next.text) return previous;
        return null;
      });
    }, 3200);
  }

  async function patchCategory(
    categoryId: string,
    payload: Record<string, unknown>,
    successMessage: string,
    actionKey: string
  ) {
    setBusyActionKey(actionKey);

    try {
      const response = await fetch('/api/expenses/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, ...payload }),
      });

      const result = (await response.json().catch(() => null)) as CategoryApiResponse | null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || t.updateFailed);
      }

      await refetch();
      setFeedbackMessage({ type: 'success', text: successMessage });
    } catch (patchError) {
      setFeedbackMessage({
        type: 'error',
        text: patchError instanceof Error ? patchError.message : t.updateFailed,
      });
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleCreateCategory() {
    if (!canManageExpenses) return;

    const name = newCategoryName.trim();
    if (!name) {
      setCreateError(t.nameRequired);
      return;
    }

    const parsedSortOrder = parseSortOrderInput(newCategorySortOrder);
    if (newCategorySortOrder.trim() && parsedSortOrder == null) {
      setCreateError(t.invalidSortOrder);
      return;
    }

    setCreateError(null);
    setBusyActionKey('create');

    try {
      const response = await fetch('/api/expenses/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          isEnabled: newCategoryEnabled,
          sortOrder: parsedSortOrder ?? undefined,
        }),
      });

      const result = (await response.json().catch(() => null)) as CategoryApiResponse | null;
      if (!response.ok || !result?.success) {
        throw new Error(result?.message || t.createFailed);
      }

      setNewCategoryName('');
      setNewCategorySortOrder('');
      setNewCategoryEnabled(true);
      await refetch();
      setFeedbackMessage({ type: 'success', text: t.createSuccess });
    } catch (createCategoryError) {
      const message = createCategoryError instanceof Error ? createCategoryError.message : t.createFailed;
      setCreateError(message);
      setFeedbackMessage({ type: 'error', text: message });
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleSaveRow(category: ExpenseCategoryItem) {
    if (!canManageExpenses) return;

    const draft = getRowDraft(category);
    const updates: Record<string, unknown> = {};

    const nextName = draft.name.trim();
    if (!nextName) {
      setFeedbackMessage({ type: 'error', text: t.nameRequired });
      return;
    }

    if (nextName !== category.name) {
      updates.name = nextName;
    }

    const parsedSortOrder = parseSortOrderInput(draft.sortOrder);
    if (parsedSortOrder == null) {
      setFeedbackMessage({ type: 'error', text: t.invalidSortOrder });
      return;
    }

    if (parsedSortOrder !== category.sortOrder) {
      updates.sortOrder = parsedSortOrder;
    }

    if (draft.isEnabled !== category.isEnabled) {
      updates.isEnabled = draft.isEnabled;
    }

    if (Object.keys(updates).length === 0) {
      setFeedbackMessage({ type: 'success', text: t.noChanges });
      return;
    }

    await patchCategory(category._id, updates, t.updateSuccess, `${category._id}:save`);
  }

  async function handleToggleCategory(category: ExpenseCategoryItem, nextEnabled: boolean) {
    if (!canManageExpenses) return;

    setRowDraft(category._id, { isEnabled: nextEnabled });
    await patchCategory(
      category._id,
      { isEnabled: nextEnabled },
      t.toggleSuccess,
      `${category._id}:toggle`
    );
  }

  async function handleMoveCategory(category: ExpenseCategoryItem, direction: -1 | 1) {
    if (!canManageExpenses) return;

    const draft = getRowDraft(category);
    const parsedSortOrder = parseSortOrderInput(draft.sortOrder);
    const currentSortOrder = parsedSortOrder ?? category.sortOrder;
    const nextSortOrder = currentSortOrder + direction;

    setRowDraft(category._id, { sortOrder: String(nextSortOrder) });
    await patchCategory(
      category._id,
      { sortOrder: nextSortOrder },
      t.orderingSuccess,
      `${category._id}:move`
    );
  }

  function resetRowDraft(category: ExpenseCategoryItem) {
    setRowDraft(category._id, {
      name: category.name,
      sortOrder: String(category.sortOrder),
      isEnabled: category.isEnabled,
    });
  }

  const sortedCategories = useMemo(() => [...categories], [categories]);

  return (
    <div className="space-y-5">
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-base">{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {feedback ? (
              <p className={`text-sm ${feedback.type === 'success' ? 'text-emerald-600' : 'text-destructive'}`}>
                {feedback.text}
              </p>
            ) : (
              <span className="text-sm text-muted-foreground" />
            )}

            <Button variant="outline" onClick={() => void refetch()} disabled={loading || busyActionKey != null}>
              <RefreshCwIcon className="size-4" />
              {t.refresh}
            </Button>
          </div>

          {!canManageExpenses ? (
            <p className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
              {t.viewOnly}
            </p>
          ) : null}

          <div className="rounded-xl border border-border/70 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">{t.addSectionTitle}</h3>
              <p className="text-xs text-muted-foreground">{t.addSectionDescription}</p>
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.5fr)_140px_150px_auto]">
              <div className="space-y-1.5">
                <Label>{t.categoryName}</Label>
                <Input
                  value={newCategoryName}
                  onChange={(event) => {
                    setCreateError(null);
                    setNewCategoryName(event.target.value);
                  }}
                  placeholder={t.categoryNamePlaceholder}
                  disabled={!canManageExpenses || isBusy('create')}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.sortOrder}</Label>
                <Input
                  type="number"
                  value={newCategorySortOrder}
                  onChange={(event) => {
                    setCreateError(null);
                    setNewCategorySortOrder(event.target.value);
                  }}
                  disabled={!canManageExpenses || isBusy('create')}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.enabled}</Label>
                <div className="flex h-9 items-center gap-2 rounded-lg border border-border/70 px-2.5">
                  <Switch
                    checked={newCategoryEnabled}
                    onCheckedChange={setNewCategoryEnabled}
                    disabled={!canManageExpenses || isBusy('create')}
                  />
                  <span className="text-xs text-muted-foreground">{t.enabledDescription}</span>
                </div>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  onClick={() => void handleCreateCategory()}
                  disabled={!canManageExpenses || isBusy('create')}
                  className="w-full"
                >
                  {isBusy('create') ? <Loader2Icon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
                  {isBusy('create') ? t.adding : t.add}
                </Button>
              </div>
            </div>

            {createError ? <p className="mt-2 text-sm text-destructive">{createError}</p> : null}
          </div>

          {loading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" />
              {t.loading}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : sortedCategories.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.empty}</p>
          ) : (
            <div className="space-y-3">
              {sortedCategories.map((category, index) => {
                const draft = getRowDraft(category);
                const rowBusy = isRowBusy(category._id);

                return (
                  <div key={category._id} className="rounded-xl border border-border/70 p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{category.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.slugPrefix}: {category.slug}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {category.isDefault ? <Badge variant="outline">{t.defaultTag}</Badge> : null}
                        <Badge variant={category.isEnabled ? 'default' : 'secondary'}>
                          {category.isEnabled ? t.activeTag : t.inactiveTag}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.5fr)_140px_150px_auto]">
                      <div className="space-y-1.5">
                        <Label>{t.categoryName}</Label>
                        <Input
                          value={draft.name}
                          onChange={(event) => setRowDraft(category._id, { name: event.target.value })}
                          disabled={!canManageExpenses || rowBusy}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>{t.sortOrder}</Label>
                        <Input
                          type="number"
                          value={draft.sortOrder}
                          onChange={(event) => setRowDraft(category._id, { sortOrder: event.target.value })}
                          disabled={!canManageExpenses || rowBusy}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>{t.enabled}</Label>
                        <div className="flex h-9 items-center gap-2 rounded-lg border border-border/70 px-2.5">
                          <Switch
                            checked={draft.isEnabled}
                            onCheckedChange={(nextChecked) => {
                              void handleToggleCategory(category, nextChecked);
                            }}
                            disabled={!canManageExpenses || rowBusy}
                          />
                          <span className="text-xs text-muted-foreground">
                            {draft.isEnabled ? t.activeTag : t.inactiveTag}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-end">
                        <div className="flex w-full flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleMoveCategory(category, -1)}
                            disabled={!canManageExpenses || rowBusy || index === 0}
                          >
                            <ArrowUpIcon className="size-3.5" />
                            {t.moveUp}
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleMoveCategory(category, 1)}
                            disabled={!canManageExpenses || rowBusy || index === sortedCategories.length - 1}
                          >
                            <ArrowDownIcon className="size-3.5" />
                            {t.moveDown}
                          </Button>

                          <Button
                            type="button"
                            size="sm"
                            onClick={() => void handleSaveRow(category)}
                            disabled={!canManageExpenses || rowBusy}
                          >
                            {rowBusy ? <Loader2Icon className="size-3.5 animate-spin" /> : <SaveIcon className="size-3.5" />}
                            {rowBusy ? t.saving : t.save}
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => resetRowDraft(category)}
                            disabled={!canManageExpenses || rowBusy}
                          >
                            <RotateCcwIcon className="size-3.5" />
                            {t.reset}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
