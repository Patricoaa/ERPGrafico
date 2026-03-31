import { TaskInbox } from "@/features/workflow/components/TaskInbox"

export default function TasksPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <TaskInbox />
        </div>
    )
}
