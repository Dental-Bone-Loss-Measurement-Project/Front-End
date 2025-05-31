import React, { useState, useEffect, useCallback } from 'react';
import { getRenderingEngine, cache, Types, Enums } from '@cornerstonejs/core';

interface HURangeSliderProps {
  viewportId: string;
  renderingEngineId: string;
  volumeId: string;
  onRangeChange?: (min: number, max: number) => void;
}

const HURangeSlider: React.FC<HURangeSliderProps> = ({
  viewportId,
  renderingEngineId,
  volumeId,
  onRangeChange
}) => {
  const [threshold, setThreshold] = useState(0);
  const [minHU, setMinHU] = useState(-1000);
  const [maxHU, setMaxHU] = useState(1000);

  // Get volume range when loaded
  useEffect(() => {
    const volume = cache.getVolume(volumeId) as Types.IImageVolume;
    if (volume) {
      try {
        const pointData = volume.imageData.getPointData();
        const scalars = pointData?.getScalars();
        if (scalars) {
          const range = scalars.getRange();
          console.log('Setting initial range:', range);
          setMinHU(Math.floor(range[0]));
          setMaxHU(Math.ceil(range[1]));
          setThreshold(Math.floor(range[0]));
        }
      } catch (error) {
        console.error('Error getting volume range:', error);
      }
    }
  }, [volumeId]);

  // Apply threshold when slider changes
  const applyThreshold = useCallback(() => {
    const renderingEngine = getRenderingEngine(renderingEngineId);
    if (!renderingEngine) return;

    const viewport = renderingEngine.getViewport(viewportId) as Types.IVolumeViewport;
    if (!viewport) return;

    // Set viewport properties for better visualization
    viewport.setProperties({
      voiRange: { 
        lower: threshold,
        upper: maxHU 
      },
      VOILUTFunction: Enums.VOILUTFunctionType.LINEAR
    });

    // Force viewport to update
    viewport.render();

    if (onRangeChange) {
      onRangeChange(threshold, maxHU);
    }
  }, [threshold, viewportId, renderingEngineId, maxHU, onRangeChange]);

  // Apply threshold when it changes
  useEffect(() => {
    applyThreshold();
  }, [applyThreshold, threshold]);

  // Direct slider change handler without debouncing
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(event.target.value);
    console.log('Slider value changed:', newValue);
    setThreshold(newValue);
  };

  // Mouse up handler to ensure final value is applied
  const handleMouseUp = () => {
    console.log('Slider released at value:', threshold);
    applyThreshold();
  };

  return (
    <div className="p-4 bg-gray-800 rounded-lg shadow-lg">
      <div className="mb-4">
        <label className="block text-white text-sm font-medium mb-2">
          Tissue Visibility Threshold: {threshold} HU
        </label>
        <div className="flex items-center space-x-4">
          <input
            type="range"
            min={minHU}
            max={maxHU}
            step="1"
            value={threshold}
            onChange={handleSliderChange}
            onMouseUp={handleMouseUp}
            onTouchEnd={handleMouseUp}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, 
                #4a5568 0%, 
                #4a5568 ${((threshold - minHU) / (maxHU - minHU)) * 100}%, 
                #718096 ${((threshold - minHU) / (maxHU - minHU)) * 100}%, 
                #718096 100%)`
            }}
            aria-label="Tissue Visibility Threshold Slider"
            title="Adjust threshold to control tissue visibility (higher values show more dense tissues)"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{minHU} (Air)</span>
          <span>{maxHU} (Dense Bone)</span>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>~100 (Soft Tissue)</span>
          <span>~1000 (Bone)</span>
        </div>
      </div>
    </div>
  );
};

export default HURangeSlider;