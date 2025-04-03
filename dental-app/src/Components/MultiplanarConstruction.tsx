import { useEffect, useRef, useState } from 'react';
import { Types, RenderingEngine, Enums, volumeLoader, getRenderingEngine } from '@cornerstonejs/core';
import {
  initDemo,
  createImageIdsAndCacheMetaData,
  setPetColorMapTransferFunctionForVolumeActor,
} from '../../utils/demo/helpers';

const { ViewportType, OrientationAxis } = Enums;
const renderingEngineId = 'myRenderingEngine';
const viewportId = 'CT_SAGITTAL_STACK';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
const ctVolumeId = `${volumeLoaderScheme}:CT_VOLUME_ID`;
const ptVolumeId = `${volumeLoaderScheme}:PT_VOLUME_ID`;

const CornerstoneVolumeViewer: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(0.5);
  const [orientation, setOrientation] = useState<OrientationAxis>(OrientationAxis.SAGITTAL);
  const renderingEngineRef = useRef<RenderingEngine | null>(null);

  useEffect(() => {
    const run = async () => {
      await initDemo();
      const wadoRsRoot = 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb';
      const StudyInstanceUID = '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463';

      const ctImageIds = await createImageIdsAndCacheMetaData({
        StudyInstanceUID,
        SeriesInstanceUID: '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
        wadoRsRoot,
      });

      const ptImageIds = await createImageIdsAndCacheMetaData({
        StudyInstanceUID,
        SeriesInstanceUID: '1.3.6.1.4.1.14519.5.2.1.7009.2403.879445243400782656317561081015',
        wadoRsRoot,
      });

      if (!containerRef.current) return;

      const renderingEngine = new RenderingEngine(renderingEngineId);
      renderingEngineRef.current = renderingEngine;

      const viewportInput = {
        viewportId,
        type: ViewportType.ORTHOGRAPHIC,
        element: containerRef.current,
        defaultOptions: {
          orientation,
          background: [0.2, 0, 0.2] as Types.Point3,
        },
      };

      renderingEngine.enableElement(viewportInput);
      const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport;

      const ctVolume = await volumeLoader.createAndCacheVolume(ctVolumeId, { imageIds: ctImageIds });
      await ctVolume.load();
      renderingEngine.render();

      const ptVolume = await volumeLoader.createAndCacheVolume(ptVolumeId, { imageIds: ptImageIds });
      await ptVolume.load();
      viewport.setVolumes([
        { volumeId: ctVolumeId },
        { volumeId: ptVolumeId, callback: setPetColorMapTransferFunctionForVolumeActor },
      ]);
    };

    run();
  }, [orientation]);

  const handleOpacityChange = (value: number) => {
    setOpacity(value);
    const renderingEngine = renderingEngineRef.current;
    if (!renderingEngine) return;

    const viewport = renderingEngine.getViewport(viewportId) as Types.IBaseVolumeViewport;
    if (viewport) {
      viewport.setProperties({ colormap: { opacity: value } }, ptVolumeId);
      viewport.render();
    }
  };

  const handleOrientationChange = (selectedValue: string) => {
    switch (selectedValue) {
      case 'axial':
        setOrientation(OrientationAxis.AXIAL);
        break;
      case 'sagittal':
        setOrientation(OrientationAxis.SAGITTAL);
        break;
      case 'coronal':
        setOrientation(OrientationAxis.CORONAL);
        break;
    }
  };

  const handleResetView = () => {
    const renderingEngine = renderingEngineRef.current;
    if (!renderingEngine) return;

    const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport;
    if (viewport) {
      viewport.resetCamera();
      viewport.render();
    }
  };

  return (
    <div>
      <div ref={containerRef} id="cornerstone-element" style={{ width: '500px', height: '500px' }}></div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.1"
        value={opacity}
        onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
      />
      <select onChange={(e) => handleOrientationChange(e.target.value)}>
        <option value="axial">Axial</option>
        <option value="sagittal" selected>Sagittal</option>
        <option value="coronal">Coronal</option>
      </select>
      <button onClick={handleResetView}>Reset View</button>
    </div>
  );
};

export default CornerstoneVolumeViewer;
