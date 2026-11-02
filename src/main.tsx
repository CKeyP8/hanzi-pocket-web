import {StrictMode,Component,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './style.css';
import './study.css';
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<div className="boot-screen"><h1>Your pocket needs a moment.</h1><p>Please reopen the app. Existing data has not been cleared.</p><button className="button" onClick={()=>location.reload()}>Reload app</button></div>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<StrictMode><Boundary><App/></Boundary></StrictMode>);
