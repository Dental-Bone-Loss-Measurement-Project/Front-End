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
const BATCH_SIZE = 50; // Process 50 files at a time
const LOW_QUALITY_TEXTURE = true; // Use lower quality textures for large series

interface CrosshairsProps {
  preset: string;
  setFileHandler: (handler: (event: React.ChangeEvent<HTMLInputElement>) => void) => void;
}

// Type definition for annotation metadata to include viewportId
interface AnnotationMetadata extends Types.ViewReference {
  toolName: string;
  cameraPosition?: Types.Point3;
  viewUp?: Types.Point3;
  viewportId?: string;
  referencedImageId?: string;
}

const CrossHairs: React.FC<CrosshairsProps> = ({ preset, setFileHandler }) => {
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
      const viewportId = metadata.viewportId ?? axialViewportId; // Safe access with fallback
      const sliceNumber = getSliceNumber(imageId, viewportId);

      if (!annotationsBySlice[`slice_${sliceNumber}`]) {
        annotationsBySlice[`slice_${sliceNumber}`] = {
          length: [],
          height: [],
          probe: [],
          rectangleROI: [],
          ellipticalROI: [],
          circleROI: [],
          bidirectional: [],
          angle: [],
          cobbAngle: [],
          arrowAnnotate: [],
          planarFreehandROI: [],
        };
      }

      const sliceData = annotationsBySlice[`slice_${sliceNumber}`];

      switch (metadata.toolName) {
        case LengthTool.toolName:
          if (data.handles.points?.length >= 2) {
            sliceData.length.push({
              start_point: data.handles.points[0],
              end_point: data.handles.points[1],
            });
          }
          break;
        case HeightTool.toolName:
          if (data.handles.points?.length >= 2) {
            sliceData.height.push({
              start_point: data.handles.points[0],
              end_point: data.handles.points[1],
            });
          }
          break;
        case ProbeTool.toolName:
          sliceData.probe.push({
            HU: data.textBox?.value || 0,
            mean: data.textBox?.mean || 0,
            max: data.textBox?.max || 0,
            stdDev: data.textBox?.stdDev || 0,
          });
          break;
        case RectangleROITool.toolName:
          if (data.handles.points?.length >= 4) {
            sliceData.rectangleROI.push({
              area: data.textBox?.area || 0,
              mean: data.textBox?.mean || 0,
              max: data.textBox?.max || 0,
              stdDev: data.textBox?.stdDev || 0,
              coordinates: [
                data.handles.points[0][0],
                data.handles.points[0][1],
                data.handles.points[2][0],
                data.handles.points[2][1],
              ],
            });
          }
          break;
        case EllipticalROITool.toolName:
          if (data.handles.points?.length >= 2) {
            sliceData.ellipticalROI.push({
              area: data.textBox?.area || 0,
              mean: data.textBox?.mean || 0,
              max: data.textBox?.max || 0,
              stdDev: data.textBox?.stdDev || 0,
              center: data.handles.points[0],
              radius: data.handles.points[1][0] - data.handles.points[0][0], // Approximate radius
            });
          }
          break;
        case CircleROITool.toolName:
          if (data.handles.points?.length >= 2) {
            sliceData.circleROI.push({
              area: data.textBox?.area || 0,
              mean: data.textBox?.mean || 0,
              max: data.textBox?.max || 0,
              stdDev: data.textBox?.stdDev || 0,
              center: data.handles.points[0],
              radius: data.handles.points[1][0] - data.handles.points[0][0],
            });
          }
          break;
        case BidirectionalTool.toolName:
          if (data.handles.points?.length >= 4) {
            sliceData.bidirectional.push({
              length1: {
                start: data.handles.points[0],
                end: data.handles.points[1],
              },
              length2: {
                start: data.handles.points[2],
                end: data.handles.points[3],
              },
              angle: data.textBox?.angle || 0,
            });
          }
          break;
        case AngleTool.toolName:
          if (data.handles.points?.length >= 3) {
            sliceData.angle.push({
              angle: data.textBox?.angle || 0,
              points: data.handles.points,
            });
          }
          break;
        case CobbAngleTool.toolName:
          if (data.handles.points?.length >= 4) {
            sliceData.cobbAngle.push({
              angle: data.textBox?.angle || 0,
              points: data.handles.points,
            });
          }
          break;
        case ArrowAnnotateTool.toolName:
          if (data.handles.points?.length >= 2) {
            sliceData.arrowAnnotate.push({
              label: data.textBox?.text || "",
              start: data.handles.points[0],
              end: data.handles.points[1],
            });
          }
          break;
        case PlanarFreehandROITool.toolName:
          if (data.handles.points?.length > 0) {
            sliceData.planarFreehandROI.push({
              area: data.textBox?.area || 0,
              mean: data.textBox?.mean || 0,
              max: data.textBox?.max || 0,
              stdDev: data.textBox?.stdDev || 0,
              points: data.handles.points,
            });
          }
          break;
        default:
          console.warn(`Unknown toolName ${metadata.toolName}, skipping annotation`);
      }
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

  // Function to import annotations from JSON
  const importAnnotations = async (event: Event) => {
    const inputEvent = event as unknown as React.ChangeEvent<HTMLInputElement>;
    const file = inputEvent.target.files?.[0];
    if (!file) {
      alert('No file selected.');
      return;
    }

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      if (!jsonData.annotations) {
        alert('Invalid JSON format: Missing annotations.');
        return;
      }

      const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
      cornerstoneTools.annotation.state.removeAllAnnotations();

      Object.keys(jsonData.annotations).forEach((sliceKey) => {
        const sliceData = jsonData.annotations[sliceKey];
        const sliceNumber = parseInt(sliceKey.replace('slice_', ''));

        // Map slice number back to imageId
        const volume = cache.getVolume(volumeId);
        if (!volume) return;
        const imageId = volume.imageIds[sliceNumber] || volume.imageIds[0];

        Object.keys(sliceData).forEach((toolType) => {
          sliceData[toolType].forEach((annotationData: any) => {
            const annotation = {
              metadata: {
                toolName: toolType,
                referencedImageId: imageId,
                viewportId: axialViewportId, // Default to axial for simplicity
              },
              data: {
                handles: {
                  points: [],
                },
                textBox: {},
              },
            };

            switch (toolType) {
              case 'length':
              case 'height':
                annotation.data.handles.points = [
                  annotationData.start_point,
                  annotationData.end_point,
                ];
                break;
              case 'probe':
                annotation.data.handles.points = [annotationData.start_point || [0, 0]];
                annotation.data.textBox = {
                  value: annotationData.HU,
                  mean: annotationData.mean,
                  max: annotationData.max,
                  stdDev: annotationData.stdDev,
                };
                break;
              case 'rectangleROI':
                annotation.data.handles.points = [
                  [annotationData.coordinates[0], annotationData.coordinates[1]],
                  [annotationData.coordinates[2], annotationData.coordinates[1]],
                  [annotationData.coordinates[2], annotationData.coordinates[3]],
                  [annotationData.coordinates[0], annotationData.coordinates[3]],
                ];
                annotation.data.textBox = {
                  area: annotationData.area,
                  mean: annotationData.mean,
                  max: annotationData.max,
                  stdDev: annotationData.stdDev,
                };
                break;
              case 'ellipticalROI':
              case 'circleROI':
                annotation.data.handles.points = [
                  annotationData.center,
                  [annotationData.center[0] + annotationData.radius, annotationData.center[1]],
                ];
                annotation.data.textBox = {
                  area: annotationData.area,
                  mean: annotationData.mean,
                  max: annotationData.max,
                  stdDev: annotationData.stdDev,
                };
                break;
              case 'bidirectional':
                annotation.data.handles.points = [
                  annotationData.length1.start,
                  annotationData.length1.end,
                  annotationData.length2.start,
                  annotationData.length2.end,
                ];
                annotation.data.textBox = { angle: annotationData.angle };
                break;
              case 'angle':
              case 'cobbAngle':
                annotation.data.handles.points = annotationData.points;
                annotation.data.textBox = { angle: annotationData.angle };
                break;
              case 'arrowAnnotate':
                annotation.data.handles.points = [
                  annotationData.start,
                  annotationData.end,
                ];
                annotation.data.textBox = { text: annotationData.label };
                break;
              case 'planarFreehandROI':
                annotation.data.handles.points = annotationData.points;
                annotation.data.textBox = {
                  area: annotationData.area,
                  mean: annotationData.mean,
                  max: annotationData.max,
                  stdDev: annotationData.stdDev,
                };
                break;
            }

            cornerstoneTools.annotation.state.addAnnotation(annotation, getViewportElement(axialViewportId));
          });
        });
      });

      const renderingEngine = getRenderingEngine(renderingEngineId);
      renderingEngine?.renderViewports([axialViewportId, sagittalViewportId, coronalViewportId]);
    } catch (error) {
      console.error('Error importing annotations:', error);
      alert('Failed to import annotations from JSON');
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

    // Export annotations button
    addButtonToToolbar({
      icon: <span className="text-white">Export JSON</span>,
      title: "Export Annotations to JSON",
      onClick: exportToJSON,
    });

    // Import annotations button
    addButtonToToolbar({
      icon: <span className="text-white">Import JSON</span>,
      title: "Import Annotations from JSON",
      onClick: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = importAnnotations as unknown as (this: GlobalEventHandlers, ev: Event) => any;
        input.click();
      },
    });

    // Delete annotation button
    addButtonToToolbar({
      icon: <span className="text-white">Delete Annotation</span>,
      title: "Delete Selected Annotation",
      onClick: () => {
        const selectedAnnotations = cornerstoneTools.annotation.selection.getAnnotationsSelected();
        if (selectedAnnotations && selectedAnnotations.length > 0) {
          const annotationUID = selectedAnnotations[0];
          cornerstoneTools.annotation.state.removeAnnotation(annotationUID);
          const renderingEngine = getRenderingEngine(renderingEngineId);
          renderingEngine?.renderViewports([axialViewportId, sagittalViewportId, coronalViewportId]);
        } else {
          alert('No annotation selected. Please select an annotation to delete.');
        }
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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      alert('No files selected.');
      return;
    }

    const mhaFile = Array.from(files).find(file =>
      file.name.toLowerCase().endsWith('.mha') ||
      file.name.toLowerCase().endsWith('.mhd')
    );

    if (mhaFile) {
      await handleMhaFile(mhaFile);
      return;
    }

    if (files.length > 450) {
      alert('Warning: Loading 450+ files may require significant system resources. Ensure you have a high-performance device.');
    }

    if (files.length == 1) {
      alert('Warning: Loading a single file may not provide a complete view. Please upload multiple files for better visualization.');
      return;
    }

    const imageIds: { id: string; fileName: string }[] = [];
    const validImageIds: string[] = [];

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
      cache.purgeCache();
      console.log('Cache size after batch:', cache.getCacheSize() / (1024 * 1024), 'MB');
    }

    if (validImageIds.length === 0) {
      alert('No valid DICOM files with required metadata were found. Please upload valid DICOM files.');
      return;
    }

    try {
      try {
        if (cache.getVolumeLoadObject(volumeId)) {
          cache.removeVolumeLoadObject(volumeId);
        }
      } catch (error) {
        console.warn(`Failed to remove volume ${volumeId} from cache:`, error);
      }

      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: validImageIds });
      await volume.load();

      const renderingEngine = getRenderingEngine(renderingEngineId);
      if (!renderingEngine) {
        console.error('Rendering engine not found.');
        return;
      }

      await setVolumesForViewports(
        renderingEngine,
        [{ volumeId, textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0 }],
        [axialViewportId, sagittalViewportId, coronalViewportId, volumeViewportId]
      );

      // Ensure crosshairs are completely disabled after volume load
      const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
      toolGroup.setToolDisabled(CrosshairsTool.toolName);
      setIsCrosshairsActive(false);

      // Force a render to ensure crosshairs are hidden
      renderingEngine.renderViewports(viewportIds);

      // Apply preset only to the 3D viewport
      const volumeViewport = renderingEngine.getViewport(volumeViewportId) as Types.IVolumeViewport;
      if (volumeViewport) {
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
      }
    } catch (error) {
      console.error('Error loading volume:', error);
      alert('Failed to load DICOM files. Please ensure all files are valid and try again.');
    }
  };

  const handleMhaFile = async (file: File) => {
    try {
      setIsLoading(true);
      setLoadingMessage('Uploading and converting MHA to DICOM series...');

      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post('http://localhost:8000/upload-volume', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 300000, // 5 minutes timeout for large files
      });

      if (!response.data) {
        throw new Error('No data returned from server');
      }

      const { dicomBaseUrl, sliceCount, dimensions } = response.data;

      if (sliceCount < 1) {
        throw new Error('No DICOM slices generated by the server');
      }

      console.log(`Received ${sliceCount} DICOM files from server with dimensions: ${dimensions.x}x${dimensions.y}x${dimensions.z}`);

      const imageIds: { id: string; fileName: string }[] = [];
      const validImageIds: string[] = [];
      const baseUrl = `http://localhost:8000${dicomBaseUrl}`;

      for (let i = 0; i < sliceCount; i++) {
        const fileName = `slice_${i.toString().padStart(4, '0')}.dcm`;
        const imageId = `wadouri:${baseUrl}${fileName}`;
        imageIds.push({ id: imageId, fileName });
      }

      setLoadingMessage('Loading DICOM slices...');
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
        cache.purgeCache();
        console.log('Cache size after batch:', cache.getCacheSize() / (1024 * 1024), 'MB');
      }

      if (validImageIds.length === 0) {
        throw new Error('No valid DICOM files with required metadata were found');
      }

      setLoadingMessage('Creating volume...');
      try {
        if (cache.getVolumeLoadObject(volumeId)) {
          cache.removeVolumeLoadObject(volumeId);
        }
      } catch (error) {
        console.warn(`Failed to remove volume ${volumeId} from cache:`, error);
      }

      const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds: validImageIds });
      await volume.load();

      const renderingEngine = getRenderingEngine(renderingEngineId);
      if (!renderingEngine) {
        throw new Error('Rendering engine not found');
      }

      setLoadingMessage('Rendering volume...');
      await setVolumesForViewports(
        renderingEngine,
        [{ volumeId, textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0 }],
        [axialViewportId, sagittalViewportId, coronalViewportId, volumeViewportId]
      );

      // Ensure crosshairs are completely disabled after volume load
      const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId);
      toolGroup.setToolDisabled(CrosshairsTool.toolName);
      setIsCrosshairsActive(false);

      // Force a render to ensure crosshairs are hidden
      renderingEngine.renderViewports(viewportIds);

      // Apply preset only to the 3D viewport
      const volumeViewport = renderingEngine.getViewport(volumeViewportId) as Types.IVolumeViewport;
      if (volumeViewport) {
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
      }
    } catch (error) {
      console.error('Error processing MHA file:', error);
      alert(`Failed to process MHA file: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('Processing...');
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
    setFileHandler(handleFileSelect);

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

  return (
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
                ${
                  activeViewportId === coronalViewportId
                    ? 'border-4 border-blue-500'
                    : 'border border-blue-500/50'
                }
              `}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CrossHairs;