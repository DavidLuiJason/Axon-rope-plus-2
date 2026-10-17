export type UnitCategory='length'|'mass'|'temperature'|'volume'|'area'|'speed'|'time'|'data';
export interface Unit { name:string; symbol:string; category:UnitCategory; factor?:number; offset?:number; }
export type UnitConvertResult={ok:true;value:number;formatted:string;from:Unit;to:Unit}|{ok:false;error:'invalid-value'|'unknown-unit'|'category-mismatch'|'domain'};
const defs:Record<UnitCategory,Unit[]> = {
 length:[['metre','m',1],['kilometre','km',1000],['centimetre','cm',.01],['millimetre','mm',.001],['mile','mi',1609.344],['yard','yd',.9144],['foot','ft',.3048],['inch','in',.0254]].map(([name,symbol,factor])=>({name:String(name),symbol:String(symbol),category:'length',factor:Number(factor)})),
 mass:[['kilogram','kg',1],['gram','g',.001],['milligram','mg',.000001],['tonne','t',1000],['pound','lb',.45359237],['ounce','oz',.028349523125]].map(([name,symbol,factor])=>({name:String(name),symbol:String(symbol),category:'mass',factor:Number(factor)})),
 temperature:[{name:'Celsius',symbol:'°C',category:'temperature'},{name:'Fahrenheit',symbol:'°F',category:'temperature'},{name:'kelvin',symbol:'K',category:'temperature'}],
 volume:[['litre','L',1],['millilitre','mL',.001],['cubic metre','m³',1000],['US gallon','gal',3.785411784],['US cup','cup',.2365882365],['US fluid ounce','fl oz',.0295735295625]].map(([name,symbol,factor])=>({name:String(name),symbol:String(symbol),category:'volume',factor:Number(factor)})),
 area:[['square metre','m²',1],['square kilometre','km²',1e6],['hectare','ha',10000],['acre','ac',4046.8564224],['square foot','ft²',.09290304]].map(([name,symbol,factor])=>({name:String(name),symbol:String(symbol),category:'area',factor:Number(factor)})),
 speed:[['metre per second','m/s',1],['kilometre per hour','km/h',1/3.6],['mile per hour','mph',.44704],['knot','kn',.514444444444]].map(([name,symbol,factor])=>({name:String(name),symbol:String(symbol),category:'speed',factor:Number(factor)})),
 time:[['second','s',1],['millisecond','ms',.001],['minute','min',60],['hour','h',3600],['day','d',86400],['week','wk',604800]].map(([name,symbol,factor])=>({name:String(name),symbol:String(symbol),category:'time',factor:Number(factor)})),
 data:[['bit','bit',1],['byte','B',8],['kilobit','kbit',1000],['kilobyte','kB',8000],['megabit','Mbit',1e6],['megabyte','MB',8e6],['gigabit','Gbit',1e9],['gigabyte','GB',8e9],['terabit','Tbit',1e12],['terabyte','TB',8e12],['kibibit','Kibit',1024],['kibibyte','KiB',8192],['mebibit','Mibit',1048576],['mebibyte','MiB',8388608],['gibibit','Gibit',1073741824],['gibibyte','GiB',8589934592],['tebibit','Tibit',1099511627776],['tebibyte','TiB',8796093022208]].map(([name,symbol,factor])=>({name:String(name),symbol:String(symbol),category:'data',factor:Number(factor)}))
};
export const UNITS:Readonly<Record<UnitCategory,readonly Unit[]>>=defs;
export function listUnits(category:UnitCategory):readonly Unit[]{return defs[category]||[];}
function findUnit(s:string):Unit|undefined {return Object.values(defs).flat().find(u=>u.symbol.toLowerCase()===s.toLowerCase()||u.name.toLowerCase()===s.toLowerCase());}
export function convert(value:number,from:string,to:string):UnitConvertResult {
 if(typeof value!=='number'||!Number.isFinite(value))return{ok:false,error:'invalid-value'};
 if(typeof from!=='string'||typeof to!=='string')return{ok:false,error:'unknown-unit'};
 const a=findUnit(from),b=findUnit(to);if(!a||!b)return{ok:false,error:'unknown-unit'};
 if(a.category!==b.category)return{ok:false,error:'category-mismatch'};
 let out:number;
 if(a.category==='temperature'){
  if(a.symbol==='K'&&value<0)return{ok:false,error:'domain'};
  const c=a.symbol==='°C'?value:a.symbol==='°F'?(value-32)*5/9:value-273.15;
  out=b.symbol==='°C'?c:b.symbol==='°F'?c*9/5+32:c+273.15;
  if((b.symbol==='K'&&out<0)||!Number.isFinite(out))return{ok:false,error:'domain'};
 }else out=value*(a.factor||1)/(b.factor||1);
 if(!Number.isFinite(out))return{ok:false,error:'domain'};
 const rounded=Number(out.toPrecision(12));return{ok:true,value:rounded,formatted:String(rounded),from:a,to:b};
}
