document.addEventListener('DOMContentLoaded',()=>{
 document.querySelectorAll('[data-confirm]').forEach(el=>{
   el.addEventListener('click',e=>{if(!confirm(el.dataset.confirm))e.preventDefault()});
 });
 const menu=document.querySelector('[data-mobile-toggle]');
 const side=document.querySelector('.sidebar');
 if(menu&&side)menu.addEventListener('click',()=>{side.style.display=side.style.display==='block'?'none':'block'});
});
