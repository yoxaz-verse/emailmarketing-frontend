// dashboard/lib/mock-voice-agents.ts
import { VoiceAgent, VoiceAgentCall, VoiceAgentStats } from "@/types/voice-agent";

export const MOCK_VOICE_AGENTS: VoiceAgent[] = [
    {
        id: "1",
        name: "Alex Rivera",
        status: "active",
        assignedCampaigns: 3,
        totalCalls: 1240,
        answeredCalls: 842,
        avgCallDuration: "3m 45s",
        lastActive: new Date().toISOString(),
    },
    {
        id: "2",
        name: "Sarah Chen",
        status: "active",
        assignedCampaigns: 2,
        totalCalls: 980,
        answeredCalls: 620,
        avgCallDuration: "4m 10s",
        lastActive: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    },
    {
        id: "3",
        name: "Jordan Smith",
        status: "paused",
        assignedCampaigns: 1,
        totalCalls: 450,
        answeredCalls: 210,
        avgCallDuration: "2m 50s",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    },
    {
        id: "4",
        name: "Taylor Reed",
        status: "retired",
        assignedCampaigns: 0,
        totalCalls: 2300,
        answeredCalls: 1540,
        avgCallDuration: "3m 15s",
        lastActive: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(), // 5 days ago
    },
];

export const getMockAgentStats = (agentId: string): VoiceAgentStats => ({
    totalCalls: 1240,
    answerRate: "68%",
    avgDuration: "3m 45s",
    recordingCount: 842,
});

export const MOCK_CALL_HISTORY: VoiceAgentCall[] = [
    {
        id: "c1",
        leadName: "John Doe",
        campaignName: "Q1 Outreach",
        timestamp: new Date().toISOString(),
        outcome: "answered",
        duration: "4m 20s",
        recordingUrl: "#",
    },
    {
        id: "c2",
        leadName: "Jane Miller",
        campaignName: "Q1 Outreach",
        timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
        outcome: "no-answer",
        duration: "0m 45s",
    },
    {
        id: "c3",
        leadName: "Robert Wilson",
        campaignName: "Inbound Followup",
        timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
        outcome: "voicemail",
        duration: "1m 10s",
        recordingUrl: "#",
    },
    {
        id: "c4",
        leadName: "Emily Brown",
        campaignName: "Re-engagement",
        timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
        outcome: "answered",
        duration: "6m 15s",
        recordingUrl: "#",
    },
];
