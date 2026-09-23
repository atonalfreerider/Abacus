// Exact decimal text from reduced rationals: no floating-point formatting.
export function decimalText(value){
 let n=BigInt(Math.abs(value.n)),d=BigInt(value.d),remaining=d;
 for(const factor of [2n,5n])while(remaining%factor===0n)remaining/=factor;
 if(remaining!==1n)return null;
 let text=String(n/d),r=n%d;if(r){text+='.';while(r){r*=10n;text+=String(r/d);r%=d;}}
 return (value.n<0?'-':'')+text;
}
export function numberSpec(term){
 const decimal=(term.notation==='fraction'||term.notation==='mixed')&&term.value.d!==1?null:decimalText(term.value);
 if(decimal===null)return null;
 const [whole,rawFraction='']=decimal.replace('-','').split('.'),fraction=rawFraction.padEnd(term.decimalPlaces||0,'0'),places=[],markers=[];let x=0;
 const chars=whole+fraction;
 for(let i=0;i<chars.length;i++){
  const exponent=whole.length-i-1;
  if(i&&(exponent===-1||exponent>=0&&exponent%3===2||exponent<0&&exponent%3===0)){markers.push({x,decimal:exponent===-1});x+=40;}
  places.push({digit:Number(chars[i]),exponent,x});x+=160;
 }
 return {places,markers,width:x,minPlace:-fraction.length,maxPlace:whole.length-1,text:(term.value.n<0?'-':'')+whole+(fraction?'.'+fraction:'')};
}
export function placeOffset(place){return place>=0?-(place+1)*160-Math.floor(place/3)*40: (-place-1)*160+(Math.floor(-place/3)+1)*40;}
