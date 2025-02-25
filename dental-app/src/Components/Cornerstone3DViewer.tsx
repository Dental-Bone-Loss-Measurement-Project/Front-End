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
  setCtTransferFunctionForVolumeActor,
  setPetColorMapTransferFunctionForVolumeActor,
  addSliderToToolbar,
} from '../../utils/demo/helpers';

const Cornerstone3DViewer = () => {
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (toolbarRef.current) {
      toolbarRef.current.innerHTML = '';
    }

    const { ViewportType } = Enums;
    const renderingEngineId = 'myRenderingEngine';
    const viewportIds = {
      AXIAL: 'AXIAL_VIEWPORT',
      SAGITTAL: 'SAGITTAL_VIEWPORT',
      CORONAL: 'CORONAL_VIEWPORT'
    };

    const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
    const ctVolumeName = 'CT_VOLUME_ID';
    const ctVolumeId = `${volumeLoaderScheme}:${ctVolumeName}`;
    const ptVolumeName = 'PT_VOLUME_ID';
    const ptVolumeId = `${volumeLoaderScheme}:${ptVolumeName}`;

    setTitleAndDescription(
      'Multiplanar Volume Reconstruction',
      'Demonstrates axial, sagittal, and coronal views simultaneously'
    );

    const content = document.getElementById('content');
    if (!content) {
      console.error('Content element not found in the DOM');
      return;
    }

    // Clear existing content
    content.innerHTML = '';
    content.style.display = 'flex';
    content.style.flexDirection = 'column';
    content.style.gap = '20px';

    if (!toolbarRef.current) {
      console.error('Toolbar container not found in the DOM');
      return;
    }

    // Opacity slider
    addSliderToToolbar({
      container: toolbarRef.current,
      title: 'Opacity',
      range: [0, 1],
      step: 0.1,
      defaultValue: 0.5,
      onSelectedValueChange: (value) => {
        const renderingEngine = getRenderingEngine(renderingEngineId);
        Object.values(viewportIds).forEach(viewportId => {
          const viewport = renderingEngine.getViewport(viewportId);
          viewport.setProperties({ colormap: { opacity: Number(value) } }, ptVolumeId);
          viewport.render();
        });
      },
    });

    const run = async () => {
      try {
        await initDemo();

        const wadoRsRoot = 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb';
        const StudyInstanceUID = 
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463';

        // Load image data first
        const [ctImageIds, ptImageIds] = await Promise.all([
          createImageIdsAndCacheMetaData({
            StudyInstanceUID,
            SeriesInstanceUID: '1.3.6.1.4.1.14519.5.2.1.7009.2403.879445243400782656317561081015',
            wadoRsRoot,
          })
        ]);

        // Create viewport elements only after data is loaded
        const createViewportElement = (orientation: string) => {
          const element = document.createElement('div');
          element.id = `cornerstone-element-${orientation}`;
          element.style.width = '500px';
          element.style.height = '300px';
          element.style.backgroundColor = '#000'; // Add background color
          return element;
        };

        const elements = {
          axial: createViewportElement('axial'),
          sagittal: createViewportElement('sagittal'),
          coronal: createViewportElement('coronal')
        };

        // Add elements to DOM only when ready
        content.appendChild(elements.sagittal);
        content.appendChild(elements.axial);
        content.appendChild(elements.coronal);

        const renderingEngine = new RenderingEngine(renderingEngineId);

        // Configure viewports
        const viewportInputs = [
          {
            viewportId: viewportIds.SAGITTAL,
            type: ViewportType.ORTHOGRAPHIC,
            element: elements.sagittal,
            defaultOptions: {
              orientation: Enums.OrientationAxis.SAGITTAL,
              background: [0.2, 0, 0.2] as Types.Point3,
            },
          },
          {
            viewportId: viewportIds.AXIAL,
            type: ViewportType.ORTHOGRAPHIC,
            element: elements.axial,
            defaultOptions: {
              orientation: Enums.OrientationAxis.AXIAL,
              background: [0.2, 0, 0.2] as Types.Point3,
            },
          },
          {
            viewportId: viewportIds.CORONAL,
            type: ViewportType.ORTHOGRAPHIC,
            element: elements.coronal,
            defaultOptions: {
              orientation: Enums.OrientationAxis.CORONAL,
              background: [0.2, 0, 0.2] as Types.Point3,
            },
          },
        ];

        // Enable viewports after elements are in DOM
        viewportInputs.forEach(input => renderingEngine.enableElement(input));

        // Load volumes
        const [ctVolume, ptVolume] = await Promise.all([
          volumeLoader.createAndCacheVolume(ctVolumeId, { imageIds: ctImageIds }),
          volumeLoader.createAndCacheVolume(ptVolumeId, { imageIds: ptImageIds })
        ]);

        await Promise.all([ctVolume.load(), ptVolume.load()]);

        // Set volumes and render
        Object.values(viewportIds).forEach(viewportId => {
          const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport;
          viewport.setVolumes([
            { volumeId: ctVolumeId },
            {
              volumeId: ptVolumeId,
              callback: setPetColorMapTransferFunctionForVolumeActor,
            },
          ]);
          viewport.render();
        });

      } catch (error) {
        console.error('Error initializing Cornerstone3D viewer:', error);
        // Clean up if error occurs
        const content = document.getElementById('content');
        if (content) content.innerHTML = '';
      }
    };

    run();

    return () => {
      const renderingEngine = getRenderingEngine(renderingEngineId);
      if (renderingEngine) {
        renderingEngine.destroy();
      }
      const content = document.getElementById('content');
      if (content) content.innerHTML = '';
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