// CoronalView.tsx
import React, { useRef, useEffect } from 'react';
import { renderingEngineId } from '../../../utils/renderingEngineSetup';
import { getRenderingEngine, Enums } from '@cornerstonejs/core';

const viewportId = 'CT_CORONAL';

const CoronalView: React.FC = () => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function setupCoronal() {
      const element = elementRef.current;
      if (!element) return;

      const renderingEngine = getRenderingEngine(renderingEngineId);

      renderingEngine.setViewports([
        {
          viewportId,
          element,
          type: Enums.ViewportType.ORTHOGRAPHIC,
          defaultOptions: {
            orientation: Enums.OrientationAxis.CORONAL,
            background: [0, 0, 0],
          },
        },
      ]);

      renderingEngine.renderViewports([viewportId]);
    }
    setupCoronal();
  }, []);

  return (
    <div
      ref={elementRef}
      className="w-full h-full border border-gray-700 m-[2px]"
    />
  );
};

export default CoronalView;