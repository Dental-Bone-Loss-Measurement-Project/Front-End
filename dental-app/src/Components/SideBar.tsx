import { FiUpload, FiImage } from "react-icons/fi";
import { useNavigate } from 'react-router-dom';
import "./sidebar.css";
import React from 'react';

interface SideBarProps {
  onFileSelect?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export function SideBar({ onFileSelect }: SideBarProps) {
  const navigate = useNavigate();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="sidebar sidebar-open">
      <nav className="sidebar-nav">
        <div className="upload-container">
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
        </div>

        <button
          onClick={() => navigate('/convert')}
          className="sidebar-btn"
        >
          <FiImage size={24} />
          <span>Convert to Panorama</span>
        </button>
      </nav>
    </div>
  );
}
