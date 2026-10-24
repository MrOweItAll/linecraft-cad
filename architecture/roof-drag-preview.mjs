/* Original detached full-parent roof preview. Accepted source, editor, history,
 * camera, and persisted drawing fields are never changed by this adapter. */
import {previewRoofGroup,triangulateFace,architectureInputHash} from './editor-adapter.mjs';
import {reviseRoofComponentBounds} from './roof-component-edit.mjs';
import {toWorld} from './units-adapter.mjs';
import {roofDisplayEdges} from './view-adapter.mjs';

export function solveRoofDragPreview(architecture,settings,{roofGroupId,componentId,bounds}){
  const copiedBounds={minX:bounds?.minX,minY:bounds?.minY,maxX:bounds?.maxX,maxY:bounds?.maxY};
  const sourceHash=architectureInputHash(architecture),boundsHash=architectureInputHash({roofGroupId,componentId,bounds:copiedBounds});
  const empty={status:'invalid',roofStatus:'not-run',roofGroupId,componentId,sourceHash,boundsHash,generationHash:null,bounds:copiedBounds,diagnostics:[],counts:{faces:0,triangles:0,edges:0,closures:0},entities:[],triangles:[],edges:[]};
  try{
    const {group}=reviseRoofComponentBounds(architecture,roofGroupId,componentId,copiedBounds),solved=previewRoofGroup(architecture,group,settings);
    const review=group.reviewDrainage===true&&solved.status==='needs-review'&&solved.reviewOnly===true&&solved.validation?.geometry==='valid'&&solved.validation?.drainage==='failed';
    if(solved.status!=='ok'&&!review)return{...empty,roofStatus:solved.status,diagnostics:(solved.diagnostics??[]).map(item=>typeof item==='string'?item:item.message||'The proposed roof is not valid.')};
    const source=structuredClone(architecture);source.roofGroups[source.roofGroups.findIndex(item=>item.id===roofGroupId)]=group;
    const roof={...solved,id:roofGroupId},derived={roofs:[roof],owners:{}},entities=[],triangles=[],edges=[];
    const add=(part,vertices,faces)=>{if(!vertices.length||!faces.length)return;const id=`@architecture/roofGroup/${roofGroupId}/${part}`,entity={id,type:'MESH',vertices,faces,layer:'0',...(review&&part==='surface'?{color:'#e5ad45'}:{})};entities.push(entity);derived.owners[id]={kind:'roofGroup',id:roofGroupId};for(const[faceIndex,face]of faces.entries())triangles.push({entityId:id,part,faceIndex,points:face.map(index=>({...vertices[index]}))});};
    const vertices=[],faces=[];for(const face of solved.faces){const at=vertices.length;vertices.push(...face.vertices.map(point=>toWorld(point,source.buildingFrame)));faces.push(...triangulateFace(face.vertices).map(triangle=>triangle.map(index=>index+at)));}add('surface',vertices,faces);
    for(const[kind,closures]of [['gable',solved.gableClosures??[]],['step',solved.stepClosures??[]]])for(const[index,closure]of closures.entries()){const vertices=closure.vertices.map(point=>toWorld(point,source.buildingFrame));add(`${kind}-closure-${index}`,vertices,Array.from({length:vertices.length-2},(_,i)=>[0,i+1,i+2]));}
    for(const entity of entities)for(const edge of roofDisplayEdges(entity,source,derived)??[])edges.push({entityId:entity.id,part:entity.id.slice(`@architecture/roofGroup/${roofGroupId}/`.length),id:edge.id,kind:edge.kind,a:{...edge.a},b:{...edge.b}});
    const generationHash=architectureInputHash({sourceHash,boundsHash,entities,edges});
    return{...empty,status:review?'review':'valid',roofStatus:solved.status,generationHash,diagnostics:(solved.diagnostics??[]).map(item=>typeof item==='string'?item:item.message||'Roof review required.'),counts:{faces:solved.faces.length,triangles:triangles.length,edges:edges.length,closures:(solved.gableClosures?.length??0)+(solved.stepClosures?.length??0)},entities,triangles,edges};
  }catch(error){return{...empty,diagnostics:[error.message||'The proposed roof could not be solved.']};}
}
