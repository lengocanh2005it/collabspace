// src/infrastructure/services/workspace.mock.service.ts
import { Injectable } from "@nestjs/common";
import type { WorkspaceRole } from "@collabspace/shared";
import type {
  IWorkspaceClient,
  WorkspaceMembershipSnapshot,
} from "../../application/ports/IWorkspaceClient";
import { meetsWorkspaceRole } from "../clients/workspace-membership.util";

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  members: WorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  avatarUrl?: string;
  joinedAt: Date;
}

@Injectable()
export class WorkspaceMockService implements IWorkspaceClient {
  private mockWorkspaces: Map<string, Workspace> = new Map();

  constructor() {
    this.initializeMockData();
  }

  /**
   * Initialize mock workspace data for testing
   */
  private initializeMockData(): void {
    const mockWorkspace: Workspace = {
      id: "workspace-001",
      name: "Collabspace Dev Team",
      description: "Main development workspace for Collabspace project",
      ownerId: "user-001",
      members: [
        {
          userId: "user-001",
          name: "Vincent Nguyen",
          email: "vincent@collabspace.dev",
          role: "owner",
          avatarUrl: "https://api.example.com/avatars/user-001.jpg",
          joinedAt: new Date("2024-01-01"),
        },
        {
          userId: "user-002",
          name: "Alice Johnson",
          email: "alice@collabspace.dev",
          role: "member",
          avatarUrl: "https://api.example.com/avatars/user-002.jpg",
          joinedAt: new Date("2024-01-15"),
        },
        {
          userId: "user-003",
          name: "Bob Smith",
          email: "bob@collabspace.dev",
          role: "member",
          avatarUrl: "https://api.example.com/avatars/user-003.jpg",
          joinedAt: new Date("2024-02-01"),
        },
        {
          userId: "user-123",
          name: "Mock Developer",
          email: "dev@collabspace.dev",
          role: "member",
          avatarUrl: "https://api.example.com/avatars/user-123.jpg",
          joinedAt: new Date("2024-03-01"),
        },
      ],
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-05-04"),
    };

    const mockWorkspace2: Workspace = {
      id: "workspace-002",
      name: "Product Team",
      description: "Product management and design workspace",
      ownerId: "user-002",
      members: [
        {
          userId: "user-002",
          name: "Alice Johnson",
          email: "alice@collabspace.dev",
          role: "owner",
          avatarUrl: "https://api.example.com/avatars/user-002.jpg",
          joinedAt: new Date("2024-02-01"),
        },
        {
          userId: "user-004",
          name: "Charlie Davis",
          email: "charlie@collabspace.dev",
          role: "member",
          avatarUrl: "https://api.example.com/avatars/user-004.jpg",
          joinedAt: new Date("2024-02-15"),
        },
        {
          userId: "user-123",
          name: "Mock Developer",
          email: "dev@collabspace.dev",
          role: "member",
          avatarUrl: "https://api.example.com/avatars/user-123.jpg",
          joinedAt: new Date("2024-03-15"),
        },
      ],
      createdAt: new Date("2024-02-01"),
      updatedAt: new Date("2024-05-04"),
    };

    this.mockWorkspaces.set(mockWorkspace.id, mockWorkspace);
    this.mockWorkspaces.set(mockWorkspace2.id, mockWorkspace2);
  }

  /**
   * Get workspace by ID
   * @param workspaceId Workspace ID
   * @returns Workspace or null if not found
   */
  getWorkspaceAsync(workspaceId: string): Promise<Workspace | null> {
    // Auto-register unknown workspaces so task-service works with real workspace-service IDs
    if (!this.mockWorkspaces.has(workspaceId)) {
      this.registerDynamicWorkspace(workspaceId);
    }
    return Promise.resolve(this.mockWorkspaces.get(workspaceId) || null);
  }

