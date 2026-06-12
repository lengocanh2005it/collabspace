"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadDemoSeedData = loadDemoSeedData;
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
//# sourceMappingURL=load-demo-seed-data.js.map