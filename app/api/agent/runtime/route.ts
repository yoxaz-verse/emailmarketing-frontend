import { proxyAgentRequest } from '@/lib/server/agent-proxy';

export async function GET(req: Request) {
  return proxyAgentRequest(req, '/agents/runtime', 'GET');
}

