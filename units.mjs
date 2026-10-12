/* Original physical-unit parsing and display. Geometry remains in assigned model units. */
const NUMBER='(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?';
const numeric=new RegExp(`^[+-]?${NUMBER}$`),unsigned=new RegExp(`^${NUMBER}$`);
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export const UNIT_SETTINGS_DEFAULTS=Object.freeze({linearFormat:'decimal',fractionPrecision:4,angularInputUnit:'degrees',angularFormat:'decimal-degrees',angularPrecision:4});
export const UNIT_PRESETS=Object.freeze({
  architectural:Object.freeze({units:'in',linearFormat:'architectural',precision:4,fractionPrecision:4,angularInputUnit:'degrees',angularFormat:'decimal-degrees',angularPrecision:4}),
  surveyor:Object.freeze({units:'in',linearFormat:'engineering',precision:3,fractionPrecision:4,angularInputUnit:'degrees',angularFormat:'dms',angularPrecision:0}),
  engineering:Object.freeze({units:'in',linearFormat:'engineering',precision:3,fractionPrecision:4,angularInputUnit:'degrees',angularFormat:'decimal-degrees',angularPrecision:3}),
});
export function normalizeUnitSettings(raw={}){
  const s={...UNIT_SETTINGS_DEFAULTS,...raw};
  if(!['decimal','architectural','engineering'].includes(s.linearFormat))throw Error('Unsupported linear format.');
  if(!['degrees','minutes','seconds','radians'].includes(s.angularInputUnit))throw Error('Unsupported angular input unit.');
  if(!['decimal-degrees','dms','radians','decimal-minutes','decimal-seconds'].includes(s.angularFormat))throw Error('Unsupported angular display format.');
  for(const key of ['fractionPrecision','angularPrecision'])if(!Number.isInteger(s[key])||s[key]<0||s[key]>8)throw Error(`${key} must be an integer from zero through eight.`);
  return Object.fromEntries(Object.keys(UNIT_SETTINGS_DEFAULTS).map(key=>[key,s[key]]));
}
function source(raw){
  if(typeof raw==='number'){if(!finite(raw))throw Error('Enter a finite value.');return String(raw);}
  if(typeof raw!=='string'||!raw.trim()||raw.length>256||/[\x00-\x1f]/.test(raw))throw Error('Enter one finite unit value.');
  return raw.trim().replace(/[‘’′]/g,"'").replace(/[“”″]/g,'"').replace(/−/g,'-');
}
function component(raw){
  const s=raw.trim();if(unsigned.test(s)){const value=Number(s);if(!finite(value))throw Error('Value exceeds the finite numeric range.');return value;}
  const fraction=s.match(/^(?:(\d+)\s*(?:-|\s)\s*)?(\d+)\s*\/\s*(\d+)$/);
  if(!fraction||Number(fraction[3])===0)throw Error('Invalid number or fraction.');
  const value=Number(fraction[1]??0)+Number(fraction[2])/Number(fraction[3]);if(!finite(value))throw Error('Value exceeds the finite numeric range.');return value;
}
function signed(raw){const s=source(raw),sign=s.startsWith('-')?-1:1;return{sign,text:s.replace(/^[+-]\s*/, '')};}
const inchToModel={unitless:1,in:1,ft:1/12,mm:25.4,cm:2.54,m:.0254};
const footToModel={unitless:12,in:12,ft:1,mm:304.8,cm:30.48,m:.3048};
export function modelToInches(units='unitless'){if(!Object.hasOwn(inchToModel,units))throw Error('Unsupported model unit.');return 1/inchToModel[units];}
export function parseLength(raw,settings={}){
  const {sign,text}=signed(raw),unit=settings.units??'unitless';if(!Object.hasOwn(inchToModel,unit))throw Error('Unsupported model unit.');let value;
  const feet=text.match(/^(.*?)\s*(?:'|feet|foot|ft)(.*)$/i);
  if(feet){const first=component(feet[1]),tail=feet[2].trim().replace(/^-\s*/,''),inches=tail?component(tail.replace(/(?:"|inches|inch|in)\s*$/i,'')):0;value=first*footToModel[unit]+inches*inchToModel[unit];}
  else{const explicit=text.match(/^(.*?)\s*(mm|cm|m|inches|inch|in|")$/i);if(explicit){const amount=component(explicit[1]),label=explicit[2].toLowerCase();if(['in','inch','inches','"'].includes(label))value=amount*inchToModel[unit];else value=amount*((({mm:1,cm:10,m:1000})[label])/({mm:1,cm:10,m:1000,in:25.4,unitless:25.4,ft:304.8})[unit]);}else value=component(text);}
  value*=sign;if(!finite(value))throw Error('Length exceeds the finite numeric range.');return value;
}
export function parseAngle(raw,settings={}){
  const {sign,text}=signed(raw);let value;
  const degree=text.match(new RegExp(`^(${NUMBER})\\s*(?:°|d|deg|degree|degrees)\\s*(?:(\\d+(?:\\.\\d+)?)\\s*'\\s*)?(?:(\\d+(?:\\.\\d+)?)\\s*"\\s*)?$`,'i'));
  const minute=text.match(new RegExp(`^(${NUMBER})\\s*(?:'|arcmin|min|minutes?)\\s*(?:(\\d+(?:\\.\\d+)?)\\s*"\\s*)?$`,'i'));
  const second=text.match(new RegExp(`^(${NUMBER})\\s*(?:"|arcsec|sec|seconds?)$`,'i'));
  const radians=text.match(new RegExp(`^(${NUMBER})\\s*(?:r|rad|radians?)$`,'i'));
  if(degree){const d=Number(degree[1]),m=Number(degree[2]??0),s=Number(degree[3]??0);if(m>=60||s>=60||degree[2]!==undefined&&!Number.isInteger(d)||degree[3]!==undefined&&(!Number.isInteger(d)||!Number.isInteger(m)))throw Error('DMS components require integer degrees/minutes and minutes/seconds below 60.');value=d+m/60+s/3600;}
  else if(minute){const m=Number(minute[1]),s=Number(minute[2]??0);if(s>=60||minute[2]!==undefined&&!Number.isInteger(m))throw Error('Minute/second components are invalid.');value=m/60+s/3600;}
  else if(second)value=Number(second[1])/3600;else if(radians)value=Number(radians[1])*180/Math.PI;
  else{if(!numeric.test(text))throw Error('Invalid angle. Use degrees, DMS, arcminutes, arcseconds or radians.');const factor={degrees:1,minutes:1/60,seconds:1/3600,radians:180/Math.PI}[settings.angularInputUnit??'degrees'];if(factor===undefined)throw Error('Unsupported angular input unit.');value=Number(text)*factor;}
  value*=sign;if(!finite(value))throw Error('Angle exceeds the finite numeric range.');return value;
}
function precision(value,fallback=4){const n=value===undefined?fallback:value;if(!Number.isInteger(n)||n<0||n>8)throw Error('Precision must be an integer from zero through eight.');return n;}
function decimal(value,p,trim=false){let s=value.toFixed(p);if(trim&&s.includes('.'))s=s.replace(/0+$/,'').replace(/\.$/,'');return /^-0(?:\.0*)?$/.test(s)?s.slice(1):s;}
function gcd(a,b){while(b){const t=a%b;a=b;b=t;}return a;}
export function formatLength(value,settings={},options={}){
  if(!finite(value))return 'out of range';const format=settings.linearFormat??'decimal',p=precision(options.precision,settings.precision??4);
  if(format==='decimal')return decimal(value,p,options.trim===true);
  if(!['architectural','engineering'].includes(format))throw Error('Unsupported linear format.');const inches=value*modelToInches(settings.units??'unitless'),fraction=precision(options.fractionPrecision,settings.fractionPrecision??4),scale=format==='architectural'?2**fraction:10**p,ticks=Math.round(Math.abs(inches)*scale);
  if(!Number.isSafeInteger(ticks))return 'out of range';const feet=Math.floor(ticks/(12*scale)),remaining=ticks-feet*12*scale,sign=inches<0&&ticks!==0?'-':'';
  if(format==='engineering')return `${sign}${feet}'-${decimal(remaining/scale,p,options.trim===true)}"`;
  const whole=Math.floor(remaining/scale),numerator=remaining-whole*scale,divisor=numerator?gcd(numerator,scale):1,f=numerator?`${whole?`${whole} `:''}${numerator/divisor}/${scale/divisor}`:String(whole);return `${sign}${feet}'-${f}"`;
}
export function formatAngle(degrees,settings={},options={}){
  if(!finite(degrees))return 'out of range';const format=settings.angularFormat??'decimal-degrees',p=precision(options.precision,settings.angularPrecision??4);
  if(format==='decimal-degrees')return `${decimal(degrees,p,options.trim===true)}°`;
  if(format==='radians')return `${decimal(degrees*(Math.PI/180),p,options.trim===true)} rad`;
  if(format==='decimal-minutes')return finite(degrees*60)?`${decimal(degrees*60,p,options.trim===true)}'`:'out of range';
  if(format==='decimal-seconds')return finite(degrees*3600)?`${decimal(degrees*3600,p,options.trim===true)}"`:'out of range';
  if(format!=='dms')throw Error('Unsupported angular display format.');const scale=10**p,ticks=Math.round(Math.abs(degrees)*3600*scale);if(!Number.isSafeInteger(ticks))return 'out of range';const d=Math.floor(ticks/(3600*scale)),rest=ticks-d*3600*scale,m=Math.floor(rest/(60*scale)),s=(rest-m*60*scale)/scale;return `${degrees<0&&ticks!==0?'-':''}${d}°${m}'${decimal(s,p,options.trim===true)}"`;
}
export function formatArea(value,settings={},options={}){
  if(!finite(value))return 'out of range';const p=precision(options.precision,settings.precision??4),imperial=['architectural','engineering'].includes(settings.linearFormat),factor=imperial?modelToInches(settings.units??'unitless')/12:1,area=value*factor*factor;if(!finite(area))return 'out of range';return `${decimal(area,p)}${imperial?' ft²':settings.units&&settings.units!=='unitless'?` ${settings.units}²`:''}`;
}
export function dxfUnitFormat(settings={}){
  const s={...UNIT_SETTINGS_DEFAULTS,...settings},imperial=['architectural','engineering'].includes(s.linearFormat),nativeImperial=!settings.units||['unitless','in'].includes(settings.units);
  const warnings=[];if(imperial&&!nativeImperial)warnings.push('Native DXF coordinate display uses decimal model units; imperial dimension labels retain physical conversion.');if(['decimal-minutes','decimal-seconds'].includes(s.angularFormat))warnings.push('Native DXF has no standalone decimal arcminute/arcsecond display format; its angular header uses decimal degrees and angular labels use explicit text.');if(s.angularFormat==='dms'&&s.angularPrecision>4)warnings.push('Native DXF DMS precision is limited to four decimal places of seconds; original labels retain the selected precision.');
  // Native angtos mode 1 precision 4 produces whole seconds; 0..3 are
  // degrees/minutes-only levels. Higher native levels add second decimals.
  return{lunits:imperial&&nativeImperial?(s.linearFormat==='engineering'?3:4):2,luprec:s.linearFormat==='architectural'&&nativeImperial?s.fractionPrecision:settings.precision??4,aunits:({ 'decimal-degrees':0,dms:1,radians:3,'decimal-minutes':0,'decimal-seconds':0})[s.angularFormat],auprec:s.angularFormat==='dms'?Math.min(8,s.angularPrecision+4):s.angularPrecision,dimlunit:({decimal:2,engineering:3,architectural:4})[s.linearFormat],dimlfac:imperial?modelToInches(settings.units??'unitless'):1,dimaunit:s.angularFormat==='dms'?1:s.angularFormat==='radians'?3:0,warnings,warning:warnings.join(' ')||null};
}
