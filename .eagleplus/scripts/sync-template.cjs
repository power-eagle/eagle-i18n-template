const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const {
  ensureFileExists,
  getRepoRoot,
  matchesAny,
  normalizePath,
  readJson,
} = require('./_shared.cjs');

function resolveConfigPath(repoRoot) {
  return path.join(getRepoRoot(repoRoot), '.eagleplus', 'config', 'template-target.json');
}

function normalizeRepoPath(repoRoot) {
  const resolved = path.resolve(getRepoRoot(repoRoot));
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function resolveStateFilePath(repoRoot) {
  const repoPathHash = crypto
    .createHash('sha256')
    .update(normalizeRepoPath(repoRoot))
    .digest('hex');
  return path.join(os.tmpdir(), '.eagleplus', `${repoPathHash}.json`);
}

function readStateFile(stateFilePath) {
  if (!fs.existsSync(stateFilePath)) {
    return null;
  }

  return readJson(stateFilePath);
}

function writeStateFile(stateFilePath, state) {
  fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
  fs.writeFileSync(stateFilePath, `${JSON.stringify(state, null, 2)}\n`);
}

function resolveCheckIntervalHours(config) {
  if (config.checkIntervalHours == null) {
    return null;
  }

  const value = Number(config.checkIntervalHours);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error('template-target.json field checkIntervalHours must be a non-negative number');
  }

  return value;
}

function resolveNextCheck(state, checkIntervalHours) {
  if (checkIntervalHours == null || !state?.lastUpdated) {
    return null;
  }

  const lastUpdatedMs = Date.parse(state.lastUpdated);
  if (Number.isNaN(lastUpdatedMs)) {
    return null;
  }

  return new Date(lastUpdatedMs + checkIntervalHours * 60 * 60 * 1000);
}

function getSyncStatus(options = {}) {
  const repoRoot = getRepoRoot(options.repoRoot);
  const configPath = resolveConfigPath(repoRoot);
  ensureFileExists(configPath, 'template config');

  const config = readJson(configPath);
  if (!config.source || !config.branch) {
    throw new Error('template-target.json must include both source and branch');
  }

  const checkIntervalHours = resolveCheckIntervalHours(config);
  const stateFilePath = resolveStateFilePath(repoRoot);
  const state = readStateFile(stateFilePath);
  const nextCheckAt = resolveNextCheck(state, checkIntervalHours);
  const now = new Date();

  return {
    source: config.source,
    branch: config.branch,
    workflow: config.workflow || null,
    syncLefthook: config.syncLefthook === true,
    checkIntervalHours,
    stateFilePath,
    lastUpdated: state?.lastUpdated || null,
    nextCheckAt: nextCheckAt ? nextCheckAt.toISOString() : null,
    checkDue: nextCheckAt == null ? true : now >= nextCheckAt,
  };
}

function cloneTemplate(source, branch, destination) {
  try {
    execFileSync('git', ['clone', '--depth', '1', '--branch', branch, source, destination], {
      stdio: 'inherit',
    });
  } catch {
    throw new Error(`Unable to clone template source '${source}' on branch '${branch}'`);
  }
}

function fileExists(rootDir, relativePath) {
  return fs.existsSync(path.join(rootDir, relativePath));
}

function collectSyncFiles(templateRoot, config) {
  const filesToSync = ['.eagleplus/scripts/_shared.cjs'];

  const scriptsRoot = path.join(templateRoot, '.eagleplus', 'scripts');
  if (fs.existsSync(scriptsRoot)) {
    const entries = fs.readdirSync(scriptsRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      filesToSync.push(normalizePath(path.join('.eagleplus', 'scripts', entry.name)));
    }
  }

  if (typeof config.workflow === 'string' && config.workflow.trim() !== '') {
    filesToSync.push(normalizePath(config.workflow.trim()));
  }

  if (config.syncLefthook === true) {
    filesToSync.push('lefthook.yaml');
  }

  return [...new Set(filesToSync)].filter(relativePath => fileExists(templateRoot, relativePath));
}

function copyFile(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function syncTemplate(options = {}) {
  const repoRoot = getRepoRoot(options.repoRoot);
  const syncStatus = getSyncStatus({ repoRoot });
  const configPath = resolveConfigPath(repoRoot);
  const config = readJson(configPath);
  const checkIntervalHours = syncStatus.checkIntervalHours;
  const protectedFiles = Array.isArray(config.protected) ? config.protected : [];
  const stateFilePath = syncStatus.stateFilePath;
  const now = new Date();

  if (!options.force && syncStatus.nextCheckAt && !syncStatus.checkDue) {
    return {
      source: syncStatus.source,
      branch: syncStatus.branch,
      dryRun: Boolean(options.dryRun),
      force: Boolean(options.force),
      workflow: syncStatus.workflow,
      syncLefthook: syncStatus.syncLefthook,
      checkIntervalHours,
      stateFilePath,
      lastUpdated: syncStatus.lastUpdated,
      nextCheckAt: syncStatus.nextCheckAt,
      skipped: true,
      reason: 'next_check_not_due',
      copiedFiles: [],
      skippedFiles: [],
    };
  }

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'eagle-template-'));
  const copiedFiles = [];
  const skippedFiles = [];

  try {
    cloneTemplate(config.source, config.branch, tempRoot);
    const filesToSync = collectSyncFiles(tempRoot, config);

    for (const relativeFile of filesToSync) {
      if (matchesAny(relativeFile, protectedFiles)) {
        skippedFiles.push(relativeFile);
        continue;
      }

      if (!options.dryRun) {
        copyFile(path.join(tempRoot, relativeFile), path.join(repoRoot, relativeFile));
      }

      copiedFiles.push(relativeFile);
    }

    if (!options.dryRun) {
      writeStateFile(stateFilePath, {
        repoRoot: normalizeRepoPath(repoRoot),
        lastUpdated: now.toISOString(),
      });
    }
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  const effectiveLastUpdated = !options.dryRun ? now.toISOString() : syncStatus.lastUpdated || null;
  const effectiveNextCheckAt =
    checkIntervalHours == null
      ? null
      : new Date((!options.dryRun ? now : syncStatus.lastUpdated ? new Date(syncStatus.lastUpdated) : now).getTime() + checkIntervalHours * 60 * 60 * 1000).toISOString();

  return {
    source: config.source,
    branch: config.branch,
    dryRun: Boolean(options.dryRun),
    force: Boolean(options.force),
    workflow: config.workflow || null,
    syncLefthook: config.syncLefthook === true,
    checkIntervalHours,
    stateFilePath,
    lastUpdated: effectiveLastUpdated,
    nextCheckAt: effectiveNextCheckAt,
    skipped: false,
    copiedFiles,
    skippedFiles,
  };
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const force = process.argv.includes('--force');
  console.log(JSON.stringify(syncTemplate({ dryRun, force }), null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  getSyncStatus,
  resolveStateFilePath,
  syncTemplate,
};