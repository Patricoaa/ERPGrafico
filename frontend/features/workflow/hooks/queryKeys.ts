export const WORKFLOW_KEYS = {
  tasks: () => ['workflow-tasks'] as const,
  taskDetail: (id: number | string) => [...WORKFLOW_KEYS.tasks(), 'detail', id] as const,
  assignmentRules: () => ['workflow-assignment-rules'] as const,
  notificationRules: () => ['workflow-notification-rules'] as const,
  workflowSettings: () => ['workflow-settings'] as const,
  getUnreadNotificationCount: () => ['workflow-unread-notification-count'] as const,
}