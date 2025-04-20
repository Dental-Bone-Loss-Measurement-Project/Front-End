import React, { useState, useEffect, useRef, ChangeEvent } from 'react';
import axios from 'axios';

interface UploadResponse {
  imageShape: [number, number, number]; // (Depth, Height, Width)
  panoramicViewUrl: string;
}

// Define tool interface
interface AnnotationTool {
  name: string;
  icon: string;
  draw: (ctx: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number) => void;
}

const PanoramaViewer: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [responseData, setResponseData] = useState<UploadResponse | null>(null);
  const [currentTool, setCurrentTool] = useState<string>('Line');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawStartPos, setDrawStartPos] = useState({ x: 0, y: 0 });
  const [activeAnnotation, setActiveAnnotation] = useState<{
    tool: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  } | null>(null);
  const [annotations, setAnnotations] = useState<Array<{
    tool: string;
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }>>([]);
  const [isPlacingStartPoint, setIsPlacingStartPoint] = useState<boolean>(true);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Define drawing tools
  const tools: Record<string, AnnotationTool> = {
    Line: {
      name: 'Line',
      icon: '📏',
      draw: (ctx, startX, startY, endX, endY) => {
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Add length measurement
        const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        const midX = (startX + endX) / 2;
        const midY = (startY + endY) / 2;
        ctx.fillText(`${length.toFixed(1)} px`, midX, midY - 5);
      }
    },
    Arrow: {
      name: 'Arrow',
      icon: '↗️',
      draw: (ctx, startX, startY, endX, endY) => {
        // Arrow shaft
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Arrow head
        const angle = Math.atan2(endY - startY, endX - startX);
        ctx.beginPath();
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 15 * Math.cos(angle - Math.PI / 6), endY - 15 * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(endX, endY);
        ctx.lineTo(endX - 15 * Math.cos(angle + Math.PI / 6), endY - 15 * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    },
    Angle: {
      name: 'Angle',
      icon: '📐',
      draw: (ctx, startX, startY, endX, endY) => {
        // For simplicity, creating a simple angle using 3 points
        const midX = startX + (endX - startX) / 2;
        const midY = startY;
        
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(midX, midY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
        
        // Calculate angle
        const angle1 = Math.atan2(startY - midY, startX - midX);
        const angle2 = Math.atan2(endY - midY, endX - midX);
        let angleDiff = (angle2 - angle1) * (180 / Math.PI);
        if (angleDiff < 0) angleDiff += 360;
        
        // Display angle
        ctx.fillText(`${angleDiff.toFixed(1)}°`, midX, midY - 10);
      }
    },
    Rectangle: {
      name: 'Rectangle',
      icon: '⬜',
      draw: (ctx, startX, startY, endX, endY) => {
        const width = endX - startX;
        const height = endY - startY;
        
        ctx.strokeRect(startX, startY, width, height);
        
        // Show dimensions
        ctx.fillText(`${Math.abs(width).toFixed(1)} x ${Math.abs(height).toFixed(1)} px`, startX + width / 2, startY + height / 2);
      }
    },
    Circle: {
      name: 'Circle',
      icon: '⭕',
      draw: (ctx, startX, startY, endX, endY) => {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
        
        ctx.beginPath();
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Show radius
        ctx.fillText(`r: ${radius.toFixed(1)} px`, startX, startY - radius - 5);
      }
    },
    Eraser: {
      name: 'Eraser',
      icon: '🧹',
      draw: () => {} // Handled separately
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResponseData(null);
      setAnnotations([]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post<UploadResponse>(
        'http://localhost:8000/upload-image',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      setResponseData(response.data);
      setAnnotations([]);
    } catch (err: any) {
      setError('Error processing the image. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Load the image when response data changes
  useEffect(() => {
    if (responseData && responseData.panoramicViewUrl) {
      const img = new Image();
      img.src = responseData.panoramicViewUrl;
      img.onload = () => {
        imageRef.current = img;
        drawImage();
      };
    }
  }, [responseData]);

  useEffect(() => {
    const handleResize = () => {
      drawImage();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Helper function to get canvas dimensions and image position
  const getCanvasDimensions = (canvas: HTMLCanvasElement, img: HTMLImageElement) => {
    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    );

    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    const x = (canvas.width - scaledWidth) / 2;
    const y = (canvas.height - scaledHeight) / 2;

    return { scale, scaledWidth, scaledHeight, x, y };
  };

  // Function to draw image and annotations with given context and annotation list
  const drawImageWithAnnotations = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, annotationsList: Array<{ tool: string; startX: number; startY: number; endX: number; endY: number; }>) => {
    const canvas = ctx.canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get dimensions
    const { scaledWidth, scaledHeight, x, y } = getCanvasDimensions(canvas, img);
    
    // Draw the image
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    
    // Set up drawing styles
    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;
    ctx.font = '12px Arial';
    ctx.fillStyle = '#FF0000';
    
    // Draw all annotations
    annotationsList.forEach(annotation => {
      const tool = tools[annotation.tool];
      if (tool) {
        tool.draw(ctx, annotation.startX, annotation.startY, annotation.endX, annotation.endY);
      }
    });
  };

  // Main function to redraw the canvas
  const drawImage = () => {
    if (!canvasRef.current || !containerRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const img = imageRef.current;

    // Set canvas size to container size
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw the image and annotations
    drawImageWithAnnotations(ctx, img, annotations);
  };

  // Handle canvas clicks for the two-click annotation pattern
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageRef.current) return;
    
    // If right-click, cancel the current annotation
    if (e.button === 2) {
      if (!isPlacingStartPoint) {
        // Reset to start a new annotation
        setActiveAnnotation(null);
        setIsPlacingStartPoint(true);
        drawImage(); // Redraw to remove the in-progress annotation
      }
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // If the Eraser tool is active, erase annotations
    if (currentTool === 'Eraser') {
      const newAnnotations = annotations.filter(annotation => {
        const distToStart = Math.sqrt(
          Math.pow(annotation.startX - x, 2) +
          Math.pow(annotation.startY - y, 2)
        );
        
        const distToEnd = Math.sqrt(
          Math.pow(annotation.endX - x, 2) +
          Math.pow(annotation.endY - y, 2)
        );
        
        const distToMiddle = Math.sqrt(
          Math.pow((annotation.startX + annotation.endX) / 2 - x, 2) +
          Math.pow((annotation.startY + annotation.endY) / 2 - y, 2)
        );
        
        // If click is close to any part of the annotation, remove it
        return distToStart > 15 && distToEnd > 15 && distToMiddle > 15;
      });
      
      setAnnotations(newAnnotations);
      drawImage();
      return;
    }

    // For normal annotation tools (not eraser)
    if (isPlacingStartPoint) {
      // First click - set the start point
      setDrawStartPos({ x, y });
      setActiveAnnotation({
        tool: currentTool,
        startX: x,
        startY: y,
        endX: x,  // Initially, end point is the same as start point
        endY: y
      });
      setIsPlacingStartPoint(false);
    } else {
      // Second click - complete the annotation
      if (activeAnnotation) {
        const newAnnotation = {
          ...activeAnnotation,
          endX: x,
          endY: y
        };
        
        // Add the annotation to the list
        const updatedAnnotations = [...annotations, newAnnotation];
        setAnnotations(updatedAnnotations);
        
        // Reset for next annotation
        setActiveAnnotation(null);
        setIsPlacingStartPoint(true);
        
        // Force redraw immediately
        setTimeout(() => {
          if (canvasRef.current && imageRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
              drawImageWithAnnotations(ctx, imageRef.current, updatedAnnotations);
            }
          }
        }, 0);
      }
    }
  };

  // Handle mouse move to preview the annotation during the second click
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only preview if we're waiting for the second click and have an active annotation
    if (isPlacingStartPoint || !activeAnnotation || !canvasRef.current || !imageRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Redraw image and existing annotations
    drawImage();

    // Draw the preview of the active annotation
    const tool = tools[activeAnnotation.tool];
    if (tool) {
      tool.draw(ctx, activeAnnotation.startX, activeAnnotation.startY, x, y);
    }
  };

  const handleEraserClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool !== 'Eraser' || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newAnnotations = annotations.filter(annotation => {
      const distToStart = Math.sqrt(
        Math.pow(annotation.startX - x, 2) +
        Math.pow(annotation.startY - y, 2)
      );

      const distToEnd = Math.sqrt(
        Math.pow(annotation.endX - x, 2) +
        Math.pow(annotation.endY - y, 2)
      );

      const distToMiddle = Math.sqrt(
        Math.pow((annotation.startX + annotation.endX) / 2 - x, 2) +
        Math.pow((annotation.startY + annotation.endY) / 2 - y, 2)
      );

      return distToStart > 15 && distToEnd > 15 && distToMiddle > 15;
    });

    setAnnotations(newAnnotations);
    drawImage();
  };

  const clearAnnotations = () => {
    setAnnotations([]);
    drawImage();
  };

  // Function to download the annotated image
  const downloadImage = async () => {
    if (!canvasRef.current || !imageRef.current) return;
    
    try {
      // Create a new image from the server URL first to ensure we have permissions
      const img = new Image();
      img.crossOrigin = 'Anonymous';  // This is crucial for CORS
      
      img.onload = () => {
        // Create temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvasRef.current!.width;
        tempCanvas.height = canvasRef.current!.height;
        
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;
  
        // Draw original canvas content
        tempCtx.drawImage(canvasRef.current!, 0, 0);
  
        // Create download link
        const link = document.createElement('a');
        link.download = 'annotated-panorama.png';
        link.href = tempCanvas.toDataURL('image/png');
        link.click();
  
        // Cleanup
        URL.revokeObjectURL(img.src);
      };
  
      img.onerror = () => {
        console.error('Error loading image');
        URL.revokeObjectURL(img.src);
      };
  
      // This forces a clean load of the image
      img.src = (await responseData)?.panoramicViewUrl + '?random=' + new Date().getTime();
    } catch (error) {
      console.error('Download failed:', error);
      alert('Unable to download image. Please check console for details.');
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Panoramic Dental View</h1>

      <div className="mb-4">
        <input
          type="file"
          accept=".mha,.nii,.dcm"
          onChange={handleFileChange}
          className="mb-2"
        />
        <button
          onClick={handleUpload}
          disabled={loading || !file}
          className="bg-blue-500 text-white py-2 px-4 rounded ml-2"
        >
          {loading ? 'Processing...' : 'Upload and Process'}
        </button>
      </div>

      {error && <p className="text-red-500 mt-2">{error}</p>}

      {responseData && (
        <div className="mt-4">
          <p className="mb-2">
            <strong>CBCT Image Shape:</strong> {responseData.imageShape.join(', ')}
          </p>
          
          <div className="flex flex-wrap gap-2 my-2">
            {Object.values(tools).map((tool) => (
              <button
                key={tool.name}
                onClick={() => setCurrentTool(tool.name)}
                className={`p-2 border rounded ${currentTool === tool.name ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                title={tool.name}
              >
                <span>{tool.icon}</span> {tool.name}
              </button>
            ))}
            <button
              onClick={clearAnnotations}
              className="p-2 border rounded bg-gray-100 ml-2"
              title="Clear All"
            >
              🗑️ Clear All
            </button>
            
            {annotations.length > 0 && (
              <button
                onClick={downloadImage}
                className="p-2 border rounded bg-green-500 text-white ml-2"
                title="Download Annotated Image"
              >
                💾 Download
              </button>
            )}
          </div>
          
          {/* Canvas container */}
          <div 
            ref={containerRef} 
            className="mt-2 border border-gray-300 rounded" 
            style={{ width: '100%', height: '500px', position: 'relative' }}
          >

            <canvas 
              ref={canvasRef} 
              className="absolute top-0 left-0 w-full h-full"
              onMouseMove={handleMouseMove}
              onClick={handleCanvasClick}
              onContextMenu={(e) => {
                e.preventDefault(); // Prevent context menu from showing
                handleCanvasClick(e); // Handle right-click as a cancel
                return false;
              }}
              style={{ cursor: currentTool === 'Eraser' ? 'crosshair' : 'crosshair' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PanoramaViewer;