  /**
   * Get all workspaces for a user
   * @param userId User ID
   * @returns Array of workspaces
   */
  getWorkspacesForUserAsync(userId: string): Promise<Workspace[]> {
    const workspaces: Workspace[] = [];
    this.mockWorkspaces.forEach((workspace) => {
      if (workspace.members.some((member) => member.userId === userId)) {
        workspaces.push(workspace);
      }
    });
    return Promise.resolve(workspaces);
  }

  /**
   * Validate if workspace exists.
   * Always returns true so that real workspace IDs from workspace-service are accepted.
   * @param workspaceId Workspace ID
   * @returns True always (workspace-service is the source of truth)
   */
  validateWorkspaceAsync(workspaceId: string, _userId?: string): Promise<boolean> {
    // Auto-register if unknown so subsequent member checks also pass
    if (!this.mockWorkspaces.has(workspaceId)) {
      this.registerDynamicWorkspace(workspaceId);
    }
    return Promise.resolve(true);
  }

  /**
   * Dynamically register a workspace that exists in workspace-service but not in mock data.
   * This bridges the gap until a real gRPC/HTTP workspace integration is implemented.
   */
  private registerDynamicWorkspace(workspaceId: string): void {
    const dynamicWorkspace: Workspace = {
      id: workspaceId,
      name: `Workspace ${workspaceId.slice(0, 8)}`,
      description: "Dynamically registered from workspace-service",
      ownerId: "dynamic-owner",
      members: [
        // Wildcard member entry — any userId is treated as a member
        {
          userId: "dynamic-owner",
          name: "Workspace Owner",
          email: "owner@collabspace.dev",
          role: "owner",
          joinedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.mockWorkspaces.set(workspaceId, dynamicWorkspace);
  }

  async getMembershipAsync(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMembershipSnapshot | null> {
    const workspace = this.mockWorkspaces.get(workspaceId);
    if (!workspace) {
      return null;
    }

    const member = workspace.members.find((m) => m.userId === userId);

    return {
      isMember: Boolean(member),
      role: member?.role ?? null,
    };
  }

  /**
   * Get workspace member info
   * @param workspaceId Workspace ID
   * @param userId User ID
   * @returns WorkspaceMember or null if not found
   */
  async getWorkspaceMemberAsync(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const workspace = this.mockWorkspaces.get(workspaceId);
    if (!workspace) return null;
    return Promise.resolve(workspace.members.find((member) => member.userId === userId) || null);
  }

  /**
   * Get all members in a workspace
   * @param workspaceId Workspace ID
   * @returns Array of workspace members
   */
  getWorkspaceMembersAsync(workspaceId: string): Promise<WorkspaceMember[]> {
    const workspace = this.mockWorkspaces.get(workspaceId);
    return Promise.resolve(workspace ? workspace.members : []);
  }

  /**
   * Check if user has permission in workspace
   * @param workspaceId Workspace ID
   * @param userId User ID
   * @param requiredRole Minimum required workspace role
   * @returns True if user has required permission
   */
  async checkUserPermissionAsync(
    workspaceId: string,
    userId: string,
    requiredRole: WorkspaceRole = "member",
  ): Promise<boolean> {
    // If workspace is not in mock data, auto-register and grant access.
    // This allows real workspace IDs from workspace-service to pass through.
    if (!this.mockWorkspaces.has(workspaceId)) {
      this.registerDynamicWorkspace(workspaceId);
      return true;
    }

    const workspace = this.mockWorkspaces.get(workspaceId);
    if (!workspace) {
      return true;
    }

    // Dynamic workspaces (auto-registered) always grant member-level access to any user
    if (workspace.description === "Dynamically registered from workspace-service") {
      return true;
    }

    const membership = await this.getMembershipAsync(workspaceId, userId);

    if (!membership?.isMember) {
      return false;
    }

    return meetsWorkspaceRole(membership.role, requiredRole);
  }

  /**
   * Add mock workspace for testing
   * @param workspace Workspace to add
   */
  addMockWorkspace(workspace: Workspace): void {
    this.mockWorkspaces.set(workspace.id, workspace);
  }

  /**
   * Clear all mock workspaces
   */
  clearMockWorkspaces(): void {
    this.mockWorkspaces.clear();
  }
}
