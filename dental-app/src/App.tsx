// App.tsx
import React, { useState, useCallback } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
//import VolumeViewer3D from "./Components/VolumeViewer3D";
import Header from "./Components/Header";
import { SideBar } from "./Components/SideBar";
import Crosshairs from "./Components/Crosshairs";
import ImageUpload from "./Components/Panorama";
import AnnotationUploading from"./Components/Annotation_uploading";
//import MedicalViewer from "./Components/MedicalViewer";

function App() {
  const [preset, setPreset] = useState<string>('CT-Bone');
  const [handleFileSelect, setHandleFileSelect] = useState<((event: React.ChangeEvent<HTMLInputElement>) => void) | undefined>();
  const [handleExportAnnotations, setHandleExportAnnotations] = useState<(() => void) | undefined>();
  const [handleImportAnnotations, setHandleImportAnnotations] = useState<((event: React.ChangeEvent<HTMLInputElement>) => void) | undefined>();
  const [handleImportPoints, setHandleImportPoints] = useState<((event: React.ChangeEvent<HTMLInputElement>) => void) | undefined>();
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [viewportId, setViewportId] = useState<string>('VOLUME_VIEWPORT_ID');
  const [renderingEngineId, setRenderingEngineId] = useState<string>('volumeRenderingEngine');
  const [volumeId, setVolumeId] = useState<string>('cornerstoneStreamingImageVolume:VOLUME_ID');

  const setFileHandler = useCallback((handler: (event: React.ChangeEvent<HTMLInputElement>) => void) => {
    setHandleFileSelect(() => handler);
  }, []);

  const setExportHandler = useCallback((handler: () => void) => {
    setHandleExportAnnotations(() => handler);
  }, []);

  const setImportHandler = useCallback((handler: (event: React.ChangeEvent<HTMLInputElement>) => void) => {
    setHandleImportAnnotations(() => handler);
  }, []);

  const setImportPointsHandler = useCallback((handler: (event: React.ChangeEvent<HTMLInputElement>) => void) => {
    setHandleImportPoints(() => handler);
  }, []);

  return (
    <Router>
      <div>
        <Header preset={preset} setPreset={setPreset} />
        <div className="app-container flex" style={{ alignSelf: 'self-end', gap: '0.1em' }}>
          <SideBar 
            onFileSelect={handleFileSelect} 
            onExportAnnotations={handleExportAnnotations}
            onImportAnnotations={handleImportAnnotations}
            onImportPoints={handleImportPoints}
            isImageLoaded={isImageLoaded}
            viewportId={viewportId}
            renderingEngineId={renderingEngineId}
            volumeId={volumeId}
          />
          <div className="flex-grow">
            <Routes>
              {/* Home route with Crosshairs view */}
              <Route 
                path="/" 
                element={
                  <Crosshairs 
                    preset={preset} 
                    setFileHandler={setFileHandler}
                    setExportHandler={setExportHandler}
                    setImportHandler={setImportHandler}
                    setImportPointsHandler={setImportPointsHandler}
                    setIsImageLoaded={setIsImageLoaded}
                  />
                } 
              />

              {/* Convert to Panorama page */}
              <Route path="/convert" element={<ImageUpload />} />

              {/* annotation page */}
              <Route path="/annotation" element={<AnnotationUploading />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
