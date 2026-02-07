"use client";

import React from "react";
import Link from "next/link";
import { MOCK_VOICE_AGENTS } from "@/lib/mock-voice-agents";
import { VoiceAgentStatus } from "@/types/voice-agent";
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

const statusColors: Record<VoiceAgentStatus, string> = {
    active: "bg-green-100 text-green-800 border-green-200",
    paused: "bg-yellow-100 text-yellow-800 border-yellow-200",
    retired: "bg-gray-100 text-gray-800 border-gray-200",
};

export default function VoiceAgentListPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-gray-900">Voice Agents</h2>
                    <p className="text-gray-500">Manage and monitor your AI voice callers.</p>
                </div>
                <Button disabled>Add New Agent</Button>
            </div>

            <Card className="border-none shadow-sm bg-white">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b border-gray-100">
                                <TableHead className="font-semibold text-gray-900">Agent Name</TableHead>
                                <TableHead className="font-semibold text-gray-900">Status</TableHead>
                                <TableHead className="font-semibold text-gray-900">Assigned Campaigns</TableHead>
                                <TableHead className="font-semibold text-gray-900">Total Calls</TableHead>
                                <TableHead className="font-semibold text-gray-900">Answered</TableHead>
                                <TableHead className="font-semibold text-gray-900">Avg Duration</TableHead>
                                <TableHead className="font-semibold text-gray-900">Last Active</TableHead>
                                <TableHead className="text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {MOCK_VOICE_AGENTS.map((agent) => (
                                <TableRow key={agent.id} className="hover:bg-gray-50/50 transition-colors">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                                                {agent.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <Link
                                                href={`/dashboard/voice-agents/${agent.id}`}
                                                className="text-blue-600 hover:text-blue-800 hover:underline"
                                            >
                                                {agent.name}
                                            </Link>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={cn("capitalize border", statusColors[agent.status])}>
                                            {agent.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-gray-600 font-medium">
                                        {agent.assignedCampaigns}
                                    </TableCell>
                                    <TableCell className="text-gray-600">
                                        {agent.totalCalls.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-gray-600">
                                        {agent.answeredCalls.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-gray-600 font-mono text-xs">
                                        {agent.avgCallDuration}
                                    </TableCell>
                                    <TableCell className="text-gray-500 text-sm">
                                        {new Date(agent.lastActive).toLocaleDateString()} at {new Date(agent.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/dashboard/voice-agents/${agent.id}`}>
                                            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                                View Details
                                            </Button>
                                        </Link>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {MOCK_VOICE_AGENTS.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-gray-200 rounded-lg">
                    <p className="text-gray-500 mb-4">No voice agents found.</p>
                    <Button disabled>Create Your First Agent</Button>
                </div>
            )}
        </div>
    );
}
