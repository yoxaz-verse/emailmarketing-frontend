import { serverFetch } from '@/lib/server/server-fetch';

export default async function AnalyticsTab({
  campaignId,
}: {
  campaignId: string;
}) {
  const stats = await serverFetch<any[]>(
    `/crud/campaign_leads?campaign_id=${campaignId}`
  );

  const summary: Record<string, number> = stats.reduce(
    (acc: Record<string, number>, row: any) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    },
    {}
  );
  
  return (
    <div className="border rounded p-4 space-y-2">
      <h2 className="font-semibold">Analytics</h2>
  
      {Object.entries(summary).map(([status, count]) => (
        <div key={status} className="text-sm">
          {status}: <b>{count}</b>
        </div>
      ))}
    </div>
  );
  
}
