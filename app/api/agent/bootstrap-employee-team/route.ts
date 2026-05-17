import { proxyAgentRequest } from '@/lib/server/agent-proxy';

export async function POST(req: Request) {
  return proxyAgentRequest(req, '/agents/bootstrap-employee-team', 'POST');
}

