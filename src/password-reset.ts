import {createClient} from '@supabase/supabase-js';
import {config} from '../config.js';

const requestForm=document.querySelector<HTMLFormElement>('#request-form')!;
const updateForm=document.querySelector<HTMLFormElement>('#update-form')!;
const message=document.querySelector<HTMLElement>('#message')!;
const email=document.querySelector<HTMLInputElement>('#email')!;
const password=document.querySelector<HTMLInputElement>('#new-password')!;
const confirmation=document.querySelector<HTMLInputElement>('#confirm-password')!;
let recovery=false;
// Recovery has its own in-memory session; do not overwrite or take over Planning.
const client=createClient(config.url,config.publishableKey,{auth:{
  storageKey:'lustre-password-recovery',persistSession:false,autoRefreshToken:false,
  detectSessionInUrl:true,flowType:'implicit',
}});
client.auth.onAuthStateChange((event,session)=>{
  if(event==='PASSWORD_RECOVERY'&&session){
    recovery=true;requestForm.hidden=true;updateForm.hidden=false;
    message.textContent='Enter your new password.';
  }
});
const initial=await client.auth.initialize();
// Recovery credentials must not remain in the address bar or copied URLs.
history.replaceState(null,'',location.pathname);
if(initial.error)message.textContent='This recovery link is invalid or expired. Request a new email below.';

requestForm.addEventListener('submit',async event=>{
  event.preventDefault();const button=requestForm.querySelector<HTMLButtonElement>('button')!;
  button.disabled=true;message.textContent='Sending recovery email…';
  try{
    const {error}=await client.auth.resetPasswordForEmail(email.value.trim(),{
      redirectTo:new URL('../reset-password.html',import.meta.url).href,
    });
    if(error)throw error;
    message.textContent='If this address has an account, a recovery email has been sent. Open the newest email to choose your password.';
  }catch(error){message.textContent=error instanceof Error?error.message:'Unable to send recovery email.';}
  finally{button.disabled=false;}
});
updateForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!recovery){message.textContent='Open a fresh recovery email first.';return;}
  if(password.value!==confirmation.value){message.textContent='The passwords do not match.';return;}
  const button=updateForm.querySelector<HTMLButtonElement>('button')!;button.disabled=true;
  try{
    const {error}=await client.auth.updateUser({password:password.value});
    if(error)throw error;
    password.value='';confirmation.value='';recovery=false;updateForm.hidden=true;
    message.textContent='Password updated. You can now sign in with your new password.';
    await client.auth.signOut({scope:'local'});
  }catch(error){message.textContent=error instanceof Error?error.message:'Unable to update password.';}
  finally{button.disabled=false;}
});
