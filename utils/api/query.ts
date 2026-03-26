export type SortOrder = 'asc' | 'desc';

export interface ListQueryOptions {
  page: number;
  limit: number;
  search: string;
  sortBy: string;
  sortOrder: SortOrder;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function parseListQuery(
  searchParams: URLSearchParams,
  config: {
    defaultSortBy: string;
    allowedSortBy: string[];
    defaultLimit?: number;
    maxLimit?: number;
  }
): ListQueryOptions {
  const pageRaw = Number(searchParams.get('page') || '1');
  const limitRaw = Number(searchParams.get('limit') || String(config.defaultLimit ?? 10));

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const maxLimit = config.maxLimit ?? 100;
  const limitCandidate = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.floor(limitRaw) : config.defaultLimit ?? 10;
  const limit = Math.min(limitCandidate, maxLimit);

  const search = (searchParams.get('search') || '').trim();

  const sortByInput = (searchParams.get('sortBy') || '').trim();
  const sortBy = config.allowedSortBy.includes(sortByInput) ? sortByInput : config.defaultSortBy;

  const sortOrderInput = (searchParams.get('sortOrder') || 'desc').toLowerCase();
  const sortOrder: SortOrder = sortOrderInput === 'asc' ? 'asc' : 'desc';

  return {
    page,
    limit,
    search,
    sortBy,
    sortOrder,
  };
}

export function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { page, limit, total, totalPages };
}
