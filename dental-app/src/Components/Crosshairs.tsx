import React, { useRef, useEffect } from 'react';
import type { Types } from '@cornerstonejs/core';
import {
  RenderingEngine,
  Enums,
  setVolumesForViewports,
  volumeLoader,
  getRenderingEngine,
} from '@cornerstonejs/core';
import {
  initDemo,
  createImageIdsAndCacheMetaData,
  setCtTransferFunctionForVolumeActor,
  addDropdownToToolbar,
  addManipulationBindings,
  getLocalUrl,
  addToggleButtonToToolbar,
  addButtonToToolbar,
} from '../../utils/demo/helpers';
import * as cornerstoneTools from '@cornerstonejs/tools';

const {
  ToolGroupManager,
  Enums: csToolsEnums,
  CrosshairsTool,
  synchronizers,
} = cornerstoneTools;

const { createSlabThicknessSynchronizer } = synchronizers;
const { MouseBindings } = csToolsEnums;
const { ViewportType } = Enums;

const volumeName = 'CT_VOLUME_ID';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
const volumeId = `${volumeLoaderScheme}:${volumeName}`;
const toolGroupId = 'MY_TOOLGROUP_ID';
const viewportId1 = 'CT_AXIAL';
const viewportId2 = 'CT_SAGITTAL';
const viewportId3 = 'CT_CORONAL';
const viewportIds = [viewportId1, viewportId2, viewportId3];
const renderingEngineId = 'myRenderingEngine';
const synchronizerId = 'SLAB_THICKNESS_SYNCHRONIZER_ID';
const size = '500px';

const viewportColors = {
  [viewportId1]: 'rgb(200, 0, 0)',
  [viewportId2]: 'rgb(200, 200, 0)',
  [viewportId3]: 'rgb(0, 200, 0)',
};

let synchronizer: cornerstoneTools.Synchronizer;

