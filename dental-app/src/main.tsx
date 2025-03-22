import React from 'react'
import ReactDOM from 'react-dom/client'
// import App from './App.tsx'
// import Nifti from './Nifti.tsx'
import './index.css'
// import Cornerstone3DViewer from "./Components/Cornerstone3DViewer";
import VolumeViewer3D from './Components/VolumeViewer3D.tsx'
// MultiplanarConstruction.tsx this file is to fix the bug in sagittal, cronal and axial views but it doesn't work yet
// import CornerstoneVolumeViewer from './Components/MultiplanarConstruction.tsx'
import { SideBar } from './Components/sidebar.tsx'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="relative">
      {/* Main content area */}
      <VolumeViewer3D />
      <SideBar />
    </div>
  </React.StrictMode>
);
