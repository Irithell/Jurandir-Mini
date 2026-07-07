import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');

const isPreview = process.argv.includes('--preview');

const IGNORED_DIRS = [
  'node_modules',
  '.git',
  'tmp',
  'backups',
  '.tmp_release',
  'src/addons',
  'database/addons',
  'database/cache',
  'database/sessions',
  'database/media/gifs/tmp',
];

const IGNORED_FILES = [
  'manifest.json',
  'package-lock.json',
  '.env',
  '.gitignore',
  'git.sh',
  'scripts/build.mjs',
];

function generateFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

async function buildManifest(dir) {
  const manifest = {};
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    const relativePath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');

    if (stat.isDirectory()) {
      if (IGNORED_DIRS.includes(relativePath)) continue;
      const subDirManifest = await buildManifest(fullPath);
      Object.assign(manifest, subDirManifest);
    } else {
      if (IGNORED_FILES.includes(relativePath)) continue;
      manifest[relativePath] = generateFileHash(fullPath);
    }
  }
  return manifest;
}

async function execute() {
  const manifestPath = path.join(ROOT_DIR, 'manifest.json');
  const pkgPath = path.join(ROOT_DIR, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    console.error('\x1b[31m[ x ] package.json não encontrado.\x1b[0m');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let oldManifest = { files: {} };

  if (fs.existsSync(manifestPath)) {
    oldManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  const newDictionary = await buildManifest(ROOT_DIR);

  if (isPreview) {
    console.log(`\n\x1b[36m[ i ] Preview do Manifest (v${pkg.version}):\x1b[0m\n`);
    const allFiles = new Set([...Object.keys(oldManifest.files), ...Object.keys(newDictionary)]);
    const sortedFiles = Array.from(allFiles).sort();

    let changed = 0,
      removed = 0,
      unchanged = 0;

    for (const file of sortedFiles) {
      const oldHash = oldManifest.files[file];
      const newHash = newDictionary[file];

      if (!oldHash && newHash) {
        console.log(`  \x1b[32m[ + ]\x1b[0m ${file} \x1b[32m(Novo)\x1b[0m`);
        changed++;
      } else if (oldHash && !newHash) {
        console.log(`  \x1b[31m[ - ]\x1b[0m \x1b[31m${file} (Removido)\x1b[0m`);
        removed++;
      } else if (oldHash !== newHash) {
        console.log(`  \x1b[32m[ + ]\x1b[0m ${file} \x1b[33m(Modificado)\x1b[0m`);
        changed++;
      } else {
        console.log(`  \x1b[90m[ = ] ${file}\x1b[0m`);
        unchanged++;
      }
    }
    console.log(
      `\n\x1b[33mResumo:\x1b[0m ${changed} modificado(s) | ${removed} removido(s) | ${unchanged} intacto(s)`
    );
    process.exit(0);
  }

  console.log(`\n\x1b[36m[ ⚙ ] Gravando hashes...\x1b[0m`);

  const manifestData = {
    version: pkg.version,
    build_time: Date.now(),
    files: newDictionary,
  };

  fs.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
  console.log(
    `\x1b[32m[ ✓ ] Manifest atualizado com ${Object.keys(newDictionary).length} arquivos.\x1b[0m\n`
  );
}

execute();
