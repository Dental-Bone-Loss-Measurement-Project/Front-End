import Header from "./Components/Header";
import { SideBar } from "./Components/SideBar";
// import DentalViewerPage from "./Pages/Dental_Viewer_Page";
// import MultiViewer from "./Components/MultiViewer";
import Crosshairs from "./Components/Crosshairs";
// import Crosshairs from "./Components/Crosshairs_gpt";

function App() {
  return (
    <div>
      {/* Header */}
      <Header/>
      <div className="app-container flex h-screen">
        {/* Sidebar on the left */}
        <SideBar />
        {/* Main content area */}
        <div className="content-container flex-1 p-4">
          {/* <DentalViewerPage /> */}
          {/* <MultiViewer/> */}
          <Crosshairs/>
        </div>
      </div>
    </div>
  );
}

export default App;
