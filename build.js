import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const isWatch = process.argv.includes('--watch');
const distDir = path.resolve('dist');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

function copyStaticAssets() {
  console.log('Copying static assets...');

  // Manifest
  copyFile('src/manifest.json', 'dist/manifest.json');

  // Content Styles
  copyFile('src/content/styles.css', 'dist/content/styles.css');

  // Popup HTML & CSS
  copyFile('src/popup/popup.html', 'dist/popup/popup.html');
  copyFile('src/popup/popup.css', 'dist/popup/popup.css');

  // Options HTML & CSS
  copyFile('src/options/options.html', 'dist/options/options.html');
  copyFile('src/options/options.css', 'dist/options/options.css');

  // Icons
  const icons = ['icon16.png', 'icon48.png', 'icon128.png'];
  icons.forEach((icon) => {
    const iconSrc = path.join('src/icons', icon);
    if (fs.existsSync(iconSrc)) {
      copyFile(iconSrc, path.join('dist/icons', icon));
    }
  });

  console.log('Static assets copied.');
}

async function build() {
  ensureDir(distDir);
  copyStaticAssets();

  const entryPoints = [
    { in: 'src/background/service-worker.ts', out: 'background/service-worker' },
    { in: 'src/content/content.ts', out: 'content/content' },
    { in: 'src/popup/popup.ts', out: 'popup/popup' },
    { in: 'src/options/options.ts', out: 'options/options' },
  ];

  const buildOptions = {
    entryPoints,
    bundle: true,
    outdir: 'dist',
    format: 'iife',
    target: 'es2022',
    sourcemap: isWatch ? 'inline' : false,
    minify: !isWatch,
    logLevel: 'info',
  };

  if (isWatch) {
    const ctx = await esbuild.context(buildOptions);
    await ctx.watch();
    console.log('Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    try {
      const now = new Date();
      fs.utimesSync(distDir, now, now);
    } catch {
      // ignore
    }
    console.log('Build completed successfully!');
  }
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
