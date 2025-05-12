// Header.tsx
import React from 'react';
interface HeaderProps {
  preset: string;
  setPreset: (preset: string) => void;
}

const Header: React.FC<HeaderProps> = ({ preset, setPreset }) => {
  const handlePresetChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setPreset(event.target.value);
  };

  const presetOptions = [
    { value: 'CT-Bone', label: 'CT Bone (with some tissue)' },
    { value: 'CT-Bone-Only', label: 'Bones Only' },
    { value: 'CT-Soft-Tissue', label: 'Soft Tissue' },
  ];

  return (
    <header className='relative bg-[#041C4A] h-[50px]'>
      <div className='container mx-auto flex items-center justify-start h-full px-4'>
        <a href='/' className='flex items-center h-full'>
          <img 
            src="/src/assets/WhatsApp_Image_2025-04-06_at_15.20.32_962b4bea-removebg-preview.png" 
            alt='logo_img' 
            className='h-full w-auto object-contain' 
          />
          <h3 className='text-white text-xl font-bold ml-2'>Dental App</h3>
        </a>  
      </div>

      {/* Absolutely centered toolbar */}
      <nav className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center gap-4">
        <div id="demo-toolbar" className="flex gap-4 items-center text-white">
          {/* Toolbar content goes here */}
        </div>
        <select
          value={preset}
          onChange={handlePresetChange}
          className="p-2 rounded bg-gray-700 text-white"
        >
          {presetOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </nav>
    </header>
  );
}

export default Header;