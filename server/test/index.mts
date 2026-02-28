// Runs unit tests using the `node:test` runner.

import { Command, Option } from 'commander';
import { createWriteStream } from 'node:fs';
import { glob } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { run } from 'node:test';
import * as reporters from 'node:test/reporters';
import { fileURLToPath } from 'node:url';

const resolveImport = (specifier: string) =>
  fileURLToPath(import.meta.resolve(specifier));
const BASE_DIR = join(import.meta.dirname, '../..');

const program = new Command();
program
  .name('test')
  .argument('[file...]', 'Test file(s) to run (default: all)')
  .option(
    '-m, --test-name-pattern <pattern>',
    'Run tests matching the given pattern',
    (v, acc: string[]) => [...acc, v],
    [] as string[]
  )
  .option(
    '--test-reporter <reporter>',
    'Test reporter to use (repeatable)',
    (v, acc: string[]) => [...acc, v],
    [] as string[]
  )
  .option(
    '--test-reporter-destination <dest>',
    'Test reporter destination: stdout, stderr, or a file path (repeatable)',
    (v, acc: string[]) => [...acc, v],
    [] as string[]
  )
  .option(
    '--coverage, --experimental-test-coverage',
    'Enable code coverage collection'
  )
  // ignore additional options passed by vscode test runner
  .addOption(new Option('--test').hideHelp())
  .parse();

const positionals: string[] = program.args;
const opts = program.opts<{
  testNamePattern: string[];
  testReporter: string[];
  testReporterDestination: string[];
  experimentalTestCoverage: boolean;
}>();

let files: string[];

if (positionals.length > 0) {
  files = positionals.map((f) => resolve(f));
} else {
  files = [];
  for await (const entry of glob(join(BASE_DIR, 'server/**/*.test.ts'))) {
    files.push(resolve(entry));
  }
  files.sort();
}

// @ts-ignore
process.env.NODE_ENV = 'test';
// configure ts
process.env.TS_NODE_PROJECT = resolveImport('../tsconfig.json');
process.env.TS_NODE_FILES = 'true';

const stream = run({
  files,
  execArgv: [
    '--experimental-test-module-mocks',
    '-r',
    'ts-node/register',
    '-r',
    'tsconfig-paths/register',
    '-r',
    resolveImport('./setup.ts'),
  ],
  coverage: opts.experimentalTestCoverage,
  coverageExcludeGlobs: [
    join(BASE_DIR, 'server/test/**'),
    join(BASE_DIR, 'server/migration/**'),
  ],
  testNamePatterns: opts.testNamePattern,
});

// In CI, write a JUnit report to a file for use by GitHub
if (process.env.CI) {
  const reportStream = createWriteStream(join(BASE_DIR, 'report.xml'));
  stream.compose(reporters.junit).pipe(reportStream);
}

if (opts.testReporter.length > 0) {
  for (let i = 0; i < opts.testReporter.length; i++) {
    const reporterName = opts.testReporter[i];
    // check built-in reporters, otherwise import
    const reporter =
      reporterName in reporters
        ? reporters[reporterName as keyof typeof reporters]
        : await import(reporterName).then((m) => m.default);

    if (reporter == null) {
      console.error('Invalid test reporter: ', reporterName);
      process.exit(1);
    }

    const destArg = opts.testReporterDestination[i];
    const dest =
      destArg === 'stdout' || destArg == null
        ? process.stdout
        : destArg === 'stderr'
          ? process.stderr
          : createWriteStream(destArg);

    stream.compose(reporter).pipe(dest);
  }
} else {
  stream.compose(reporters.spec).pipe(process.stdout);
}
