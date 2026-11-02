export async function activateWaitingUpdate(registration:ServiceWorkerRegistration|undefined){
  const worker=registration?.waiting;
  if(!worker)return;
  await new Promise<void>((resolve,reject)=>{
    const changed=()=>{
      if(worker.state==='activated'){worker.removeEventListener('statechange',changed);resolve();}
      else if(worker.state==='redundant'){worker.removeEventListener('statechange',changed);reject(new Error('The update could not activate. Reopen the app while connected and try again.'));}
    };
    worker.addEventListener('statechange',changed);
    worker.postMessage({type:'SKIP_WAITING'});
    changed();
  });
}
