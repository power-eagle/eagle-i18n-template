const { packagePlugin } = require('./package-plugin.cjs');

function main() {
  const repoRoot = process.cwd();
  const releaseResult = packagePlugin('release', { repoRoot });
  const debugResult = packagePlugin('debug', { repoRoot });

  console.log('generated packages:');
  console.log(`- ${releaseResult.outputPath}`);
  console.log(`- ${debugResult.outputPath}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}