// One, ten, and one hundred physical cards per occupied cell.
// The cycle restarts at commas; every card carries its group inscription.
export const scaleGroups = [
  { mark: '', name: 'units' }, { mark: 'k', name: 'thousands' },
  { mark: 'M', name: 'millions' }, { mark: 'B', name: 'billions' },
  { mark: 'T', name: 'trillions' }, { mark: 'Q', name: 'quadrillions' },
];
export function placeMetadata(exponent) {
  if(exponent<0)return {exponent,group:0,local:0,magnitude:10**exponent,cardCount:1,supportCards:0,mark:'',name:'decimal',innerScale:10**(exponent/2)};
  const group = Math.floor(exponent / 3), local = exponent % 3;
  return { exponent, group, local, magnitude: 10 ** local, cardCount: 10 ** local, supportCards: 10 ** local - 1, ...scaleGroups[group] };
}
export function digitPlaces(input) {
  const value = String(input).trim();
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value)) throw new Error('Use a whole number with optional thousands commas, such as 1,234,567.');
  const digits = value.replace(/[-,]/g,'').replace(/^0+(?=\d)/,'');
  if(digits.length > 15) throw new Error('Explore up to 15 digits, through the trillions group.');
  return { negative:value.startsWith('-'), digits, formatted:(value.startsWith('-')?'-':'')+digits.replace(/\B(?=(\d{3})+(?!\d))/g,','), places:[...digits].map((digit,index)=>({digit:Number(digit),...placeMetadata(digits.length-index-1)})) };
}
