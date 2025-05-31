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
import {
  PanTool,
  CrosshairsTool,
  ZoomTool,
  TrackballRotateTool,
  LengthTool,
  HeightTool,
  ProbeTool,
  RectangleROITool,
  EllipticalROITool,
  CircleROITool,
  BidirectionalTool,
  AngleTool,
  CobbAngleTool,
  ArrowAnnotateTool,
  PlanarFreehandROITool,
} from '@cornerstonejs/tools';
import {
  addDropdownToToolbar,
  addManipulationBindings,
  addButtonToToolbar,
} from '../../utils/demo/helpers';
import { vec3, mat4 } from 'gl-matrix';
import cornerstoneDICOMImageLoader from '@cornerstonejs/dicom-image-loader';
import * as csRenderCore from '@cornerstonejs/core';
import axios from 'axios';
import vtkPoints from '@kitware/vtk.js/Common/Core/Points';
import vtkPolyData from '@kitware/vtk.js/Common/DataModel/PolyData';
import vtkPolyDataMapper from '@kitware/vtk.js/Rendering/Core/PolyDataMapper';
import vtkActor from '@kitware/vtk.js/Rendering/Core/Actor';
import vtkSphereSource from '@kitware/vtk.js/Filters/Sources/SphereSource';
import vtkMapper from '@kitware/vtk.js/Rendering/Core/Mapper';
import HURangeSlider from './HURangeSlider';

const volumeName = 'VOLUME_ID';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
const volumeId = `${volumeLoaderScheme}:${volumeName}`;
const toolGroupId = 'CROSSHAIRS_TOOLGROUP_ID';
const volumeToolGroupId = 'VOLUME_TOOL_GROUP_ID';
const axialViewportId = 'AXIAL_VIEWPORT_ID';
const sagittalViewportId = 'SAGITTAL_VIEWPORT_ID';
const coronalViewportId = 'CORONAL_VIEWPORT_ID';
const volumeViewportId = 'VOLUME_VIEWPORT_ID';
const viewportIds = [axialViewportId, sagittalViewportId, coronalViewportId, volumeViewportId];
const renderingEngineId = 'volumeRenderingEngine';
const synchronizerId = 'SLAB_THICKNESS_SYNCHRONIZER_ID';

// Cache settings for large series
const MAX_CACHE_SIZE_MB = 2048; // 2GB cache
const LARGE_SERIES_THRESHOLD = 302; // Apply downsampling for series with more than 302 slices
const LOW_QUALITY_TEXTURE = true; // Use lower quality textures for large series

interface CrosshairsProps {
  preset: string;
  setFileHandler: (handler: (event: React.ChangeEvent<HTMLInputElement>) => void) => void;
  setExportHandler: (handler: () => void) => void;
  setImportHandler: (handler: (event: React.ChangeEvent<HTMLInputElement>) => void) => void;
  setImportPointsHandler?: (handler: (event: React.ChangeEvent<HTMLInputElement>) => void) => void;
  setIsImageLoaded: (isLoaded: boolean) => void;
  setAddPointHandler?: (handler: (point: Point3D) => boolean) => void;
}

// Type definition for annotation metadata to include viewportId
interface AnnotationMetadata extends Types.ViewReference {
  toolName: string;
  cameraPosition?: Types.Point3;
  viewUp?: Types.Point3;
  viewportId?: string;
  referencedImageId?: string;
}

// Add this type definition near the top with other interfaces
interface Point3D {
  x: number;
  y: number;
  z: number;
  color?: [number, number, number];
  size?: number;
}

