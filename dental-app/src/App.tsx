import Header from "./Components/Header";
import { SideBar } from "./Components/SideBar";
import DentalViewerPage from "./Pages/Dental_Viewer_Page";

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
          <DentalViewerPage />
        </div>
      </div>
    </div>
  );
}

export default App;
