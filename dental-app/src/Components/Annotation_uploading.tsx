import React, { useState } from 'react';

const AnnotationUploading: React.FC = () => {
  // State to track the selected file
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError(null);

    if (file) {
      // Check if file is a JSON file
      if (file.type !== 'application/json') {
        setError('Please upload a JSON file');
        return;
      }
      setSelectedFile(file);
    }
  };

  // Handle file upload
  const handleUpload = () => {
    if (selectedFile) {
      // Handle the file upload here
      console.log('Uploaded file:', selectedFile);
      setSelectedFile(null);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-gray-50 my-4">
      <div className="flex gap-4 items-center mb-4">
        <label 
          htmlFor="annotation-file" 
          className="inline-block px-4 py-2 bg-gray-100 border border-gray-200 rounded cursor-pointer hover:bg-gray-200 transition-colors duration-200"
        >
          Choose JSON file
          <input
            id="annotation-file"
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload annotation JSON file"
          />
        </label>
        <button 
          onClick={handleUpload}
          disabled={!selectedFile}
          className={`px-4 py-2 rounded text-white transition-colors duration-200 ${
            selectedFile 
              ? 'bg-blue-500 hover:bg-blue-600 cursor-pointer' 
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Upload Annotation
        </button>
      </div>

      {selectedFile && (
        <div className="mt-2 p-2 bg-gray-100 rounded text-sm">
          Selected file: {selectedFile.name}
        </div>
      )}

      {error && (
        <div 
          className="mt-2 p-2 bg-red-100 text-red-700 border border-red-200 rounded text-sm"
          role="alert"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default AnnotationUploading;