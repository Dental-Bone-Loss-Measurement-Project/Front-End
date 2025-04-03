// Crosshairs.tsx
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
  setTitleAndDescription,
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

// Volume and viewport configuration
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
const positionSynchronizerId = 'POSITION_SYNCHRONIZER_ID'; 

const size = '500px';

const viewportColors: Record<string, string> = {
  [viewportId1]: 'rgb(200, 0, 0)',
  [viewportId2]: 'rgb(200, 200, 0)',
  [viewportId3]: 'rgb(0, 200, 0)',
};

let synchronizer: any;
let positionSynchronizer: any; 

const viewportReferenceLineControllable = [viewportId1, viewportId2, viewportId3];
const viewportReferenceLineDraggableRotatable = [viewportId1, viewportId2, viewportId3];
const viewportReferenceLineSlabThicknessControlsOn = [viewportId1, viewportId2, viewportId3];

function getReferenceLineColor(viewportId: string): string {
  return viewportColors[viewportId];
}

function getReferenceLineControllable(viewportId: string): boolean {
  return viewportReferenceLineControllable.includes(viewportId);
}

function getReferenceLineDraggableRotatable(viewportId: string): boolean {
  return viewportReferenceLineDraggableRotatable.includes(viewportId);
}

function getReferenceLineSlabThicknessControlsOn(viewportId: string): boolean {
  return viewportReferenceLineSlabThicknessControlsOn.includes(viewportId);
}

const blendModeOptions = {
  MIP: 'Maximum Intensity Projection',
  MINIP: 'Minimum Intensity Projection',
  AIP: 'Average Intensity Projection',
};

const Crosshairs: React.FC = () => {
  // Refs for the three viewport elements
  const element1Ref = useRef<HTMLDivElement>(null);
  const element2Ref = useRef<HTMLDivElement>(null);
  const element3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function run() {
    setTitleAndDescription(
        'Crosshairs',
        'Here we demonstrate crosshairs linking three orthogonal views of the same data. You can select the blend mode that will be used if you modify the slab thickness of the crosshairs by dragging the control points.'
        );

      const element1 = element1Ref.current;
      const element2 = element2Ref.current;
      const element3 = element3Ref.current;
      if (!element1 || !element2 || !element3) {
        console.error('Viewport elements not found');
        return;
      }

      // Disable right-click context menu for the viewports.
      element1.oncontextmenu = (e) => e.preventDefault();
      element2.oncontextmenu = (e) => e.preventDefault();
      element3.oncontextmenu = (e) => e.preventDefault();

      // Initialize the demo environment and add the crosshairs tool.
      await initDemo();
      cornerstoneTools.addTool(CrosshairsTool);

      // Load image IDs and cache metadata.
      const imageIds = await createImageIdsAndCacheMetaData({
        StudyInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
        SeriesInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
        wadoRsRoot:
          getLocalUrl() || 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
      });

      const volume = await volumeLoader.createAndCacheVolume(volumeId, {
        imageIds,
      });

      // Create the rendering engine.
      const renderingEngine = new RenderingEngine(renderingEngineId);

      // Configure the viewports using our refs.
      const viewportInputArray = [
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
      ];

      renderingEngine.setViewports(viewportInputArray);
      volume.load();

      await setVolumesForViewports(
        renderingEngine,
        [
          {
            volumeId,
            callback: setCtTransferFunctionForVolumeActor,
          },
        ],
        [viewportId1, viewportId2, viewportId3]
      );

      // Add toolbar controls.
      addButtonToToolbar({
        title: 'Reset Camera',
        onClick: () => {
          const viewport1 = getRenderingEngine(renderingEngineId).getViewport(
            viewportId1
          ) as Types.IVolumeViewport;
          viewport1.resetCamera({
            resetPan: true,
            resetZoom: true,
            resetToCenter: true,
            resetRotation: true,
          });
          viewport1.render();
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
            case blendModeOptions.MIP:
              blendModeToUse = Enums.BlendModes.MAXIMUM_INTENSITY_BLEND;
              break;
            case blendModeOptions.MINIP:
              blendModeToUse = Enums.BlendModes.MINIMUM_INTENSITY_BLEND;
              break;
            case blendModeOptions.AIP:
              blendModeToUse = Enums.BlendModes.AVERAGE_INTENSITY_BLEND;
              break;
            default:
              throw new Error('undefined orientation option');
          }

          const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
          const crosshairsInstance = toolGroup.getToolInstance(
            CrosshairsTool.toolName
          );
          const oldConfiguration = crosshairsInstance.configuration;

          crosshairsInstance.configuration = {
            ...oldConfiguration,
            slabThicknessBlendMode: blendModeToUse,
          };

          toolGroup.viewportsInfo.forEach(({ viewportId, renderingEngineId }) => {
            const renderingEngine = getRenderingEngine(renderingEngineId);
            const viewport = renderingEngine.getViewport(
              viewportId
            ) as Types.IVolumeViewport;
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

      // Set up synchronizers.
      function setUpSynchronizers() {
        synchronizer = createSlabThicknessSynchronizer(synchronizerId);
        [viewportId1, viewportId2, viewportId3].forEach((viewportId) => {
          synchronizer.add({
            renderingEngineId,
            viewportId,
          });
        });
        synchronizer.setEnabled(false);
      }

      // Create and configure the tool group for the crosshairs tool.
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
      addManipulationBindings(toolGroup);
      toolGroup.addViewport(viewportId1, renderingEngineId);
      toolGroup.addViewport(viewportId2, renderingEngineId);
      toolGroup.addViewport(viewportId3, renderingEngineId);

      const isMobile = window.matchMedia('(any-pointer:coarse)').matches;
      toolGroup.addTool(CrosshairsTool.toolName, {
        getReferenceLineColor,
        getReferenceLineControllable,
        getReferenceLineDraggableRotatable,
        getReferenceLineSlabThicknessControlsOn,
        mobile: {
          enabled: isMobile,
          opacity: 0.8,
          handleRadius: 9,
        },
      });

      toolGroup.setToolActive(CrosshairsTool.toolName, {
        bindings: [{ mouseButton: MouseBindings.Primary }],
      });

      setUpSynchronizers();

      // Render the viewports.
      renderingEngine.renderViewports(viewportIds);
    }
    run();
  }, []);

  return (
<div>
      <div id="demoTitle" />
      <div id="demoDescription" />
      <div style={{ display: 'flex', flexDirection: 'row' }}>
        {[element1Ref, element2Ref, element3Ref].map((ref, i) => (
          <div
            key={viewportIds[i]}
            ref={ref}
            style={{
              width: size,
              height: size,
              position: 'relative',
              border: '1px solid #555',
              margin: '2px'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Crosshairs;
