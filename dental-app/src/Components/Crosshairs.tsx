// react imports
import {
    useEffect,
    useRef
} from "react"

// cornerstone imports
import {
    RenderingEngine,
    Enums,
    setVolumesForViewports,
    volumeLoader,
    getRenderingEngine,
} from '@cornerstonejs/core';
import type {Types} from '@cornerstonejs/core';
import {init as csRenderInit} from "@cornerstonejs/core"
import {init as csToolsInit} from "@cornerstonejs/tools"
import {init as dicomImageLoaderInit} from "@cornerstonejs/dicom-image-loader"
import * as cornerstoneTools from '@cornerstonejs/tools';

// helper imports
import {
    createImageIdsAndCacheMetaData,
    addDropdownToToolbar,
    addManipulationBindings,
    addToggleButtonToToolbar,
    addButtonToToolbar,
    getLocalUrl,
} from '../../utils/demo/helpers';


// extract the needed functions
const {
    ToolGroupManager,
    Enums: csToolsEnums,
    CrosshairsTool,
    synchronizers,
} = cornerstoneTools;

const {createSlabThicknessSynchronizer} = synchronizers;
const {MouseBindings} = csToolsEnums;
const {ViewportType} = Enums;

// Define a unique id for the volume
const volumeName = 'VOLUME_ID';
const volumeLoaderScheme = 'cornerstoneStreamingImageVolume';
const volumeId = `${volumeLoaderScheme}:${volumeName}`; //
const toolGroupId = 'CROSSHAIRS_TOOLGROUP_ID';
const axialViewportId = 'AXIAL_VIEWPORT_ID';
const sagittalViewportId = 'SAGITTAL_VIEWPORT_ID';
const coronalViewportId = 'CORONAL_VIEWPORT_ID';
const viewportIds = [axialViewportId, sagittalViewportId, coronalViewportId];
const renderingEngineId = 'volumeRenderingEngine';
const synchronizerId = 'SLAB_THICKNESS_SYNCHRONIZER_ID';

const viewportSize = '500px';

