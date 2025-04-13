import React from 'react';

const Header: React.FC = () => {
    return (
        <header className='bg-gray-700'>
            <div className='container mx-auto flex justify-between items-center p-4'>
                <a href='/' className='flex items-center'>
                    <img src="\src\assets\WhatsApp_Image_2025-04-06_at_15.20.32_962b4bea-removebg-preview.png" alt='logo_img' className='w-20 h-20' />
                    <h3 className='text-white text-2xl font-bold'>Dental App</h3>
                </a>  
                <nav>
                <div id="demo-toolbar" className="flex gap-4"></div>
                </nav>
            </div>
        </header>
    );
}

export default Header;