// The original Nomial.NewNomial uses 0, 1, and 10 support cards at
// magnitudes 1, 10, and 100. Constant.InsertNomial resets at each comma.
export const scaleGroups = [
  { mark: '', name: 'units' }, { mark: 'k', name: 'thousands' },
  { mark: 'M', name: 'millions' }, { mark: 'B', name: 'billions' },
  { mark: 'T', name: 'trillions' },
];
export function placeMetadata(exponent) {
  const group = Math.floor(exponent / 3), local = exponent % 3;
  return { exponent, group, local, magnitude: 10 ** local, supportCards: [0, 1, 10][local], ...scaleGroups[group] };
}
export function digitPlaces(input) {
  const value = String(input).trim();
  if (!/^-?(?:\d+|\d{1,3}(?:,\d{3})+)$/.test(value)) throw new Error('Use a whole number with optional thousands commas, such as 1,234,567.');
  const digits = value.replace(/[-,]/g,'').replace(/^0+(?=\d)/,'');
  if(digits.length > 15) throw new Error('Explore up to 15 digits, through the trillions group.');
  return { negative:value.startsWith('-'), digits, formatted:(value.startsWith('-')?'-':'')+digits.replace(/\B(?=(\d{3})+(?!\d))/g,','), places:[...digits].map((digit,index)=>({digit:Number(digit),...placeMetadata(digits.length-index-1)})) };
}
