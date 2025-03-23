import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import VolumeViewer3D from './Components/VolumeViewer3D.tsx';
import { SideBar } from './Components/SideBar.tsx';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div className="app-container">
      <SideBar />
      <div className="content-container">
        <VolumeViewer3D />
      </div>
    </div>
  </React.StrictMode>
);
