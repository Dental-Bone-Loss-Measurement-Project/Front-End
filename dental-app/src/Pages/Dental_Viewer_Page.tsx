import React, { useRef, useEffect } from "react";
import VolumeViewer3D from "../Components/VolumeViewer3D";
import CoronalView from "../Components/Dental_Viewer/CoronalView";
import AxialView from "../Components/Dental_Viewer/AxialView";
import SagittalView from "../Components/Dental_Viewer/SagittalView";
import { initializeEngine } from "../../utils/renderingEngineSetup";


const renderingEngineId = 'myRenderingEngine';
const viewportId1 = 'CT_AXIAL';
const viewportId2 = 'CT_SAGITTAL';
const viewportId3 = 'CT_CORONAL';

const DentalViewerPage = () => {
  // Create refs for each view container.
  // const ref3D = useRef<HTMLDivElement>(null);
  // const refSagittal = useRef<HTMLDivElement>(null);
  // const refCoronal = useRef<HTMLDivElement>(null);
  // // const refAxial = useRef<HTMLDivElement>(null);

  // useEffect(() => {
  //   // Prepare mapping from viewport IDs to DOM elements.
  //   const viewportElements: { [viewportId: string]: HTMLDivElement } = {
  //     CT_3D: ref3D.current!,
  //     CT_SAGITTAL: refSagittal.current!,
  //     CT_CORONAL: refCoronal.current!,
  //     CT_AXIAL: refAxial.current!,
  //   };

  //   // Ensure all elements are available before initializing.
  //   if (
  //     viewportElements.CT_3D &&
  //     viewportElements.CT_SAGITTAL &&
  //     viewportElements.CT_CORONAL &&
  //     viewportElements.CT_AXIAL
  //   ) {
  //     initializeEngine(viewportElements);
  //   }
  // }, []);
  useEffect(() => {
    async function runViewer() {
      // move everything related to demo init, volume loading, rendering engine setup, etc. here.
      // You can reference document.getElementById('CT_AXIAL') to get the DOM elements

      // Example:
      const axialElement = document.getElementById(viewportId1);
      const sagittalElement = document.getElementById(viewportId2);
      const coronalElement = document.getElementById(viewportId3);

      if (!axialElement || !sagittalElement || !coronalElement) return;

      // Now follow your logic for creating rendering engine, setting viewports etc.
    }

    runViewer();
  }, []);

  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full">
      {/* 3D Viewer */}
      <div className="border border-gray-300 overflow-hidden h-full">
        <VolumeViewer3D />
      </div>
      {/* Sagittal view */}
      {/* <div
        ref={refSagittal}
        className="border border-gray-300 overflow-hidden h-full"
      >
        <SagittalView />
      </div>
      {/* Coronal view */}
      {/* <div
        ref={refCoronal}
        className="border border-gray-300 overflow-hidden h-full"
      >
        <CoronalView />
      </div> */} 
      {/* Axial view */}
      <div className="border border-gray-300 overflow-hidden h-full">
        <AxialView renderingEngineId={renderingEngineId} viewportId={viewportId1}/>
      </div>
    </div>
  );
};

export default DentalViewerPage;
