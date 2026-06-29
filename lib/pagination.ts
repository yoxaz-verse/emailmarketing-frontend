export type PageSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function buildCrudPageParams(searchParams: PageSearchParams, pageSize = 25) {
  const page = Math.max(1, Math.trunc(Number(first(searchParams.page)) || 1));
  const q = String(first(searchParams.q) ?? '').trim();
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(Math.max(1, Math.min(100, pageSize))),
  });
  if (q) params.set('q', q);
  const sortBy = String(first(searchParams.sort_by) ?? '').trim();
  const sortOrder = String(first(searchParams.sort_order) ?? '').trim();
  if (sortBy) params.set('sort_by', sortBy);
  if (sortOrder === 'asc' || sortOrder === 'desc') params.set('sort_order', sortOrder);
  return { params, q };
}
