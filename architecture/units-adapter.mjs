/* Original, reversible architecture frame conversion. Source remains in assigned model units. */
export const MILLIMETERS_PER_UNIT=Object.freeze({in:25.4,ft:304.8,mm:1,cm:10,m:1000});
export function physicalScale(settings={}){const unit=typeof settings==='string'?settings:settings.units;const scale=MILLIMETERS_PER_UNIT[unit];if(!scale)throw Error('Assign inches, feet, millimeters, centimeters, or meters before architectural physical analysis.');return scale;}
export function geometryTolerance(settings={}){return .01/physicalScale(settings);}
export function toWorld(point,frame){const a=frame.rotationDegrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return{x:frame.origin.x+c*point.x-s*point.y,y:frame.origin.y+s*point.x+c*point.y,z:frame.origin.z+(point.z??0)};}
export function fromWorld(point,frame){const a=frame.rotationDegrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a),x=point.x-frame.origin.x,y=point.y-frame.origin.y;return{x:c*x+s*y,y:-s*x+c*y,z:(point.z??frame.origin.z)-frame.origin.z};}
