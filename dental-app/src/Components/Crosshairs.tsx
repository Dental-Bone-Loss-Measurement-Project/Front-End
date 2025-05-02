import React, { useEffect, useRef, useState } from "react";
import {
  RenderingEngine,
  Enums,
  setVolumesForViewports,
  volumeLoader,
  getRenderingEngine,
  cache,
  imageLoader,
  metaData,
} from '@cornerstonejs/core';
import type { Types } from '@cornerstonejs/core';
import { init as csRenderInit } from "@cornerstonejs/core";
import { init as csToolsInit } from "@cornerstonejs/tools";
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader";
import * as cornerstoneTools from '@cornerstonejs/tools';
import { FaCrosshairs, FaCamera } from 'react-icons/fa';
import { CiSearch } from "react-icons/ci";
import { GrPowerReset, GrPan } from "react-icons/gr";
import { AiOutlineRotateRight } from "react-icons/ai";
import { PanTool, CrosshairsTool, ZoomTool } from '@cornerstonejs/tools';
import {
  addDropdownToToolbar,
  addManipulationBindings,
  addButtonToToolbar,
} from '../../utils/demo/helpers';
import VolumeViewer3D from "./VolumeViewer3D";
import { vec3, mat4 } from 'gl-matrix';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';

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

// Cache settings for large series
const MAX_CACHE_SIZE_MB = 2048; // 2GB cache
const BATCH_SIZE = 100; // Process 100 files at a time
const LOW_QUALITY_TEXTURE = true; // Use lower quality textures for large series

interface CrosshairsProps {
  preset: string;
}

