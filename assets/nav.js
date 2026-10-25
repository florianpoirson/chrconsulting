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
