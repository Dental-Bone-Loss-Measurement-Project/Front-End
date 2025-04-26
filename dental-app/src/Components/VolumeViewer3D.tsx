// VolumeViewer3D.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  CONSTANTS,
  Enums,
  RenderingEngine,
  setVolumesForViewports,
  volumeLoader,
  Types,
} from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { initDemo } from '../../utils/demo/helpers'; // Use if needed for initialization.
import { RGB } from '@cornerstonejs/core/types';

const { ToolGroupManager } = cornerstoneTools;
const { ViewportType } = Enums;

const volumeName = 'CT_VOLUME_ID';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
const volumeId = `${volumeLoaderScheme}:${volumeName}`;
const renderingEngineId = 'myRenderingEngine';
const viewportId = '3D_VIEWPORT';
const toolGroupId = 'TOOL_GROUP_ID';

const ORTHANC_URL = '/orthanc';
const ORTHANC_WADO_CONFIG = {
  wadoUriRoot: `${ORTHANC_URL}/wado`,
  wadoRsRoot: `${ORTHANC_URL}/dicom-web`,
};
interface VolumeViewer3DProps {
  preset: string;
}

const VolumeViewer3D: React.FC<VolumeViewer3DProps> = ({ preset }) => {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('Please upload DICOM files.');
  const [uploading, setUploading] = useState(false);
  const [studyUID, setStudyUID] = useState<string | null>(null);
  const [seriesUID, setSeriesUID] = useState<string | null>(null);

  const viewerElementRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const viewportRef = useRef<Types.IVolumeViewport | null>(null);

  // Orthanc upload handler: uploads files, retrieves study and series UIDs from Orthanc.
  const handleFilesUpload = async (files: FileList) => {
    if (files.length === 0) return;
    setUploading(true);
    setError(null);
    setStatus('Uploading DICOM files to Orthanc...');

    try {
      let lastStudyUID: string | null = null;
      let lastSeriesUID: string | null = null;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const response = await fetch(`${ORTHANC_URL}/instances`, {
          method: 'POST',
          body: await file.arrayBuffer(),
          headers: {
            'Content-Type': 'application/dicom',
          },
        });
        if (!response.ok) {
          throw new Error(`Upload failed for file ${i + 1}: ${response.statusText}`);
        }
        const instanceData = await response.json();
        console.log("Instance Data (POST response):", instanceData);

        // Fetch detailed info primarily for ParentSeries if needed, or other details
        const instanceInfo = await fetch(`${ORTHANC_URL}/instances/${instanceData.ID}`).then(res =>
          res.json()
        );
        console.log("Full instanceInfo JSON (GET /instances/ID):", JSON.stringify(instanceInfo, null, 2));

        // Use ParentStudy from the initial POST response (instanceData)
        if (!lastStudyUID && instanceData.ParentStudy) {
             lastStudyUID = instanceData.ParentStudy;
        }
        // Use ParentSeries from the detailed GET response (instanceInfo)
        if (!lastSeriesUID && instanceInfo.ParentSeries) {
             lastSeriesUID = instanceInfo.ParentSeries;
        }

        console.log('instanceData.ParentStudy:', instanceData.ParentStudy);
        console.log('instanceInfo.ParentSeries:', instanceInfo.ParentSeries);
        console.log('lastStudyUID after check:', lastStudyUID);
        console.log('lastSeriesUID after check:', lastSeriesUID);

        // Optional: Break early if both UIDs are found
        if (lastStudyUID && lastSeriesUID) {
             console.log("Both UIDs found, breaking loop.");
        }
      }

      setStudyUID(lastStudyUID);
      setSeriesUID(lastSeriesUID);
      console.log('Study UID:', lastStudyUID);
      console.log('Series UID:', lastSeriesUID);
      setStatus('Files uploaded. Preparing 3D volume...');
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Upload error: ${errorMessage}`);
      setStatus('Error during upload.');
    } finally {
      setUploading(false);
    }
  };

  // Create and render volume from Orthanc data.
  useEffect(() => {
    const renderVolume = async () => {
      console.log('i entered rendervolume');
      console.log(viewerElementRef.current);
      if (!viewerElementRef.current) return;

      // Only render if we have valid study and series UIDs
      console.log('studyUID', studyUID);
      console.log('seriesUID', seriesUID);
      if (!seriesUID && !studyUID) return;

      // Clean up previous instance
      console.log('before cleanup');
      console.log(renderingEngineRef.current);
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
      }
      const existingToolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (existingToolGroup) {
        ToolGroupManager.destroyToolGroup(toolGroupId);
      }
      console.log('i entered cleanup');
      console.log(renderingEngineRef.current);
      try {
        setStatus('Initializing viewer...');
        console.log('i entered initializing viewer');
        await initDemo(); // If you need additional initialization steps.

        // Register tools globally before creating the tool group
        const { ZoomTool, PanTool, TrackballRotateTool } = cornerstoneTools;
        cornerstoneTools.addTool(TrackballRotateTool);
        cornerstoneTools.addTool(ZoomTool);
        cornerstoneTools.addTool(PanTool);

        const renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = renderingEngine;
        console.log("before viewport input");
        const viewportInput = {
          viewportId,
          type: ViewportType.VOLUME_3D,
          element: viewerElementRef.current,
          defaultOptions: {
            orientation: Enums.OrientationAxis.CORONAL,
            background: CONSTANTS.BACKGROUND_COLORS.slicer3D.slice(0, 3) as RGB,
          },
        };
        console.log("after viewport input");
        renderingEngine.setViewports([viewportInput]);

        // Setup mouse interaction tools.
        const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
        // Tools are already registered globally, retrieve them for adding to the group
        toolGroup.addTool(TrackballRotateTool.toolName);
        toolGroup.addTool(ZoomTool.toolName);
        toolGroup.addTool(PanTool.toolName);
        toolGroup.setToolActive(TrackballRotateTool.toolName, { bindings: [{ mouseButton: 1 }] });
        toolGroup.setToolActive(ZoomTool.toolName, { bindings: [{ mouseButton: 3 }] });
        toolGroup.setToolActive(PanTool.toolName, { bindings: [{ mouseButton: 2 }] });
        toolGroup.addViewport(viewportId, renderingEngineId);

        // Fetch DICOM image IDs from Orthanc.
        const { createImageIdsAndCacheMetaData } = await import('../../utils/demo/helpers');
        setStatus('Fetching DICOM images from Orthanc...');
        console.log("before image ids");
        console.log("studyUID", studyUID);
        console.log("seriesUID", seriesUID);
        const imageIds = await createImageIdsAndCacheMetaData({
          StudyInstanceUID: studyUID,
          SeriesInstanceUID: seriesUID,
          wadoRsRoot: ORTHANC_WADO_CONFIG.wadoRsRoot,
        });
        console.log("after image ids");
        if (!imageIds || imageIds.length === 0) {
          throw new Error('No images found from Orthanc.');
        }
        setStatus(`Creating 3D volume from ${imageIds.length} images...`);

        // Create the volume.
        console.log("before volume input options");
        const volumeInputOptions = {
          imageIds,
          spacing: undefined, // spacing will be inferred from metadata
          orientation: Enums.OrientationAxis.AXIAL,
        };
        console.log('before volume loader');
        const volume = await volumeLoader.createAndCacheVolume(volumeId, volumeInputOptions);
        console.log('after volume loader');
        await volume.load();

        const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport;
        viewportRef.current = viewport;
        
        await setVolumesForViewports(renderingEngine, [{ volumeId }], [viewportId]);
        console.log('after set volumes for viewports');
        // Apply the preset from props
        viewport.setProperties({ preset });
        viewport.render();
        console.log('after render');
        setStatus('Volume rendered successfully.');
      } catch (err: unknown) {
        console.error(err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Rendering error: ${errorMessage}`);
        setStatus('Error rendering volume.');
      }
    };

    renderVolume();

    return () => {
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
      }
      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (toolGroup) {
        ToolGroupManager.destroyToolGroup(toolGroupId);
      }
    };
  }, [studyUID, seriesUID, preset]);

  return (
    <div className="h-full flex flex-col">
      {/* Upload Bar */}
      <div className="p-4 border-b flex items-center">
        <input
          aria-label="Upload DICOM files"
          id="dicom-upload"
          type="file"
          accept=".dcm"
          multiple
          disabled={uploading}
          onChange={(e) => e.target.files && handleFilesUpload(e.target.files)}
          className="mr-4"
        />
        <div>
          {status && <p className="text-green-600">{status}</p>}
          {error && <p className="text-red-600">{error}</p>}
        </div>
      </div>

      {/* Full screen viewer */}
      <div className="flex-1 relative">
        <div
          ref={viewerElementRef}
          className="w-full h-full"
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
};

export default VolumeViewer3D;