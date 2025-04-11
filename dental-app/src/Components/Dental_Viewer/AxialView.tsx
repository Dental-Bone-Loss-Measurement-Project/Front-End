import { useEffect, useRef } from 'react';

interface Props {
  renderingEngineId: string;
  viewportId: string;
}

const AxialView: React.FC<Props> = ({ viewportId }) => {
  const axialRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!axialRef.current) return;

    // Prevent default context menu
    axialRef.current.oncontextmenu = (e) => e.preventDefault();

    // Set up initial viewport size
    const updateSize = () => {
      if (axialRef.current) {
        axialRef.current.style.width = `${window.innerWidth * 0.45}px`;
        axialRef.current.style.height = `${window.innerHeight * 0.45}px`;
      }
    };

    window.addEventListener('resize', updateSize);
    updateSize();

    return () => window.removeEventListener('resize', updateSize);
  }, []);

  return (
    <div
      id={viewportId}
      ref={axialRef}
      className="w-full h-full"
    />
  );
};

export default AxialView;