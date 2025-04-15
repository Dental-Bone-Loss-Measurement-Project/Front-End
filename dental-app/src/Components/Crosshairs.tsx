// react and cornerstone imports
import React, { useEffect, useRef, useState } from "react";
import {
  RenderingEngine,
  Enums,
  setVolumesForViewports,
  volumeLoader,
  getRenderingEngine,
} from '@cornerstonejs/core';
import type { Types } from '@cornerstonejs/core';
import { init as csRenderInit } from "@cornerstonejs/core";
import { init as csToolsInit } from "@cornerstonejs/tools";
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader";
import * as cornerstoneTools from '@cornerstonejs/tools';

// Import the GrPan icon and tools
import { GrPan } from "react-icons/gr";
import { PanTool, CrosshairsTool, ZoomTool } from '@cornerstonejs/tools';

// Helper functions
import {
  createImageIdsAndCacheMetaData,
  addDropdownToToolbar,
  addManipulationBindings,
  addToggleButtonToToolbar,
  addButtonToToolbar,
  getLocalUrl,
} from '../../utils/demo/helpers';
import VolumeViewer3D from "./VolumeViewer3D";

// Constants for viewports and tool groups
const volumeName = 'VOLUME_ID';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
const volumeId = `${volumeLoaderScheme}:${volumeName}`;
const toolGroupId = 'CROSSHAIRS_TOOLGROUP_ID';
const axialViewportId = 'AXIAL_VIEWPORT_ID';
const sagittalViewportId = 'SAGITTAL_VIEWPORT_ID';
const coronalViewportId = 'CORONAL_VIEWPORT_ID';
const viewportIds = [axialViewportId, sagittalViewportId, coronalViewportId];
const renderingEngineId = 'volumeRenderingEngine';
const synchronizerId = 'SLAB_THICKNESS_SYNCHRONIZER_ID';

const viewportSizeheight = '300px';
const viewportSizewidth = '530px';

