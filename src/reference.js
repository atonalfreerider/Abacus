// A comparison surface with no director bridge or UI additions.
while (!window.RufflePlayer?.newest) await new Promise(resolve => setTimeout(resolve, 50));
const player = window.RufflePlayer.newest().createPlayer();
document.getElementById('equation-space').append(player);
await player.ruffle().load({url: new URL('../ABACUS.swf', import.meta.url).href, allowScriptAccess:false, allowNetworking:'none'});
