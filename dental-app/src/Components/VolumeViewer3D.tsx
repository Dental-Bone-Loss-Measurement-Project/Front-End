import React, { useEffect, useRef, useState } from 'react';
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

const { ToolGroupManager, Enums: csToolsEnums } = cornerstoneTools;
const { ViewportType } = Enums;

const volumeName = 'CT_VOLUME_ID';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
const volumeId = `${volumeLoaderScheme}:${volumeName}`;
const renderingEngineId = 'myRenderingEngine';
const viewportId = '3D_VIEWPORT';
const toolGroupId = 'TOOL_GROUP_ID';

const VolumeViewer3D: React.FC = () => {
  const elementRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const viewportRef = useRef<Types.IVolumeViewport | null>(null);
  
  // Default preset is CT-Bone
  const [preset, setPreset] = useState<string>('CT-Bone');

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

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.setProperties({ preset });
      viewportRef.current.render();
    }
  }, [preset]);

  const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPreset(event.target.value);
  };


  return (
    <div className="h-full">
      <div id="demo-title" className='' />
      <div id="demo-description" />
      <div className="mb-4">
        <select name="preset" title="Presets" value={preset} onChange={handlePresetChange}>
          <option value="CT-Bone">CT-Bone</option>
          <option value="CT-Bones">CT-Bones</option>
        </select>
      </div>
      {/* This container now takes full width and height of its parent */}
      <div
        ref={elementRef}
        className="w-full h-full relative"
        onContextMenu={(e) => e.preventDefault()}
      ></div>
    </div>
  );
};

export default VolumeViewer3D;
