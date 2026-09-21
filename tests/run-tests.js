import * as esbuild from 'esbuild';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

async function run() {
  const cacheDir = path.resolve('node_modules/.cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const outfile = path.join(cacheDir, 'test-bundle.mjs');
  await esbuild.build({
    entryPoints: ['tests/suite.test.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile,
    target: 'node20',
    packages: 'external',
  });

  const proc = spawn(process.execPath, ['--test', outfile], {
    stdio: 'inherit',
  });

  proc.on('exit', (code) => {
    process.exit(code || 0);
  });
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
