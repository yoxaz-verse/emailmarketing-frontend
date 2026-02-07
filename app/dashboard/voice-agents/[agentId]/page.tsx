"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { MOCK_VOICE_AGENTS, MOCK_CALL_HISTORY, getMockAgentStats } from "@/lib/mock-voice-agents";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { CallOutcome } from "@/types/voice-agent";

const outcomeColors: Record<CallOutcome, string> = {
    answered: "bg-green-100 text-green-800 border-green-200",
    'no-answer': "bg-gray-100 text-gray-800 border-gray-200",
    busy: "bg-yellow-100 text-yellow-800 border-yellow-200",
    failed: "bg-red-100 text-red-800 border-red-200",
    voicemail: "bg-blue-100 text-blue-800 border-blue-200",
};

export default function VoiceAgentDetailPage() {
    const { agentId } = useParams();
    const agent = MOCK_VOICE_AGENTS.find((a) => a.id === agentId);
    const [activeTab, setActiveTab] = useState("overview");

    if (!agent) {
        return (
            <div className="flex flex-col items-center justify-center py-12">
                <h2 className="text-xl font-semibold text-gray-900">Agent not found</h2>
                <Link href="/dashboard/voice-agents" className="mt-4">
                    <Button variant="outline">Back to Search</Button>
                </Link>
            </div>
        );
    }

    const stats = getMockAgentStats(agent.id);

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "history", label: "Call History" },
        { id: "campaigns", label: "Campaigns" },
        { id: "intelligence", label: "Intelligence" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/dashboard/voice-agents">
                    <Button variant="ghost" size="sm" className="text-gray-500">
                        ← Back
                    </Button>
                </Link>
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                        {agent.name.split(' ').map(n => n[0]).join('')}
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">{agent.name}</h2>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">{agent.status}</Badge>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">ID: {agent.id}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <div className="flex gap-8">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "pb-3 text-sm font-medium transition-colors relative",
                                activeTab === tab.id
                                    ? "text-blue-600 border-b-2 border-blue-600"
                                    : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="mt-6">
                {activeTab === "overview" && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Calls</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalCalls.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">Answer Rate</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{stats.answerRate}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Duration</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.avgDuration}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-medium text-gray-500 uppercase tracking-wider">Recordings</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.recordingCount.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === "history" && (
                    <Card className="border-none shadow-sm bg-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-b border-gray-100">
                                        <TableHead className="font-semibold text-gray-900">Lead Name</TableHead>
                                        <TableHead className="font-semibold text-gray-900">Campaign</TableHead>
                                        <TableHead className="font-semibold text-gray-900">Timestamp</TableHead>
                                        <TableHead className="font-semibold text-gray-900">Outcome</TableHead>
                                        <TableHead className="font-semibold text-gray-900">Duration</TableHead>
                                        <TableHead className="font-semibold text-gray-900">Recording</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {MOCK_CALL_HISTORY.map((call) => (
                                        <TableRow key={call.id} className="hover:bg-gray-50/50">
                                            <TableCell className="font-medium text-gray-900">{call.leadName}</TableCell>
                                            <TableCell className="text-gray-600">{call.campaignName}</TableCell>
                                            <TableCell className="text-gray-500 text-sm whitespace-nowrap">
                                                {new Date(call.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn("capitalize border font-normal", outcomeColors[call.outcome])}>
                                                    {call.outcome.replace('-', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-gray-600 font-mono text-xs">{call.duration}</TableCell>
                                            <TableCell>
                                                {call.recordingUrl ? (
                                                    <Button variant="ghost" size="sm" className="text-blue-500 h-8 w-8 p-0" title="Listen to recording">
                                                        <span className="sr-only">Play</span>
                                                        ▶️
                                                    </Button>
                                                ) : (
                                                    <span className="text-gray-300 text-xs">—</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {activeTab === "campaigns" && (
                    <Card className="border-none shadow-sm bg-white">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-transparent border-b border-gray-100">
                                        <TableHead className="font-semibold text-gray-900">Campaign Name</TableHead>
                                        <TableHead className="font-semibold text-gray-900">Channel</TableHead>
                                        <TableHead className="font-semibold text-gray-900">Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell className="font-medium">Q1 Outreach</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100">Voice</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-green-100 text-green-800 border-green-200">Running</Badge>
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell className="font-medium">Inbound Followup</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-100">Voice</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge className="bg-green-100 text-green-800 border-green-200">Running</Badge>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                )}

                {activeTab === "intelligence" && (
                    <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                        <div className="text-4xl mb-4">🧠</div>
                        <h3 className="text-lg font-semibold text-gray-900 italic">Conversation Intelligence — Coming Soon</h3>
                        <p className="text-gray-500 mt-2">Sentiment analysis and transcriptions will appear here.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
