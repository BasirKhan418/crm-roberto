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
  Trash2Icon,
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
import { resolveExpenseCategoryNameByLocale } from '@/lib/expenses/category-i18n';
import { hasModuleActionAccess } from '@/lib/route-access';

type RowDraft = {
  nameEn: string;
  nameFr: string;
  sortOrder: string;
  isEnabled: boolean;
};

type CategoryApiResponse = {
  success: boolean;
  message?: string;
  code?: string;
  category?: ExpenseCategoryItem;
  conflictCategory?: ExpenseCategoryItem;
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
    categoryNameEn: 'Category name (EN)',
    categoryNameFr: 'Category name (FR)',
    categoryNameEnPlaceholder: 'Example: Fuel',
    categoryNameFrPlaceholder: 'Example: Carburant',
    sortOrder: 'Sort order',
    active: 'Active',
    activeDescription: 'Active categories are available in expense forms and filters.',
    add: 'Add category',
    adding: 'Adding...',
    save: 'Save',
    saving: 'Saving...',
    reset: 'Reset',
    moveUp: 'Move up',
    moveDown: 'Move down',
    defaultTag: 'Default',
    activeTag: 'Active',
    inactiveTag: 'Archived',
    slugPrefix: 'Slug',
    canonicalPrefix: 'Canonical key',
    delete: 'Delete',
    deleting: 'Deleting...',
    deleteConfirm: 'Delete this category? This cannot be undone.',
    deleteSuccess: 'Category deleted successfully',
    deleteFailed: 'Failed to delete category',
    noChanges: 'No pending changes',
    createSuccess: 'Category created successfully',
    updateSuccess: 'Category updated successfully',
    orderingSuccess: 'Category order updated',
    toggleSuccess: 'Category status updated',
    createFailed: 'Failed to create category',
    createExistsDisabledPrompt:
      'Category already exists but is currently disabled. Do you want to reactivate it?',
    reactivateAction: 'Reactivate category',
    reactivating: 'Reactivating...',
    reactivateSuccess: 'Category reactivated successfully',
    updateFailed: 'Failed to update category',
    nameRequired: 'At least one category name (EN or FR) is required',
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
    categoryNameEn: 'Nom catégorie (EN)',
    categoryNameFr: 'Nom catégorie (FR)',
    categoryNameEnPlaceholder: 'Exemple : Fuel',
    categoryNameFrPlaceholder: 'Exemple : Carburant',
    sortOrder: 'Ordre',
    active: 'Active',
    activeDescription: 'Les catégories actives sont disponibles dans les formulaires et filtres.',
    add: 'Ajouter catégorie',
    adding: 'Ajout...',
    save: 'Enregistrer',
    saving: 'Enregistrement...',
    reset: 'Réinitialiser',
    moveUp: 'Monter',
    moveDown: 'Descendre',
    defaultTag: 'Défaut',
    activeTag: 'Active',
    inactiveTag: 'Archivée',
    slugPrefix: 'Slug',
    canonicalPrefix: 'Clé canonique',
    delete: 'Supprimer',
    deleting: 'Suppression...',
    deleteConfirm: 'Supprimer cette catégorie ? Cette action est irréversible.',
    deleteSuccess: 'Catégorie supprimée avec succès',
    deleteFailed: 'Échec suppression catégorie',
    noChanges: 'Aucun changement en attente',
    createSuccess: 'Catégorie créée avec succès',
    updateSuccess: 'Catégorie mise à jour avec succès',
    orderingSuccess: 'Ordre des catégories mis à jour',
    toggleSuccess: 'Statut de la catégorie mis à jour',
    createFailed: 'Échec création catégorie',
    createExistsDisabledPrompt:
      'La catégorie existe déjà mais est désactivée. Voulez-vous la réactiver ?',
    reactivateAction: 'Réactiver catégorie',
    reactivating: 'Réactivation...',
    reactivateSuccess: 'Catégorie réactivée avec succès',
    updateFailed: 'Échec mise à jour catégorie',
    nameRequired: 'Au moins un nom (EN ou FR) est requis',
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
  const canManageExpenses = hasModuleActionAccess({ role: user?.role, modulePermissions: user?.modulePermissions, moduleKey: 'expenses', action: 'manage' });

  const { categories, loading, error, refetch } = useExpenseCategories();

  const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});
  const [newCategoryNameEn, setNewCategoryNameEn] = useState('');
  const [newCategoryNameFr, setNewCategoryNameFr] = useState('');
  const [newCategorySortOrder, setNewCategorySortOrder] = useState('');
  const [newCategoryEnabled, setNewCategoryEnabled] = useState(true);

  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [reactivateCandidate, setReactivateCandidate] = useState<ExpenseCategoryItem | null>(null);

  useEffect(() => {
    setRowDrafts(
      Object.fromEntries(
        categories.map((category) => [
          category._id,
          {
            nameEn: category.nameEn || category.name,
            nameFr: category.nameFr || '',
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
        nameEn: category.nameEn || category.name,
        nameFr: category.nameFr || '',
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
      return true;
    } catch (patchError) {
      setFeedbackMessage({
        type: 'error',
        text: patchError instanceof Error ? patchError.message : t.updateFailed,
      });
      return false;
    } finally {
      setBusyActionKey(null);
    }
  }

  async function handleCreateCategory() {
    if (!canManageExpenses) return;

    const nameEn = newCategoryNameEn.trim();
    const nameFr = newCategoryNameFr.trim();
    if (!nameEn && !nameFr) {
      setCreateError(t.nameRequired);
      return;
    }

    const parsedSortOrder = parseSortOrderInput(newCategorySortOrder);
    if (newCategorySortOrder.trim() && parsedSortOrder == null) {
      setCreateError(t.invalidSortOrder);
      return;
    }

    setCreateError(null);
    setReactivateCandidate(null);
    setBusyActionKey('create');

    try {
      const response = await fetch('/api/expenses/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameEn || nameFr,
          nameEn: nameEn || undefined,
          nameFr: nameFr || undefined,
          isEnabled: newCategoryEnabled,
          sortOrder: parsedSortOrder ?? undefined,
        }),
      });

      const result = (await response.json().catch(() => null)) as CategoryApiResponse | null;
      if (!response.ok || !result?.success) {
        if (result?.code === 'CATEGORY_EXISTS_DISABLED' && result.conflictCategory?._id) {
          setReactivateCandidate(result.conflictCategory);
          setCreateError(result.message || t.createExistsDisabledPrompt);
          return;
        }

        throw new Error(result?.message || t.createFailed);
      }

      setReactivateCandidate(null);
      setNewCategoryNameEn('');
      setNewCategoryNameFr('');
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

  async function handleReactivateCategory() {
    if (!canManageExpenses || !reactivateCandidate?._id) {
      return;
    }

    const reactivated = await patchCategory(
      reactivateCandidate._id,
      { isEnabled: true },
      t.reactivateSuccess,
      'reactivate'
    );

    if (!reactivated) {
      return;
    }

    setCreateError(null);
    setReactivateCandidate(null);
    setNewCategoryEnabled(true);
  }

  async function handleSaveRow(category: ExpenseCategoryItem) {
    if (!canManageExpenses) return;

    const draft = getRowDraft(category);
    const updates: Record<string, unknown> = {};

    const nextNameEn = draft.nameEn.trim();
    const nextNameFr = draft.nameFr.trim();

    if (!nextNameEn && !nextNameFr) {
      setFeedbackMessage({ type: 'error', text: t.nameRequired });
      return;
    }

    const currentNameEn = (category.nameEn || category.name || '').trim();
    const currentNameFr = (category.nameFr || '').trim();

    if (nextNameEn !== currentNameEn) {
      updates.nameEn = nextNameEn;
      updates.name = nextNameEn || nextNameFr;
    }

    if (nextNameFr !== currentNameFr) {
      updates.nameFr = nextNameFr;
      if (!updates.name) {
        updates.name = nextNameEn || nextNameFr;
      }
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
      nameEn: category.nameEn || category.name,
      nameFr: category.nameFr || '',
      sortOrder: String(category.sortOrder),
      isEnabled: category.isEnabled,
    });
  }

  async function handleDeleteCategory(category: ExpenseCategoryItem) {
    if (!canManageExpenses) return;

    const confirmed = window.confirm(t.deleteConfirm);
    if (!confirmed) {
      return;
    }

    setBusyActionKey(`${category._id}:delete`);

    try {
      const response = await fetch('/api/expenses/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: category._id }),
      });

      const result = (await response.json().catch(() => null)) as { success: boolean; message?: string } | null;

      if (!response.ok || !result?.success) {
        throw new Error(result?.message || t.deleteFailed);
      }

      await refetch();
      setFeedbackMessage({ type: 'success', text: t.deleteSuccess });
    } catch (deleteError) {
      setFeedbackMessage({
        type: 'error',
        text: deleteError instanceof Error ? deleteError.message : t.deleteFailed,
      });
    } finally {
      setBusyActionKey(null);
    }
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

            <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_140px_170px_auto]">
              <div className="space-y-1.5">
                <Label>{t.categoryNameEn}</Label>
                <Input
                  value={newCategoryNameEn}
                  onChange={(event) => {
                    setCreateError(null);
                    setReactivateCandidate(null);
                    setNewCategoryNameEn(event.target.value);
                  }}
                  placeholder={t.categoryNameEnPlaceholder}
                  disabled={!canManageExpenses || isBusy('create')}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.categoryNameFr}</Label>
                <Input
                  value={newCategoryNameFr}
                  onChange={(event) => {
                    setCreateError(null);
                    setReactivateCandidate(null);
                    setNewCategoryNameFr(event.target.value);
                  }}
                  placeholder={t.categoryNameFrPlaceholder}
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
                    setReactivateCandidate(null);
                    setNewCategorySortOrder(event.target.value);
                  }}
                  disabled={!canManageExpenses || isBusy('create')}
                />
              </div>

              <div className="space-y-1.5">
                <Label>{t.active}</Label>
                <div className="flex h-9 items-center gap-2 rounded-lg border border-border/70 px-2.5">
                  <Switch
                    checked={newCategoryEnabled}
                    onCheckedChange={setNewCategoryEnabled}
                    disabled={!canManageExpenses || isBusy('create')}
                  />
                  <span className="text-xs text-muted-foreground">{t.activeDescription}</span>
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

            {createError ? (
              <div className="mt-2 space-y-2">
                <p className="text-sm text-destructive">{createError}</p>
                {reactivateCandidate ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleReactivateCategory()}
                    disabled={!canManageExpenses || isBusy('reactivate')}
                  >
                    {isBusy('reactivate') ? <Loader2Icon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
                    {isBusy('reactivate') ? t.reactivating : t.reactivateAction}
                  </Button>
                ) : null}
              </div>
            ) : null}
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
                        <p className="text-sm font-medium">{resolveExpenseCategoryNameByLocale(category, locale)}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.slugPrefix}: {category.slug}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t.canonicalPrefix}: {category.canonicalKey || category.slug}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {category.isDefault ? <Badge variant="outline">{t.defaultTag}</Badge> : null}
                        <Badge variant={category.isEnabled ? 'default' : 'secondary'}>
                          {category.isEnabled ? t.activeTag : t.inactiveTag}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_140px_170px_auto]">
                      <div className="space-y-1.5">
                        <Label>{t.categoryNameEn}</Label>
                        <Input
                          value={draft.nameEn}
                          onChange={(event) => setRowDraft(category._id, { nameEn: event.target.value })}
                          disabled={!canManageExpenses || rowBusy}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label>{t.categoryNameFr}</Label>
                        <Input
                          value={draft.nameFr}
                          onChange={(event) => setRowDraft(category._id, { nameFr: event.target.value })}
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
                        <Label>{t.active}</Label>
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

                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDeleteCategory(category)}
                            disabled={!canManageExpenses || rowBusy || category.isDefault}
                          >
                            {isBusy(`${category._id}:delete`) ? <Loader2Icon className="size-3.5 animate-spin" /> : <Trash2Icon className="size-3.5" />}
                            {isBusy(`${category._id}:delete`) ? t.deleting : t.delete}
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
