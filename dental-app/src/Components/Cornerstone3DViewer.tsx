import React, { useEffect, useRef } from 'react';
import type { Types } from '@cornerstonejs/core';
import {
  RenderingEngine,
  Enums,
  volumeLoader,
  getRenderingEngine,
} from '@cornerstonejs/core';
import {
  initDemo,
  createImageIdsAndCacheMetaData,
  setTitleAndDescription,
  addButtonToToolbar,
  addDropdownToToolbar,
  setCtTransferFunctionForVolumeActor,
  setPetColorMapTransferFunctionForVolumeActor,
  addSliderToToolbar,
} from '../../utils/demo/helpers';

const Cornerstone3DViewer = () => {
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Clear the toolbar container to avoid duplicate items.
    if (toolbarRef.current) {
      toolbarRef.current.innerHTML = '';
    }

    const { ViewportType } = Enums;
    const renderingEngineId = 'myRenderingEngine';
    const viewportId = 'CT_SAGITTAL_STACK';

    const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
    const ctVolumeName = 'CT_VOLUME_ID';
    const ctVolumeId = `${volumeLoaderScheme}:${ctVolumeName}`;
    const ptVolumeName = 'PT_VOLUME_ID';
    const ptVolumeId = `${volumeLoaderScheme}:${ptVolumeName}`;

    // Set title and description for the demo.
    setTitleAndDescription(
      'Volume Viewport API With Multiple Volumes',
      'Demonstrates how to interact with a Volume viewport when using fusion.'
    );

    // Get the content container.
    const content = document.getElementById('content');
    if (!content) {
      console.error('Content element not found in the DOM');
      return;
    }

    // Create and configure the cornerstone element.
    const element = document.createElement('div');
    element.id = 'cornerstone-element';
    element.style.width = '500px';
    element.style.height = '500px';
    content.appendChild(element);

    if (!toolbarRef.current) {
      console.error('Toolbar container not found in the DOM');
      return;
    }

    // Add a slider to the toolbar.
    addSliderToToolbar({
      container: toolbarRef.current,
      title: 'Opacity',
      range: [0, 1],
      step: 0.1,
      defaultValue: 0.5,
      onSelectedValueChange: (value) => {
        const renderingEngine = getRenderingEngine(renderingEngineId);
        const viewport = renderingEngine.getViewport(
          viewportId
        ) as Types.IBaseVolumeViewport;

        viewport.setProperties(
          { colormap: { opacity: Number(value) } },
          ptVolumeId
        );
        viewport.render();
      },
    });

    // Add a button to set the CT VOI range.
    addButtonToToolbar({
      container: toolbarRef.current,
      title: 'Set CT VOI Range',
      onClick: () => {
        const renderingEngine = getRenderingEngine(renderingEngineId);
        const viewport = renderingEngine.getViewport(
          viewportId
        ) as Types.IVolumeViewport;

        viewport.setProperties({ voiRange: { lower: -1500, upper: 2500 } });
        viewport.render();
      },
    });

    // Add a button to reset the viewport.
    addButtonToToolbar({
      container: toolbarRef.current,
      title: 'Reset Viewport',
      onClick: () => {
        const renderingEngine = getRenderingEngine(renderingEngineId);
        const viewport = renderingEngine.getViewport(
          viewportId
        ) as Types.IVolumeViewport;

        viewport.resetCamera();
        viewport.render();
      },
    });

    // Add a button to toggle PET visibility.
    addButtonToToolbar({
      container: toolbarRef.current,
      title: 'Toggle PET',
      onClick: () => {
        const renderingEngine = getRenderingEngine(renderingEngineId);
        const viewport = renderingEngine.getViewport(
          viewportId
        ) as Types.IVolumeViewport;
        viewport.addVolumes(
          [
            {
              volumeId: ptVolumeId,
              callback: setPetColorMapTransferFunctionForVolumeActor,
            },
          ],
          true
        );
      },
    });

    // Define orientation options.
    const orientationOptions = {
      axial: 'axial',
      sagittal: 'sagittal',
      coronal: 'coronal',
      oblique: 'oblique',
    };

    // Add a dropdown to change the orientation.
    addDropdownToToolbar({
      container: toolbarRef.current,
      options: {
        values: ['axial', 'sagittal', 'coronal', 'oblique'],
        defaultValue: 'sagittal',
      },
      onSelectedValueChange: (selectedValue) => {
        const renderingEngine = getRenderingEngine(renderingEngineId);
        const viewport = renderingEngine.getViewport(
          viewportId
        ) as Types.IVolumeViewport;

        switch (selectedValue) {
          case orientationOptions.axial:
            viewport.setOrientation(Enums.OrientationAxis.AXIAL);
            break;
          case orientationOptions.sagittal:
            viewport.setOrientation(Enums.OrientationAxis.SAGITTAL);
            break;
          case orientationOptions.coronal:
            viewport.setOrientation(Enums.OrientationAxis.CORONAL);
            break;
          case orientationOptions.oblique:
            const viewUp = [-0.5962687530844388, 0.5453181550345819, -0.5891448751239446];
            const viewPlaneNormal = [
              -0.5962687530844388,
              0.5453181550345819,
              -0.5891448751239446,
            ];
            viewport.setCamera({ viewUp, viewPlaneNormal });
            viewport.resetCamera();
            break;
          default:
            break;
        }
        viewport.render();
      },
    });

    // Initialize and run the demo.
    const run = async () => {
      try {
        await initDemo();

        const wadoRsRoot = 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb';
        const StudyInstanceUID =
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463';

        const ctImageIds = await createImageIdsAndCacheMetaData({
          StudyInstanceUID,
          SeriesInstanceUID:
            '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
          wadoRsRoot,
        });

        const ptImageIds = await createImageIdsAndCacheMetaData({
          StudyInstanceUID,
          SeriesInstanceUID:
            '1.3.6.1.4.1.14519.5.2.1.7009.2403.879445243400782656317561081015',
          wadoRsRoot,
        });

        const renderingEngine = new RenderingEngine(renderingEngineId);

        const viewportInput = {
          viewportId,
          type: ViewportType.ORTHOGRAPHIC,
          element,
          defaultOptions: {
            orientation: Enums.OrientationAxis.SAGITTAL,
            background: [0.2, 0, 0.2] as Types.Point3,
          },
        };

        renderingEngine.enableElement(viewportInput);

        const viewport = renderingEngine.getViewport(
          viewportId
        ) as Types.IVolumeViewport;

        const ctVolume = await volumeLoader.createAndCacheVolume(ctVolumeId, {
          imageIds: ctImageIds,
        });

        await ctVolume.load();
        renderingEngine.render();

        const ptVolume = await volumeLoader.createAndCacheVolume(ptVolumeId, {
          imageIds: ptImageIds,
        });

        await ptVolume.load();

        viewport.setVolumes([
          { volumeId: ctVolumeId },
          {
            volumeId: ptVolumeId,
            callback: setPetColorMapTransferFunctionForVolumeActor,
          },
        ]);
      } catch (error) {
        console.error('Error initializing Cornerstone3D viewer:', error);
      }
    };

    run();

    // Cleanup on unmount.
    return () => {
      const renderingEngine = getRenderingEngine(renderingEngineId);
      if (renderingEngine) {
        renderingEngine.destroy();
      }
    };
  }, []);

  return (
    <div>
      <div id="demo-title"></div>
      <div id="demo-description"></div>
      <div id="toolbar" ref={toolbarRef}></div>
      <div id="content"></div>
    </div>
  );
};

export default Cornerstone3DViewer;
