import React from 'react';
const Header: React.FC = () => {
    const itemsInNavBar = [
        { name: 'item1', link: '/' },
        { name: 'item2', link: '/' },
        { name: 'item3', link: '/' },
    ];
    return (
        <header className='bg-gray-700'>
            <div className='container mx-auto flex justify-between items-center p-4'>
                <a href='/' className='flex items-center'>
                    <img src="\src\assets\WhatsApp_Image_2025-04-06_at_15.20.32_962b4bea-removebg-preview.png" alt='logo_img' className='w-20 h-20'>
                    </img>
                    <h3 className='text-white text-2xl font-bold'>Dental App</h3>
                </a>  
                <nav>
                    <ul className='flex gap-8 items-center'>
                        {itemsInNavBar.map((item, index) => (
                            <li key={index} className='text-white opacity-[0.9] hover:opacity-[1] hover:underline transition-opacity duration-200'>
                                <a href={item.link}>{item.name}</a>
                            </li>
                        ))}
                    </ul>
                </nav>
            </div>
        </header>
    );
}

export default Header;

