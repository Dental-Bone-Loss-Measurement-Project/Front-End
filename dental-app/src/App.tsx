import Header from "./Components/Header";
import { SideBar } from "./Components/SideBar";
import CrossHairs from "./Components/Crosshairs";
import ImageUpload from "./Components/Panorama";

function App() {
  return (
    <div>
      <Header/>
      <div className="app-container flex" style={{'alignSelf':'self-end', 'gap':'0.5em'}}>
        <SideBar />
        <div className="content-container flex-1 p-4">
          {/* <Crosshairs/> */}
          <ImageUpload />
          {/* Add other components here */}
        </div>
        <CrossHairs/>
      </div>
    </div>
  );
}

export default App;
