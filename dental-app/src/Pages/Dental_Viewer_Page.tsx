import VolumeViewer3D from "../Components/VolumeViewer3D";
import CoronalView from "../Components/Dental_Viewer/CoronalView";
import AxialView from "../Components/Dental_Viewer/AxialView";
import SagittalView from "../Components/Dental_Viewer/SagittalView";

const DentalViewerPage = () => {
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
      {/* 3D Viewer */}
      <div className="border border-gray-300 overflow-x-auto overflow-y-auto h-full">
        <VolumeViewer3D />
      </div>
      {/* Sagittal view */}
      <div className="border border-gray-300 overflow-x-auto overflow-y-auto h-full">
        <SagittalView />
      </div>
      {/* Coronal view */}
      <div className="border border-gray-300 overflow-x-auto overflow-y-auto h-full">
        <CoronalView />
      </div>
      {/* Axial view */}
      <div className="border border-gray-300 overflow-x-auto overflow-y-auto h-full">
        <AxialView />
      </div>
    </div>
  );
};

export default DentalViewerPage;