const CrossHairs: React.FC<CrosshairsProps> = ({ 
  preset, 
  setFileHandler,
  setExportHandler,
  setImportHandler,
  setImportPointsHandler,
  setIsImageLoaded
}) => {
  const [isPanActive, setIsPanActive] = useState(false);
  const [isCrosshairsActive, setIsCrosshairsActive] = useState(false);
  const [isZoomActive, setIsZoomActive] = useState(false);
  const [activeViewportId, setActiveViewportId] = useState<string | null>(axialViewportId);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Processing...');
  const activeViewportIdRef = useRef<string | null>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);

  const axialViewportElementRef = useRef<HTMLDivElement>(null);
  const sagittalViewportElementRef = useRef<HTMLDivElement>(null);
  const coronalViewportElementRef = useRef<HTMLDivElement>(null);
  const volumeViewportElementRef = useRef<HTMLDivElement>(null);
  const running = useRef(false);

  let synchronizer: cornerstoneTools.Synchronizer;

  const [isImageLoaded, setIsImageLoadedLocal] = useState(false);

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
      case volumeViewportId:
        rotationAxis = [0, 0, 1];
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
            textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0,
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
        {
          viewportId: volumeViewportId,
          type: Enums.ViewportType.VOLUME_3D,
          element: volumeViewportElementRef.current,
          defaultOptions: {
            orientation: Enums.OrientationAxis.CORONAL,
            background: [0, 0, 0] as Types.Point3,
          },
        },
      ];

      renderingEngine.setViewports(viewportInputArray);

      const isMobile = window.matchMedia('(any-pointer:coarse)').matches;

      const toolGroup = cornerstoneTools.ToolGroupManager.createToolGroup(toolGroupId);
      addManipulationBindings(toolGroup);

      // Add all tools
      toolGroup.addTool(LengthTool.toolName);
      toolGroup.addTool(HeightTool.toolName);
      toolGroup.addTool(ProbeTool.toolName);
      toolGroup.addTool(RectangleROITool.toolName);
      toolGroup.addTool(EllipticalROITool.toolName);
      toolGroup.addTool(CircleROITool.toolName);
      toolGroup.addTool(BidirectionalTool.toolName);
      toolGroup.addTool(AngleTool.toolName);
      toolGroup.addTool(CobbAngleTool.toolName);
      toolGroup.addTool(ArrowAnnotateTool.toolName);
      toolGroup.addTool(PlanarFreehandROITool.toolName);
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
        configuration: {
          hideLinesWhenPassive: true,
          hideLinesWhenDisabled: true,
        },
      });

      // Set all tools to disabled initially, including crosshairs
      toolGroup.setToolDisabled(CrosshairsTool.toolName);
      toolGroup.setToolPassive(LengthTool.toolName);
      toolGroup.setToolPassive(HeightTool.toolName);
      toolGroup.setToolPassive(ProbeTool.toolName);
      toolGroup.setToolPassive(RectangleROITool.toolName);
      toolGroup.setToolPassive(EllipticalROITool.toolName);
      toolGroup.setToolPassive(CircleROITool.toolName);
      toolGroup.setToolPassive(BidirectionalTool.toolName);
      toolGroup.setToolPassive(AngleTool.toolName);
      toolGroup.setToolPassive(CobbAngleTool.toolName);
      toolGroup.setToolPassive(ArrowAnnotateTool.toolName);
      toolGroup.setToolPassive(PlanarFreehandROITool.toolName);

      toolGroup.addViewport(axialViewportId, renderingEngineId);
      toolGroup.addViewport(sagittalViewportId, renderingEngineId);
      toolGroup.addViewport(coronalViewportId, renderingEngineId);

      const volumeToolGroup = cornerstoneTools.ToolGroupManager.createToolGroup(volumeToolGroupId);
      volumeToolGroup.addTool(TrackballRotateTool.toolName);
      volumeToolGroup.addTool(ZoomTool.toolName);
      volumeToolGroup.addTool(PanTool.toolName);

      // Configure tools for 3D viewport
      volumeToolGroup.setToolActive(TrackballRotateTool.toolName, {
        bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }],
      });
      volumeToolGroup.setToolActive(ZoomTool.toolName, {
        bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Wheel }],
      });
      volumeToolGroup.setToolActive(PanTool.toolName, {
        bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Secondary }],
      });

      volumeToolGroup.addViewport(volumeViewportId, renderingEngineId);
    } catch (error) {
      console.error('Failed to reinitialize rendering engine:', error);
    }
  };

  const getViewportElement = (viewportId: string): HTMLDivElement | null => {
    switch (viewportId) {
      case axialViewportId:
        return axialViewportElementRef.current;
      case sagittalViewportId:
        return sagittalViewportElementRef.current;
      case coronalViewportId:
        return coronalViewportElementRef.current;
      case volumeViewportId:
        return volumeViewportElementRef.current;
      default:
        return null;
    }
  };

  // Improved getSliceNumber function with fallback
  const getSliceNumber = (imageId: string | undefined, viewportId: string): number => {
    if (!imageId) {
      console.warn(`No imageId provided for annotation in viewport ${viewportId}, defaulting to slice 0`);
      return 0;
    }

    const metadata = metaData.get('imagePlaneModule', imageId);
    if (!metadata || !metadata.imagePositionPatient) {
      console.warn(`No valid metadata or imagePositionPatient for imageId ${imageId}, defaulting to slice 0`);
      return 0;
    }

    const position = metadata.imagePositionPatient;
    const volume = cache.getVolume(volumeId);
    if (!volume) {
      console.warn(`No volume found for volumeId ${volumeId}, defaulting to slice 0`);
      return 0;
    }

    const { dimensions, spacing } = volume;
    let zIndex: number;

    // Adjust slice calculation based on viewport orientation
    switch (viewportId) {
      case axialViewportId:
        zIndex = Math.round(position[2] / spacing[2]);
        break;
      case sagittalViewportId:
        zIndex = Math.round(position[0] / spacing[0]);
        break;
      case coronalViewportId:
        zIndex = Math.round(position[1] / spacing[1]);
        break;
      default:
        console.warn(`Unknown viewportId ${viewportId}, defaulting to slice 0`);
        return 0;
    }

    // Ensure zIndex is within valid range
    return Math.min(Math.max(zIndex, 0), dimensions[2] - 1);
  };

  // Function to format annotations into the specified JSON structure
  const formatAnnotations = (annotations: { metadata: AnnotationMetadata; data: any }[]) => {
    const annotationsBySlice: { [key: string]: any } = {};

    annotations.forEach((annotation) => {
      const { metadata, data } = annotation;
      if (!metadata || !metadata.toolName || !data || !data.handles) {
        console.warn('Skipping invalid annotation:', annotation);
        return;
      }

      const imageId = metadata.referencedImageId;
      const viewportId = metadata.viewportId ?? axialViewportId;
      const sliceNumber = getSliceNumber(imageId, viewportId);

      if (!annotationsBySlice[`slice_${sliceNumber}`]) {
        annotationsBySlice[`slice_${sliceNumber}`] = {};
      }

      const sliceData = annotationsBySlice[`slice_${sliceNumber}`];
      const toolType = metadata.toolName;

      // Add viewport-specific information
      if (!sliceData[toolType]) {
        sliceData[toolType] = [];
      }

      // Get viewport information for proper restoration
      const viewport = getRenderingEngine(renderingEngineId)?.getViewport(viewportId);
      const camera = viewport?.getCamera();
      const viewPlaneNormal = camera?.viewPlaneNormal;
      const viewUp = camera?.viewUp;

      // Create tool-specific annotation data
      const annotationData = {
        points: data.handles.points,
        viewPlaneNormal,
        viewUp,
        viewportId,
        imageId,
        cachedStats: data.cachedStats || {},
        // Add tool-specific data
        ...(toolType === 'arrowAnnotate' && { label: data.label }),
        ...(toolType === 'length' && { length: data.cachedStats?.length }),
        ...(toolType === 'height' && { height: data.cachedStats?.height }),
        ...(toolType === 'probe' && {
          HU: data.cachedStats?.value,
          mean: data.cachedStats?.mean,
          max: data.cachedStats?.max,
          stdDev: data.cachedStats?.stdDev,
        }),
        ...(toolType === 'rectangleROI' && {
          area: data.cachedStats?.area,
          mean: data.cachedStats?.mean,
          max: data.cachedStats?.max,
          stdDev: data.cachedStats?.stdDev,
        }),
        ...(toolType === 'ellipticalROI' && {
          area: data.cachedStats?.area,
          mean: data.cachedStats?.mean,
          max: data.cachedStats?.max,
          stdDev: data.cachedStats?.stdDev,
        }),
        ...(toolType === 'circleROI' && {
          area: data.cachedStats?.area,
          mean: data.cachedStats?.mean,
          max: data.cachedStats?.max,
          stdDev: data.cachedStats?.stdDev,
        }),
        ...(toolType === 'bidirectional' && { angle: data.cachedStats?.angle }),
        ...(toolType === 'angle' && { angle: data.cachedStats?.angle }),
        ...(toolType === 'cobbAngle' && { angle: data.cachedStats?.angle }),
      };

      sliceData[toolType].push(annotationData);
    });

    return annotationsBySlice;
  };

  // Updated exportToJSON function with enhanced retrieval and debugging
  const exportToJSON = async () => {
    try {
      console.log('Starting annotation export...');

      const annotationToolsNames = [
        LengthTool.toolName,
        HeightTool.toolName,
        ProbeTool.toolName,
        RectangleROITool.toolName,
        EllipticalROITool.toolName,
        CircleROITool.toolName,
        BidirectionalTool.toolName,
        AngleTool.toolName,
        CobbAngleTool.toolName,
        ArrowAnnotateTool.toolName,
        PlanarFreehandROITool.toolName,
      ];

      const viewports = [axialViewportId, sagittalViewportId, coronalViewportId];
      const annotations: { metadata: AnnotationMetadata; data: any }[] = [];

      // Verify tool group
      const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
      if (!toolGroup) {
        console.error('Tool group not found for ID:', toolGroupId);
        alert('Tool group not found. Cannot export annotations.');
        return;
      }
      console.log('Tool group found:', toolGroupId, 'Viewports:', toolGroup.viewportsInfo);

      // Primary retrieval: Check each tool and viewport
      annotationToolsNames.forEach((toolName) => {
        viewports.forEach((viewportId) => {
          try {
            console.log(`Retrieving annotations for tool: ${toolName}, viewport: ${viewportId}`);
            const toolAnnotations = cornerstoneTools.annotation.state.getAnnotations(toolName, viewportId) || [];
            console.log(`Found ${toolAnnotations.length} annotations for ${toolName} in ${viewportId}`);
            toolAnnotations.forEach((annotation: any) => {
              if (annotation.metadata?.toolName) {
                console.log(`Processing annotation:`, annotation);
                annotation.metadata.viewportId = annotation.metadata.viewportId ?? viewportId;
                annotations.push({
                  metadata: annotation.metadata,
                  data: annotation.data || {},
                });
              } else {
                console.warn(`Skipping annotation with missing toolName in ${viewportId}:`, annotation);
              }
            });
          } catch (error) {
            console.warn(`Error retrieving annotations for ${toolName} in ${viewportId}:`, error);
          }
        });
      });

      // Fallback: Try all annotations
      if (annotations.length === 0) {
        console.log('No annotations found in primary retrieval, attempting to retrieve all annotations...');
        try {
          const allAnnotations = cornerstoneTools.annotation.state.getAllAnnotations() || [];
          console.log(`Found ${allAnnotations.length} total annotations:`, allAnnotations);
          allAnnotations.forEach((annotation: any) => {
            if (annotation.metadata?.toolName) {
              const viewportId = annotation.metadata.viewportId ?? axialViewportId;
              if (viewports.includes(viewportId)) {
                console.log(`Processing fallback annotation:`, annotation);
                annotations.push({
                  metadata: annotation.metadata,
                  data: annotation.data || {},
                });
              } else {
                console.log(`Skipping annotation with invalid viewportId: ${viewportId}`, annotation);
              }
            } else {
              console.warn('Skipping annotation with missing toolName:', annotation);
            }
          });
        } catch (error) {
          console.warn('Error retrieving all annotations:', error);
        }
      }

      // Check annotation state directly for debugging
      if (annotations.length === 0) {
        console.log('Checking annotation state directly...');
        try {
          const state = cornerstoneTools.annotation.state;
          console.log('Annotation state:', state);
          console.log('Tool groups:', cornerstoneTools.ToolGroupManager.getAllToolGroups());
        } catch (error) {
          console.warn('Error accessing annotation state:', error);
        }
      }

      if (annotations.length === 0) {
        console.error('No valid annotations found after all retrieval attempts.');
        alert('No valid annotations found to export. Check console for details.');
        return;
      }

      console.log(`Total annotations to process: ${annotations.length}`, annotations);

      const formattedAnnotations = formatAnnotations(annotations);

      if (Object.keys(formattedAnnotations).length === 0) {
        console.error('No annotations could be formatted. Possible issues with annotation data.');
        alert('No annotations could be formatted. Check console for details.');
        return;
      }

      const jsonData = {
        metadata: {
          savedAt: new Date().toISOString(),
          cornerstoneVersion: '3.x',
          toolsVersion: '4.x',
        },
        annotations: formattedAnnotations,
      };

      console.log('Formatted JSON data:', jsonData);

      const jsonStr = JSON.stringify(jsonData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.download = 'annotations.json';
      link.href = url;
      link.click();

      setTimeout(() => URL.revokeObjectURL(url), 100);
    } catch (error) {
      console.error('Error exporting to JSON:', error);
      alert('Failed to export annotations to JSON. Check the console for details.');
    }
  };

  // Function to validate if a slice exists in the current volume
  const validateSliceExists = (sliceNumber: number, viewportId: string): boolean => {
    const volume = cache.getVolume(volumeId);
    if (!volume) {
      console.error('No volume found for validation');
      return false;
    }

    const { dimensions } = volume;
    let maxSlices: number;

    // Get max slices based on viewport orientation
    switch (viewportId) {
      case axialViewportId:
        maxSlices = dimensions[2];
        break;
      case sagittalViewportId:
        maxSlices = dimensions[0];
        break;
      case coronalViewportId:
        maxSlices = dimensions[1];
        break;
      default:
        console.error('Invalid viewport ID for validation');
        return false;
    }

    return sliceNumber >= 0 && sliceNumber < maxSlices;
  };

  // Function to import annotations from JSON
  const importAnnotations = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      if (!jsonData.annotations) {
        alert('Invalid JSON format: Missing annotations.');
        return;
      }

      // Get current volume info
      const volume = cache.getVolume(volumeId);
      if (!volume) {
        alert('No DICOM series loaded. Please load a DICOM series first.');
        return;
      }

      // Get tool group and enable all annotation tools
      const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
      if (!toolGroup) {
        console.error('Tool group not found');
        return;
      }

      // Enable all annotation tools for editing
      const annotationTools = [
        LengthTool.toolName,
        HeightTool.toolName,
        ProbeTool.toolName,
        RectangleROITool.toolName,
        EllipticalROITool.toolName,
        CircleROITool.toolName,
        BidirectionalTool.toolName,
        AngleTool.toolName,
        CobbAngleTool.toolName,
        ArrowAnnotateTool.toolName,
        PlanarFreehandROITool.toolName,
      ];

      // Set all tools to passive mode
      annotationTools.forEach(toolName => {
        toolGroup.setToolPassive(toolName);
      });

      // Clear existing annotations
      cornerstoneTools.annotation.state.removeAllAnnotations();

      // Import annotations
      Object.keys(jsonData.annotations).forEach((sliceKey) => {
        const sliceNumber = parseInt(sliceKey.replace('slice_', ''));
        const sliceData = jsonData.annotations[sliceKey];

        // Process each viewport
        [axialViewportId, sagittalViewportId, coronalViewportId].forEach(viewportId => {
          if (!validateSliceExists(sliceNumber, viewportId)) return;

          const imageId = volume.imageIds[sliceNumber];
          if (!imageId) return;

          Object.keys(sliceData).forEach((toolType) => {
            sliceData[toolType].forEach((annotationData: any) => {
              try {
                // Get the appropriate tool instance
                const toolInstance = toolGroup.getToolInstance(toolType);
                if (!toolInstance) {
                  console.warn(`Tool instance not found for ${toolType}`);
                  return;
                }

                // Create annotation using tool-specific hydration
                let annotation;
                switch (toolType) {
                  case LengthTool.toolName:
                    annotation = LengthTool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                    });
                    break;
                  case HeightTool.toolName:
                    annotation = HeightTool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                    });
                    break;
                  case ProbeTool.toolName:
                    annotation = ProbeTool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                    });
                    break;
                  case RectangleROITool.toolName:
                    annotation = RectangleROITool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                    });
                    break;
                  case EllipticalROITool.toolName:
                    annotation = EllipticalROITool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                    });
                    break;
                  case CircleROITool.toolName:
                    annotation = CircleROITool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                    });
                    break;
                  case BidirectionalTool.toolName:
                    annotation = BidirectionalTool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                    });
                    break;
                  case AngleTool.toolName:
                    annotation = AngleTool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                    });
                    break;
                  case CobbAngleTool.toolName:
                    annotation = CobbAngleTool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                    });
                    break;
                  case ArrowAnnotateTool.toolName:
                    annotation = ArrowAnnotateTool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                      label: annotationData.label,
                    });
                    break;
                  case PlanarFreehandROITool.toolName:
                    annotation = PlanarFreehandROITool.hydrate(viewportId, annotationData.points, {
                      referencedImageId: imageId,
                      viewplaneNormal: annotationData.viewPlaneNormal,
                      viewUp: annotationData.viewUp,
                    });
                    break;
                  default:
                    console.warn(`Unknown tool type: ${toolType}`);
                    return;
                }

                // Add cached stats if available
                if (annotationData.cachedStats) {
                  annotation.data.cachedStats = annotationData.cachedStats;
                }

                // Add the annotation to the state
                cornerstoneTools.annotation.state.addAnnotation(annotation, getViewportElement(viewportId));

              } catch (error) {
                console.warn(`Failed to add annotation for ${toolType} in ${viewportId}:`, error);
              }
            });
          });
        });
      });

      // Render all viewports
      const renderingEngine = getRenderingEngine(renderingEngineId);
      renderingEngine?.renderViewports([axialViewportId, sagittalViewportId, coronalViewportId]);

    } catch (error) {
      console.error('Error importing annotations:', error);
      alert('Failed to import annotations. Please ensure the file is valid and matches the current DICOM series.');
    }
  };

  useEffect(() => {
    const toolbar = document.getElementById('demo-toolbar');
    if (toolbar) toolbar.innerHTML = '';

    const annotationToolsNames = [
      LengthTool.toolName,
      HeightTool.toolName,
      ProbeTool.toolName,
      RectangleROITool.toolName,
      EllipticalROITool.toolName,
      CircleROITool.toolName,
      BidirectionalTool.toolName,
      AngleTool.toolName,
      CobbAngleTool.toolName,
      ArrowAnnotateTool.toolName,
      PlanarFreehandROITool.toolName,
    ];

    // Add pan button
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

    // Add zoom button
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

    // Annotation tools dropdown
    addDropdownToToolbar({
      options: { values: annotationToolsNames, defaultValue: CrosshairsTool.toolName },
      onSelectedValueChange: (newSelectedToolName) => {
        const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
        toolGroup.setToolActive(newSelectedToolName, {
          bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }],
        });
        annotationToolsNames.forEach((toolName) => {
          if (toolName !== newSelectedToolName) {
            toolGroup.setToolPassive(toolName);
          }
        });
      },
    });

    // Blend mode dropdown
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

    // Screenshot button
    addButtonToToolbar({
      icon: <FaCamera className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" title="Capture Screenshot" />,
      onClick: async () => {
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
          case volumeViewportId:
            element = volumeViewportElementRef.current;
            break;
        }

        if (!element) return;

        try {
          const canvas = element.querySelector('canvas');
          const svgElement = element.querySelector('svg');

          if (!canvas) return;

          const compositeCanvas = document.createElement('canvas');
          compositeCanvas.width = canvas.width;
          compositeCanvas.height = canvas.height;
          const ctx = compositeCanvas.getContext('2d');

          ctx.drawImage(canvas, 0, 0);

          if (svgElement) {
            const svgData = new XMLSerializer().serializeToString(svgElement);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml' });
            const svgUrl = URL.createObjectURL(svgBlob);

            await new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => {
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(svgUrl);
                resolve(null);
              };
              img.onerror = () => {
                URL.revokeObjectURL(svgUrl);
                reject(new Error('Failed to load annotations'));
              };
              img.src = svgUrl;
            });
          }

          const dataUrl = compositeCanvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `${currentViewportId}-screenshot.png`;
          link.href = dataUrl;
          link.click();
        } catch (error) {
          console.error('Error capturing screenshot:', error);
          alert('Failed to capture image with annotations');
        }
      },
    });

    // Crosshairs button
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

          const renderingEngine = getRenderingEngine(renderingEngineId);
          if (renderingEngine) {
            renderingEngine.renderViewports([axialViewportId, sagittalViewportId, coronalViewportId]);
          }

          return newActive;
        });
      },
    });

    // Reset view button
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

    // Rotate view button
    addButtonToToolbar({
      icon: <AiOutlineRotateRight className="w-6 h-6 text-white hover:underline hover:opacity-80 cursor-pointer" title="Rotate View" />,
      onClick: () => rotateViewport(90),
    });
  }, []);

  // Add styles for dropdown menus
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      #demo-toolbar select {
        color: white;
        background-color: var(--color-gray-700);
        padding: 8px;
        border-radius: 0.25rem;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const viewportColors: { [key: string]: string } = {
    [axialViewportId]: 'rgb(200, 0, 0)',
    [sagittalViewportId]: 'rgb(200, 200, 0)',
    [coronalViewportId]: 'rgb(0, 200, 0)',
    [volumeViewportId]: 'rgb(0, 0, 200)',
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

  // Add this function before the CrossHairs component
  const addPointToVolume = (
    viewport: Types.IVolumeViewport,
    point: Point3D,
    volume: csRenderCore.Types.IImageVolume | csRenderCore.Types.IStreamingImageVolume
  ) => {
    try {
      console.log('Adding point to volume:', point);
      const { spacing } = volume;
      const worldPoint = [
        point.x * spacing[0],
        point.y * spacing[1],
        point.z * spacing[2]
      ] as [number, number, number];

      console.log('World point coordinates:', worldPoint);

      // Create a sphere using vtk.js
      const sphereSource = vtkSphereSource.newInstance({
        center: worldPoint,
        radius: point.size || 2,
        phiResolution: 32,
        thetaResolution: 32
      });

      console.log('Created sphere source');

      const mapper = vtkMapper.newInstance();
      mapper.setInputConnection(sphereSource.getOutputPort());

      const actor = vtkActor.newInstance();
      const color = point.color || [1, 0, 0];
      actor.setMapper(mapper);
      actor.getProperty().setColor(color[0], color[1], color[2]);

      console.log('Created actor with color:', color);

      // Add the actor to the viewport
      const actorUid = `point-${Date.now()}-${Math.random()}`;
      viewport.addActor({
        uid: actorUid,
        actor
      });

      console.log('Added actor to viewport:', actorUid);
      viewport.render();
      return true;
    } catch (error) {
      console.error('Error adding point to volume:', error);
      return false;
    }
  };

  // Replace the volume loading code section with this simplified version
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      alert('No files selected.');
      return;
    }

    const imageIds: { id: string; fileName: string }[] = [];
    const isLargeSeries = files.length > LARGE_SERIES_THRESHOLD;

    if (isLargeSeries) {
      console.log(`Large series detected (${files.length} files). Applying downsampling (take 1, skip 1).`);
      alert(`Large series detected (${files.length} files). Applying downsampling for better performance.`);
    }

    // Process all files at once
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

    // Sort imageIds by filename to ensure correct order
    imageIds.sort((a, b) => a.fileName.localeCompare(b.fileName));

    // Apply downsampling for large series (take 1, skip 1)
    const selectedImageIds = isLargeSeries 
      ? imageIds.filter((_, index) => index % 2 === 0) // Take every even-indexed image (0, 2, 4, ...)
      : imageIds;

    console.log(`Original series: ${imageIds.length} images, After downsampling: ${selectedImageIds.length} images`);

    // Load all images at once
    const validImageIds = await Promise.all(
      selectedImageIds.map(async ({ id: imageId, fileName }) => {
        try {
          await imageLoader.loadImage(imageId);
          const imagePixelModule = metaData.get('imagePixelModule', imageId);
          if (imagePixelModule && typeof imagePixelModule.pixelRepresentation !== 'undefined') {
            return imageId;
          } else {
            console.warn(`Skipping imageId ${imageId} (file: ${fileName}): Missing or invalid metadata.`);
            return null;
          }
        } catch (error) {
          console.warn(`Skipping imageId ${imageId} (file: ${fileName}) due to load error:`, error);
          return null;
        }
      })
    ).then(ids => ids.filter((id): id is string => id !== null));

    if (validImageIds.length === 0) {
      alert('No valid DICOM files with required metadata were found. Please upload valid DICOM files.');
      return;
    }

    try {
      // Clear existing volume
      if (cache.getVolumeLoadObject(volumeId)) {
        cache.removeVolumeLoadObject(volumeId);
      }

      // Load new volume
      const volume = await volumeLoader.createAndCacheVolume(volumeId, { 
        imageIds: validImageIds
      });

      await volume.load();

      const renderingEngine = getRenderingEngine(renderingEngineId);
      if (!renderingEngine) {
        console.error('Rendering engine not found.');
        return;
      }

      // Set volumes for all viewports with proper initialization
      await setVolumesForViewports(
        renderingEngine,
        [{
          volumeId,
        }],
        [axialViewportId, sagittalViewportId, coronalViewportId, volumeViewportId]
      );

      // Initialize each viewport
      const viewports = [axialViewportId, sagittalViewportId, coronalViewportId, volumeViewportId];
      viewports.forEach(viewportId => {
        const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport;
        if (viewport) {
          viewport.resetCamera();
          viewport.setProperties({
            voiRange: { lower: -1000, upper: 3000 },
            VOILUTFunction: Enums.VOILUTFunctionType.LINEAR
          });

          if (viewportId === volumeViewportId) {
            viewport.setProperties({
              preset: 'CT-Bone'
            });
          }
        }
      });

      // Force render all viewports
      renderingEngine.renderViewports(viewports);
      setIsImageLoadedLocal(true);

    } catch (error) {
      console.error('Error loading volume:', error);
      setIsImageLoadedLocal(false);
      alert('Failed to load DICOM files. Please ensure all files are valid and try again.');
    }
  };

  // Update the handleImportPoints function to preserve the volume while adding points
  const handleImportPoints = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('Import points handler called in Crosshairs component');
    const file = event.target.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    try {
      console.log('Reading file:', file.name);
      const text = await file.text();
      console.log('File contents:', text);
      const data = JSON.parse(text);

      if (!data.points || !Array.isArray(data.points)) {
        console.error('Invalid JSON format - missing points array:', data);
        alert('Invalid JSON format: Expected an object with a "points" array.');
        return;
      }

      console.log('Parsed points:', data.points);

      // Validate points format
      const validPoints = data.points.filter(point => 
        typeof point.x === 'number' && 
        typeof point.y === 'number' && 
        typeof point.z === 'number'
      );

      console.log('Valid points:', validPoints);

      if (validPoints.length === 0) {
        console.error('No valid points found in data');
        alert('No valid points found in the file.');
        return;
      }

      // Get the volume and viewport
      const renderingEngine = getRenderingEngine(renderingEngineId);
      if (!renderingEngine) {
        console.error('Rendering engine not found');
        alert('Rendering engine not initialized.');
        return;
      }

      const volumeViewport = renderingEngine.getViewport(volumeViewportId) as Types.IVolumeViewport;
      const volume = cache.getVolume(volumeId);
      
      if (!volumeViewport || !volume) {
        console.error('Volume or viewport not found', { 
          hasVolume: !!volume, 
          hasViewport: !!volumeViewport,
          volumeId,
          viewportId: volumeViewportId
        });
        alert('Volume not loaded. Please load a DICOM series first.');
        return;
      }

      console.log('Volume and viewport found, proceeding with sphere creation');
      
      // Only clear point actors (those with 'point-' prefix in their UID)
      console.log('Clearing existing point actors');
      const actors = volumeViewport.getActors();
      console.log('Found existing actors:', actors.length);
      actors.forEach(actor => {
        if (actor.uid.startsWith('point-')) {
          try {
            volumeViewport._removeActor(actor.uid);
            console.log('Removed point actor:', actor.uid);
          } catch (error) {
            console.error('Error removing point actor:', error);
          }
        }
      });

      console.log('Adding new spheres');
      // Add each point as a sphere
      validPoints.forEach((point, index) => {
        console.log('Processing point:', point);
        // Create a unique color for each point
        const hue = (index * 137.5) % 360; // Golden angle approximation for good color distribution
        const color: [number, number, number] = [
          Math.cos(hue * Math.PI / 180) * 0.5 + 0.5,
          Math.cos((hue + 120) * Math.PI / 180) * 0.5 + 0.5,
          Math.cos((hue + 240) * Math.PI / 180) * 0.5 + 0.5
        ];

        // Add the sphere at the point location with a larger size
        const success = addPointToVolume(volumeViewport, {
          x: point.x,
          y: point.y,
          z: point.z,
          color,
          size: 0.5  // Increased from 5 to 20mm radius for better visibility
        }, volume);

        console.log('Added sphere:', { point, success, size: 2 });
      });

      // Render the viewport
      console.log('Rendering viewport');
      volumeViewport.render();
      console.log(`Successfully added ${validPoints.length} spheres`);

    } catch (error) {
      console.error('Error importing points:', error);
      alert('Failed to import points. Please ensure the file is valid JSON.');
    }
  };

  useEffect(() => {
    const setup = async () => {
      if (running.current) return;
      running.current = true;

      await csRenderInit();
      await csToolsInit();
      await dicomImageLoaderInit({
        maxWebWorkers: navigator.hardwareConcurrency || 4,
      });

      cache.setMaxCacheSize(MAX_CACHE_SIZE_MB * 1024 * 1024);

      // Register all tools
      cornerstoneTools.addTool(CrosshairsTool);
      cornerstoneTools.addTool(PanTool);
      cornerstoneTools.addTool(ZoomTool);
      cornerstoneTools.addTool(TrackballRotateTool);
      cornerstoneTools.addTool(LengthTool);
      cornerstoneTools.addTool(HeightTool);
      cornerstoneTools.addTool(ProbeTool);
      cornerstoneTools.addTool(RectangleROITool);
      cornerstoneTools.addTool(EllipticalROITool);
      cornerstoneTools.addTool(CircleROITool);
      cornerstoneTools.addTool(BidirectionalTool);
      cornerstoneTools.addTool(AngleTool);
      cornerstoneTools.addTool(CobbAngleTool);
      cornerstoneTools.addTool(ArrowAnnotateTool);
      cornerstoneTools.addTool(PlanarFreehandROITool);

      await setupRenderingEngine();

      const canvases = [
        axialViewportElementRef.current?.querySelector('canvas'),
        sagittalViewportElementRef.current?.querySelector('canvas'),
        coronalViewportElementRef.current?.querySelector('canvas'),
        volumeViewportElementRef.current?.querySelector('canvas'),
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

    // Set up the file handler when component mounts
    console.log('Setting up file handlers');
    setFileHandler(handleFileSelect);

    // Set up the export handler when component mounts
    setExportHandler(exportToJSON);

    // Set up the import handler when component mounts
    setImportHandler(importAnnotations);

    // Set up the points import handler when component mounts
    if (setImportPointsHandler) {
      console.log('Setting up points import handler');
      setImportPointsHandler(handleImportPoints);
    } else {
      console.warn('setImportPointsHandler not provided');
    }

    return () => {
      const canvases = [
        axialViewportElementRef.current?.querySelector('canvas'),
        sagittalViewportElementRef.current?.querySelector('canvas'),
        coronalViewportElementRef.current?.querySelector('canvas'),
        volumeViewportElementRef.current?.querySelector('canvas'),
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
    volumeViewportElementRef,
    running,
    setFileHandler,
    setExportHandler,
    setImportHandler,
    setImportPointsHandler,
  ]);

  useEffect(() => {
    const renderingEngine = getRenderingEngine(renderingEngineId);
    if (!renderingEngine) return;

    try {
      const volumeViewport = renderingEngine.getViewport(volumeViewportId) as Types.IVolumeViewport;
      if (volumeViewport && cache.getVolumeLoadObject(volumeId)) {
        if (preset === 'CT-Bone-Only') {
          volumeViewport.setProperties({
            voiRange: { lower: 300, upper: 3000 },
            colormap: csRenderCore.utilities.colormap.getColormap('white'),
            preset: undefined,
            VOILUTFunction: Enums.VOILUTFunctionType.LINEAR,
            invert: false,
            interpolationType: Enums.InterpolationType.NEAREST
          });
        } else {
          volumeViewport.setProperties({ preset });
        }
        volumeViewport.render();
      }
    } catch (error) {
      console.error('Error applying preset to 3D viewport:', error);
    }
  }, [preset]);

  // Update the parent component's isImageLoaded state when local state changes
  useEffect(() => {
    setIsImageLoaded?.(isImageLoaded);
  }, [isImageLoaded, setIsImageLoaded]);

  return (
    <div>
      <div className="bg-black">
        <div className="flex flex-col h-screen">
          <div className="flex-1 p-1">
            <div className="grid grid-cols-2 grid-rows-2 h-full w-full gap-1">
              <div
                ref={volumeViewportElementRef}
                className={`
                  relative
                  overflow-hidden
                  cursor-pointer
                  transition-all
                  duration-200
                  border border-blue-500/50
                `}
              />
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
      </div>
    </div>
  );
};

export default CrossHairs;