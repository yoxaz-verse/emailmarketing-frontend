// dashboard/types/voice-agent.ts

export type VoiceAgentStatus = 'active' | 'paused' | 'retired';

export interface VoiceAgent {
    id: string;
    name: string;
    avatar?: string;
    status: VoiceAgentStatus;
    assignedCampaigns: number;
    totalCalls: number;
    answeredCalls: number;
    avgCallDuration: string; // e.g., "2m 15s"
    lastActive: string; // ISO string
}

export interface VoiceAgentStats {
    totalCalls: number;
    answerRate: string; // e.g., "65%"
    avgDuration: string;
    recordingCount: number;
}

export type CallOutcome = 'answered' | 'no-answer' | 'busy' | 'failed' | 'voicemail';

export interface VoiceAgentCall {
    id: string;
    leadName: string;
    campaignName: string;
    timestamp: string; // ISO string
    outcome: CallOutcome;
    duration: string;
    recordingUrl?: string;
}