const CrossHairs = () => {

    // ref elements for the viewports
    const running = useRef(false)
    const axialViewportElementRef = useRef<HTMLDivElement>(null)
    const sagittalViewportElementRef = useRef<HTMLDivElement>(null)
    const coronalViewportElementRef = useRef<HTMLDivElement>(null)

    // Set up the toolbar
    useEffect(() => {
        addButtonToToolbar({
            title: 'Reset Camera',
            onClick: () => {
                const viewport = getRenderingEngine(renderingEngineId).getViewport(
                    axialViewportId
                ) as Types.IVolumeViewport;
                viewport.resetCamera({
                    resetPan: true,
                    resetZoom: true,
                    resetToCenter: true,
                    resetRotation: true,
                });
                viewport.render();
            },
        });

        addDropdownToToolbar({
            options: {
                values: [
                    'Maximum Intensity Projection',
                    'Minimum Intensity Projection',
                    'Average Intensity Projection',
                ],
                defaultValue: 'Maximum Intensity Projection',
            },
            onSelectedValueChange: (selectedValue: string) => {
                let blendModeToUse;
                switch (selectedValue) {
                    case 'Maximum Intensity Projection':
                        blendModeToUse = Enums.BlendModes.MAXIMUM_INTENSITY_BLEND;
                        break;
                    case 'Minimum Intensity Projection':
                        blendModeToUse = Enums.BlendModes.MINIMUM_INTENSITY_BLEND;
                        break;
                    case 'Average Intensity Projection':
                        blendModeToUse = Enums.BlendModes.AVERAGE_INTENSITY_BLEND;
                        break;
                    default:
                        throw new Error('Undefined blend mode');
                }

                const toolGroup = ToolGroupManager.getToolGroup(toolGroupId);
                const crosshairsInstance = toolGroup.getToolInstance(CrosshairsTool.toolName);
                const oldConfig = crosshairsInstance.configuration;

                crosshairsInstance.configuration = {
                    ...oldConfig,
                    slabThicknessBlendMode: blendModeToUse,
                };

                toolGroup.viewportsInfo.forEach(({ viewportId, renderingEngineId }) => {
                    const engine = getRenderingEngine(renderingEngineId);
                    const viewport = engine.getViewport(viewportId) as Types.IVolumeViewport;
                    viewport.setBlendMode(blendModeToUse);
                    viewport.render();
                });
            },
        });

        addToggleButtonToToolbar({
            id: 'syncSlabThickness',
            title: 'Sync Slab Thickness',
            defaultToggle: false,
            onClick: (toggle: boolean) => {
                synchronizer.setEnabled(toggle);
            },
        });
    }, []);

    // Set up the viewports
    const viewportColors = {
        [axialViewportId]: 'rgb(200, 0, 0)',
        [sagittalViewportId]: 'rgb(200, 200, 0)',
        [coronalViewportId]: 'rgb(0, 200, 0)',
    };

    let synchronizer: cornerstoneTools.Synchronizer;

    const viewportReferenceLineControllable = [
        axialViewportId,
        sagittalViewportId,
        coronalViewportId,
    ];

    const viewportReferenceLineDraggableRotatable = [
        axialViewportId,
        sagittalViewportId,
        coronalViewportId,
    ];

    const viewportReferenceLineSlabThicknessControlsOn = [
        axialViewportId,
        sagittalViewportId,
        coronalViewportId,
    ];

    function getReferenceLineColor(viewportId: string | number) {
        return viewportColors[viewportId];
    }

    function getReferenceLineControllable(viewportId: string) {
        const index = viewportReferenceLineControllable.indexOf(viewportId);
        return index !== -1;
    }

    function getReferenceLineDraggableRotatable(viewportId: string) {
        const index = viewportReferenceLineDraggableRotatable.indexOf(viewportId);
        return index !== -1;
    }

    function getReferenceLineSlabThicknessControlsOn(viewportId: string) {
        const index =
            viewportReferenceLineSlabThicknessControlsOn.indexOf(viewportId);
        return index !== -1;
    }

    function setUpSynchronizers() {
        synchronizer = createSlabThicknessSynchronizer(synchronizerId);

        // Add viewports to VOI synchronizers
        [axialViewportId, sagittalViewportId, coronalViewportId].forEach((viewportId) => {
            synchronizer.add({
                renderingEngineId,
                viewportId,
            });
        });
        synchronizer.setEnabled(false);
    }


    useEffect(() => {
        const setup = async () => {

            // Check if the component is already running
            if (running.current) {
                return
            }
            running.current = true

            // init the cornerstone libraries and add the crosshairs tool
            csRenderInit()
            csToolsInit()
            dicomImageLoaderInit({maxWebWorkers: 1})
            cornerstoneTools.addTool(CrosshairsTool);

            // Get Cornerstone imageIds for the source data and fetch metadata into RAM
            const imageIds = await createImageIdsAndCacheMetaData({
                StudyInstanceUID:
                    '1.3.6.1.4.1.14519.5.2.1.7009.2403.334240657131972136850343327463',
                SeriesInstanceUID:
                    '1.3.6.1.4.1.14519.5.2.1.7009.2403.226151125820845824875394858561',
                wadoRsRoot: getLocalUrl() || 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
            });

            // Define a volume in memory
            const volume = await volumeLoader.createAndCacheVolume(volumeId, {
                imageIds,
            });

            const renderingEngine = new RenderingEngine(renderingEngineId);

            const viewportInputArray = [
                {
                    viewportId: axialViewportId,
                    type: ViewportType.ORTHOGRAPHIC,
                    element: axialViewportElementRef.current,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.AXIAL,
                        background: [0, 0, 0] as Types.Point3,
                    },
                },
                {
                    viewportId: sagittalViewportId,
                    type: ViewportType.ORTHOGRAPHIC,
                    element: sagittalViewportElementRef.current,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.SAGITTAL,
                        background: [0, 0, 0] as Types.Point3,
                    }
                },
                {
                    viewportId: coronalViewportId,
                    type: ViewportType.ORTHOGRAPHIC,
                    element: coronalViewportElementRef.current,
                    defaultOptions: {
                        orientation: Enums.OrientationAxis.CORONAL,
                        background: [0, 0, 0] as Types.Point3,
                    },
                }
            ]

            renderingEngine.setViewports(viewportInputArray);

            volume.load();

            // Set volumes on the viewports
            await setVolumesForViewports(
                renderingEngine,
                [{volumeId}],
                [axialViewportId, sagittalViewportId, coronalViewportId]
            );

            const toolGroup = ToolGroupManager.createToolGroup(toolGroupId);
            addManipulationBindings(toolGroup);

            // For the crosshairs to operate, the viewports must currently be
            // added ahead of setting the tool active. This will be improved in the future.
            toolGroup.addViewport(axialViewportId, renderingEngineId);
            toolGroup.addViewport(sagittalViewportId, renderingEngineId);
            toolGroup.addViewport(coronalViewportId, renderingEngineId);

            // Manipulation Tools
            // Add Crosshairs tool and configure it to link the three viewports
            // These viewports could use different tool groups. See the PET-CT example
            // for a more complicated used case.
            const isMobile = window.matchMedia('(any-pointer:coarse)').matches;

            toolGroup.addTool(CrosshairsTool.toolName, {
                getReferenceLineColor,
                getReferenceLineControllable,
                getReferenceLineDraggableRotatable,
                getReferenceLineSlabThicknessControlsOn,
                mobile: {
                    enabled: isMobile,
                    opacity: 0.8,
                    handleRadius: 9,
                },
            });

            toolGroup.setToolActive(CrosshairsTool.toolName, {
                bindings: [{mouseButton: MouseBindings.Primary}],
            });

            setUpSynchronizers();

            // Render the image
            renderingEngine.renderViewports(viewportIds);
        }

        setup().then( () => {
            console.log('Rendering engine and viewports set up');
        })

        // Create a stack viewport
    }, [axialViewportElementRef, sagittalViewportElementRef, coronalViewportElementRef, running])

    return (
        <div className="flex flex-col items-center space-y-8 p-8">
            <div id="demo-toolbar" className="w-full bg-gray-100 p-4 flex flex-wrap gap-4 justify-center"/>
            <div className="flex flex-col items-center">
                <div className="flex flex-row flex-wrap gap-4 justify-center">
                    <div ref={axialViewportElementRef} className="relative border border-gray-600"
                         style={{width: viewportSize, height: viewportSize}}/>
                    <div ref={sagittalViewportElementRef} className="relative border border-gray-600"
                         style={{width: viewportSize, height: viewportSize}}/>
                    <div ref={coronalViewportElementRef} className="relative border border-gray-600"
                         style={{width: viewportSize, height: viewportSize}}/>
                </div>
            </div>
        </div>
    )
}

export default CrossHairs