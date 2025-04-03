import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Nifti from './Nifti.tsx'
import './index.css'
import Cornerstone3DViewer from "./Components/Cornerstone3DViewer";
import Crosshairs from "./Components/Crosshairs.tsx";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* <App />
    <Nifti /> */}
    {/* <Cornerstone3DViewer /> */}
    <Crosshairs />
  </React.StrictMode>,
)
