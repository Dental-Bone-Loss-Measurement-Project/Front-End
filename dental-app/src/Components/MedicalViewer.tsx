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
  init as csRenderInit,
  Types,
} from '@cornerstonejs/core';
import {
  init as csToolsInit,
  addTool,
  ToolGroupManager,
  CrosshairsTool,
  PanTool,
  ZoomTool,
  synchronizers,
  Synchronizer,
  Enums as csToolsEnums,
} from "@cornerstonejs/tools";
import { init as dicomImageLoaderInit } from "@cornerstonejs/dicom-image-loader";
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import { FaCrosshairs, FaCamera } from 'react-icons/fa';
import { CiSearch } from "react-icons/ci";
import { GrPowerReset, GrPan } from "react-icons/gr";
import { AiOutlineRotateRight } from "react-icons/ai";
import { addButtonToToolbar, addDropdownToToolbar, addManipulationBindings } from '../../utils/demo/helpers';
import VolumeViewer3D from "./VolumeViewer3D";
import AxialViewer from "./AxialViewer";
import SagittalViewer from "./SagittalViewer";
import CoronalViewer from "./CoronalViewer";
import { vec3, mat4 } from 'gl-matrix';

// Shared Constants
export const renderingEngineId = 'volumeRenderingEngine';
export const toolGroupId = 'CROSSHAIRS_TOOLGROUP_ID';
export const axialViewportId = 'AXIAL_VIEWPORT_ID';
export const sagittalViewportId = 'SAGITTAL_VIEWPORT_ID';
export const coronalViewportId = 'CORONAL_VIEWPORT_ID';
export const volumeName = 'VOLUME_ID';
export const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
export const volumeId = `${volumeLoaderScheme}:${volumeName}`;
export const synchronizerId = 'SLAB_THICKNESS_SYNCHRONIZER_ID';
export const MAX_CACHE_SIZE_MB = 2048;
export const BATCH_SIZE = 100;
export const LOW_QUALITY_TEXTURE = true;

const viewportColors: { [key: string]: string } = {
  [axialViewportId]: 'rgb(200, 0, 0)',
  [sagittalViewportId]: 'rgb(200, 200, 0)',
  [coronalViewportId]: 'rgb(0, 200, 0)',
};

