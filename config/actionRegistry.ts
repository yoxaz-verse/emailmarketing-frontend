// config/actionRegistry.ts

import { pauseCampaign, startCampaign } from "@/app/dashboard/campaign/actions";
import { disableSequence, enableSequence, validateSendingDomain, validateSmtpAccount, viewCampaign, viewSequence } from "./tableActions";

  
  export const actionRegistry: Record<string, Function> = {
  
    viewSequence,
    validateSmtpAccount,
    viewCampaign,  
    validateSendingDomain,
    enableSequence,
    disableSequence,
    startCampaign,
    pauseCampaign,
  };
  