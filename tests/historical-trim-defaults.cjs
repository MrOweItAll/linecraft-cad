'use strict';
// Test expectations only. Historical native/sample bytes remain unchanged.
// Do not replace this fixed spec with createEditor-derived normalization.
const DECLARED_TRIM_DEFAULTS=Object.freeze({trimExtendMode:'quick',trimProject:'ucs',trimEdgeExtend:false});
function settingsOf(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||!raw.settings||typeof raw.settings!=='object'||Array.isArray(raw.settings))throw TypeError('Historical fixture adapter requires an existing document settings object.');
 return raw.settings;
}
function withHistoricalTrimDefaults(raw){
 const settings=settingsOf(raw),copy=structuredClone(raw);
 for(const[key,value]of Object.entries(DECLARED_TRIM_DEFAULTS))if(!Object.hasOwn(settings,key))copy.settings[key]=value;
 return copy;
}
function describeHistoricalTrimDefaults(raw){
 const settings=settingsOf(raw);
 return{adapter:'HistoricalTrimDefaults/1',scope:'Expected-value clone only; exactly the declared missing trim settings are added. No engine-derived normalization, source native rewrite or geometry/scale adaptation.',declaredDefaults:{...DECLARED_TRIM_DEFAULTS},fieldsAdded:Object.keys(DECLARED_TRIM_DEFAULTS).filter(key=>!Object.hasOwn(settings,key)).map(key=>({path:'settings.'+key,value:DECLARED_TRIM_DEFAULTS[key]}))};
}
module.exports=Object.freeze({DECLARED_TRIM_DEFAULTS,withHistoricalTrimDefaults,describeHistoricalTrimDefaults});
