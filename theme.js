const root=document.documentElement;
function render(){
 root.dataset.theme=localStorage.getItem('ekwo-lustre-theme')||'light';
 root.dataset.accent=localStorage.getItem('ekwo-lustre-accent')||'cobalt';
 document.querySelector('#theme-toggle')?.setAttribute('aria-pressed',String(root.dataset.theme==='dark'));
 document.querySelector('#accent-toggle')?.setAttribute('aria-pressed',String(root.dataset.accent==='gold'));
}
render();
document.querySelector('#theme-toggle')?.addEventListener('click',()=>{localStorage.setItem('ekwo-lustre-theme',root.dataset.theme==='dark'?'light':'dark');render();});
document.querySelector('#accent-toggle')?.addEventListener('click',()=>{localStorage.setItem('ekwo-lustre-accent',root.dataset.accent==='gold'?'cobalt':'gold');render();});
