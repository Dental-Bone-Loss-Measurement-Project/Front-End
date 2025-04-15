import React from 'react';

const Header: React.FC = () => {
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
  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
    <div id="demo-toolbar" className="flex gap-4 items-center text-white">
      {/* Toolbar content goes here */}
    </div>
  </div>
</header>

    );
}

export default Header;