/* Menu « Outils & solutions » + menu mobile — partagé par toutes les pages */
(function(){
  var dd=document.querySelector('.dd'), btn=dd&&dd.querySelector('.dd-btn');
  function closeDd(){if(dd){dd.classList.remove('open');btn.setAttribute('aria-expanded','false');}}
  if(btn){
    btn.addEventListener('click',function(e){e.stopPropagation();var o=!dd.classList.contains('open');dd.classList.toggle('open',o);btn.setAttribute('aria-expanded',o?'true':'false');});
    document.addEventListener('click',function(e){if(!dd.contains(e.target))closeDd();});
    dd.addEventListener('focusout',function(e){if(!dd.contains(e.relatedTarget))closeDd();});
  }
  var tg=document.querySelector('.m-toggle'), menu=document.getElementById('m-menu');
  function setTop(){var h=document.querySelector('header');if(h&&menu)menu.style.setProperty('--m-top',h.getBoundingClientRect().bottom+'px');}
  function closeM(){if(!menu)return;menu.classList.remove('open');tg.setAttribute('aria-expanded','false');document.body.classList.remove('m-open');}
  if(tg&&menu){
    tg.addEventListener('click',function(){var o=!menu.classList.contains('open');setTop();menu.classList.toggle('open',o);tg.setAttribute('aria-expanded',o?'true':'false');document.body.classList.toggle('m-open',o);});
    menu.addEventListener('click',function(e){if(e.target.closest('a'))closeM();});
    window.addEventListener('resize',function(){if(window.innerWidth>900)closeM();});
  }
  document.addEventListener('keydown',function(e){if(e.key==='Escape'){closeDd();closeM();}});
})();
/* Mesure des contacts (GA4, uniquement si l'utilisateur a accepté les cookies) */
(function(){
  function ev(n,p){if(typeof window.gtag==='function')window.gtag('event',n,p||{});}
  document.addEventListener('click',function(e){
    var a=e.target.closest('a,button');if(!a)return;
    var h=a.getAttribute('href')||'';
    if(/wa\.me\//.test(h))ev('contact_whatsapp');
    else if(/^mailto:/.test(h))ev('contact_email');
    else if(a.hasAttribute('data-cal-link')||/cal\.com\//.test(h))ev('rdv_expert_clic');
    else if(/app\.chrconsulting\.fr/.test(h))ev('outil_pilotage_clic');
    else if(/\.xlsx($|\?)/.test(h))ev('telechargement_modele_excel');
  },true);
  var q=new URLSearchParams(location.search).get('commande');
  if(q&&/\/plan-de-maitrise-sanitaire\/telechargement\//.test(location.pathname)){
    var k='chr_ga_pms_'+q,done=false;try{done=!!localStorage.getItem(k);localStorage.setItem(k,'1');}catch(x){}
    if(!done)ev('purchase',{page_location:location.origin+location.pathname,transaction_id:q,value:50,currency:'EUR',items:[{item_name:'Plan de maîtrise sanitaire',price:50,quantity:1}]});
  }
})();
