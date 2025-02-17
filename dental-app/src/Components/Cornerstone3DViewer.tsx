import React, { useEffect, useRef } from 'react';
import {
    init as coreInit,
    RenderingEngine,
    Enums,
    volumeLoader,
    setVolumesForViewports,
} from '@cornerstonejs/core';
import { init as dicomImageLoaderInit } from '@cornerstonejs/dicom-image-loader';
import { createImageIdsAndCacheMetaData } from '../../cornerstone3D/utils/demo/helpers';
// import { createImageIdsAndCacheMetaData } from '@cornerstonejs/core';

const { ViewportType, OrientationAxis } = Enums;

const Cornerstone3DViewer: React.FC = () => {
    const axialRef = useRef<HTMLDivElement>(null);
    const sagittalRef = useRef<HTMLDivElement>(null);
    const coronalRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        async function run() {
            await coreInit();
            await dicomImageLoaderInit();

            const imageIds = await createImageIdsAndCacheMetaData({
                StudyInstanceUID: '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
                SeriesInstanceUID: '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
                wadoRsRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
            });

            const renderingEngineId = 'myRenderingEngine';
            const renderingEngine = new RenderingEngine(renderingEngineId);

            const volumeId = 'myVolume';
            const volume = await volumeLoader.createAndCacheVolume(volumeId, { imageIds });

            const viewports = [
                {
                    viewportId: 'CT_AXIAL',
                    element: axialRef.current,
                    type: ViewportType.ORTHOGRAPHIC,
                    defaultOptions: { orientation: OrientationAxis.AXIAL },
                },
                {
                    viewportId: 'CT_SAGITTAL',
                    element: sagittalRef.current,
                    type: ViewportType.ORTHOGRAPHIC,
                    defaultOptions: { orientation: OrientationAxis.SAGITTAL },
                },
                {
                    viewportId: 'CT_CORONAL',
                    element: coronalRef.current,
                    type: ViewportType.ORTHOGRAPHIC,
                    defaultOptions: { orientation: OrientationAxis.CORONAL },
                },
            ];

            renderingEngine.setViewports(viewports);
            volume.load();
            setVolumesForViewports(renderingEngine, [{ volumeId }], viewports.map(v => v.viewportId));
        }
        run();
    }, []);

    return (
        <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
            <div ref={axialRef} style={{ width: '500px', height: '500px', backgroundColor: 'black' }} />
            <div ref={sagittalRef} style={{ width: '500px', height: '500px', backgroundColor: 'black' }} />
            <div ref={coronalRef} style={{ width: '500px', height: '500px', backgroundColor: 'black' }} />
        </div>
    );
};

export default Cornerstone3DViewer;
