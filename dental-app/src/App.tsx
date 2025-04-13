import Header from "./Components/Header";
import { SideBar } from "./Components/SideBar";
import Crosshairs from "./Components/Crosshairs";

function App() {
  return (
    <div>
      <Header/>
      <div className="app-container flex" style={{'alignSelf':'self-end', 'gap':'0.5em'}}>
        <SideBar />
        <div className="">
          <Crosshairs/>
        </div>
      </div>
    </div>
  );
}

export default App;
