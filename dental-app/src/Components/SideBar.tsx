import { useState } from "react";
import { BsArrowRight, BsArrowLeft } from "react-icons/bs";
import { FiUpload, FiImage } from "react-icons/fi";

export function SideBar() {
  const [sideBar, setSideBar] = useState(false);

  function handleToggleSidebar() {
    setSideBar((prevState) => !prevState);
  }

  return (
    <div
      className={`fixed top-0 left-0 h-full ${
        sideBar ? 'w-64' : 'w-16'
      } bg-gray-900 text-white transition-all duration-300 z-50`}
    >
      <button onClick={handleToggleSidebar} className="p-4 focus:outline-none">
        {sideBar ? <BsArrowLeft size={24} /> : <BsArrowRight size={24} />}
      </button>

      <nav className="flex flex-col gap-6 mt-10">
        <button
          onClick={() => alert("Upload clicked")}
          className="flex items-center gap-4 p-4 hover:bg-gray-800"
        >
          <FiUpload size={24} />
          {sideBar && <span>Upload</span>}
        </button>

        <button
          onClick={() => alert("Convert to Panorama clicked")}
          className="flex items-center gap-4 p-4 hover:bg-gray-800"
        >
          <FiImage size={24} />
          {sideBar && <span>Convert to Panorama</span>}
        </button>
      </nav>
    </div>
  );
}
