import type { Task, TaskUserData } from "../api/workflowApi"

const MAX_VISIBLE_ASSIGNEES = 5

export function getTaskAssigneeStack(tasks: readonly Task[]): {
    users: TaskUserData[]
    totalCount: number
    overflowCount: number
} {
    const uniqueUsers = new Map<number, TaskUserData>()

    for (const task of tasks) {
        const assignee = task.assigned_to_data
        if (assignee) uniqueUsers.set(assignee.id, assignee)
    }

    const allUsers = Array.from(uniqueUsers.values())
    return {
        users: allUsers.slice(0, MAX_VISIBLE_ASSIGNEES),
        totalCount: allUsers.length,
        overflowCount: Math.max(0, allUsers.length - MAX_VISIBLE_ASSIGNEES),
    }
}