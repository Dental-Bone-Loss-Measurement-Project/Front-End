import {
  volumeLoader,
  cornerstoneStreamingImageVolumeLoader,
} from "@cornerstonejs/core";
import { SideBar } from './Components/SideBar';
import VolumeViewer3D from './Components/VolumeViewer3D';
import MultiplannarConstruction from './Components/MultiplanarConstruction';

function App() {

  return (
    <div className="app-container flex h-screen">
      {/* Sidebar on the left */}
      <SideBar />
      {/* Main content area */}
      <div className="content-container flex-1 p-4">
        <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
          {/* 3D Viewer */}
          <div className="border border-gray-300 p-2">
            <VolumeViewer3D />
          </div>
          {/* Sagittal view */}
          <div className="border border-gray-300 p-2">
            <MultiplannarConstruction />
          </div>
          {/* Coronal view */}
          <div className="border border-gray-300 p-2">
            <MultiplannarConstruction />
          </div>
          {/* Axial view */}
          <div className="border border-gray-300 p-2">
            <MultiplannarConstruction />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;