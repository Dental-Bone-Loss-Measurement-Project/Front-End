// CrosshairsReact.tsx
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

// Size for each viewport
const size = '500px';

const viewportColors: Record<string, string> = {
  [viewportId1]: 'rgb(200, 0, 0)',
  [viewportId2]: 'rgb(200, 200, 0)',
  [viewportId3]: 'rgb(0, 200, 0)',
};

let synchronizer: cornerstoneTools.Synchronizer;

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

const CrosshairsReact: React.FC = () => {
  // Refs for the three viewports
  const element1Ref = useRef<HTMLDivElement>(null);
  const element2Ref = useRef<HTMLDivElement>(null);
  const element3Ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function run() {
      
      // Get DOM elements from refs
      const element1 = element1Ref.current;
      const element2 = element2Ref.current;
      const element3 = element3Ref.current;
      if (!element1 || !element2 || !element3) {
        console.error('Viewport elements not found');
        return;
      }

      // Disable right-click context menu
      [element1, element2, element3].forEach((el) => (el.oncontextmenu = (e) => e.preventDefault()));

      // Initialize demo environment (this may initialize globals)
      await initDemo();

      // Register required tools
      cornerstoneTools.addTool(CrosshairsTool);
      cornerstoneTools.addTool(cornerstoneTools.PanTool);
      cornerstoneTools.addTool(cornerstoneTools.ZoomTool);
      cornerstoneTools.addTool(cornerstoneTools.WindowLevelTool);
      // (The vanilla example registers only CrosshairsTool for manipulation, but you could add others if needed)

      // Load image IDs and cache metadata for the study/series
      const imageIds = await createImageIdsAndCacheMetaData({
        StudyInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
        SeriesInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
        wadoRsRoot: getLocalUrl() || 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
      });

      // Create and cache the volume
      const volume = await volumeLoader.createAndCacheVolume(volumeId, {
        imageIds,
      });

      // Instantiate the rendering engine
      const renderingEngine = new RenderingEngine(renderingEngineId);

      // Create viewport configuration with the three viewports
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

      // Load the volume (this may be asynchronous)
      await volume.load();

      // Set volumes for the viewports
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

      // Add toolbar controls
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
          // Get the tool group and update the Crosshairs tool configuration
          const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
          const crosshairsInstance = toolGroup.getToolInstance(CrosshairsTool.toolName);
          const oldConfiguration = crosshairsInstance.configuration;
          crosshairsInstance.configuration = {
            ...oldConfiguration,
            slabThicknessBlendMode: blendModeToUse,
          };

          // Update blend mode on each viewport
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

      // Set up synchronizers for the slab thickness
      function setUpSynchronizers() {
        synchronizer = createSlabThicknessSynchronizer(synchronizerId);
        [viewportId1, viewportId2, viewportId3].forEach((vpId) => {
          synchronizer.add({
            renderingEngineId,
            viewportId: vpId,
          });
        });
        synchronizer.setEnabled(false);
      }
      setUpSynchronizers();

      // Create and configure the tool group
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
      addManipulationBindings(toolGroup);
      [viewportId1, viewportId2, viewportId3].forEach((vpId) => {
        toolGroup.addViewport(vpId, renderingEngineId);
      });

      // Detect if running on a coarse pointer (i.e. mobile)
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

      // Finally, render the viewports
      renderingEngine.renderViewports(viewportIds);
    }
    run().catch((error) => console.error('Error during initialization:', error));
  }, []);

  return (
    <div className="flex flex-col items-center space-y-4 p-4">
      {/* Toolbar container */}
      <div id="demo-toolbar" className="w-full bg-gray-100 p-4 flex flex-wrap gap-4 justify-center" />
      {/* Main content container */}
      <div className="flex flex-col items-center">
        {/* Viewport grid */}
        <div className="flex flex-row flex-wrap gap-4 justify-center">
          <div
            ref={element1Ref}
            className="relative border border-gray-600"
            style={{ width: size, height: size }}
          />
          <div
            ref={element2Ref}
            className="relative border border-gray-600"
            style={{ width: size, height: size }}
          />
          <div
            ref={element3Ref}
            className="relative border border-gray-600"
            style={{ width: size, height: size }}
          />
        </div>
      </div>
    </div>
  );
};

export default CrosshairsReact;
