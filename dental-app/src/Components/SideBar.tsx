import { FiUpload, FiImage } from "react-icons/fi";
import { useNavigate } from 'react-router-dom';
import "./sidebar.css";
import { useRef } from 'react';

export function SideBar() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('http://localhost:8000/upload-volume', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error('Upload failed');
      
      const data = await response.json();
      localStorage.setItem('volumeUrl', data.volumeUrl);
      navigate('/convert');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please check the console for details.');
    }
  };

  return (
    <div className="sidebar sidebar-open">
      <nav className="sidebar-nav">
        <button onClick={handleUploadClick} className="sidebar-btn">
          <FiUpload size={24} />
          <span>Upload</span>
        </button>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileUpload}
          accept=".mha"
        />

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