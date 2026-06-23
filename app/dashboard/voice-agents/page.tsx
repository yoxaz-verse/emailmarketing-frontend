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
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const statusColors: Record<VoiceAgentStatus, string> = {
    active: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
    paused: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
    retired: "bg-muted text-muted-foreground border-border",
};

export default function VoiceAgentListPage() {
    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
                <p className="text-sm font-semibold text-foreground">Voice AI is not functional yet.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                    This section is available for preview only and will be enabled in a future update.
                </p>
            </div>

            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Voice AI (CS)</h2>
                    <p className="text-muted-foreground">Preview layout only. Voice automation controls are not active yet.</p>
                </div>
                <Button disabled>Feature Not Available</Button>
            </div>

            <Card className="border border-border shadow-sm bg-card">
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-b border-border">
                                <TableHead className="font-semibold text-foreground">Agent Name</TableHead>
                                <TableHead className="font-semibold text-foreground">Status</TableHead>
                                <TableHead className="font-semibold text-foreground">Assigned Campaigns</TableHead>
                                <TableHead className="font-semibold text-foreground">Total Calls</TableHead>
                                <TableHead className="font-semibold text-foreground">Answered</TableHead>
                                <TableHead className="font-semibold text-foreground">Avg Duration</TableHead>
                                <TableHead className="font-semibold text-foreground">Last Active</TableHead>
                                <TableHead className="text-right"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {MOCK_VOICE_AGENTS.map((agent) => (
                                <TableRow key={agent.id} className="hover:bg-muted/40 transition-colors">
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs">
                                                {agent.name.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <Link
                                                href={`/dashboard/voice-agents/${agent.id}`}
                                                className="text-blue-700 dark:text-blue-300 hover:text-blue-700 dark:text-blue-200 hover:underline"
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
                                    <TableCell className="text-muted-foreground font-medium">
                                        {agent.assignedCampaigns}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {agent.totalCalls.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground">
                                        {agent.answeredCalls.toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground font-mono text-xs">
                                        {agent.avgCallDuration}
                                    </TableCell>
                                    <TableCell className="text-muted-foreground text-sm">
                                        {new Date(agent.lastActive).toLocaleDateString()} at {new Date(agent.lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Link href={`/dashboard/voice-agents/${agent.id}`}>
                                            <Button variant="ghost" size="sm" className="text-blue-700 dark:text-blue-300 hover:text-blue-700 dark:text-blue-200 hover:bg-blue-500/10">
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
                <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-border rounded-lg">
                    <p className="text-muted-foreground mb-4">No voice agents found.</p>
                    <Button disabled>Create Your First Agent</Button>
                </div>
            )}
        </div>
    );
}
