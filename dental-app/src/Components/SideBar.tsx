import { FiUpload, FiImage } from "react-icons/fi";
import "./sidebar.css";

export function SideBar() {
  return (
    <div className="sidebar sidebar-open">
      <nav className="sidebar-nav">
        <button onClick={() => alert("Upload clicked")} className="sidebar-btn">
          <FiUpload size={24} />
          <span>Upload</span>
        </button>

        <button onClick={() => alert("Convert to Panorama clicked")} className="sidebar-btn">
          <FiImage size={24} />
          <span>Convert to Panorama</span>
        </button>
      </nav>
    </div>
  );
}