const CrossHairs = () => {
  const [isPanActive, setIsPanActive] = useState(false);
  const [isCrosshairsActive, setIsCrosshairsActive] = useState(false);
  const [isZoomActive, setIsZoomActive] = useState(false);
  
  // Refs for the viewports
  const running = useRef(false);
  const axialViewportElementRef = useRef<HTMLDivElement>(null);
  const sagittalViewportElementRef = useRef<HTMLDivElement>(null);
  const coronalViewportElementRef = useRef<HTMLDivElement>(null);

  let synchronizer: cornerstoneTools.Synchronizer;

  // Toolbar setup
  useEffect(() => {
    // Clear any existing toolbar content
    const toolbar = document.getElementById('demo-toolbar');
    if (toolbar) {
      toolbar.innerHTML = '';
    }

    // Add Reset Camera button
    addButtonToToolbar({
      title: 'Reset Camera', // Tooltip will show "Reset Camera" on hover
      onClick: () => {
        const viewport = getRenderingEngine(renderingEngineId).getViewport(
          axialViewportId
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

    // Add Projection dropdown
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
        const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
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

    // Add Pan button with icon and tooltip text on hover.
    addButtonToToolbar({
      title: 'Pan',  // This text will be used as the tooltip.
      icon: <GrPan />, // Only the icon is rendered on the button.
      onClick: () => {
        setIsPanActive((prev) => {
          const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
          const newActive = !prev;
          
          if (newActive) {
            // Disable competing tools
            toolGroup.setToolDisabled(ZoomTool.toolName);
            toolGroup.setToolDisabled(CrosshairsTool.toolName);
            setIsZoomActive(false);
            setIsCrosshairsActive(false);
            
            toolGroup.setToolActive(PanTool.toolName, {
              bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }],
            });
          } else {
            toolGroup.setToolDisabled(PanTool.toolName);
          }
          return newActive;
        });
      },
    });

    // Add Zoom button
    addButtonToToolbar({
      title: 'Zoom',
      onClick: () => {
        setIsZoomActive((prev) => {
          const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
          const newActive = !prev;
          
          if (newActive) {
            // Disable competing tools
            toolGroup.setToolDisabled(PanTool.toolName);
            toolGroup.setToolDisabled(CrosshairsTool.toolName);
            setIsPanActive(false);
            setIsCrosshairsActive(false);
            
            toolGroup.setToolActive(ZoomTool.toolName, {
              bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Wheel }],
            });
          } else {
            toolGroup.setToolDisabled(ZoomTool.toolName);
          }
          return newActive;
        });
      },
    });
    
    // Add Crosshairs button
    addButtonToToolbar({
      title: 'Crosshairs',
      onClick: () => {
        setIsCrosshairsActive((prev) => {
          const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
          const newActive = !prev;
          
          if (newActive) {
            // Disable competing tools
            toolGroup.setToolDisabled(PanTool.toolName);
            toolGroup.setToolDisabled(ZoomTool.toolName);
            setIsPanActive(false);
            setIsZoomActive(false);
            
            toolGroup.setToolActive(CrosshairsTool.toolName, {
              bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }],
            });
          } else {
            toolGroup.setToolDisabled(CrosshairsTool.toolName);
          }
          return newActive;
        });
      },
    });
  }, []);

  const viewportColors: { [key: string]: string } = {
    [axialViewportId]: 'rgb(200, 0, 0)',
    [sagittalViewportId]: 'rgb(200, 200, 0)',
    [coronalViewportId]: 'rgb(0, 200, 0)',
  };

  const viewportReferenceLineControllable = [
    axialViewportId,
    sagittalViewportId,
    coronalViewportId,
  ];

  const viewportReferenceLineDraggableRotatable = [
    axialViewportId,
    sagittalViewportId,
    coronalViewportId,
  ];

  const viewportReferenceLineSlabThicknessControlsOn = [
    axialViewportId,
    sagittalViewportId,
    coronalViewportId,
  ];

  function getReferenceLineColor(viewportId: string | number) {
    return viewportColors[viewportId];
  }

  function getReferenceLineControllable(viewportId: string) {
    return viewportReferenceLineControllable.includes(viewportId);
  }

  function getReferenceLineDraggableRotatable(viewportId: string) {
    return viewportReferenceLineDraggableRotatable.includes(viewportId);
  }

  function getReferenceLineSlabThicknessControlsOn(viewportId: string) {
    return viewportReferenceLineSlabThicknessControlsOn.includes(viewportId);
  }

  function setUpSynchronizers() {
    synchronizer = cornerstoneTools.synchronizers.createSlabThicknessSynchronizer(synchronizerId);

    // Add viewports to the synchronizer
    [axialViewportId, sagittalViewportId, coronalViewportId].forEach((viewportId) => {
      synchronizer.add({
        renderingEngineId,
        viewportId,
      });
    });
    synchronizer.setEnabled(false);
  }

  // Set up the rendering engine, viewports, and tools
  useEffect(() => {
    const setup = async () => {
      if (running.current) return;
      running.current = true;

      // Initialize Cornerstone libraries
      csRenderInit();
      csToolsInit();
      dicomImageLoaderInit({ maxWebWorkers: 1 });

      // Register tools
      cornerstoneTools.addTool(CrosshairsTool);
      cornerstoneTools.addTool(PanTool);
      cornerstoneTools.addTool(ZoomTool);

      // Load imageIds and cache metadata
      const imageIds = await createImageIdsAndCacheMetaData({
        StudyInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
        SeriesInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
        wadoRsRoot: getLocalUrl() || 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
      });

      // Create the volume
      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });

      // Initialize rendering engine
      const renderingEngine = new RenderingEngine(renderingEngineId);

      const viewportInputArray = [
        {
          viewportId: axialViewportId,
          type: Enums.ViewportType.ORTHOGRAPHIC,
          element: axialViewportElementRef.current,
          defaultOptions: {
            orientation: Enums.OrientationAxis.AXIAL,
            background: [0, 0, 0] as Types.Point3,
          },
        },
        {
          viewportId: sagittalViewportId,
          type: Enums.ViewportType.ORTHOGRAPHIC,
          element: sagittalViewportElementRef.current,
          defaultOptions: {
            orientation: Enums.OrientationAxis.SAGITTAL,
            background: [0, 0, 0] as Types.Point3,
          },
        },
        {
          viewportId: coronalViewportId,
          type: Enums.ViewportType.ORTHOGRAPHIC,
          element: coronalViewportElementRef.current,
          defaultOptions: {
            orientation: Enums.OrientationAxis.CORONAL,
            background: [0, 0, 0] as Types.Point3,
          },
        },
      ];

      renderingEngine.setViewports(viewportInputArray);

      // Load volume and set viewports
      volume.load();
      await setVolumesForViewports(
        renderingEngine,
        [{ volumeId }],
        [axialViewportId, sagittalViewportId, coronalViewportId]
      );

      // Setup tool group
      const toolGroup = cornerstoneTools.ToolGroupManager.createToolGroup(toolGroupId);
      addManipulationBindings(toolGroup);

      // Add viewports to tool group
      toolGroup.addViewport(axialViewportId, renderingEngineId);
      toolGroup.addViewport(sagittalViewportId, renderingEngineId);
      toolGroup.addViewport(coronalViewportId, renderingEngineId);

      // Configure Crosshairs tool
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

      // Set up synchronizers
      setUpSynchronizers();
      renderingEngine.renderViewports(viewportIds);
    };

    setup().then(() => {
      console.log('Rendering engine and viewports set up');
    });
  }, [
    axialViewportElementRef,
    sagittalViewportElementRef,
    coronalViewportElementRef,
    running,
  ]);

  return (
    <div className="flex flex-col items-center space-y-8">
      <div className="flex flex-col items-center">
        <div className="grid grid-cols-2 gap-4">
          <div
            className="relative border border-blue-500/50 overflow-hidden"
            style={{ width: viewportSizewidth, height: viewportSizeheight }}
          >
            <VolumeViewer3D />
          </div>
          <div
            ref={axialViewportElementRef}
            className="relative border border-blue-500/50 overflow-hidden"
            style={{ width: viewportSizewidth, height: viewportSizeheight }}
          />
          <div
            ref={sagittalViewportElementRef}
            className="relative border border-blue-500/50 overflow-hidden"
            style={{ width: viewportSizewidth, height: viewportSizeheight }}
          />
          <div
            ref={coronalViewportElementRef}
            className="relative border border-blue-500/50 overflow-hidden"
            style={{ width: viewportSizewidth, height: viewportSizeheight }}
          />
        </div>
      </div>
    </div>
  );
};

export default CrossHairs;
