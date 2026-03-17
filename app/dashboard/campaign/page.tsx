import DynamicTable from "@/components/dynamic/dynamicTable";
import { crudServer } from "@/lib/crud-server";
import { resolveRelations } from "@/lib/resolveRelation";
import { cookies } from "next/headers";

export default async function CampaignPage() {
 
  const data = await crudServer.list("campaigns");
  const cookieStore = await cookies(); // ✅ FIX
  const role = cookieStore.get('user_role')?.value;
const relations = await resolveRelations("campaigns", role);

  return ( 
    <div className="-mx-8 -my-8">
      <div className="px-8 py-8">
        <DynamicTable
          table="campaigns"
          data={data}
          relations={relations}
          role={role}
        />
      </div>
    </div>
  );
}
