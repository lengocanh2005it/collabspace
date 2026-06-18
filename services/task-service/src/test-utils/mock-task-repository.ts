// src/test-utils/mock-task-repository.ts
import type { ITaskRepository } from "../application/ports/ITaskRepository";

export function createMockTaskRepository(): jest.Mocked<ITaskRepository> {
  return {
    saveAsync: jest.fn(),
    findByIdAsync: jest.fn(),
    loadAggregateByIdAsync: jest.fn(),
    deleteAsync: jest.fn(),
    findByWorkspaceIdAsync: jest.fn(),
    countByWorkspaceIdAsync: jest.fn(),
    countByWorkspaceGrouped: jest.fn(),
    countByStatusGrouped: jest.fn(),
    addAttachmentAsync: jest.fn(),
    removeAttachmentAsync: jest.fn(),
  };
}
