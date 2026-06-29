import DynamicTable from "@/components/dynamic/dynamicTable";
import { crudServer } from "@/lib/crud-server";
import { resolveRelations } from "@/lib/resolveRelation";
import { cookies } from "next/headers";
import { buildCrudPageParams, type PageSearchParams } from '@/lib/pagination';

export default async function CampaignPage({ searchParams }: { searchParams: Promise<PageSearchParams> }) {
  const query = await searchParams;
  const cookieStore = await cookies(); // ✅ FIX
  const role = cookieStore.get('user_role')?.value;
  const { params, q } = buildCrudPageParams(query);
  const [page, relations] = await Promise.all([
    crudServer.page('campaigns', params),
    resolveRelations('campaigns', role),
  ]);

  return ( 
    <div className="-mx-8 -my-8">
      <div className="px-8 py-8">
        <DynamicTable
          table="campaigns"
          data={page.rows}
          relations={relations}
          role={role}
          pagination={{ page: page.page, pageSize: page.page_size, total: page.total, query: q }}
        />
      </div>
    </div>
  );
}
