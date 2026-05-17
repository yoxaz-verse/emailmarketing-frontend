import { proxyAgentRequest } from '@/lib/server/agent-proxy';

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(req: Request, ctx: Params) {
  const { id } = await ctx.params;
  return proxyAgentRequest(req, `/agents/missions/${id}/runs`, 'GET');
}

