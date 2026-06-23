export type RuhrohContinuityLevel = "native_session" | "workspace_plus_transcript" | "workspace_only";
export type RuhrohCompletionConfidence = "explicit" | "adapter_inferred";
export type RuhrohCompletionDoneReason = "goal_satisfied";
export type RuhrohCompletionNotDoneReason = "agent_requested_continue" | "missing_completion_signal" | "context_checkpoint" | "partial_progress";
export type RuhrohCompletionTerminalFailureReason = "cannot_satisfy" | "policy_blocked" | "out_of_scope" | "runtime_failure" | "infra_failure";
export interface RuhrohEvidenceRef {
    kind: string;
    ref: string;
    summary: string;
}
export type RuhrohCompletionStatus = {
    state: "done";
    reason: RuhrohCompletionDoneReason;
    confidence: RuhrohCompletionConfidence;
    evidenceRefs: RuhrohEvidenceRef[];
} | {
    state: "not_done";
    reason: RuhrohCompletionNotDoneReason;
    evidenceRefs: RuhrohEvidenceRef[];
} | {
    state: "terminal_failure";
    reason: RuhrohCompletionTerminalFailureReason;
    evidenceRefs: RuhrohEvidenceRef[];
};
export interface PrepareRunAgentInput {
    scenarioId: string;
    workspacePath: string;
    runRootPath: string;
}
export interface PrepareRunAgentResult {
    artifactPaths: Record<string, string>;
}
export interface StartSessionInput {
    scenarioId: string;
    workspacePath: string;
}
export interface StartSessionResult {
    sessionHandle: string;
    artifactPaths: Record<string, string>;
}
export interface RunTurnInput {
    iteration: number;
    message: string;
    workspacePath: string;
}
export interface RunTurnResult {
    iteration: number;
    status: "completed" | "failed" | "timeout";
    failureKind?: string | undefined;
    runId?: string | undefined;
    threadId?: string | undefined;
    sessionHandle: string;
    transcriptPath?: string | undefined;
    eventLogPath?: string | undefined;
    artifactPaths: Record<string, string>;
    raw: unknown;
}
export interface DetectCompletionInput {
    turn: RunTurnResult;
}
export interface CollectArtifactsInput {
    sessionHandle: string;
}
export interface RunAgentArtifactManifest {
    adapterId: string;
    continuityLevel: RuhrohContinuityLevel;
    sessionHandle: string;
    runIds: string[];
    transcriptPaths: string[];
    eventLogPaths: string[];
    artifactPaths: Record<string, string>;
}
export interface CleanupInput {
    sessionHandle: string;
}
export interface RuhrohRunAgentAdapter {
    readonly id: string;
    readonly continuityLevel: RuhrohContinuityLevel;
    prepare(input: PrepareRunAgentInput): Promise<PrepareRunAgentResult>;
    startSession(input: StartSessionInput): Promise<StartSessionResult>;
    runTurn(input: RunTurnInput): Promise<RunTurnResult>;
    detectCompletion(input: DetectCompletionInput): Promise<RuhrohCompletionStatus>;
    collectArtifacts(input: CollectArtifactsInput): Promise<RunAgentArtifactManifest>;
    cleanup?(input: CleanupInput): Promise<void>;
}
export interface RuhrohRunAgentAdapterCapabilities {
    adapter: string;
    continuity: RuhrohContinuityLevel;
    tools: string[];
    network: boolean;
}
export declare function adapterSatisfiesRequirements(adapter: RuhrohRunAgentAdapterCapabilities, requirements: {
    continuity: RuhrohContinuityLevel;
    tools: string[];
    network: boolean;
}): string[];
//# sourceMappingURL=adapters.d.ts.map