import {nativeIcon} from './icons.js';
const $=id=>document.getElementById(id),root=document.documentElement;
function folded(value){root.dataset.folded=String(value);$('fold-sidebar').innerHTML=nativeIcon(value?'panel-left-open':'panel-left-close');$('fold-sidebar').title=value?'Open the side bar':'Fold the side bar';$('fold-sidebar').setAttribute('aria-label',$('fold-sidebar').title);localStorage.setItem('ekwo-sidebar-folded',String(value));}
folded(localStorage.getItem('ekwo-sidebar-folded')==='true');$('fold-sidebar').onclick=()=>folded(root.dataset.folded!=='true');
function menu(value){root.dataset.menuOpen=String(value);$('menu-backdrop').hidden=!value;$('menu-toggle').setAttribute('aria-expanded',String(value));if(value)$('company-toggle').focus();else $('menu-toggle').focus();}
$('menu-toggle').onclick=()=>menu(root.dataset.menuOpen!=='true');$('menu-backdrop').onclick=()=>menu(false);$('side-menu').addEventListener('click',()=>{if(innerWidth<768)menu(false)});
function account(value){$('account-menu').hidden=!value;$('account-toggle').setAttribute('aria-expanded',String(value));}
$('account-toggle').onclick=()=>account($('account-menu').hidden);document.addEventListener('click',e=>{if(!e.target.closest('#account-controls'))account(false)});document.addEventListener('keydown',e=>{if(e.key==='Escape'){account(false);if(root.dataset.menuOpen==='true')menu(false)}});
$('accent-toggle').append('Accent');$('theme-toggle').append('Day / Night');

$('menu-toggle').innerHTML=nativeIcon('menu');
