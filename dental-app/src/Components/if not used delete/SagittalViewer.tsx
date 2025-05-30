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
  sagittalViewportId,
  LOW_QUALITY_TEXTURE,
} from './MedicalViewer';

interface SagittalViewerProps {
  activeViewportId: string;
  setActiveViewportId: (id: string) => void;
  isInitialized: boolean;
  synchronizer: Synchronizer | null;
}

const SagittalViewer: React.FC<SagittalViewerProps> = ({
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
      viewportId: sagittalViewportId,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element,
      defaultOptions: {
        orientation: Enums.OrientationAxis.SAGITTAL,
        background: [0, 0, 0] as Types.Point3,
        textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0,
      },
    }]);

    const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
    if (toolGroup) toolGroup.addViewport(sagittalViewportId, renderingEngineId);

    synchronizer.add({ renderingEngineId, viewportId: sagittalViewportId });
    isViewportSetup.current = true;

    return () => {
      // First, remove the viewport from the synchronizer
      if (synchronizer) {
        synchronizer.remove({ renderingEngineId, viewportId: sagittalViewportId });
      }
      
      // Then remove from toolgroup
      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (toolGroup) {
        toolGroup.removeViewports(sagittalViewportId);
      }
      
      // Finally, disable the element
      const renderingEngine = getRenderingEngine(renderingEngineId);
      const element = viewportElementRef.current;
      if (renderingEngine && element) {
        renderingEngine.disableElement(sagittalViewportId);
      }
      
      isViewportSetup.current = false;
    };
  }, [isInitialized, synchronizer]);

  return (
    <div
      ref={viewportElementRef}
      onClick={() => setActiveViewportId(sagittalViewportId)}
      className={`relative h-full w-full overflow-hidden cursor-pointer transition-all duration-200 ${
        activeViewportId === sagittalViewportId ? 'border-4 border-blue-500' : 'border border-gray-700'
      }`}
    >
      <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
        SAGITTAL
      </div>
    </div>
  );
};

export default memo(SagittalViewer);