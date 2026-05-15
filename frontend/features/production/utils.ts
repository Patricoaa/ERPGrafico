import type { WorkOrder } from "./types"

export function isWorkOrderOverdue(order: Pick<WorkOrder, 'due_date' | 'status'>): boolean {
    if (!order.due_date || order.status === 'FINISHED' || order.status === 'CANCELLED') {
        return false
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const [year, month, day] = order.due_date.split('-').map(Number)
    const dueDate = new Date(year, month - 1, day)
    
    return dueDate < today
}
