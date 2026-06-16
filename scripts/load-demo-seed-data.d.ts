export type DemoSeedUser = {
    id: string;
    profileId: string;
    email: string;
    fullName: string;
    username: string;
    roleNames: string[];
    bio: string;
    preferredLanguage: string;
    preferredTimezone: string;
    avatarSeed: string;
};
export type DemoSeedWorkspaceMember = {
    userId: string;
    role: 'owner' | 'manager' | 'member';
};
export type DemoSeedTask = {
    id: string;
    title: string;
    description: string;
    status: 'TODO' | 'DOING' | 'DONE';
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    labels: string[];
    assigneeUserId: string | null;
    createdByUserId: string;
};
export type DemoSeedComment = {
    taskId: string;
    authorUserId: string;
    content: string;
    mentionUserIds: string[];
};
export type DemoSeedNotification = {
    recipientId: string;
    actorId: string;
    type: string;
    title: string;
    message: string;
    targetId: string;
    targetType: string;
    status?: 'UNREAD' | 'READ' | 'ARCHIVED';
};
export type DemoSeedPendingInvitation = {
    id: string;
    email: string;
    inviterUserId: string;
};
export type DemoSeedProject = {
    projectId: string;
    projectName: string;
    projectDescription: string;
    tasks: DemoSeedTask[];
    sampleComments?: DemoSeedComment[];
};
export type DemoSeedWorkspace = {
    workspaceId: string;
    workspaceName: string;
    workspaceDescription: string;
    ownerUserId: string;
    members: DemoSeedWorkspaceMember[];
    projects: DemoSeedProject[];
    pendingInvitations?: DemoSeedPendingInvitation[];
    sampleNotifications?: DemoSeedNotification[];
};
/** @deprecated flat MVP shape — use workspaces[] */
export type DemoSeedLegacyDemo = {
    workspaceId: string;
    workspaceName: string;
    workspaceDescription: string;
    ownerUserId: string;
    members: DemoSeedWorkspaceMember[];
    projectId: string;
    projectName: string;
    projectDescription: string;
    tasks: DemoSeedTask[];
    sampleComment?: DemoSeedComment;
    sampleNotifications?: DemoSeedNotification[];
};
export type DemoSeedDataMeta = {
    roleModel?: string;
    accountCount?: number;
    workspaceCount?: number;
    platformAdmins?: string[];
};
export type DemoSeedData = {
    _meta?: DemoSeedDataMeta;
    defaultPassword: string;
    users: DemoSeedUser[];
    workspaces?: DemoSeedWorkspace[];
    /** @deprecated use workspaces */
    demo?: DemoSeedLegacyDemo;
};
export declare function loadDemoSeedData(): DemoSeedData;
export declare function getDemoWorkspaces(data: DemoSeedData): DemoSeedWorkspace[];
/** Primary MVP workspace (first entry). */
export declare function getPrimaryDemoWorkspace(data: DemoSeedData): DemoSeedWorkspace;
export declare function collectDemoNotifications(data: DemoSeedData): DemoSeedNotification[];
export declare function avatarUrlFor(user: DemoSeedUser): string;
export declare function userSnapshot(user: DemoSeedUser): {
    userId: string;
    email: string;
    fullName: string;
    displayName: string;
    avatarUrl: string;
};
/** Mongo `user_replicas` — task-service + notification-service. */
export declare function userReplicaDocumentFor(user: DemoSeedUser): {
    userId: string;
    email: string;
    username: string;
    fullName: string;
    displayName: string;
    avatarUrl: string;
    isActive: boolean;
};
