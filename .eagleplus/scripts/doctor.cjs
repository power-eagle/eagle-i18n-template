const path = require('path');
const { fileExists, readJson } = require('./_shared.cjs');
const { packagePlugin } = require('./package-plugin.cjs');
const { getSyncStatus } = require('./sync-template.cjs');

function printList(title, items) {
  console.log(title);
  if (items.length === 0) {
    console.log('- none');
    return;
  }

  for (const item of items) {
    console.log(`- ${item}`);
  }
}

function printSyncStatus(syncStatus) {
  console.log('sync status:');
  console.log(`- source: ${syncStatus.source}`);
  console.log(`- branch: ${syncStatus.branch}`);
  console.log(`- workflow: ${syncStatus.workflow || 'none'}`);
  console.log(`- sync lefthook: ${syncStatus.syncLefthook}`);
  console.log(`- state file: ${syncStatus.stateFilePath}`);
  console.log(`- last updated: ${syncStatus.lastUpdated || 'never'}`);
  console.log(`- next sync time: ${syncStatus.nextCheckAt || 'on next run'}`);
  console.log(`- next check due: ${syncStatus.checkDue}`);
}

function main() {
  const repoRoot = process.cwd();
  readJson(path.join(repoRoot, '.eagleplus', 'config', 'pkg-rules.json'));
  const templateTarget = readJson(path.join(repoRoot, '.eagleplus', 'config', 'template-target.json'));
  const syncStatus = getSyncStatus({ repoRoot });

  if (
    templateTarget.checkIntervalHours != null &&
    (!Number.isFinite(Number(templateTarget.checkIntervalHours)) || Number(templateTarget.checkIntervalHours) < 0)
  ) {
    throw new Error('template-target.json field checkIntervalHours must be a non-negative number');
  }

  printSyncStatus(syncStatus);

  if (fileExists(path.join(repoRoot, 'manifest.json'))) {
    const packageCheck = packagePlugin('release', { repoRoot, checkOnly: true });
    console.log(`package manifest: ${packageCheck.manifestName} v${packageCheck.manifestVersion} (${packageCheck.type})`);
    printList('files to package:', [...packageCheck.includedFiles, 'manifest.json (generated)']);
    console.log('doctor: config and packaging rules are valid');
    return;
  }

  printList('files to package:', []);
  console.log('doctor: config files are valid; manifest.json not found, skipped package validation');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}