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
    role: string;
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
export type DemoSeedData = {
    defaultPassword: string;
    users: DemoSeedUser[];
    demo: {
        workspaceId: string;
        workspaceName: string;
        workspaceDescription: string;
        ownerUserId: string;
        members: DemoSeedWorkspaceMember[];
        projectId: string;
        projectName: string;
        projectDescription: string;
        tasks: DemoSeedTask[];
        sampleComment: {
            taskId: string;
            authorUserId: string;
            content: string;
            mentionUserIds: string[];
        };
        sampleNotifications: Array<{
            recipientId: string;
            actorId: string;
            type: string;
            title: string;
            message: string;
            targetId: string;
            targetType: string;
        }>;
    };
};
export declare function loadDemoSeedData(): DemoSeedData;
export declare function avatarUrlFor(user: DemoSeedUser): string;
export declare function userSnapshot(user: DemoSeedUser): {
    userId: string;
    email: string;
    fullName: string;
    displayName: string;
    avatarUrl: string;
};
