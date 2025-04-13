import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';

interface PanoramaResponse {
  imageUrl: string; // URL of the processed panorama image
}

const PanoramaUploader: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [panoramaUrl, setPanoramaUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('scan', selectedFile);

    try {
      // Replace the URL with your actual backend endpoint
      const response = await axios.post<PanoramaResponse>('http://localhost:8000/process-scan', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setPanoramaUrl(response.data.imageUrl);
    } catch (err: any) {
      setError('Failed to process the scan.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Upload CBCT Scan for Panorama Extraction</h1>
      <input type="file" accept=".nifti,.mha,.dcm" onChange={handleFileChange} className="mb-4" />
      <button 
        onClick={handleUpload} 
        className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded"
        disabled={loading}
      >
        {loading ? 'Processing...' : 'Upload and Process'}
      </button>
      {error && <div className="text-red-500 mt-2">{error}</div>}
      {panoramaUrl && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold">Extracted Panorama:</h2>
          <img src={panoramaUrl} alt="Extracted Panorama" className="mt-2" />
        </div>
      )}
    </div>
  );
};

export default PanoramaUploader;
