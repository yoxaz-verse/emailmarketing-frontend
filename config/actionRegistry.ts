// config/actionRegistry.ts
import { pauseCampaign, startCampaign } from "@/app/dashboard/campaign/actions";
import {
  disableSequence,
  enableSequence,
  pauseNewsletterIssue,
  publishNewsletterIssue,
  resumeNewsletterIssue,
  runNewsletterIssueNow,
  validateSendingDomain,
  validateSmtpAccount,
} from "./tableActions";
import { viewCampaign, viewSequence } from "./clientTableActions";

  
  export const actionRegistry: Record<string, Function> = {
  
    viewSequence,
    validateSmtpAccount,
    viewCampaign,  
    validateSendingDomain,
    enableSequence,
    disableSequence,
    startCampaign,
    pauseCampaign,
    publishNewsletterIssue,
    runNewsletterIssueNow,
    pauseNewsletterIssue,
    resumeNewsletterIssue,
  };
  
