import Header from "./Components/Header";
import { SideBar } from "./Components/SideBar";
import Crosshairs from "./Components/Crosshairs";

function App() {
  return (
    <div>
      <Header/>
      <div className="app-container flex h-screen">
        <SideBar />
        <div className="content-container flex-1 p-4">
          <Crosshairs/>
        </div>
      </div>
    </div>
  );
}

export default App;
