// Crosshairs.tsx
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
import { FaCrosshairs, FaCamera } from 'react-icons/fa';
import { CiSearch } from "react-icons/ci";
import { GrPowerReset, GrPan } from "react-icons/gr";
import { PanTool, CrosshairsTool, ZoomTool } from '@cornerstonejs/tools';
import {
  createImageIdsAndCacheMetaData,
  addDropdownToToolbar,
  addManipulationBindings,
  addToggleButtonToToolbar,
  addButtonToToolbar,
  getLocalUrl,
} from '../../utils/demo/helpers';
import VolumeViewer3D from "./VolumeViewer3D";

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

interface CrosshairsProps {
  preset: string;
}

const CrossHairs: React.FC<CrosshairsProps> = ({ preset }) => {
  const [isPanActive, setIsPanActive] = useState(false);
  const [isCrosshairsActive, setIsCrosshairsActive] = useState(false);
  const [isZoomActive, setIsZoomActive] = useState(false);
  const [activeViewportId, setActiveViewportId] = useState<string | null>(axialViewportId);
  const activeViewportIdRef = useRef<string | null>(null);

  const axialViewportElementRef = useRef<HTMLDivElement>(null);
  const sagittalViewportElementRef = useRef<HTMLDivElement>(null);
  const coronalViewportElementRef = useRef<HTMLDivElement>(null);
  const running = useRef(false);

  let synchronizer: cornerstoneTools.Synchronizer;

  useEffect(() => {
    activeViewportIdRef.current = activeViewportId;
  }, [activeViewportId]);

  useEffect(() => {
    const handleViewportClick = (viewportId: string) => {
      setActiveViewportId(viewportId);
    };

    const axialElement = axialViewportElementRef.current;
    const sagittalElement = sagittalViewportElementRef.current;
    const coronalElement = coronalViewportElementRef.current;

    const axialClickHandler = () => handleViewportClick(axialViewportId);
    const sagittalClickHandler = () => handleViewportClick(sagittalViewportId);
    const coronalClickHandler = () => handleViewportClick(coronalViewportId);

    if (axialElement) axialElement.addEventListener('click', axialClickHandler);
    if (sagittalElement) sagittalElement.addEventListener('click', sagittalClickHandler);
    if (coronalElement) coronalElement.addEventListener('click', coronalClickHandler);

    return () => {
      if (axialElement) axialElement.removeEventListener('click', axialClickHandler);
      if (sagittalElement) sagittalElement.removeEventListener('click', sagittalClickHandler);
      if (coronalElement) coronalElement.removeEventListener('click', coronalClickHandler);
    };
  }, []);

  useEffect(() => {
    const toolbar = document.getElementById('demo-toolbar');
    if (toolbar) toolbar.innerHTML = '';

    addButtonToToolbar({
      icon: <GrPan className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" />,
      onClick: () => {
        setIsPanActive((prev) => {
          const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
          const newActive = !prev;

          if (newActive) {
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

    addButtonToToolbar({
      icon: <CiSearch className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" />,
      onClick: () => {
        setIsZoomActive((prev) => {
          const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
          const newActive = !prev;

          if (newActive) {
            toolGroup.setToolDisabled(PanTool.toolName);
            toolGroup.setToolDisabled(CrosshairsTool.toolName);
            setIsPanActive(false);
            setIsCrosshairsActive(false);

            toolGroup.setToolActive(ZoomTool.toolName, {
              bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }],
            });
          } else {
            toolGroup.setToolDisabled(ZoomTool.toolName);
          }
          return newActive;
        });
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

    addButtonToToolbar({
      icon: <FaCamera className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" />,
      onClick: () => {
        const currentViewportId = activeViewportIdRef.current;
        if (!currentViewportId) {
          alert('Please click on a viewport first to select it.');
          return;
        }

        let element: HTMLDivElement | null = null;
        switch (currentViewportId) {
          case axialViewportId:
            element = axialViewportElementRef.current;
            break;
          case sagittalViewportId:
            element = sagittalViewportElementRef.current;
            break;
          case coronalViewportId:
            element = coronalViewportElementRef.current;
            break;
        }

        if (!element) return;

        const canvas = element.querySelector('canvas');
        if (!canvas) return;

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${currentViewportId}-screenshot.png`;
        link.href = dataUrl;
        link.click();
      },
    });

    addButtonToToolbar({
      icon: <FaCrosshairs className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" />,
      onClick: () => {
        setIsCrosshairsActive((prev) => {
          const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
          const newActive = !prev;

          if (newActive) {
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

    addButtonToToolbar({
      icon: <GrPowerReset className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" />,
      className: "flex items-center gap-2 bg-transparent border-0 text-white p-2 transition hover:underline hover:text-blue-400",
      onClick: () => {
        const viewport = getRenderingEngine(renderingEngineId).getViewport(axialViewportId) as Types.IVolumeViewport;
        viewport.resetCamera({
          resetPan: true,
          resetZoom: true,
          resetToCenter: true,
          resetRotation: true,
        });
        viewport.render();
      },
    });
  }, []);

  const viewportColors: { [key: string]: string } = {
    [axialViewportId]: 'rgb(200, 0, 0)',
    [sagittalViewportId]: 'rgb(200, 200, 0)',
    [coronalViewportId]: 'rgb(0, 200, 0)',
  };

  function getReferenceLineColor(viewportId: string | number) {
    return viewportColors[viewportId];
  }

  function getReferenceLineControllable(viewportId: string) {
    return [axialViewportId, sagittalViewportId, coronalViewportId].includes(viewportId);
  }

  function getReferenceLineDraggableRotatable(viewportId: string) {
    return [axialViewportId, sagittalViewportId, coronalViewportId].includes(viewportId);
  }

  function getReferenceLineSlabThicknessControlsOn(viewportId: string) {
    return [axialViewportId, sagittalViewportId, coronalViewportId].includes(viewportId);
  }

  function setUpSynchronizers() {
    synchronizer = cornerstoneTools.synchronizers.createSlabThicknessSynchronizer(synchronizerId);
    [axialViewportId, sagittalViewportId, coronalViewportId].forEach((viewportId) => {
      synchronizer.add({
        renderingEngineId,
        viewportId,
      });
    });
    synchronizer.setEnabled(false);
  }

  useEffect(() => {
    const setup = async () => {
      if (running.current) return;
      running.current = true;

      csRenderInit();
      csToolsInit();
      dicomImageLoaderInit({ maxWebWorkers: 1 });

      cornerstoneTools.addTool(CrosshairsTool);
      cornerstoneTools.addTool(PanTool);
      cornerstoneTools.addTool(ZoomTool);

      const imageIds = await createImageIdsAndCacheMetaData({
        StudyInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
        SeriesInstanceUID:
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
        wadoRsRoot: getLocalUrl() || 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
      });

      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });

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

      volume.load();
      await setVolumesForViewports(
        renderingEngine,
        [{ volumeId }],
        [axialViewportId, sagittalViewportId, coronalViewportId]
      );

      const toolGroup = cornerstoneTools.ToolGroupManager.createToolGroup(toolGroupId);
      addManipulationBindings(toolGroup);

      toolGroup.addViewport(axialViewportId, renderingEngineId);
      toolGroup.addViewport(sagittalViewportId, renderingEngineId);
      toolGroup.addViewport(coronalViewportId, renderingEngineId);

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
            <VolumeViewer3D preset={preset} />
          </div>
          <div
            ref={axialViewportElementRef}
            onClick={() => setActiveViewportId(axialViewportId)}
            className={`
              relative
              overflow-hidden
              cursor-pointer
              transition-all         
              duration-200     
              ${activeViewportId === axialViewportId
                ? 'border-4 border-blue-500'       /* thick blue when active */
                : 'border border-blue-500/50'       /* thin faded when inactive */
              }
            `}
            style={{ width: viewportSizewidth, height: viewportSizeheight }}
          />
          <div
            ref={sagittalViewportElementRef}
            onClick={() => setActiveViewportId(sagittalViewportId)}
            className={`
              relative
              overflow-hidden
              cursor-pointer
              transition-all         
              duration-200     
              ${activeViewportId === sagittalViewportId
                ? 'border-4 border-blue-500'       /* thick blue when active */
                : 'border border-blue-500/50'       /* thin faded when inactive */
              }
            `}
            style={{ width: viewportSizewidth, height: viewportSizeheight }}
          />
          <div
            ref={coronalViewportElementRef}
            onClick={() => setActiveViewportId(coronalViewportId)}
            className={`
              relative
              overflow-hidden
              cursor-pointer
              transition-all         
              duration-200     
              ${activeViewportId === coronalViewportId
                ? 'border-4 border-blue-500'       /* thick blue when active */
                : 'border border-blue-500/50'       /* thin faded when inactive */
              }
            `}
            style={{ width: viewportSizewidth, height: viewportSizeheight }}
          />
        </div>
      </div>
    </div>
  );
};

export default CrossHairs;