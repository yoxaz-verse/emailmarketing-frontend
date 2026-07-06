import { Suspense } from 'react';
import CampaignHeader from './CampaignHeader';
import { getCampaignWorkspace } from '@/lib/server/campaign-workspace';

function SectionFallback() {
  return (
    <div className="px-8 pb-8 space-y-6" aria-label="Loading campaign sections">
      <div className="h-36 animate-pulse rounded-xl border border-border bg-muted/40" />
      <div className="h-72 animate-pulse rounded-xl border border-border bg-muted/40" />
    </div>
  );
}

export default async function CampaignDetailLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const workspace = await getCampaignWorkspace(campaignId);
  return (
    <div className="-mx-8 -my-8">
      <div className="px-8 pt-8">
        <CampaignHeader
          campaign={workspace.campaign}
        />
      </div>
      <Suspense fallback={<SectionFallback />}>{children}</Suspense>
    </div>
  );
}