function getReferenceLineColor(viewportId: string | number) {
  return viewportColors[viewportId] || 'rgb(200, 200, 200)';
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

const MedicalViewer: React.FC<{ preset: string }> = ({ preset }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [synchronizer, setSynchronizer] = useState<Synchronizer | null>(null);
  const [activeViewportId, setActiveViewportId] = useState<string>(axialViewportId);
  const activeViewportIdRef = useRef<string>(axialViewportId);
  const running = useRef(false);

  useEffect(() => {
    activeViewportIdRef.current = activeViewportId;
  }, [activeViewportId]);

  // Initialization
  useEffect(() => {
    const setup = async () => {
      if (running.current) return;
      running.current = true;

      try {
        await csRenderInit();
        await csToolsInit();
        await dicomImageLoaderInit({
          maxWebWorkers: navigator.hardwareConcurrency || 4,
          taskConfiguration: { decodeTask: { initializeCodecsOnStartup: true, strict: false } },
        });

        cache.setMaxCacheSize(MAX_CACHE_SIZE_MB * 1024 * 1024);

        addTool(CrosshairsTool);
        addTool(PanTool);
        addTool(ZoomTool);

        new RenderingEngine(renderingEngineId);

        const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
        if (toolGroup) {
          addManipulationBindings(toolGroup);
          const isMobile = window.matchMedia('(any-pointer:coarse)').matches;
          toolGroup.addTool(CrosshairsTool.toolName, {
            getReferenceLineColor,
            getReferenceLineControllable,
            getReferenceLineDraggableRotatable,
            getReferenceLineSlabThicknessControlsOn,
            mobile: { enabled: isMobile, opacity: 0.8, handleRadius: 9 },
          });
          toolGroup.addTool(PanTool.toolName);
          toolGroup.addTool(ZoomTool.toolName);
        }

        const sync = synchronizers.createSlabThicknessSynchronizer(synchronizerId);
        setSynchronizer(sync);
        sync.setEnabled(false); // Enable after volume load

        setIsInitialized(true);
      } catch (error) {
        console.error('Setup failed:', error);
      }
    };

    setup();

    return () => {
      const renderingEngine = getRenderingEngine(renderingEngineId);
      if (renderingEngine) renderingEngine.destroy();
      ToolGroupManager.destroyToolGroup(toolGroupId);
      if (synchronizer) synchronizer.destroy();
    };
  }, []);

  // Toolbar Setup
  useEffect(() => {
    if (!isInitialized) return;
    const toolbar = document.getElementById('demo-toolbar');
    if (!toolbar) return;
    toolbar.innerHTML = '';

    const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
    if (!toolGroup) return;

    const setActiveTool = (toolName: string) => {
      toolGroup.setToolDisabled(PanTool.toolName);
      toolGroup.setToolDisabled(ZoomTool.toolName);
      toolGroup.setToolDisabled(CrosshairsTool.toolName);
      if (toolName) {
        toolGroup.setToolActive(toolName, {
          bindings: [{ mouseButton: csToolsEnums.MouseBindings.Primary }],
        });
      }
    };

    addButtonToToolbar({
      title: 'Pan Tool',
      icon: <GrPan className="w-6 h-6 text-white hover:opacity-80" />,
      onClick: () => setActiveTool(PanTool.toolName),
      container: toolbar,
    });

    addButtonToToolbar({
      title: 'Zoom Tool',
      icon: <CiSearch className="w-6 h-6 text-white hover:opacity-80" />,
      onClick: () => setActiveTool(ZoomTool.toolName),
      container: toolbar,
    });

    addButtonToToolbar({
      title: 'Crosshairs Tool',
      icon: <FaCrosshairs className="w-6 h-6 text-white hover:opacity-80" />,
      onClick: () => setActiveTool(CrosshairsTool.toolName),
      container: toolbar,
    });

    addDropdownToToolbar({
      options: {
        values: ['Maximum Intensity Projection', 'Minimum Intensity Projection', 'Average Intensity Projection'],
        defaultValue: 'Maximum Intensity Projection',
      },
      onSelectedValueChange: (selectedValue: string) => {
        const renderingEngine = getRenderingEngine(renderingEngineId);
        if (!renderingEngine) return;
        let blendMode: Enums.BlendModes;
        switch (selectedValue) {
          case 'Minimum Intensity Projection':
            blendMode = Enums.BlendModes.MINIMUM_INTENSITY_BLEND;
            break;
          case 'Average Intensity Projection':
            blendMode = Enums.BlendModes.AVERAGE_INTENSITY_BLEND;
            break;
          default:
            blendMode = Enums.BlendModes.MAXIMUM_INTENSITY_BLEND;
        }
        const crosshairsInstance = toolGroup.getToolInstance(CrosshairsTool.toolName);
        if (crosshairsInstance) {
          crosshairsInstance.configuration = {
            ...crosshairsInstance.configuration,
            slabThicknessBlendMode: blendMode,
          };
        }
        [axialViewportId, sagittalViewportId, coronalViewportId].forEach((viewportId) => {
          const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport;
          if (viewport) viewport.setBlendMode(blendMode);
        });
        renderingEngine.renderViewports([axialViewportId, sagittalViewportId, coronalViewportId]);
      },
      container: toolbar,
    });

    addButtonToToolbar({
      title: 'Capture Screenshot',
      icon: <FaCamera className="w-6 h-6 text-white hover:opacity-80" />,
      onClick: () => {
        const currentViewportId = activeViewportIdRef.current;
        if (!currentViewportId) {
          alert('Please select a viewport first.');
          return;
        }
        const renderingEngine = getRenderingEngine(renderingEngineId);
        if (!renderingEngine) return;
        const viewport = renderingEngine.getViewport(currentViewportId);
        if (!viewport) return;
        const canvas = viewport.getCanvas();
        if (!canvas) return;
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${currentViewportId}-screenshot.png`;
        link.href = dataUrl;
        link.click();
      },
      container: toolbar,
    });

    addButtonToToolbar({
      title: 'Reset View',
      icon: <GrPowerReset className="w-6 h-6 text-white hover:opacity-80" />,
      onClick: () => {
        const renderingEngine = getRenderingEngine(renderingEngineId);
        if (!renderingEngine) return;
        [axialViewportId, sagittalViewportId, coronalViewportId].forEach((viewportId) => {
          const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport;
          if (viewport) {
            viewport.resetCamera({ resetPan: true, resetZoom: true, resetToCenter: true, resetRotation: true });
          }
        });
        renderingEngine.renderViewports([axialViewportId, sagittalViewportId, coronalViewportId]);
      },
      container: toolbar,
    });

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
      const { viewUp } = camera;
      let rotationAxis: vec3;
      switch (currentViewportId) {
        case axialViewportId:
          rotationAxis = vec3.fromValues(0, 0, 1);
          break;
        case sagittalViewportId:
          rotationAxis = vec3.fromValues(1, 0, 0);
          break;
        case coronalViewportId:
          rotationAxis = vec3.fromValues(0, 1, 0);
          break;
        default:
          return;
      }
      const rotationMatrix = mat4.create();
      mat4.fromRotation(rotationMatrix, degrees * (Math.PI / 180), rotationAxis);
      const rotatedViewUp = vec3.create();
      vec3.transformMat4(rotatedViewUp, viewUp, rotationMatrix);
      viewport.setCamera({ ...camera, viewUp: rotatedViewUp as Types.Point3 });
      viewport.render();
    };

    addButtonToToolbar({
      title: 'Rotate View',
      icon: <AiOutlineRotateRight className="w-6 h-6 text-white hover:opacity-80" />,
      onClick: () => rotateViewport(90),
      container: toolbar,
    });
  }, [isInitialized]);

  // File Handling
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isInitialized) return;
    const files = event.target.files;
    if (!files || files.length === 0) {
      alert('No files selected.');
      return;
    }
    if (files.length > 450) {
      alert('Warning: Loading 450+ files may require significant resources.');
    }
    if (files.length === 1) {
      alert('Warning: Single file may not provide a complete view.');
      return;
    }

    const imageIds: { id: string; fileName: string }[] = [];
    const validImageIds: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.name.toLowerCase().endsWith('.dcm') && file.type !== 'application/dicom') {
        console.warn(`Skipping file ${file.name}: Not a DICOM file.`);
        continue;
      }
      const imageId = cornerstoneDICOMImageLoader.wadouri.fileManager.add(file);
      imageIds.push({ id: imageId, fileName: file.name });
    }

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
              console.warn(`Skipping imageId ${imageId} (file: ${fileName}): Invalid metadata.`);
            }
          } catch (error) {
            console.warn(`Skipping imageId ${imageId} (file: ${fileName}) due to error:`, error);
          }
        })
      );
      cache.purgeCache();
    }

    if (validImageIds.length === 0) {
      alert('No valid DICOM files found.');
      return;
    }

    try {
      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: validImageIds });
      await volume.load();
      const renderingEngine = getRenderingEngine(renderingEngineId);
      if (!renderingEngine) return;
      await setVolumesForViewports(
        renderingEngine,
        [{ volumeId, textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0 }],
        [axialViewportId, sagittalViewportId, coronalViewportId]
      );
      if (synchronizer) synchronizer.setEnabled(true);
      renderingEngine.renderViewports([axialViewportId, sagittalViewportId, coronalViewportId]);
    } catch (error) {
      console.error('Error loading volume:', error);
      alert('Failed to load DICOM files.');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-black">
      <div className="p-2">
        <input
          type="file"
          multiple
          accept="application/dicom,.dcm"
          onChange={handleFileSelect}
          className="mb-4 p-2 border rounded text-white"
        />
      </div>
      <div id="demo-toolbar" className="bg-gray-900 p-2 flex space-x-2" />
      <div className="flex-1 p-1 overflow-hidden">
        {!isInitialized && <div className="text-white text-center">Initializing...</div>}
        {isInitialized && (
          <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-1">
            <div className="relative border border-gray-700 overflow-hidden">
              <VolumeViewer3D preset={preset} />
            </div>
            <AxialViewer
              activeViewportId={activeViewportId}
              setActiveViewportId={setActiveViewportId}
              isInitialized={isInitialized}
              synchronizer={synchronizer}
            />
            <SagittalViewer
              activeViewportId={activeViewportId}
              setActiveViewportId={setActiveViewportId}
              isInitialized={isInitialized}
              synchronizer={synchronizer}
            />
            <CoronalViewer
              activeViewportId={activeViewportId}
              setActiveViewportId={setActiveViewportId}
              isInitialized={isInitialized}
              synchronizer={synchronizer}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MedicalViewer;