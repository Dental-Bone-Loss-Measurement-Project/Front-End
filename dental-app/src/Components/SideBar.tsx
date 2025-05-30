import { FiUpload, FiImage, FiEdit2, FiDownload, FiUploadCloud, FiMapPin } from "react-icons/fi";
import { useNavigate } from 'react-router-dom';
import "./sidebar.css";
import React from 'react';

interface SideBarProps {
  onFileSelect?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExportAnnotations?: () => void;
  onImportAnnotations?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImportPoints?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  isImageLoaded?: boolean;
}

export function SideBar({ 
  onFileSelect, 
  onExportAnnotations, 
  onImportAnnotations,
  onImportPoints,
  isImageLoaded 
}: SideBarProps) {
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const importInputRef = React.useRef<HTMLInputElement>(null);
  const pointsInputRef = React.useRef<HTMLInputElement>(null);

  // Add debug logging
  React.useEffect(() => {
    console.log('SideBar props:', {
      hasExportHandler: !!onExportAnnotations,
      isImageLoaded,
    });
  }, [onExportAnnotations, isImageLoaded]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handlePointsClick = () => {
    console.log('Points import button clicked');
    console.log('Import points handler available:', !!onImportPoints);
    pointsInputRef.current?.click();
  };

  return (
    <div className="sidebar sidebar-open">
      <nav className="sidebar-nav">
        {/* <div className="upload-container"> */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="application/dicom,.dcm"
            onChange={onFileSelect}
            className="hidden"
            aria-label="Upload DICOM files"
          />
          <button onClick={handleUploadClick} className="sidebar-btn">
            <FiUpload size={24} />
            <span>Upload DICOM Files</span>
          </button>
        {/* </div> */}

        <button
          onClick={() => navigate('/convert')}
          className="sidebar-btn"
        >
          <FiImage size={24} />
          <span>Convert to Panorama</span>
        </button>

        {isImageLoaded && (
          <>
            <input
              ref={importInputRef}
              type="file"
              accept=".json"
              onChange={onImportAnnotations}
              className="hidden"
              aria-label="Import annotations"
            />
            <button onClick={handleImportClick} className="sidebar-btn">
              <FiUploadCloud size={24} />
              <span>Import Annotations</span>
            </button>

            {onExportAnnotations && (
              <button onClick={onExportAnnotations} className="sidebar-btn">
                <FiDownload size={24} />
                <span>Export Annotations</span>
              </button>
            )}

            <input
              ref={pointsInputRef}
              type="file"
              accept=".json"
              onChange={(e) => {
                console.log('Points file selected');
                onImportPoints?.(e);
              }}
              className="hidden"
              aria-label="Import points"
            />
            <button onClick={handlePointsClick} className="sidebar-btn">
              <FiMapPin size={24} />
              <span>Import Points</span>
            </button>
          </>
        )}
      </nav>
    </div>
  );
}
