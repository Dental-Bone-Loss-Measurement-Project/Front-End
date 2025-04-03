import VolumeViewer3D from "../Components/VolumeViewer3D";
import MultiplannarConstruction from "../Components/MultiplanarConstruction";

const DentalViewerPage = () => {
  return (
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
  );
};

export default DentalViewerPage;
