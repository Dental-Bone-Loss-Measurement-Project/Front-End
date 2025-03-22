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
// import { TrackballRotateTool } from '@cornerstonejs/tools';
import {
  // addButtonToToolbar,
  // addDropdownToToolbar,
  addManipulationBindings,
  createImageIdsAndCacheMetaData,
  initDemo,
  // setTitleAndDescription,
} from '../../utils/demo/helpers';
import { RGB } from '@cornerstonejs/core/types';

const { ToolGroupManager, Enums: csToolsEnums } = cornerstoneTools;
const { ViewportType } = Enums;
// const { MouseBindings } = csToolsEnums;

// Constants
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
  const [preset, setPreset] = useState<string>('CT-Bone');
  const [rotation, setRotation] = useState<number>(0);

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

  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.setViewPresentation({ rotation });
      viewportRef.current.render();
    }
  }, [rotation]);

  const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPreset(event.target.value);
  };

  const handleRandomRotation = () => {
    setRotation(Math.random() * 360);
  };


  return (
    <div>
      <div id="demo-title" />
      <div id="demo-description" />
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={handleRandomRotation} style={{ marginRight: '1rem' }}>
          Apply Random Rotation
        </button>
        <select name='preset' title='Presets' value={preset} onChange={handlePresetChange}>
          {CONSTANTS.VIEWPORT_PRESETS.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
      </div>
      <div
        ref={elementRef}
        style={{
          width: '500px',
          height: '500px',
          position: 'relative',
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
      <p>Click the image to rotate it.</p>
    </div>
  );
};

export default VolumeViewer3D;