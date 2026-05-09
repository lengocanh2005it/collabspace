const { readdirSync } = require('node:fs');
const { join, relative } = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = join(__dirname, '..', '..');
const protoDir = join(rootDir, 'proto');
const outputDir = join(rootDir, 'src', 'generated', 'proto');

const protoFiles = readdirSync(protoDir)
  .filter((fileName) => fileName.endsWith('.proto'))
  .sort();

if (protoFiles.length === 0) {
  console.log(`No .proto files found in ${relative(rootDir, protoDir)}`);
  process.exit(0);
}

const cliPath = require.resolve('nestjs-proto-gen-ts/bin/cli');

for (const protoFile of protoFiles) {
  console.log(`-- generating: ${protoFile}`);

  const result = spawnSync(
    process.execPath,
    [
      cliPath,
      '--path',
      './proto',
      '--output',
      './src/generated/proto',
      '--target',
      protoFile,
    ],
    {
      cwd: rootDir,
      stdio: 'inherit',
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(
  `Generated ${protoFiles.length} proto file(s) into ${relative(rootDir, outputDir)}`,
);
