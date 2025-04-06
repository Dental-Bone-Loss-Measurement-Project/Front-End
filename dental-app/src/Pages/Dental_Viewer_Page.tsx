import VolumeViewer3D from "../Components/VolumeViewer3D";
import CoronalView from "../Components/Dental_Viewer/CoronalView";
import AxialView from "../Components/Dental_Viewer/AxialView";
import SagittalView from "../Components/Dental_Viewer/SagittalView";

const DentalViewerPage = () => {
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-1 w-full h-full">
      {/* 3D Viewer */}
      <div className="border border-gray-300 overflow-hidden h-full">
        <VolumeViewer3D />
      </div>
      {/* Sagittal view */}
      <div className="border border-gray-300 overflow-hidden h-full">
        <SagittalView />
      </div>
      {/* Coronal view */}
      <div className="border border-gray-300 overflow-hidden h-full">
        <CoronalView />
      </div>
      {/* Axial view */}
      <div className="border border-gray-300 overflow-hidden h-full">
        <AxialView />
      </div>
    </div>
  );
};

export default DentalViewerPage;
