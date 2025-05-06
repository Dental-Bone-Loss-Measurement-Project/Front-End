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
  coronalViewportId,
  LOW_QUALITY_TEXTURE,
} from './MedicalViewer';

interface CoronalViewerProps {
  activeViewportId: string;
  setActiveViewportId: (id: string) => void;
  isInitialized: boolean;
  synchronizer: Synchronizer | null;
}

const CoronalViewer: React.FC<CoronalViewerProps> = ({
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
      viewportId: coronalViewportId,
      type: Enums.ViewportType.ORTHOGRAPHIC,
      element,
      defaultOptions: {
        orientation: Enums.OrientationAxis.CORONAL,
        background: [0, 0, 0] as Types.Point3,
        textureQuality: LOW_QUALITY_TEXTURE ? 0.5 : 1.0,
      },
    }]);

    const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
    if (toolGroup) toolGroup.addViewport(coronalViewportId, renderingEngineId);

    synchronizer.add({ renderingEngineId, viewportId: coronalViewportId });
    isViewportSetup.current = true;

    return () => {
      // First, remove the viewport from the synchronizer
      if (synchronizer) {
        synchronizer.remove({ renderingEngineId, viewportId: coronalViewportId });
      }
      
      // Then remove from toolgroup
      const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
      if (toolGroup) {
        toolGroup.removeViewports(coronalViewportId);
      }
      
      // Finally, disable the viewport using the correct method
      const renderingEngine = getRenderingEngine(renderingEngineId);
      if (renderingEngine) {
        renderingEngine.disableElement(coronalViewportId);
      }
      
      isViewportSetup.current = false;
    };
  }, [isInitialized, synchronizer]);

  return (
    <div
      ref={viewportElementRef}
      onClick={() => setActiveViewportId(coronalViewportId)}
      className={`relative h-full w-full overflow-hidden cursor-pointer transition-all duration-200 ${
        activeViewportId === coronalViewportId ? 'border-4 border-blue-500' : 'border border-gray-700'
      }`}
    >
      <div className="absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
        CORONAL
      </div>
    </div>
  );
};

export default memo(CoronalViewer);