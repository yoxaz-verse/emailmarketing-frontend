import { proxyAgentRequest } from '@/lib/server/agent-proxy';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return proxyAgentRequest(req, `/agents/tasks/${id}/result`, 'POST');
}
