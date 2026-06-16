"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDemoSeedData = loadDemoSeedData;
exports.getDemoWorkspaces = getDemoWorkspaces;
exports.getPrimaryDemoWorkspace = getPrimaryDemoWorkspace;
exports.collectDemoNotifications = collectDemoNotifications;
exports.avatarUrlFor = avatarUrlFor;
exports.userSnapshot = userSnapshot;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const DEMO_SEED_FILENAME = 'demo-seed-data.json';
function loadDemoSeedData() {
    const candidates = [
        process.env.DEMO_SEED_DATA_PATH,
        (0, node_path_1.join)(__dirname, DEMO_SEED_FILENAME),
        (0, node_path_1.join)(process.cwd(), 'scripts', DEMO_SEED_FILENAME),
        (0, node_path_1.join)(process.cwd(), '..', '..', 'scripts', DEMO_SEED_FILENAME),
        '/app/scripts/demo-seed-data.json',
    ].filter((p) => Boolean(p));
    for (const candidate of candidates) {
        if ((0, node_fs_1.existsSync)(candidate)) {
            return JSON.parse((0, node_fs_1.readFileSync)(candidate, 'utf8'));
        }
    }
    throw new Error(`Could not find ${DEMO_SEED_FILENAME}. Run seed scripts from the repository root or a service directory.`);
}
function legacyDemoToWorkspace(demo) {
    return {
        workspaceId: demo.workspaceId,
        workspaceName: demo.workspaceName,
        workspaceDescription: demo.workspaceDescription,
        ownerUserId: demo.ownerUserId,
        members: demo.members,
        projects: [
            {
                projectId: demo.projectId,
                projectName: demo.projectName,
                projectDescription: demo.projectDescription,
                tasks: demo.tasks,
                sampleComments: demo.sampleComment ? [demo.sampleComment] : [],
            },
        ],
        sampleNotifications: demo.sampleNotifications,
    };
}
function getDemoWorkspaces(data) {
    if (data.workspaces && data.workspaces.length > 0) {
        return data.workspaces;
    }
    if (data.demo) {
        return [legacyDemoToWorkspace(data.demo)];
    }
    throw new Error('demo-seed-data.json must define workspaces[] or legacy demo');
}
/** Primary MVP workspace (first entry). */
function getPrimaryDemoWorkspace(data) {
    return getDemoWorkspaces(data)[0];
}
function collectDemoNotifications(data) {
    return getDemoWorkspaces(data).flatMap((workspace) => workspace.sampleNotifications ?? []);
}
function avatarUrlFor(user) {
    return `https://api.dicebear.com/9.x/initials/svg?seed=${user.avatarSeed}`;
}
function userSnapshot(user) {
    return {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        displayName: user.fullName,
        avatarUrl: avatarUrlFor(user),
    };
}
