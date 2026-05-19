const ADMIN_ROLES = new Set(['admin', 'superadmin']);

const OPERATOR_ALLOWED_EXACT_PATHS = new Set([
  '/dashboard',
  '/dashboard/campaign',
  '/dashboard/campaign_leads',
  '/dashboard/leads',
  '/dashboard/leads/upload',
  '/dashboard/sequences',
]);

const OPERATOR_ALLOWED_PREFIXES = [
  '/dashboard/campaign/',
  '/dashboard/sequences/',
];

export function isAdminRole(role?: string | null): boolean {
  return ADMIN_ROLES.has((role ?? '').toLowerCase());
}

export function canOperatorAccessDashboardPath(pathname: string): boolean {
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  if (OPERATOR_ALLOWED_EXACT_PATHS.has(normalizedPath)) {
    return true;
  }

  return OPERATOR_ALLOWED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix));
}

export function isAllowedDashboardPathForRole(
  role: string | null | undefined,
  pathname: string
): boolean {
  if (isAdminRole(role)) {
    return true;
  }

  return canOperatorAccessDashboardPath(pathname);
}
