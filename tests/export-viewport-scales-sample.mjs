/* Original editable sample; its PDF is copied only from audited actual Chromium output. */
import {readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {createEditor} from '../core.mjs';
import {PHYSICAL_UNIT_CASES,rawArchitecturalScaleDrawing} from './viewport-scales-fixtures-v18.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const editor=createEditor(rawArchitecturalScaleDrawing(PHYSICAL_UNIT_CASES[0])),text=editor.serialize();
await writeFile(path.join(root,'samples/viewport-scales-v18.linecraft'),text);
const producerFile=path.join(root,'tests/viewport-scales-pdf-v18-render-results.json'),producerBytes=await readFile(producerFile),producer=JSON.parse(producerBytes),audit=JSON.parse(await readFile(path.join(root,'tests/viewport-scales-pdf-v18-audit-results.json'),'utf8'));
assert.equal(producer.failed,0);assert.equal(producer.sourceChangedDuringRun,false);assert.equal(audit.failed,0);assert.equal(audit.producerSHA256,hash(producerBytes));
const output=producer.exports.find(item=>item.name==='in'),pdf=await readFile(path.join(root,output.pdf));assert.equal(hash(pdf),output.pdfSHA256);assert.equal(await readFile(path.join(root,'tests/viewport-scales-pdf-v18/in.linecraft'),'utf8'),text);
await copyFile(path.join(root,output.pdf),path.join(root,'work/viewport-scales-v18-example.pdf'));
if(path.basename(path.dirname(root))==='outputs')await copyFile(path.join(root,output.pdf),path.join(root,'../Linecraft-Viewport-Scales-1.8.pdf'));
console.log(JSON.stringify({drawing:'samples/viewport-scales-v18.linecraft',drawingSHA256:hash(Buffer.from(text)),pdf:'work/viewport-scales-v18-example.pdf',pdfSHA256:hash(pdf),producerSHA256:hash(producerBytes),auditedLengthsMm:[76.2,152.4,38.1,57.15]},null,2));
