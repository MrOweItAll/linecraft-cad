import {preserveHistoricalNativeFixture} from './historical-native-fixture.mjs';
// Reproducible original drawing for external curve/hatch/block DXF inspection.
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createEditor} from '../core.mjs';
const editor=createEditor(),commands=[],run=inputs=>{commands.push(...inputs);for(const input of inputs){const result=editor.execute(input);if(!result.ok)throw Error(`${input}: ${result.message}`);}};
run(['ELLIPSE','0,0','40,0','8','SPLINE','M','CV','60,0','60,20','100,20','100,0','','DIMANGULAR','120,0','140,0','120,20','135,15']);
run(['RECTANG','0,50','40,80','HATCH','PARALLEL','30','4','e4']);
run(['CIRCLE','60,65','15','HATCH','SOLID','e6','ELLIPSE','C','120,65','140,65','8','HATCH','PARALLEL','45','3','e8']);
run(['LINE','0,110','40,110','','LINE','40,110','40,150','','FILLET','8','20,110','40,130']);
run(['LINE','60,110','100,110','','LINE','100,110','100,150','','CHAMFER','5','10','80,110','100,130']);
editor.select(['e1','e2','e3','e5']);run(['BLOCK','AdvancedPart','0,0','','INSERT','AdvancedPart','200,0','1.5','30']);
const dxf=editor.exportDXF();await writeFile(new URL('../samples/advanced-v14-reference.dxf',import.meta.url),dxf);preserveHistoricalNativeFixture(new URL('../samples/advanced-v14-reference.linecraft',import.meta.url),editor.serialize());
const report={framework:'Original independently authored advanced exchange sample',completedAt:new Date().toISOString(),commands,pickfirstBlockSelection:['e1','e2','e3','e5'],entities:editor.state.entities.map(entity=>entity.type),blocks:editor.state.blocks.map(block=>({name:block.name,types:block.entities.map(entity=>entity.type)})),dxfSHA256:createHash('sha256').update(dxf).digest('hex'),scope:'External parser audit recorded separately. Native AutoCAD Open/AUDIT has not been performed on this sample.'};await writeFile(new URL('./advanced-sample-v14-results.json',import.meta.url),`${JSON.stringify(report,null,2)}\n`);console.log(`${editor.state.entities.length} model entities; ${editor.state.blocks.length} original reusable block; ${report.dxfSHA256}`);
