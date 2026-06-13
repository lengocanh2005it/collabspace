export type TaskListFilter = {
  status?: string;
  assigneeId?: string;
  priority?: string;
  projectId?: string;
};

export type TaskListOptions = {
  skip?: number;
  limit?: number;
};

export const TASK_LIST_DEFAULT_LIMIT = 50;
export const TASK_LIST_MAX_LIMIT = 200;
export const TASK_BOARD_DEFAULT_LIMIT = 1000;

export function buildTaskListFilter(input: {
  status?: string;
  assigneeId?: string;
  priority?: string;
  projectId?: string;
}): TaskListFilter | undefined {
  const filter: TaskListFilter = {};

  if (input.status) {
    filter.status = input.status;
  }
  if (input.assigneeId) {
    filter.assigneeId = input.assigneeId;
  }
  if (input.priority) {
    filter.priority = input.priority;
  }
  if (input.projectId) {
    filter.projectId = input.projectId;
  }

  return Object.keys(filter).length > 0 ? filter : undefined;
}

export function clampTaskListLimit(
  limit: number | undefined,
  fallback = TASK_LIST_DEFAULT_LIMIT,
): number {
  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(limit), TASK_LIST_MAX_LIMIT);
}
