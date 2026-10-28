/** Approval task type of a work-order stage (mirrors WorkflowService.stage_task_type). */
export function stageTaskType(stageId: string): string {
    return stageId.endsWith("_APPROVAL") ? `OT_${stageId}` : `OT_${stageId}_APPROVAL`
}
