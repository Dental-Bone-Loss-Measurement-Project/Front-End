import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import Nifti from './Nifti.tsx'
import './index.css'
import Cornerstone3DViewer from "./Components/Cornerstone3DViewer";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* <App />
    <Nifti /> */}
    <Cornerstone3DViewer />
  </React.StrictMode>,
)
