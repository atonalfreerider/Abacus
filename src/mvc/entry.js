// Shared incremental input for hardware keys and the on-screen keypad.
export class EquationEntry {
 constructor(){this.text='';this.active=false;}
 clear(){this.text='';this.active=true;}
 key(key){
  if(key==='Escape'){this.active=false;return null;}
  if(key==='Enter'){this.active=false;return this.text;}
  if(!this.active){this.text='';this.active=true;}
  if(key==='Backspace')this.text=this.text.slice(0,-1);
  else if(/^[0-9xX.+\-*/=(),]$/.test(key))this.text+=key.toLowerCase();
  else return null;
  return this.text;
 }
 preview(){let text=this.text.replace(/[+\-*/(]+$/,'');if(!text)return '0';if(text.endsWith('='))text+='0';return text;}
}
