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

// Check once at startup, then when returning to the app or reconnecting.
// Offline failures leave the installed app available.
export function watchForUpdates(registration:ServiceWorkerRegistration,onWaiting:()=>void){
  let lastCheck=-Infinity,inFlight=false,stopped=false;
  const check=async()=>{
    if(stopped||document.visibilityState==='hidden'||!navigator.onLine)return;
    if(registration.waiting)onWaiting();
    if(inFlight||Date.now()-lastCheck<60_000)return;
    inFlight=true;lastCheck=Date.now();
    try{await registration.update();if(!stopped&&registration.waiting)onWaiting();}catch{/* Recheck on the next foreground or connection event. */}
    finally{inFlight=false;}
  };
  const changed=()=>{void check();};
  window.addEventListener('pageshow',changed);window.addEventListener('focus',changed);window.addEventListener('online',changed);document.addEventListener('visibilitychange',changed);
  changed();
  return ()=>{stopped=true;window.removeEventListener('pageshow',changed);window.removeEventListener('focus',changed);window.removeEventListener('online',changed);document.removeEventListener('visibilitychange',changed);};
}
