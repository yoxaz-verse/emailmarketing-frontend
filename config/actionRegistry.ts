// config/actionRegistry.ts

import { pauseCampaign, startCampaign } from "@/app/dashboard/campaign/actions";
import { disableSequence, enableSequence } from "./tableActions";
import { redirect } from "next/navigation";
export async function viewCampaign(row: any) {
  redirect(`/dashboard/campaign/${row.id}`);
}
  
  export const actionRegistry: Record<string, Function> = {
    viewCampaign,  enableSequence,
    disableSequence,
    startCampaign,
    pauseCampaign,
  };
  