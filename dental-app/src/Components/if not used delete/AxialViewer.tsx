import React, { useEffect, useRef, memo } from "react";
import {
  RenderingEngine,
  Enums,
  getRenderingEngine,
  Types,
} from '@cornerstonejs/core';
import { ToolGroupManager, Synchronizer } from '@cornerstonejs/tools';
import {
  renderingEngineId,
  toolGroupId,
  axialViewportId,
  LOW_QUALITY_TEXTURE,
} from './MedicalViewer';

interface AxialViewerProps {
  activeViewportId: string;
  setActiveViewportId: (id: string) => void;
  isInitialized: boolean;
  synchronizer: Synchronizer | null;
}

const AxialViewer: React.FC<AxialViewerProps> = ({
  activeViewportId,
  setActiveViewportId,
  isInitialized,
  synchronizer,
}) => {
  const viewportElementRef = useRef<HTMLDivElement>(null);
  const isViewportSetup = useRef(false);

  useEffect(() => {
    if (!isInitialized || !viewportElementRef.current || !synchronizer || isViewportSetup.current) return;

    const element = viewportElementRef.current;
    const renderingEngine = getRenderingEngine(renderingEngineId);
    if (!renderingEngine) return;

    renderingEngine.setViewports([{
      viewportId: axialViewportId,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element,
      defaultOptions: {
        orientation: Enums.OrientationAxis.AXIAL,
        background: [0, 0, 0] as Types.Point3,
        textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0,
      },
    }]);

    const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
    if (toolGroup) toolGroup.addViewport(axialViewportId, renderingEngineId);

    synchronizer.add({ renderingEngineId, viewportId: axialViewportId });
    isViewportSetup.current = true;

    return () => {
      // Add better error handling for cleanup process
      try {
        // First, check if the synchronizer is still valid before using it
        if (synchronizer && isViewportSetup.current) {
          // Remove viewport from synchronizer first
          synchronizer.remove({ renderingEngineId, viewportId: axialViewportId });
        }
      } catch (error) {
        console.warn('Error removing viewport from synchronizer:', error);
      }
      
      try {
        // Then handle tool group cleanup
        const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
        if (toolGroup) {
          toolGroup.removeViewports(axialViewportId);
        }
      } catch (error) {
        console.warn('Error removing viewport from tool group:', error);
      }
      
      try {
        // Finally, disable the element
        const renderingEngine = getRenderingEngine(renderingEngineId);
        if (renderingEngine) {
          renderingEngine.disableElement(axialViewportId);
        }
      } catch (error) {
        console.warn('Error disabling viewport:', error);
      }
      
      isViewportSetup.current = false;
    };
  }, [isInitialized, synchronizer]);

  return (
    <div
      ref={viewportElementRef}
      onClick={() => setActiveViewportId(axialViewportId)}
      className={`relative h-full w-full overflow-hidden cursor-pointer transition-all duration-200 ${
        activeViewportId === axialViewportId ? 'border-4 border-blue-500' : 'border border-gray-700'
      }`}
    >
      <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
        AXIAL
      </div>
    </div>
  );
};

export default memo(AxialViewer);