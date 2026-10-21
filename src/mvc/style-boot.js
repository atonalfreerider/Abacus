// Runs before the first paint (a blocking classic script), so a page opened in the cyber
// style never flashes the sketchpad. ?style=cyber|sketchpad overrides the saved choice.
(()=>{let style=null;try{style=new URLSearchParams(location.search).get('style')||localStorage.getItem('abacus-style');}catch{}
if(style==='cyber'||style==='sketchpad')document.documentElement.dataset.style=style;})();
