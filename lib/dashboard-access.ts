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

export const MODULE_ACCESS_LABELS: Record<ModuleAccessKey, string> = {
  marketing: 'Marketing',
  newsletter: 'Newsletter',
  social_media: 'Social Media',
  openflow_ai: 'OpenFlow AI',
  inquiry: 'Inquiry',
  industry_intelligence: 'Industry Intelligence',
};

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

function parseRawAccessFlags(raw: unknown): Record<string, unknown> | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parseRawAccessFlags(parsed);
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

function parseAccessBoolean(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
  }
  return false;
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

  const parsed = parseRawAccessFlags(raw);
  const normalized = emptyModuleAccess();
  if (!parsed) {
    return normalized;
  }

  for (const key of MODULE_ACCESS_KEYS) {
    normalized[key] = parseAccessBoolean(parsed[key]);
  }

  return normalized;
}

export function formatModuleAccessFlags(raw: unknown, role?: string | null): string {
  const flags = normalizeModuleAccessFlags(raw, role);
  const labels = MODULE_ACCESS_KEYS
    .filter((key) => flags[key])
    .map((key) => MODULE_ACCESS_LABELS[key]);
  return labels.length > 0 ? labels.join(', ') : 'No modules';
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
