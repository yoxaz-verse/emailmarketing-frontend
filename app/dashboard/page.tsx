import { serverFetch } from '@/lib/server/server-fetch';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  Mail,
  Users,
  TrendingUp,
  Clock,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { MOCK_VOICE_AGENTS, MOCK_CALL_HISTORY } from '@/lib/mock-voice-agents';

export default async function OverviewPage() {
  const data = await serverFetch<any>('/stats/overview');

  const activeInboxes = data.inboxes.filter(
    (i: any) => i.status === 'active'
  ).length;

  const totalCalls = MOCK_VOICE_AGENTS.reduce((acc, agent) => acc + agent.totalCalls, 0);
  const totalAnswered = MOCK_VOICE_AGENTS.reduce((acc, agent) => acc + agent.answeredCalls, 0);
  const overallAnswerRate = totalCalls > 0 ? ((totalAnswered / totalCalls) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
          <p className="text-gray-500">Welcome back. Here's what's happening today.</p>
        </div>
        <div className="flex gap-3">
          <Link href="/dashboard/leads">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Users className="mr-2 h-4 w-4" /> Import Leads
            </Button>
          </Link>
          <Link href="/dashboard/campaign">
            <Button variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" /> New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Email Stats */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-blue-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2 uppercase tracking-wider">
              <Mail className="h-4 w-4 text-blue-500" /> Active Inboxes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{activeInboxes}</div>
            <p className="text-xs text-gray-400 mt-1">out of {data.inboxes.length} total</p>
          </CardContent>
        </Card>

        {/* Voice Stats - Total Calls */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-purple-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2 uppercase tracking-wider">
              <Phone className="h-4 w-4 text-purple-500" /> Total AI Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">{totalCalls.toLocaleString()}</div>
            <p className="text-xs text-gray-400 mt-1">Across {MOCK_VOICE_AGENTS.length} agents</p>
          </CardContent>
        </Card>

        {/* Voice Stats - Answer Rate */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-green-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2 uppercase tracking-wider">
              <TrendingUp className="h-4 w-4 text-green-500" /> Answer Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{overallAnswerRate}%</div>
            <p className="text-xs text-gray-400 mt-1">+2.4% from last week</p>
          </CardContent>
        </Card>

        {/* Campaign Health Placeholder */}
        <Card className="border-none shadow-sm bg-white overflow-hidden">
          <div className="h-1 bg-yellow-500" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2 uppercase tracking-wider">
              <Clock className="h-4 w-4 text-yellow-500" /> Active Campaigns
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">12</div>
            <p className="text-xs text-gray-400 mt-1">8 Email, 4 Voice</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent AI Call Activity</CardTitle>
              <CardDescription>Latest interactions from your voice agents.</CardDescription>
            </div>
            <Link href="/dashboard/voice-agents">
              <Button variant="ghost" size="sm" className="text-blue-600">
                View All <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {MOCK_CALL_HISTORY.slice(0, 5).map((call) => (
                <div key={call.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      call.outcome === 'answered' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                    )}>
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{call.leadName}</h4>
                      <p className="text-xs text-gray-500">{call.campaignName} • {new Date(call.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={cn(
                      "capitalize font-normal text-[10px]",
                      call.outcome === 'answered' ? "text-green-700 border-green-200" : "text-gray-500"
                    )}>
                      {call.outcome}
                    </Badge>
                    <span className="text-xs font-mono text-gray-400">{call.duration}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Side Widget: Quick Actions / Quick Stats */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm bg-gradient-to-br from-blue-600 to-indigo-700 text-white">
            <CardHeader>
              <CardTitle className="text-white">Voice Agent Status</CardTitle>
              <CardDescription className="text-blue-100">Quick overview of your callers.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {MOCK_VOICE_AGENTS.slice(0, 3).map((agent) => (
                  <div key={agent.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{agent.name}</span>
                    <Badge className={cn(
                      "bg-white/20 text-white border-none",
                      agent.status === 'active' ? "bg-green-400/30" : "bg-gray-400/30"
                    )}>
                      {agent.status}
                    </Badge>
                  </div>
                ))}
                <Link href="/dashboard/voice-agents" className="block pt-2">
                  <Button variant="secondary" className="w-full bg-white text-blue-700 hover:bg-blue-50">
                    Manage Agents
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm bg-white">
            <CardHeader>
              <CardTitle>Platform Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-l-2 border-yellow-400 pl-4 py-1">
                <p className="text-sm font-medium text-gray-900">Cold Email Warning</p>
                <p className="text-xs text-gray-500 mt-1">3 inboxes are nearing daily limits.</p>
              </div>
              <div className="border-l-2 border-green-400 pl-4 py-1">
                <p className="text-sm font-medium text-gray-900">Top Performer</p>
                <p className="text-xs text-gray-500 mt-1">Alex Rivera reached 85% answer rate today.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Helper for conditional classes - redefined here briefly just in case lib/utils cn is complex
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(' ');
}
