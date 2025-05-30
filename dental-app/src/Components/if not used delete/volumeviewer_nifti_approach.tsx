// VolumeViewer3D.tsx
import React, { useState, ChangeEvent, useEffect, useRef } from 'react';
import axios from 'axios';
import * as cornerstoneNiftiImageLoader from '@cornerstonejs/nifti-volume-loader';
import { metaData } from '@cornerstonejs/core';
import types from '@cornerstonejs/tools';
import {
  RenderingEngine,
  Enums,
  init,
  volumeLoader,
  setVolumesForViewports,
  Types,
  CONSTANTS,
} from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';

const {
  ToolGroupManager,
  WindowLevelTool,
  ZoomTool,
  PanTool,
  TrackballRotateTool,
  Enums: csToolsEnums,
} = cornerstoneTools;

const { ViewportType } = Enums;
const { MouseBindings } = csToolsEnums;

// Add Metadata interface
export interface Metadata {
  BitsAllocated: number;
  BitsStored: number;
  SamplesPerPixel: number;
  HighBit: number;
  // Add other required metadata properties here
  // Example additional properties:
  PixelRepresentation?: number;
  WindowCenter?: number | number[];
  WindowWidth?: number | number[];
  RescaleIntercept?: number;
  RescaleSlope?: number;
  Modality?: string;
  ImageOrientationPatient?: number[];
  ImagePositionPatient?: number[];
  PixelSpacing?: number[];
  Columns?: number;
  Rows?: number;
  volumeUrl: string;
}

interface VolumeUploadResponse {
  volumeUrl: string;
}

interface VolumeViewer3DProps {
  preset?: 'CT-Bone' | 'CT-Soft' | 'CT-Lung' | 'MR-Default'; // Valid preset names
}

