import {describe,it,expect} from 'vitest';
import {activateWaitingUpdate} from '../update';

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
