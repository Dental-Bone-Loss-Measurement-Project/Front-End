// VolumeViewer3D.tsx
import React, { useEffect, useRef } from 'react';
import {
  CONSTANTS,
  Enums,
  RenderingEngine,
  setVolumesForViewports,
  volumeLoader,
  Types,
} from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  addManipulationBindings,
  createImageIdsAndCacheMetaData,
  initDemo,
} from '../../utils/demo/helpers';
import { RGB } from '@cornerstonejs/core/types';

const { ToolGroupManager } = cornerstoneTools;
const { ViewportType } = Enums;

const volumeName = 'CT_VOLUME_ID';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
const volumeId = `${volumeLoaderScheme}:${volumeName}`;
const renderingEngineId = 'myRenderingEngine';
const viewportId = '3D_VIEWPORT';
const toolGroupId = 'TOOL_GROUP_ID';

interface VolumeViewer3DProps {
  preset: string;
}

const VolumeViewer3D: React.FC<VolumeViewer3DProps> = ({ preset }) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const viewportRef = useRef<Types.IVolumeViewport | null>(null);

  useEffect(() => {
    const initialize = async () => {
      await initDemo();
      
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
      addManipulationBindings(toolGroup, {
        is3DViewport: true,
      });

      const imageIds = await createImageIdsAndCacheMetaData({
        StudyInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.871108593056125491804754960339',
        SeriesInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.367700692008930469189923116409',
        wadoRsRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
      });

      renderingEngineRef.current = new RenderingEngine(renderingEngineId);

      const viewportInput = {
        viewportId,
        type: ViewportType.VOLUME_3D,
        element: elementRef.current!,
        defaultOptions: {
          orientation: Enums.OrientationAxis.CORONAL,
          background: CONSTANTS.BACKGROUND_COLORS.slicer3D.slice(0, 3) as RGB,
        },
      };

      renderingEngineRef.current.setViewports([viewportInput]);
      toolGroup.addViewport(viewportId, renderingEngineId);

      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
      volume.load();

      viewportRef.current = renderingEngineRef.current.getViewport(viewportId) as Types.IVolumeViewport;

      await setVolumesForViewports(
        renderingEngineRef.current,
        [{ volumeId }],
        [viewportId]
      );

      // Use the preset from props when initializing
      viewportRef.current.setProperties({ preset });
      viewportRef.current.render();
    };

    if (elementRef.current) {
      initialize();
    }

    return () => {
      renderingEngineRef.current?.destroy();
      ToolGroupManager.destroyToolGroup(toolGroupId);
    };
  }, []);

  // Listen for changes to the preset prop and update the viewport
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.setProperties({ preset });
      viewportRef.current.render();
    }
  }, [preset]);

  return (
    <div className="h-full">
      {/* Container takes full width and height */}
      <div
        ref={elementRef}
        className="w-full h-full relative"
        onContextMenu={(e) => e.preventDefault()}
      ></div>
    </div>
  );
};

export default VolumeViewer3D;

