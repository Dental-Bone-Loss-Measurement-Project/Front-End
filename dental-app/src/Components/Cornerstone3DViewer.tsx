import React, { useEffect, useRef, useState } from 'react';
import * as cornerstone3D from '@cornerstonejs/core';
import * as cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { Enums, volumeLoader } from '@cornerstonejs/core';

const Cornerstone3DViewer: React.FC = () => {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const initViewer = async (imageId: string) => {
      await cornerstone3D.init();
      cornerstoneTools.init();

      if (!elementRef.current) return;
      
      const renderingEngineId = 'myRenderingEngine';
      const viewportId = 'CT_AXIAL';
      
      const renderingEngine = new cornerstone3D.RenderingEngine(renderingEngineId);
      
      renderingEngine.enableElement({
        viewportId,
        element: elementRef.current,
        type: Enums.ViewportType.ORTHOGRAPHIC,
      });
      
      const viewport = renderingEngine.getViewport(viewportId) as cornerstone3D.VolumeViewport;
      
      if (!viewport) {
        console.error("Viewport not found");
        return;
      }
      
      try {
        // Ensure metadata exists before destructuring
        const metadata = cornerstone3D.metaData.get('generalSeriesModule', imageId);
        if (!metadata) {
          console.error('Metadata not found for imageId:', imageId);
          return;
        }

        console.log('Metadata:', metadata);
        const volume = await volumeLoader.createAndCacheVolume('myVolume', {
          imageIds: [imageId]
        });

        viewport.setVolumes([{ volumeId: volume.volumeId, callback: () => {} }]);
        viewport.render();
      } catch (error) {
        console.error("Error loading DICOM image", error);
      }
    };

    if (file) {
      const imageId = cornerstoneDICOMImageLoader.wadouri.getImageIdFromFile(file);

      initViewer(imageId);
    }
  }, [file]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      setFile(event.target.files[0]);
    }
  };

  return (
    <div>
      <input type="file" accept=".dcm" onChange={handleFileChange} />
      <div ref={elementRef} style={{ width: '512px', height: '512px', background: 'black' }} />
    </div>
  );
};

export default Cornerstone3DViewer;
