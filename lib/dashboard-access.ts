const ADMIN_ROLES = new Set(['admin', 'superadmin']);

export const MODULE_ACCESS_KEYS = [
  'marketing',
  'newsletter',
  'social_media',
  'openflow_ai',
  'inquiry',
  'industry_intelligence',
] as const;

export type ModuleAccessKey = typeof MODULE_ACCESS_KEYS[number];
export type ModuleAccessFlags = Record<ModuleAccessKey, boolean>;

const DASHBOARD_MODULE_RULES: Array<{
  module: ModuleAccessKey;
  exact: string[];
  prefixes: string[];
}> = [
  {
    module: 'marketing',
    exact: [
      '/dashboard/campaign',
      '/dashboard/events-intelligence',
      '/dashboard/campaign_leads',
      '/dashboard/leads',
      '/dashboard/leads/upload',
      '/dashboard/sequences',
    ],
    prefixes: ['/dashboard/campaign/', '/dashboard/sequences/'],
  },
  {
    module: 'newsletter',
    exact: [
      '/dashboard/newsletter_subscribers',
      '/dashboard/newsletter_issues',
      '/dashboard/newsletter_preferences',
      '/dashboard/newsletter_send_jobs',
      '/dashboard/newsletter_send_logs',
    ],
    prefixes: [],
  },
  {
    module: 'social_media',
    exact: [
      '/dashboard/social-scheduling',
      '/dashboard/social-connectors',
      '/dashboard/blog-distribution',
    ],
    prefixes: [],
  },
  {
    module: 'openflow_ai',
    exact: [
      '/dashboard/agent-integrations',
      '/dashboard/agents',
      '/dashboard/marketplace-publishing',
    ],
    prefixes: ['/dashboard/agents/'],
  },
  {
    module: 'inquiry',
    exact: ['/dashboard/inquiry-fetching', '/dashboard/inquiry-quoting'],
    prefixes: [],
  },
  {
    module: 'industry_intelligence',
    exact: ['/dashboard/industry-intelligence'],
    prefixes: [],
  },
];

export function isAdminRole(role?: string | null): boolean {
  return ADMIN_ROLES.has((role ?? '').toLowerCase());
}

export function emptyModuleAccess(): ModuleAccessFlags {
  return MODULE_ACCESS_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {} as ModuleAccessFlags);
}

export function fullModuleAccess(): ModuleAccessFlags {
  return MODULE_ACCESS_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {} as ModuleAccessFlags);
}

export function normalizeModuleAccessFlags(
  raw: unknown,
  role?: string | null
): ModuleAccessFlags {
  if (isAdminRole(role)) {
    return fullModuleAccess();
  }

  const normalized = emptyModuleAccess();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return normalized;
  }

  for (const key of MODULE_ACCESS_KEYS) {
    normalized[key] = (raw as Record<string, unknown>)[key] === true;
  }

  return normalized;
}

export function parseModuleAccessCookie(value?: string | null): Partial<ModuleAccessFlags> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(decodeURIComponent(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeDashboardPath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function canAccessDashboardPath(
  pathname: string,
  accessFlags: unknown,
  role?: string | null
): boolean {
  const normalizedPath =
    normalizeDashboardPath(pathname);

  if (normalizedPath === '/dashboard') {
    return true;
  }

  const matchedRule = DASHBOARD_MODULE_RULES.find((rule) => {
    if (rule.exact.includes(normalizedPath)) return true;
    return rule.prefixes.some((prefix) => normalizedPath.startsWith(prefix));
  });

  if (!matchedRule) {
    return isAdminRole(role);
  }

  return normalizeModuleAccessFlags(accessFlags, role)[matchedRule.module] === true;
}

export function isAllowedDashboardPathForRole(
  role: string | null | undefined,
  pathname: string,
  accessFlags?: unknown
): boolean {
  return canAccessDashboardPath(pathname, accessFlags, role);
}
