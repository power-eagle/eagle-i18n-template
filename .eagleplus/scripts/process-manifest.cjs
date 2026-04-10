const path = require('path');
const { ensureFileExists, getRepoRoot, readJson } = require('./_shared.cjs');

function readManifest(repoRoot) {
  const manifestPath = path.join(getRepoRoot(repoRoot), 'manifest.json');
  ensureFileExists(manifestPath, 'manifest.json');

  return {
    manifestPath,
    manifest: readJson(manifestPath),
  };
}

function resolveLocalizedName(repoRoot) {
  const localePath = path.join(getRepoRoot(repoRoot), '_locales', 'en.json');
  try {
    return readJson(localePath)?.manifest?.app?.name || null;
  } catch {
    return null;
  }
}

function sanitizeFileName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function processManifest(type, repoRoot) {
  if (!['debug', 'release'].includes(type)) {
    throw new Error(`Unsupported package type: ${type}`);
  }

  const { manifest } = readManifest(repoRoot);
  const processedManifest = { ...manifest, devTools: type === 'debug' };
  const localizedName =
    typeof processedManifest.name === 'string' && processedManifest.name.includes('{{')
      ? resolveLocalizedName(repoRoot)
      : null;

  return {
    type,
    manifest: processedManifest,
    manifestName: sanitizeFileName(localizedName || processedManifest.name || 'eagle-plugin'),
    manifestVersion: String(processedManifest.version || '0.0.0'),
  };
}

if (require.main === module) {
  const rawArg = (process.argv[2] || '').toLowerCase();
  const type = rawArg === 'true' ? 'debug' : rawArg === 'false' ? 'release' : rawArg;
  console.log(JSON.stringify(processManifest(type), null, 2));
}

module.exports = {
  processManifest,
};