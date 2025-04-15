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

  return (
    <header className='bg-gray-700'>
      <div className='container mx-auto flex justify-between items-center p-4'>
        <a href='/' className='flex items-center'>
          <img
            src="\src\assets\WhatsApp_Image_2025-04-06_at_15.20.32_962b4bea-removebg-preview.png"
            alt='logo_img'
            className='w-20 h-20'
          />
          <h3 className='text-white text-2xl font-bold'>Dental App</h3>
        </a>
        <nav className="flex gap-4">
          <div id="demo-toolbar" className="flex gap-4"></div>
          <select
              name="preset"
              title="Presets"
              value={preset}
              onChange={handlePresetChange}
              className="p-2 rounded"
            >
              <option value="CT-Bone">CT-Bone</option>
              <option value="CT-Bones">CT-Bones</option>
            </select>
        </nav>
      </div>
    </header>
  );
};

export default Header;
