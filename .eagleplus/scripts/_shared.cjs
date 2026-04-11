const fs = require('fs');
const path = require('path');

function getRepoRoot(customRoot) {
  return customRoot || process.cwd();
}

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

function ensureFileExists(filePath, description) {
  if (!fileExists(filePath)) {
    throw new Error(`Missing ${description}: ${filePath}`);
  }
}

function matchesGlob(targetPath, pattern) {
  return path.matchesGlob(targetPath, pattern);
}

function matchesAny(targetPath, patterns) {
  return patterns.some(pattern => matchesGlob(targetPath, pattern));
}

function walkFiles(rootDir, currentDir = rootDir) {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    const relativePath = normalizePath(path.relative(rootDir, fullPath));

    if (entry.isDirectory()) {
      files.push(...walkFiles(rootDir, fullPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return files;
}

function isPathPrefix(filePath, candidate) {
  const normalizedCandidate = normalizePath(candidate).replace(/\/$/, '');
  return filePath === normalizedCandidate || filePath.startsWith(`${normalizedCandidate}/`);
}

module.exports = {
  ensureFileExists,
  fileExists,
  getRepoRoot,
  isPathPrefix,
  matchesAny,
  matchesGlob,
  normalizePath,
  readJson,
  walkFiles,
};