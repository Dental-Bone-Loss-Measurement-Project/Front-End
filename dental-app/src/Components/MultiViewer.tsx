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

// Volume configuration
const volumeName = 'CT_VOLUME_ID';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
const volumeId = `${volumeLoaderScheme}:${volumeName}`;

// Viewport IDs
const toolGroupId = 'MY_TOOLGROUP_ID';
const viewportIdAxial = 'CT_AXIAL';
const viewportIdSagittal = 'CT_SAGITTAL';
const viewportIdCoronal = 'CT_CORONAL';
const viewportId3D = 'CT_3D';
const viewportIds = [
  viewportIdAxial,
  viewportIdSagittal,
  viewportIdCoronal,
  viewportId3D,
];
const renderingEngineId = 'myRenderingEngine';
const synchronizerId = 'SLAB_THICKNESS_SYNCHRONIZER_ID';

const viewportColors: Record<string, string> = {
  [viewportIdAxial]: 'rgb(200, 0, 0)',
  [viewportIdSagittal]: 'rgb(200, 200, 0)',
  [viewportIdCoronal]: 'rgb(0, 200, 0)',
  [viewportId3D]: 'rgb(0, 0, 200)',
};

const viewportReferenceLineControllable = [
  viewportIdAxial,
  viewportIdSagittal,
  viewportIdCoronal,
];

const viewportReferenceLineDraggableRotatable = [
  viewportIdAxial,
  viewportIdSagittal,
  viewportIdCoronal,
];

const viewportReferenceLineSlabThicknessControlsOn = [
  viewportIdAxial,
  viewportIdSagittal,
  viewportIdCoronal,
];

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

const MultiViewer: React.FC = () => {
  const axialRef = useRef<HTMLDivElement>(null);
  const sagittalRef = useRef<HTMLDivElement>(null);
  const coronalRef = useRef<HTMLDivElement>(null);
  const threeDRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function run() {
      const axialElement = axialRef.current;
      const sagittalElement = sagittalRef.current;
      const coronalElement = coronalRef.current;
      const threeDElement = threeDRef.current;

      if (!axialElement || !sagittalElement || !coronalElement || !threeDElement) {
        console.error('One or more viewport elements not found');
        return;
      }

      [axialElement, sagittalElement, coronalElement, threeDElement].forEach(
        (el) => {
          el!.oncontextmenu = (e) => e.preventDefault();
        }
      );

      await initDemo();
      cornerstoneTools.addTool(CrosshairsTool);

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

      const renderingEngine = new RenderingEngine(renderingEngineId);

      const viewportInputArray = [
        {
          viewportId: viewportIdAxial,
          type: ViewportType.ORTHOGRAPHIC,
          element: axialElement,
          defaultOptions: {
            orientation: Enums.OrientationAxis.AXIAL,
            background: [0, 0, 0] as Types.Point3,
          },
        },
        {
          viewportId: viewportIdSagittal,
          type: ViewportType.ORTHOGRAPHIC,
          element: sagittalElement,
          defaultOptions: {
            orientation: Enums.OrientationAxis.SAGITTAL,
            background: [0, 0, 0] as Types.Point3,
          },
        },
        {
          viewportId: viewportIdCoronal,
          type: ViewportType.ORTHOGRAPHIC,
          element: coronalElement,
          defaultOptions: {
            orientation: Enums.OrientationAxis.CORONAL,
            background: [0, 0, 0] as Types.Point3,
          },
        },
        {
          viewportId: viewportId3D,
          type: ViewportType.VOLUME_3D,
          element: threeDElement,
          defaultOptions: {
            background: [0.1, 0.1, 0.1] as Types.Point3,
          },
        },
      ];

      renderingEngine.setViewports(viewportInputArray);
      volume.load();

      // Set volumes for 2D viewports
      await setVolumesForViewports(
        renderingEngine,
        [
          {
            volumeId,
            callback: setCtTransferFunctionForVolumeActor,
          },
        ],
        [viewportIdAxial, viewportIdSagittal, viewportIdCoronal]
      );

      // Set volume for 3D viewport separately
      const viewport3D = renderingEngine.getViewport(
        viewportId3D
      ) as Types.IVolumeViewport;
      await viewport3D.setVolumes([
        {
          volumeId,
          callback: (volumeActor) => {
            setCtTransferFunctionForVolumeActor(volumeActor);
          },
        },
      ]);

      // Toolbar setup
      addButtonToToolbar({
        title: 'Reset Camera',
        onClick: () => {
          viewportIds.forEach((viewportId) => {
            const viewport = getRenderingEngine(
              renderingEngineId
            ).getViewport(viewportId) as Types.IVolumeViewport;
            viewport.resetCamera({
              resetPan: true,
              resetZoom: true,
              resetToCenter: true,
              resetRotation: true,
            });
            viewport.render();
          });
        },
      });

      addDropdownToToolbar({
        options: {
          values: Object.values(blendModeOptions),
          defaultValue: blendModeOptions.MIP,
        },
        onSelectedValueChange: (selectedValue: string) => {
          let blendMode;
          switch (selectedValue) {
            case blendModeOptions.MIP:
              blendMode = Enums.BlendModes.MAXIMUM_INTENSITY_BLEND;
              break;
            case blendModeOptions.MINIP:
              blendMode = Enums.BlendModes.MINIMUM_INTENSITY_BLEND;
              break;
            case blendModeOptions.AIP:
              blendMode = Enums.BlendModes.AVERAGE_INTENSITY_BLEND;
              break;
          }

          const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
          const crosshairs = toolGroup.getToolInstance(CrosshairsTool.toolName);
          crosshairs.configuration = {
            ...crosshairs.configuration,
            slabThicknessBlendMode: blendMode,
          };

          toolGroup.viewportsInfo.forEach(({ viewportId }) => {
            const viewport = getRenderingEngine(
              renderingEngineId
            ).getViewport(viewportId) as Types.IVolumeViewport;
            viewport.setBlendMode(blendMode);
            viewport.render();
          });
        },
      });

      addToggleButtonToToolbar({
        id: 'syncSlabThickness',
        title: 'Sync Slab Thickness',
        defaultToggle: false,
        onClick: (toggle: boolean) => {
          const synchronizer = synchronizers.getSynchronizer(
            synchronizerId
          ) as cornerstoneTools.Synchronizer;
          synchronizer.setEnabled(toggle);
        },
      });

      // Synchronizer setup
      const synchronizer = createSlabThicknessSynchronizer(synchronizerId);
      [viewportIdAxial, viewportIdSagittal, viewportIdCoronal].forEach(
        (viewportId) => {
          synchronizer.add({ renderingEngineId, viewportId });
        }
      );

      // Tool group setup
      const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
      addManipulationBindings(toolGroup);
      viewportIds.forEach((viewportId) =>
        toolGroup.addViewport(viewportId, renderingEngineId)
      );

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

      renderingEngine.renderViewports(viewportIds);
    }

    run();
  }, []);

  return (
    <>
      {/* Toolbar container */}
      <div id="demo-toolbar" className="p-4 bg-gray-800" />

      {/* Viewport grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          width: '100vw',
          height: '100vh',
          gap: '2px',
        }}
      >
        <div ref={axialRef} className="border border-gray-600" />
        <div ref={sagittalRef} className="border border-gray-600" />
        <div ref={coronalRef} className="border border-gray-600" />
        <div ref={threeDRef} className="border border-gray-600" />
      </div>
    </>
  );
};

export default MultiViewer;