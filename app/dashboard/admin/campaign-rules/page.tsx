import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import Link from 'next/link';

export default async function CampaignRulesPage() {
  const cookieStore = await cookies();
  const role = cookieStore.get('user_role')?.value;
  const isAdmin = role === 'admin' || role === 'superadmin';

  if (!isAdmin) {
    redirect('/dashboard');
  }

  const lastUpdated = new Date().toLocaleString();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Campaign Rules Console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reference page for campaign governance logic used by inbox assignment and campaign execution.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Last updated: {lastUpdated}</p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-medium">1) Inbox Exclusivity Lock</h2>
        <p className="text-sm text-muted-foreground">
          One inbox can be attached to only one active campaign at a time.
        </p>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Blocked statuses: any non-terminal status (including draft/running).</li>
          <li>Unlocked statuses: paused, completed/ended, cancelled/canceled.</li>
          <li>Enforced at save time in campaign inbox sync API.</li>
          <li>UI marks locked inboxes and prevents selecting them.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-medium">2) Risky Lead Delivery</h2>
        <p className="text-sm text-muted-foreground">
          Risky is a validation warning, not a send restriction.
        </p>
        <div className="rounded-lg border border-border bg-background p-3 text-sm">
          <p>Risky leads send under the same inbox, domain, hourly, and daily capacity limits as eligible leads.</p>
        </div>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Gmail, Outlook, and other free-mail recipients are not paused because of their provider.</li>
          <li>Unsubscribed, invalid, blocked, or permanently failed leads remain excluded.</li>
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-lg font-medium">3) Execution & Debug Flow</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Inbox capacity and warmup limits are resolved first.</li>
          <li>Provider-specific formatting and reduced tracking are applied without blocking delivery.</li>
          <li>Conflict and skip events are written to system events for auditability.</li>
        </ul>
        <div className="pt-2 text-sm">
          <Link className="text-blue-700 dark:text-blue-300 hover:text-blue-700 dark:text-blue-200 underline" href="/dashboard/admin/sending-limits">
            Open Sending Limits
          </Link>
          <span className="mx-2 text-muted-foreground">•</span>
          <Link className="text-blue-700 dark:text-blue-300 hover:text-blue-700 dark:text-blue-200 underline" href="/dashboard/admin/validation-monitor">
            Open Validation Monitor
          </Link>
        </div>
      </section>
    </div>
  );
}
