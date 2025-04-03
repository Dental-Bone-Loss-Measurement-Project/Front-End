// SagittalView.tsx
import React, { useRef, useEffect } from 'react';
import { renderingEngineId } from '../../../utils/renderingEngineSetup';
import { getRenderingEngine, Enums } from '@cornerstonejs/core';

const viewportId = 'CT_SAGITTAL';
const size = '500px';

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
      style={{
        width: size,
        height: size,
        border: '1px solid #555',
        margin: '2px',
      }}
    />
  );
};

export default SagittalView;
