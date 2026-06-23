const CONTINUITY_RANK = {
    workspace_only: 1,
    workspace_plus_transcript: 2,
    native_session: 3,
};
export function adapterSatisfiesRequirements(adapter, requirements) {
    const errors = [];
    if (CONTINUITY_RANK[adapter.continuity] < CONTINUITY_RANK[requirements.continuity]) {
        errors.push(`adapter ${adapter.adapter} does not satisfy required continuity ${requirements.continuity}`);
    }
    for (const tool of requirements.tools) {
        if (!adapter.tools.includes(tool)) {
            errors.push(`adapter ${adapter.adapter} does not provide required tool ${tool}`);
        }
    }
    if (requirements.network && !adapter.network) {
        errors.push(`adapter ${adapter.adapter} does not provide required network access`);
    }
    return errors;
}
//# sourceMappingURL=adapters.js.map