// SagittalView.tsx
import React, { useRef, useEffect } from 'react';
import { renderingEngineId } from '../../../utils/renderingEngineSetup';
import { getRenderingEngine, Enums } from '@cornerstonejs/core';

const viewportId = 'CT_SAGITTAL';

const SagittalView: React.FC = () => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function setupSagittal() {
      const element = elementRef.current;
      if (!element) return;

      const renderingEngine = getRenderingEngine(renderingEngineId);

      renderingEngine.setViewports([
        {
          viewportId,
          element,
          type: Enums.ViewportType.ORTHOGRAPHIC,
          defaultOptions: {
            orientation: Enums.OrientationAxis.SAGITTAL,
            background: [0, 0, 0],
          },
        },
      ]);

      renderingEngine.renderViewports([viewportId]);
    }
    setupSagittal();
  }, []);

  return (
    <div
      ref={elementRef}
      className="w-full h-full border border-gray-700 m-[2px]"
    />
  );
};

export default SagittalView;
