// AxialView.tsx
import React, { useRef, useEffect } from 'react';
import { renderingEngineId } from '../../../utils/renderingEngineSetup';
import { getRenderingEngine, Enums } from '@cornerstonejs/core';

const viewportId = 'CT_AXIAL';

const AxialView: React.FC = () => {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function setupAxial() {
      const element = elementRef.current;
      if (!element) return;

      // Get the existing rendering engine instance.
      const renderingEngine = getRenderingEngine(renderingEngineId);

      // Configure the single viewport for the axial view.
      renderingEngine.setViewports([
        {
          viewportId,
          element,
          type: Enums.ViewportType.ORTHOGRAPHIC,
          defaultOptions: {
            orientation: Enums.OrientationAxis.AXIAL,
            background: [0, 0, 0],
          },
        },
      ]);

      // (Optional) Render just this viewport or let the parent container trigger the render.
      renderingEngine.renderViewports([viewportId]);
    }
    setupAxial();
  }, []);

  return (
    <div
      ref={elementRef}
      className="w-full h-full border border-gray-700 m-[2px]"
    />
  );
};

export default AxialView;