import {afterEach,describe,it,expect,vi} from 'vitest';
import {activateWaitingUpdate,watchForUpdates} from '../update';

class WaitingWorker extends EventTarget{
  state:ServiceWorkerState='installed';
  messages:unknown[]=[];
  postMessage(value:unknown){this.messages.push(value);}
  transition(state:ServiceWorkerState){this.state=state;this.dispatchEvent(new Event('statechange'));}
}
const registration=(worker:WaitingWorker)=>({waiting:worker} as unknown as ServiceWorkerRegistration);

describe('Opening an available app update',()=>{
  it('waits for activation before allowing the page to reload',async()=>{
    const worker=new WaitingWorker();let ready=false;
    const update=activateWaitingUpdate(registration(worker)).then(()=>{ready=true;});
    expect(worker.messages).toEqual([{type:'SKIP_WAITING'}]);
    worker.transition('activating');await Promise.resolve();expect(ready).toBe(false);
    worker.transition('activated');await update;expect(ready).toBe(true);
  });
  it('reports an update that becomes redundant instead of treating it as active',async()=>{
    const worker=new WaitingWorker(),update=activateWaitingUpdate(registration(worker));
    worker.transition('redundant');await expect(update).rejects.toThrow('could not activate');
  });
  it('allows a reload when another tab has already activated the update',async()=>{
    await expect(activateWaitingUpdate({waiting:null} as ServiceWorkerRegistration)).resolves.toBeUndefined();
    await expect(activateWaitingUpdate(undefined)).resolves.toBeUndefined();
  });
});

describe('Checking for updates when opening or returning to the app',()=>{
 let stop:(()=>void)|undefined;
 afterEach(()=>{stop?.();stop=undefined;vi.restoreAllMocks();});
 it('checks on startup and after returning, while throttling repeated foreground events',async()=>{
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');vi.spyOn(navigator,'onLine','get').mockReturnValue(true);let now=1000;vi.spyOn(Date,'now').mockImplementation(()=>now);
  const update=vi.fn(async()=>{}),onWaiting=vi.fn(),current={waiting:null,update} as unknown as ServiceWorkerRegistration;stop=watchForUpdates(current,onWaiting);await Promise.resolve();expect(update).toHaveBeenCalledTimes(1);
  window.dispatchEvent(new Event('focus'));expect(update).toHaveBeenCalledTimes(1);now+=61_000;document.dispatchEvent(new Event('visibilitychange'));await Promise.resolve();expect(update).toHaveBeenCalledTimes(2);
  stop();now+=61_000;window.dispatchEvent(new Event('online'));expect(update).toHaveBeenCalledTimes(2);
 });
 it('recognises an already downloaded waiting update on entry',async()=>{
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');vi.spyOn(navigator,'onLine','get').mockReturnValue(true);const onWaiting=vi.fn();stop=watchForUpdates({waiting:{state:'installed'},update:async()=>{}} as unknown as ServiceWorkerRegistration,onWaiting);expect(onWaiting).toHaveBeenCalled();
 });
 it('stays usable offline and retries on reconnect without surfacing a check failure',async()=>{
  vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');let online=false;vi.spyOn(navigator,'onLine','get').mockImplementation(()=>online);const update=vi.fn(async()=>{throw new Error('Offline');});stop=watchForUpdates({waiting:null,update} as unknown as ServiceWorkerRegistration,vi.fn());expect(update).not.toHaveBeenCalled();online=true;window.dispatchEvent(new Event('online'));await Promise.resolve();expect(update).toHaveBeenCalledTimes(1);
 });
});
