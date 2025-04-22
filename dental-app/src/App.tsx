// App.tsx
import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";

import Header from "./Components/Header";
import { SideBar } from "./Components/SideBar";
import Crosshairs from "./Components/Crosshairs";
import ImageUpload from "./Components/Panorama"; // Adjust path if different

function App() {
  const [preset, setPreset] = useState<string>('CT-Bone');

  return (
    <Router>
      <div>
        <Header preset={preset} setPreset={setPreset} />
        <div className="app-container flex" style={{ alignSelf: 'self-end', gap: '0.1em' }}>
          <SideBar />
          <div className="flex-grow">
            <Routes>
              {/* Home route with Crosshairs view */}
              <Route path="/" element={<Crosshairs preset={preset} />} />

              {/* Convert to Panorama page */}
              <Route path="/convert" element={<ImageUpload />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;
