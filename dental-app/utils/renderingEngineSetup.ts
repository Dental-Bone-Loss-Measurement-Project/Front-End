import {
  RenderingEngine,
  Enums,
  volumeLoader,
  setVolumesForViewports,
} from "@cornerstonejs/core";
import {
  createImageIdsAndCacheMetaData,
  getLocalUrl,
  setCtTransferFunctionForVolumeActor,
} from "./demo/helpers";

const volumeName = "CT_VOLUME_ID";
const volumeLoaderScheme = "cornerstoneStreamingImageVolume";
export const volumeId = `${volumeLoaderScheme}:${volumeName}`;
export const renderingEngineId = "myRenderingEngine";

export async function initializeEngine(
  viewportElements: { [viewportId: string]: HTMLDivElement }
): Promise<void> {
  // Extract viewport IDs.
  const viewportIds = Object.keys(viewportElements);

  // Create a new rendering engine instance.
  const renderingEngine = new RenderingEngine(renderingEngineId);

  // Load image IDs and cache metadata.
  const imageIds = await createImageIdsAndCacheMetaData({
    StudyInstanceUID:
      "1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463",
    SeriesInstanceUID:
      "1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561",
    wadoRsRoot:
      getLocalUrl() || "https://d14fa38qiwhyfd.cloudfront.net/dicomweb",
  });

  // Create and cache the volume.
  const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });
  // Ensure the volume is loaded before proceeding.
  await volume.load();

  // Assign the volume (with its transfer function) to all viewports.
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

  // Define viewport options for each view.
  const viewports = viewportIds.map((id) => {
    let orientation;
    let type = Enums.ViewportType.ORTHOGRAPHIC;
    // Customize based on known viewport IDs.
    if (id === "CT_3D") {
      type = Enums.ViewportType.VOLUME_3D;
    } else if (id === "CT_AXIAL") {
      orientation = Enums.OrientationAxis.AXIAL;
    } else if (id === "CT_SAGITTAL") {
      orientation = Enums.OrientationAxis.SAGITTAL;
    } else if (id === "CT_CORONAL") {
      orientation = Enums.OrientationAxis.CORONAL;
    }

    return {
      viewportId: id,
      element: viewportElements[id],
      type,
      defaultOptions: {
        orientation,
        background: [0, 0, 0] as [number, number, number],
      },
    };
  });

  // Set all viewports at once.
  renderingEngine.setViewports(viewports);
  // Render all viewports.
  renderingEngine.renderViewports(viewportIds);
}
