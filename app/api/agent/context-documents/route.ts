import { proxyAgentRequest } from '@/lib/server/agent-proxy';

export async function GET(req: Request) {
  return proxyAgentRequest(req, '/agents/context-documents', 'GET');
}

export async function POST(req: Request) {
  return proxyAgentRequest(req, '/agents/context-documents', 'POST');
}