const Crosshairs: React.FC = () => {
  const element1Ref = useRef<HTMLDivElement>(null);
  const element2Ref = useRef<HTMLDivElement>(null);
  const element3Ref = useRef<HTMLDivElement>(null);

  // Add toolbar buttons outside useEffect
  useEffect(() => {
    addButtonToToolbar({
      title: 'Reset Camera',
      onClick: () => {
        const viewport = getRenderingEngine(renderingEngineId).getViewport(
          viewportId1
        ) as Types.IVolumeViewport;
        viewport.resetCamera({
          resetPan: true,
          resetZoom: true,
          resetToCenter: true,
          resetRotation: true,
        });
        viewport.render();
      },
    });

    addDropdownToToolbar({
      options: {
        values: [
          'Maximum Intensity Projection',
          'Minimum Intensity Projection',
          'Average Intensity Projection',
        ],
        defaultValue: 'Maximum Intensity Projection',
      },
      onSelectedValueChange: (selectedValue: string) => {
        let blendModeToUse;
        switch (selectedValue) {
          case 'Maximum Intensity Projection':
            blendModeToUse = Enums.BlendModes.MAXIMUM_INTENSITY_BLEND;
            break;
          case 'Minimum Intensity Projection':
            blendModeToUse = Enums.BlendModes.MINIMUM_INTENSITY_BLEND;
            break;
          case 'Average Intensity Projection':
            blendModeToUse = Enums.BlendModes.AVERAGE_INTENSITY_BLEND;
            break;
          default:
            throw new Error('Undefined blend mode');
        }

        const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
        const crosshairsInstance = toolGroup.getToolInstance(CrosshairsTool.toolName);
        const oldConfig = crosshairsInstance.configuration;

        crosshairsInstance.configuration = {
          ...oldConfig,
          slabThicknessBlendMode: blendModeToUse,
        };

        toolGroup.viewportsInfo.forEach(({ viewportId, renderingEngineId }) => {
          const engine = getRenderingEngine(renderingEngineId);
          const viewport = engine.getViewport(viewportId) as Types.IVolumeViewport;
          viewport.setBlendMode(blendModeToUse);
          viewport.render();
        });
      },
    });

    addToggleButtonToToolbar({
      id: 'syncSlabThickness',
      title: 'Sync Slab Thickness',
      defaultToggle: false,
      onClick: (toggle: boolean) => {
        synchronizer.setEnabled(toggle);
      },
    });
  }, []);

  function setUpSynchronizers() {
    synchronizer = createSlabThicknessSynchronizer(synchronizerId);
    viewportIds.forEach((vpId) => {
      synchronizer.add({ renderingEngineId, viewportId: vpId });
    });
    synchronizer.setEnabled(false);
  }

  useEffect(() => {
    async function run() {
      const element1 = element1Ref.current;
      const element2 = element2Ref.current;
      const element3 = element3Ref.current;

      if (!element1 || !element2 || !element3) {
        console.error('Viewport elements not found');
        return;
      }

      [element1, element2, element3].forEach((el) => {
        el.oncontextmenu = (e) => e.preventDefault();
      });

      await initDemo();
      cornerstoneTools.addTool(CrosshairsTool);

      const imageIds = await createImageIdsAndCacheMetaData({
        StudyInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
        SeriesInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
        wadoRsRoot: getLocalUrl() || 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
      });

      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });

      const renderingEngine = new RenderingEngine(renderingEngineId);
      renderingEngine.setViewports([
        {
          viewportId: viewportId1,
          type: ViewportType.ORTHOGRAPHIC,
          element: element1,
          defaultOptions: {
            orientation: Enums.OrientationAxis.AXIAL,
            background: [0, 0, 0] as Types.Point3,
          },
        },
        {
          viewportId: viewportId2,
          type: ViewportType.ORTHOGRAPHIC,
          element: element2,
          defaultOptions: {
            orientation: Enums.OrientationAxis.SAGITTAL,
            background: [0, 0, 0] as Types.Point3,
          },
        },
        {
          viewportId: viewportId3,
          type: ViewportType.ORTHOGRAPHIC,
          element: element3,
          defaultOptions: {
            orientation: Enums.OrientationAxis.CORONAL,
            background: [0, 0, 0] as Types.Point3,
          },
        },
      ]);

      volume.load();
      await setVolumesForViewports(
        renderingEngine,
        [
          {
            volumeId,
            callback: setCtTransferFunctionForVolumeActor,
          },
        ],
        viewportIds
      );

      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
      addManipulationBindings(toolGroup);
      viewportIds.forEach((vpId) => toolGroup.addViewport(vpId, renderingEngineId));

      toolGroup.addTool(CrosshairsTool.toolName, {
        getReferenceLineColor: (id) => viewportColors[id],
        getReferenceLineControllable: () => true,
        getReferenceLineDraggableRotatable: () => true,
        getReferenceLineSlabThicknessControlsOn: () => true,
        mobile: {
          enabled: window.matchMedia('(any-pointer:coarse)').matches,
          opacity: 0.8,
          handleRadius: 9,
        },
      });

      toolGroup.setToolActive(CrosshairsTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary }],
      });

      setUpSynchronizers();
      renderingEngine.renderViewports(viewportIds);
    }

    run().catch((err) => console.error('Error in run:', err));
  }, []);

  return (
    <div className="flex flex-col items-center space-y-8 p-8">
      <div id="demo-toolbar" className="w-full bg-gray-100 p-4 flex flex-wrap gap-4 justify-center" />
      <div className="flex flex-col items-center">
        <div className="flex flex-row flex-wrap gap-4 justify-center">
          <div ref={element1Ref} className="relative border border-gray-600" style={{ width: size, height: size }} />
          <div ref={element2Ref} className="relative border border-gray-600" style={{ width: size, height: size }} />
          <div ref={element3Ref} className="relative border border-gray-600" style={{ width: size, height: size }} />
        </div>
      </div>
    </div>
  );
};

export default Crosshairs;
