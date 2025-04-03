// renderingEngineSetup.ts
import {
    RenderingEngine,
    Enums,
    volumeLoader,
    setVolumesForViewports,
    getRenderingEngine,
  } from '@cornerstonejs/core';
  import { createImageIdsAndCacheMetaData, getLocalUrl, setCtTransferFunctionForVolumeActor } from './demo/helpers';
  
  const volumeName = 'CT_VOLUME_ID';
  const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
  export const volumeId = `${volumeLoaderScheme}:${volumeName}`;
  export const renderingEngineId = 'myRenderingEngine';
  
  export async function initializeEngine(viewportIds: string[]): Promise<void> {
    // Create a new rendering engine instance.
    const renderingEngine = new RenderingEngine(renderingEngineId);
  
    // Load image IDs and cache metadata.
    const imageIds = await createImageIdsAndCacheMetaData({
      StudyInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
      SeriesInstanceUID:
        '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
      wadoRsRoot: getLocalUrl() || 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
    });
  
    // Create and cache the volume.
    const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
    volume.load();
  
    // You can now call setVolumesForViewports in each view (or here for all viewports)
    await setVolumesForViewports(
      renderingEngine,
      [
        {
          volumeId,
          callback: setCtTransferFunctionForVolumeActor,
        },
      ],
      viewportIds
    );
  
    // Render the viewports (you might call this after all viewports are set up).
    renderingEngine.renderViewports(viewportIds);
  }  