import { serverFetch } from '@/lib/server/server-fetch';
import RepliesReviewClient from './RepliesReviewClient';

type Reply = {
  id: string;
  email: string;
  first_name: string;
  company: string;
  replied_at: string;
  reply_message: string;
  interest_status?: 'unreviewed' | 'interested' | 'not_interested';
  interest_note?: string | null;
  interest_reviewed_at?: string | null;
  campaign_leads?: Array<{
    campaign_id?: string;
    campaigns?: {
      name?: string;
    };
  }>;
  inboxes?: {
    email_address: string;
  };
};

export default async function OperatorRepliesPage() {
  const replies = await serverFetch<Reply[]>('/operator/replies');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Replies</h2>
      <RepliesReviewClient initialReplies={replies} />
    </div>
  );
}
