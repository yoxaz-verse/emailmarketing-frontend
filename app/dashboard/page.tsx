import { serverFetch } from '@/lib/server/server-fetch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import DynamicTable from '@/components/dynamic/dynamicTable';
import { cookies } from 'next/headers';
import { resolveRelations } from '@/lib/resolveRelation';
import { crudServer } from '@/lib/crud-server';

export default async function OverviewPage() {
  const data = await serverFetch<any>('/stats/overview');
  const leadData = await crudServer.list("campaign_leads");
  const cookieStore = await cookies(); // ✅ FIX
  const role = cookieStore.get('user_role')?.value;
const relations = await resolveRelations("campaign_leads");
  const activeInboxes = data.inboxes.filter(
    (i: any) => i.status === 'active'
  ).length;

  const pausedInboxes = data.inboxes.filter(
    (i: any) => i.status !== 'active'
  ).length;

  return (
    <div className='flex flex-col gap-3' >
     <div className="grid gap-6 grid-cols-1 md:grid-cols-3">

      <Card>
        <CardHeader>
          <CardTitle>Active Inboxes</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">
          {activeInboxes}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Paused Inboxes</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">
          {pausedInboxes}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Total Inboxes</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold">
          {data.inboxes.length}
        </CardContent>
      </Card>
      </div>

      <div className="flex  gap-4">
        <Link href="/dashboard/leads">
          <Button>Upload Leads</Button>
        </Link>

        <Link href="/dashboard/campaign">
          <Button variant="outline">Campaign Control</Button>
        </Link>
      </div>


<div>

      <DynamicTable
      table={"campaign_leads"}
      data={leadData}
      role={role}
      relations={relations}
    />
</div>

    </div>
  );
}
