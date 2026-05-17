import { proxyAgentRequest } from '@/lib/server/agent-proxy';

export async function GET(req: Request) {
  return proxyAgentRequest(req, '/agents/missions', 'GET');
}

export async function POST(req: Request) {
  return proxyAgentRequest(req, '/agents/missions', 'POST');
}