const CrossHairs: React.FC<CrosshairsProps> = ({ preset }) => {
  const [isPanActive, setIsPanActive] = useState(false);
  const [isCrosshairsActive, setIsCrosshairsActive] = useState(false);
  const [isZoomActive, setIsZoomActive] = useState(false);
  const [activeViewportId, setActiveViewportId] = useState<string | null>(axialViewportId);
  const activeViewportIdRef = useRef<string | null>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);

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

  const rotateViewport = (degrees: number) => {
    const currentViewportId = activeViewportIdRef.current;
    if (!currentViewportId) {
      alert('Please select a viewport first.');
      return;
    }

    const renderingEngine = getRenderingEngine(renderingEngineId);
    if (!renderingEngine) return;

    const viewport = renderingEngine.getViewport(currentViewportId) as Types.IVolumeViewport;
    if (!viewport) return;

    const camera = viewport.getCamera();
    const { viewUp, viewPlaneNormal } = camera;

    let rotationAxis: Types.Point3 = [0, 0, 0];

    switch (currentViewportId) {
      case axialViewportId:
        rotationAxis = [0, 0, 1];
        break;
      case sagittalViewportId:
        rotationAxis = [1, 0, 0];
        break;
      case coronalViewportId:
        rotationAxis = [0, 1, 0];
        break;
    }

    const rotationMatrix = mat4.create();
    mat4.fromRotation(rotationMatrix, degrees * (Math.PI / 180), rotationAxis);

    const rotatedViewUp = vec3.create();
    vec3.transformMat4(rotatedViewUp, viewUp, rotationMatrix);

    viewport.setCamera({
      ...camera,
      viewUp: rotatedViewUp as Types.Point3,
    });
    viewport.render();
  };

  // Handle WebGL context loss
  const handleContextLost = (event: Event) => {
    event.preventDefault();
    console.warn('WebGL context lost. Attempting to restore...');
    setTimeout(() => {
      if (renderingEngineRef.current) {
        renderingEngineRef.current = null;
        setupRenderingEngine();
      }
    }, 1000);
  };

  const setupRenderingEngine = async () => {
    try {
      const renderingEngine = new RenderingEngine(renderingEngineId);
      renderingEngineRef.current = renderingEngine;

      const viewportInputArray = [
        {
          viewportId: axialViewportId,
          type: Enums.ViewportType.ORTHOGRAPHIC,
          element: axialViewportElementRef.current,
          defaultOptions: {
            orientation: Enums.OrientationAxis.AXIAL,
            background: [0, 0, 0] as Types.Point3,
            textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0, // Lower quality for large series
          },
        },
        {
          viewportId: sagittalViewportId,
          type: Enums.ViewportType.ORTHOGRAPHIC,
          element: sagittalViewportElementRef.current,
          defaultOptions: {
            orientation: Enums.OrientationAxis.SAGITTAL,
            background: [0, 0, 0] as Types.Point3,
            textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0,
          },
        },
        {
          viewportId: coronalViewportId,
          type: Enums.ViewportType.ORTHOGRAPHIC,
          element: coronalViewportElementRef.current,
          defaultOptions: {
            orientation: Enums.OrientationAxis.CORONAL,
            background: [0, 0, 0] as Types.Point3,
            textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0,
          },
        },
      ];

      renderingEngine.setViewports(viewportInputArray);

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
    } catch (error) {
      console.error('Failed to reinitialize rendering engine:', error);
    }
  };

  useEffect(() => {
    const toolbar = document.getElementById('demo-toolbar');
    if (toolbar) toolbar.innerHTML = '';

    addButtonToToolbar({
      icon: <GrPan className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" title="Pan Tool" />,
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
      icon: <CiSearch className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" title="Zoom Tool" />,
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
      icon: <FaCamera className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" title="Capture Screenshot" />,
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
      icon: <FaCrosshairs className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" title="Crosshairs Tool" />,
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
      icon: <GrPowerReset className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" title="Reset View" />,
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

    addButtonToToolbar({
      icon: <AiOutlineRotateRight className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" title="Rotate View" />,
      onClick: () => rotateViewport(90),
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      alert('No files selected.');
      return;
    }

    if (files.length > 450) {
      alert('Warning: Loading 450+ files may require significant system resources. Ensure you have a high-performance device.');
    }

    if (files.length == 1){
      alert('Warning: Loading a single file may not provide a complete view. Please upload multiple files for better visualization.');
      return;
    }

    // Generate image IDs and validate metadata
    const imageIds: { id: string; fileName: string }[] = [];
    const validImageIds: string[] = [];

    // Step 1: Generate all imageIds
    for (const file of Array.from(files)) {
      try {
        if (!file.name.toLowerCase().endsWith('.dcm') && file.type !== 'application/dicom') {
          console.warn(`Skipping file ${file.name}: Not a recognized DICOM file.`);
          continue;
        }
        const imageId = cornerstoneDICOMImageLoader.wadouri.fileManager.add(file);
        imageIds.push({ id: imageId, fileName: file.name });
      } catch (error) {
        console.error(`Error generating imageId for file ${file.name}:`, error);
      }
    }

    // Step 2: Preload images in batches to ensure metadata is available
    for (let i = 0; i < imageIds.length; i += BATCH_SIZE) {
      const batch = imageIds.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async ({ id: imageId, fileName }) => {
          try {
            await imageLoader.loadImage(imageId);
            const imagePixelModule = metaData.get('imagePixelModule', imageId);
            if (imagePixelModule && typeof imagePixelModule.pixelRepresentation !== 'undefined') {
              validImageIds.push(imageId);
            } else {
              console.warn(`Skipping imageId ${imageId} (file: ${fileName}): Missing or invalid metadata.`, {
                imagePixelModule,
              });
            }
          } catch (error) {
            console.warn(`Skipping imageId ${imageId} (file: ${fileName}) due to load error:`, error);
          }
        })
      );
      // Purge cache periodically to free memory
      cache.purgeCache();
      console.log('Cache size after batch:', cache.getCacheSize() / (1024 * 1024), 'MB');
    }

    if (validImageIds.length === 0) {
      alert('No valid DICOM files with required metadata were found. Please upload valid DICOM files.');
      return;
    }

    try {
      // Safely remove existing volume from cache
      try {
        if (cache.getVolumeLoadObject(volumeId)) {
          cache.removeVolumeLoadObject(volumeId);
        }
      } catch (error) {
        console.warn(`Failed to remove volume ${volumeId} from cache:`, error);
      }

      // Create and cache new volume with valid imageIds
      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: validImageIds });

      // Load the volume data
      await volume.load();

      // Get the rendering engine
      const renderingEngine = getRenderingEngine(renderingEngineId);
      if (!renderingEngine) {
        console.error('Rendering engine not found.');
        return;
      }

      // Set the new volume to all three viewports
      await setVolumesForViewports(
        renderingEngine,
        [{ volumeId, textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0 }],
        [axialViewportId, sagittalViewportId, coronalViewportId]
      );

      // Render the updated viewports
      renderingEngine.renderViewports([axialViewportId, sagittalViewportId, coronalViewportId]);
    } catch (error) {
      console.error('Error loading volume:', error);
      alert('Failed to load DICOM files. Please ensure all files are valid and try again.');
    }
  };

  useEffect(() => {
    const setup = async () => {
      if (running.current) return;
      running.current = true;

      // Initialize Cornerstone libraries
      await csRenderInit();
      await csToolsInit();
      await dicomImageLoaderInit({
        maxWebWorkers: navigator.hardwareConcurrency || 4,
        taskConfiguration: {
          decodeTask: {
            initializeCodecsOnStartup: true,
            strict: false,
          },
        },
      });

      // Set cache size
      cache.setMaxCacheSize(MAX_CACHE_SIZE_MB * 1024 * 1024);

      // Add tools
      cornerstoneTools.addTool(CrosshairsTool);
      cornerstoneTools.addTool(PanTool);
      cornerstoneTools.addTool(ZoomTool);

      // Initialize rendering engine
      await setupRenderingEngine();

      // Add context loss listener to viewports
      const canvases = [
        axialViewportElementRef.current?.querySelector('canvas'),
        sagittalViewportElementRef.current?.querySelector('canvas'),
        coronalViewportElementRef.current?.querySelector('canvas'),
      ];
      canvases.forEach((canvas) => {
        if (canvas) {
          canvas.addEventListener('webglcontextlost', handleContextLost);
          canvas.addEventListener('webglcontextrestored', () => {
            console.log('WebGL context restored');
            setupRenderingEngine();
          });
        }
      });

      setUpSynchronizers();
    };

    setup().then(() => {
      console.log('Rendering engine and viewports set up');
    }).catch((error) => {
      console.error('Setup failed:', error);
    });

    return () => {
      // Cleanup context loss listeners
      const canvases = [
        axialViewportElementRef.current?.querySelector('canvas'),
        sagittalViewportElementRef.current?.querySelector('canvas'),
        coronalViewportElementRef.current?.querySelector('canvas'),
      ];
      canvases.forEach((canvas) => {
        if (canvas) {
          canvas.removeEventListener('webglcontextlost', handleContextLost);
          canvas.removeEventListener('webglcontextrestored', () => {});
        }
      });
    };
  }, [
    axialViewportElementRef,
    sagittalViewportElementRef,
    coronalViewportElementRef,
    running,
  ]);

  return (
    <>
    <div className="">
      <input
        type="file"
        multiple
        accept="application/dicom,.dcm"
        onChange={handleFileSelect}
        className="mb-4 p-2 border rounded"
      />
      </div>
      <div className="flex flex-col h-screen">
        <div className="flex-1 p-1">
          <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-1">
            <div className="relative border border-blue-500/50 overflow-hidden">
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
                  ? 'border-4 border-blue-500'
                  : 'border border-blue-500/50'
                }
              `}
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
                  ? 'border-4 border-blue-500'
                  : 'border border-blue-500/50'
                }
              `}
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
                  ? 'border-4 border-blue-500'
                  : 'border border-blue-500/50'
                }
              `}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default CrossHairs;