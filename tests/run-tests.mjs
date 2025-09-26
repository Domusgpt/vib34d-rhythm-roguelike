import process from 'node:process';

const tests = [];
const cleanups = [];

globalThis.test = (name, fn) => {
  tests.push({ name, fn });
};

globalThis.afterAll = (fn) => {
  cleanups.push(fn);
};

const files = [
  './stateManager.test.mjs',
];

for (const file of files) {
  await import(new URL(file, import.meta.url));
}

let failures = 0;

for (const { name, fn } of tests) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`❌ ${name}`);
    console.error(error);
  }
}

for (const cleanup of cleanups) {
  try {
    await cleanup();
  } catch (error) {
    failures += 1;
    console.error('❌ Cleanup failure');
    console.error(error);
  }
}

if (failures > 0) {
  process.exitCode = 1;
  console.error(`\n${failures} test${failures === 1 ? '' : 's'} failed or cleanup errors occurred.`);
} else {
  console.log(`\nAll ${tests.length} tests passed.`);
}