const VolumeViewer3D: React.FC<VolumeViewer3DProps> = ({ preset }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [volumeResponseData, setVolumeResponseData] = useState<VolumeUploadResponse | null>(null);

  const elementRef = useRef<HTMLDivElement>(null);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);
  const viewportRef = useRef<Types.IVolumeViewport | null>(null);

  const renderingEngineId = 'volumeRenderingEngine';
  const viewportId = 'VOLUME_3D_VIEWPORT';
  const toolGroupId = 'VOLUME_TOOL_GROUP';

  useEffect(() => {
    const initializeCornerstone = async () => {
      try {
        // Initialize cornerstone and tools
        await init();
        cornerstoneTools.init();
        
        // Register the NIFTI volume loader using the package you have
        volumeLoader.registerVolumeLoader(
          'nifti',
          cornerstoneNiftiImageLoader as unknown as Types.VolumeLoaderFn
        );
        
        console.log('NIFTI volume loader registered successfully');
  
        // Add the tools to cornerstone
        cornerstoneTools.addTool(WindowLevelTool);
        cornerstoneTools.addTool(PanTool);
        cornerstoneTools.addTool(ZoomTool);
        cornerstoneTools.addTool(TrackballRotateTool);
  
        // Create or get the tool group
        const toolGroup = ToolGroupManager.createToolGroup(toolGroupId) || 
          ToolGroupManager.getToolGroup(toolGroupId);
  
        if (toolGroup) {
          // Add tools to the tool group
          toolGroup.addTool(WindowLevelTool.toolName);
          toolGroup.addTool(PanTool.toolName);
          toolGroup.addTool(ZoomTool.toolName);
          toolGroup.addTool(TrackballRotateTool.toolName);
  
          // Set up mouse bindings for tools
          toolGroup.setToolActive(WindowLevelTool.toolName, {
            bindings: [{ mouseButton: MouseBindings.Primary }],
          });
          
          toolGroup.setToolActive(PanTool.toolName, {
            bindings: [{ mouseButton: MouseBindings.Secondary }],
          });
          
          toolGroup.setToolActive(ZoomTool.toolName, {
            bindings: [{ mouseButton: MouseBindings.Auxiliary }],
          });
          
          toolGroup.setToolActive(TrackballRotateTool.toolName, {
            bindings: [{ mouseButton: MouseBindings.Primary }],
          });
          
          console.log('Tools configured successfully');
        } else {
          console.error('Failed to create or get tool group');
        }
      } catch (error) {
        console.error('Cornerstone initialization error:', error);
      }
    };
  
    // Call the initialization function
    initializeCornerstone();
  
    // Cleanup function
    return () => {
      console.log('Cleaning up Cornerstone resources');
      
      // Clean up rendering engine
      const engine = renderingEngineRef.current;
      if (engine) {
        try {
          engine.disableElement(viewportId);
          engine.destroy();
          renderingEngineRef.current = null;
          console.log('Rendering engine destroyed');
        } catch (error) {
          console.error('Error destroying rendering engine:', error);
        }
      }
      
      // Clean up tool group
      try {
        ToolGroupManager.destroyToolGroup(toolGroupId);
        console.log('Tool group destroyed');
      } catch (error) {
        console.error('Error destroying tool group:', error);
      }
      
      viewportRef.current = null;
    };
  }, []);
  

  useEffect(() => {
    const setupVolumeViewer = async () => {
      if (!volumeResponseData?.volumeUrl || !elementRef.current) return;
  
      // Always use nifti protocol for volumeId
      const volumeId = `nifti:${volumeResponseData.volumeUrl}`;
      
      try {
        // Initialize rendering engine if needed
        const renderingEngine = renderingEngineRef.current || new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = renderingEngine;
  
        // Register metadata provider with correct types
        metaData.addProvider((type: string, imageId: string) => {
          if (!imageId.startsWith(volumeId)) return;
          
          if (type === 'imagePixelModule') {
            return {
              bitsAllocated: 16,
              bitsStored: 16,
              samplesPerPixel: 1,
              highBit: 15,
              photometricInterpretation: 'MONOCHROME2',
              pixelRepresentation: 0,
              rows: 512,
              columns: 512
            };
          }
          
          if (type === 'voiLutModule') {
            return {
              windowCenter: 500,
              windowWidth: 1000
            };
          }
          
          if (type === 'modalityLutModule') {
            return {
              rescaleIntercept: 0,
              rescaleSlope: 1,
              rescaleType: 'HU'
            };
          }
          
          return undefined;
        });
  
        // Create and cache volume
        console.log(`Loading volume: ${volumeId}`);
        const volume = await volumeLoader.createAndCacheVolume(volumeId);
        await volume.load();
        console.log('Volume loaded successfully');
  
        // Initialize viewport
        let viewport: Types.IVolumeViewport;
        try {
          viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport;
        } catch {
          renderingEngine.enableElement({
            viewportId,
            element: elementRef.current,
            type: ViewportType.VOLUME_3D,
            defaultOptions: {
              background: [0, 0, 0] as Types.RGB,
              orientation: Enums.OrientationAxis.AXIAL,
            },
          });
          viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport;
        }
  
        viewportRef.current = viewport;
        
        // Fix: Use correct structure for setVolumesForViewports
        await setVolumesForViewports(
          renderingEngine,
          [{ 
            volumeId, 
            callback: (volume) => {
              console.log('Volume loaded in viewport', volumeId);
            } 
          }],
          [viewportId]
        );
  
        // Apply preset or default settings
        if (preset) {
          console.log(`Applying preset: ${preset}`);
          viewport.setProperties({ preset });
        } else {
          console.log('Applying default VOI range');
          viewport.setProperties({
            voiRange: {
              lower: 500,
              upper: 1500
            }
          });
        }
  
        // Connect tools to viewport
        const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
        if (toolGroup) {
          toolGroup.addViewport(viewportId, renderingEngineId);
        }
  
        viewport.resetCamera();
        viewport.render();
  
      } catch (error) {
        console.error('Volume viewer setup error:', error);
        setError(`Failed to load volume: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };
  
    setupVolumeViewer();
  
    return () => {
      if (renderingEngineRef.current) {
        try {
          renderingEngineRef.current.disableElement(viewportId);
        } catch (error) {
          console.error('Error during cleanup:', error);
        }
      }
    };
  }, [volumeResponseData, preset]);
  
  

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setVolumeResponseData(null);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post<VolumeUploadResponse>(
        'http://localhost:8000/upload-volume',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setVolumeResponseData(response.data);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.detail || err.message);
      } else {
        setError('Failed to upload file');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Upload 3D Medical Volume</h1>
      
      <input
        type="file"
        accept=".mha,.nii,.nii.gz"
        onChange={handleFileChange}
        className="mb-4 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
      />

      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className={`py-2 px-4 rounded text-white ${loading || !file ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
      >
        {loading ? 'Processing...' : 'Upload and View 3D'}
      </button>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      {volumeResponseData && (
        <div className="mt-4">
          <div
            ref={elementRef}
            className="w-full h-96 bg-gray-300 border border-gray-400 relative"
            onContextMenu={(e) => e.preventDefault()}
          >
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white">
                Loading Volume...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VolumeViewer3D;