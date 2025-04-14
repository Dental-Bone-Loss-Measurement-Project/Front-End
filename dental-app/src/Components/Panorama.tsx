import React, { useState, ChangeEvent } from 'react';
import axios from 'axios';

interface UploadResponse {
  imageShape: [number, number, number]; // (Depth, Height, Width)
  panoramicViewUrl: string;
}

const ImageUpload: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [responseData, setResponseData] = useState<UploadResponse | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResponseData(null);
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
    } catch (err: any) {
      setError('Error processing the image. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Upload CBCT Scan</h1>
      <input type="file" accept=".mha,.nii,.dcm" onChange={handleFileChange} className="mb-4" />
      <button
        onClick={handleUpload}
        disabled={loading || !file}
        className="bg-blue-500 text-white py-2 px-4 rounded"
      >
        {loading ? 'Processing...' : 'Upload and Process'}
      </button>
      {error && <p className="text-red-500 mt-2">{error}</p>}
      {responseData && (
        <div className="mt-4">
          <p>
            <strong>CBCT Image Shape:</strong> {responseData.imageShape.join(', ')}
          </p>
          <img src={responseData.panoramicViewUrl} alt="Panoramic View" className="mt-2" />
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
