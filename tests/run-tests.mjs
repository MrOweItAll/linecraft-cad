import {run} from 'node:test';
import {writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import util from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const resultPath = path.join(here, 'core-results.json');
const startedAt = new Date().toISOString();
const tests = [];
let summary = null;
const stream = run({files: [path.join(here, 'core.test.mjs')], concurrency: false});
for await (const event of stream) {
  if (event.type === 'test:pass' || event.type === 'test:fail') {
    const data = event.data;
    const row = {
      name: data.name,
      status: event.type === 'test:pass' ? 'passed' : 'failed',
      durationMs: data.details?.duration_ms ?? null,
    };
    if (row.status === 'failed') row.error = util.inspect(data.details?.error, {depth: 4});
    tests.push(row);
    process.stdout.write(`${row.status === 'passed' ? 'PASS' : 'FAIL'} ${row.name}\n`);
    if (row.error) process.stdout.write(`${row.error}\n`);
  }
  if (event.type === 'test:summary') summary = event.data;
}
const failed = tests.filter(test => test.status === 'failed').length;
const report = {
  framework: 'Node.js node:test',
  nodeVersion: process.version,
  startedAt,
  completedAt: new Date().toISOString(),
  testFile: 'tests/core.test.mjs',
  total: tests.length,
  passed: tests.length - failed,
  failed,
  tests,
  summary,
};
await writeFile(resultPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`\n${report.passed}/${report.total} passed; report: ${resultPath}\n`);
process.exitCode = failed ? 1 : 0;
