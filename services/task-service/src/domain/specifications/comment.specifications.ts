/**
 * Specification pattern: reusable MongoDB query fragments for comments.
 */
export const CommentSpecs = {
  notDeleted: { deletedAt: null } as const,

  forTask: (taskId: string) => ({
    taskId,
    ...CommentSpecs.notDeleted,
  }),

  topLevelForTask: (taskId: string) => ({
    taskId,
    parentId: null,
    ...CommentSpecs.notDeleted,
  }),

  repliesOf: (parentId: string) => ({
    parentId,
    ...CommentSpecs.notDeleted,
  }),
};
