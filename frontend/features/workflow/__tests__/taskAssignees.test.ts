import { describe, expect, it } from "vitest"
import type { Task, TaskUserData } from "../api/workflowApi"
import { getTaskAssigneeStack } from "../utils/taskAssignees"

const taskWithAssignee = (assignee: TaskUserData, id: number): Task => ({
    id,
    title: `Task ${id}`,
    description: "",
    task_type: "TEST",
    status: "PENDING",
    priority: "MEDIUM",
    assigned_to: assignee.id,
    assigned_to_data: assignee,
    assigned_group: null,
    created_by: null,
    created_at: "2026-01-01T00:00:00Z",
})

const user = (id: number): TaskUserData => ({ id, username: `user-${id}` })

describe("getTaskAssigneeStack", () => {
    it("deduplicates users assigned across tasks", () => {
        const stack = getTaskAssigneeStack([
            taskWithAssignee(user(1), 1),
            taskWithAssignee(user(1), 2),
            taskWithAssignee(user(2), 3),
        ])

        expect(stack.users.map(({ id }) => id)).toEqual([1, 2])
        expect(stack.totalCount).toBe(2)
        expect(stack.overflowCount).toBe(0)
    })

    it("shows the first five users and counts the remainder", () => {
        const stack = getTaskAssigneeStack(
            Array.from({ length: 7 }, (_, index) => taskWithAssignee(user(index + 1), index + 1)),
        )

        expect(stack.users.map(({ id }) => id)).toEqual([1, 2, 3, 4, 5])
        expect(stack.totalCount).toBe(7)
        expect(stack.overflowCount).toBe(2)
    })
})