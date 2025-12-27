import DynamicTable from "@/components/dynamic/dynamicTable";
import { crudServer } from "@/lib/crud-server";
import { resolveRelations } from "@/lib/resolveRelation";
import { cookies } from "next/headers";

export default async function CampaignPage() {
 
  const data = await crudServer.list("campaigns");
  const cookieStore = await cookies(); // ✅ FIX
  const role = cookieStore.get('user_role')?.value;
const relations = await resolveRelations("campaigns");

  return ( 
    <DynamicTable
    table="campaigns"
    data={data}
    relations={relations}
    role={role}
  />
  );
}
