import {run} from 'node:test';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import util from 'node:util';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.dirname(here),tests=[],startedAt=new Date().toISOString();
const coreSHA256=createHash('sha256').update(await readFile(path.join(root,'core.mjs'))).digest('hex');
for await(const event of run({files:[path.join(here,'mesh-v14.test.mjs')],concurrency:false}))if(['test:pass','test:fail'].includes(event.type)){const row={name:event.data.name,status:event.type==='test:pass'?'passed':'failed',durationMs:event.data.details?.duration_ms??null};if(row.status==='failed')row.error=util.inspect(event.data.details?.error,{depth:5});tests.push(row);console.log(`${row.status==='passed'?'PASS':'FAIL'} ${row.name}`);if(row.error)console.log(row.error);}
const report={framework:'Independent analytical polygonal 3D geometry and document validation',scope:'Original bounds, edge incidence/orientation, Euler characteristic, signed tetrahedral volume and shoelace area checks. These are analytical tests, not claims of actual AutoCAD command equivalence or ACIS solids.',startedAt,completedAt:new Date().toISOString(),coreSHA256,total:tests.length,passed:tests.filter(test=>test.status==='passed').length,failed:tests.filter(test=>test.status==='failed').length,tests};
await writeFile(path.join(here,'mesh-v14-results.json'),`${JSON.stringify(report,null,2)}\n`);console.log(`${report.passed}/${report.total} passed`);process.exitCode=report.failed?1:0;
