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

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function matchesSegment(targetSegment, patternSegment) {
  const regex = new RegExp(`^${escapeRegex(patternSegment).replace(/\*/g, '[^/]*')}$`);
  return regex.test(targetSegment);
}

function matchesGlob(targetPath, pattern) {
  const normalizedTarget = normalizePath(targetPath).replace(/^\.\//, '').replace(/^\//, '');
  const normalizedPattern = normalizePath(pattern).replace(/^\.\//, '').replace(/^\//, '');

  if (normalizedPattern === '') {
    return normalizedTarget === '';
  }

  const targetSegments = normalizedTarget.split('/').filter(Boolean);
  const patternSegments = normalizedPattern.split('/').filter(Boolean);
  const memo = new Map();

  function matchAt(targetIndex, patternIndex) {
    const memoKey = `${targetIndex}:${patternIndex}`;
    if (memo.has(memoKey)) {
      return memo.get(memoKey);
    }

    if (patternIndex === patternSegments.length) {
      const isMatch = targetIndex === targetSegments.length;
      memo.set(memoKey, isMatch);
      return isMatch;
    }

    const patternSegment = patternSegments[patternIndex];
    if (patternSegment === '**') {
      if (patternIndex === patternSegments.length - 1) {
        memo.set(memoKey, true);
        return true;
      }

      for (let nextTargetIndex = targetIndex; nextTargetIndex <= targetSegments.length; nextTargetIndex += 1) {
        if (matchAt(nextTargetIndex, patternIndex + 1)) {
          memo.set(memoKey, true);
          return true;
        }
      }

      memo.set(memoKey, false);
      return false;
    }

    if (targetIndex >= targetSegments.length) {
      memo.set(memoKey, false);
      return false;
    }

    const isMatch =
      matchesSegment(targetSegments[targetIndex], patternSegment) &&
      matchAt(targetIndex + 1, patternIndex + 1);

    memo.set(memoKey, isMatch);
    return isMatch;
  }

  return matchAt(0, 0);
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