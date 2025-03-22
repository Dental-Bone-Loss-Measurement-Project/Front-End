import React, { useEffect, useRef } from 'react';
import type { Types } from '@cornerstonejs/core';
import { RenderingEngine, Enums, volumeLoader } from '@cornerstonejs/core';
import {
  initDemo,
  createImageIdsAndCacheMetaData,
  setTitleAndDescription,
  addSliderToToolbar,
  setPetColorMapTransferFunctionForVolumeActor,
} from '../../utils/demo/helpers';

const Cornerstone3DViewer: React.FC = () => {
  // Refs for the toolbar and content containers
  const toolbarRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // Keep a ref for the rendering engine instance
  const renderingEngineRef = useRef<RenderingEngine | null>(null);

  useEffect(() => {
    // Clear the toolbar and content containers
    if (toolbarRef.current) toolbarRef.current.innerHTML = '';
    if (contentRef.current) {
      contentRef.current.innerHTML = '';
      contentRef.current.style.display = 'flex';
      contentRef.current.style.flexDirection = 'column';
      contentRef.current.style.gap = '20px';
    }

    const { ViewportType, OrientationAxis } = Enums;
    const renderingEngineId = 'myRenderingEngine';
    const viewportIds = {
      AXIAL: 'AXIAL_VIEWPORT',
      SAGITTAL: 'SAGITTAL_VIEWPORT',
      CORONAL: 'CORONAL_VIEWPORT'
    };

    // Set the demo title and description
    setTitleAndDescription(
      'Multiplanar Volume Reconstruction',
      'Demonstrates axial, sagittal, and coronal views simultaneously'
    );

    if (!contentRef.current) {
      console.error('Content container not found');
      return;
    }

    // Add an opacity slider to the toolbar
    if (toolbarRef.current) {
      addSliderToToolbar({
        container: toolbarRef.current,
        title: 'Opacity',
        range: [0, 1],
        step: 0.1,
        defaultValue: 0.5,
        onSelectedValueChange: (value) => {
          // Use the stored rendering engine instance
          const engine = renderingEngineRef.current;
          if (engine) {
            Object.values(viewportIds).forEach(viewportId => {
              const viewport = engine.getViewport(viewportId) as Types.IVolumeViewport;
              // Here 'PT_VOLUME_ID' is the identifier for the second volume.
              viewport.setProperties({ colormap: { opacity: Number(value) } }, 'PT_VOLUME_ID');
              viewport.render();
            });
          }
        },
      });
    }

    const run = async () => {
      try {
        await initDemo();

        const wadoRsRoot = 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb';
        const StudyInstanceUID =
          '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463';

        // Load image data for CT and PT
        const [ctImageIds, ptImageIds] = await Promise.all([
          createImageIdsAndCacheMetaData({
            StudyInstanceUID,
            SeriesInstanceUID:
              '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
            wadoRsRoot,
          }),
          createImageIdsAndCacheMetaData({
            StudyInstanceUID,
            SeriesInstanceUID:
              '1.3.6.1.4.1.14519.5.2.1.7009.2403.879445243400782656317561081015',
            wadoRsRoot,
          }),
        ]);

        // Create viewport elements dynamically
        const createViewportElement = (orientation: string) => {
          const element = document.createElement('div');
          element.id = `cornerstone-element-${orientation}`;
          element.style.width = '500px';
          element.style.height = '300px';
          element.style.backgroundColor = '#000';
          return element;
        };

        const elements = {
          axial: createViewportElement('axial'),
          sagittal: createViewportElement('sagittal'),
          coronal: createViewportElement('coronal')
        };

        // Append the viewport elements to the content container
        contentRef.current.appendChild(elements.sagittal);
        contentRef.current.appendChild(elements.axial);
        contentRef.current.appendChild(elements.coronal);

        // Create and store the rendering engine
        const renderingEngine = new RenderingEngine(renderingEngineId);
        renderingEngineRef.current = renderingEngine;

        // Configure viewports for the three orientations
        const viewportInputs = [
          {
            viewportId: viewportIds.SAGITTAL,
            type: ViewportType.ORTHOGRAPHIC,
            element: elements.sagittal,
            defaultOptions: {
              orientation: OrientationAxis.SAGITTAL,
              background: [0.2, 0, 0.2] as Types.Point3,
            },
          },
          {
            viewportId: viewportIds.AXIAL,
            type: ViewportType.ORTHOGRAPHIC,
            element: elements.axial,
            defaultOptions: {
              orientation: OrientationAxis.AXIAL,
              background: [0.2, 0, 0.2] as Types.Point3,
            },
          },
          {
            viewportId: viewportIds.CORONAL,
            type: ViewportType.ORTHOGRAPHIC,
            element: elements.coronal,
            defaultOptions: {
              orientation: OrientationAxis.CORONAL,
              background: [0.2, 0, 0.2] as Types.Point3,
            },
          },
        ];

        viewportInputs.forEach(input => renderingEngine.enableElement(input));

        // Set up volume IDs for CT and PT volumes
        const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
        const ctVolumeName = 'CT_VOLUME_ID';
        const ptVolumeName = 'PT_VOLUME_ID';
        const ctVolumeId = `${volumeLoaderScheme}:${ctVolumeName}`;
        const ptVolumeId = `${volumeLoaderScheme}:${ptVolumeName}`;

        // Load and cache volumes
        const [ctVolume, ptVolume] = await Promise.all([
          volumeLoader.createAndCacheVolume(ctVolumeId, { imageIds: ctImageIds }),
          volumeLoader.createAndCacheVolume(ptVolumeId, { imageIds: ptImageIds })
        ]);

        await Promise.all([ctVolume.load(), ptVolume.load()]);

        // Set the loaded volumes on each viewport and render
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
        if (contentRef.current) contentRef.current.innerHTML = '';
      }
    };

    run();

    // Cleanup when the component is unmounted
    return () => {
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
        renderingEngineRef.current = null;
      }
      if (contentRef.current) contentRef.current.innerHTML = '';
    };
  }, []);

  return (
    <div>
      <div id="demo-title"></div>
      <div id="demo-description"></div>
      <div id="toolbar" ref={toolbarRef}></div>
      <div id="content" ref={contentRef}></div>
    </div>
  );
};

export default Cornerstone3DViewer;
