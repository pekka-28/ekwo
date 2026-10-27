// sign-in.js
import {config} from './config.js';
import {createDataClient} from './data-client.js';
const dataClient=createDataClient(config.url,config.publishableKey,sessionStorage);
const root=document.documentElement,form=document.getElementById('login-form'),error=document.getElementById('login-error');
function theme(){root.dataset.theme=localStorage.getItem('ekwo-ui-theme')==='dark'?'night':'day';root.dataset.palette=localStorage.getItem('ekwo-ui-accent')||'cobalt';}
theme();document.getElementById('theme-toggle').onclick=()=>{localStorage.setItem('ekwo-ui-theme',root.dataset.theme==='night'?'light':'dark');theme();};document.getElementById('accent-toggle').onclick=()=>{localStorage.setItem('ekwo-ui-accent',root.dataset.palette==='gold'?'cobalt':'gold');theme();};
error.textContent=sessionStorage.getItem('ekwo-login-error')||'';sessionStorage.removeItem('ekwo-login-error');
form.onsubmit=async e=>{e.preventDefault();error.textContent='';e.submitter.disabled=true;try{const {error:failure}=await dataClient.auth.signInWithPassword({email:document.getElementById('email').value,password:document.getElementById('password').value});if(failure)throw failure;document.getElementById('password').value='';location.replace('./');}catch(e){error.textContent=e.message;}finally{e.submitter.disabled=false;}};
