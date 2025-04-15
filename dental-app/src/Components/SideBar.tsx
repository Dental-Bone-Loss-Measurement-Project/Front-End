import { FiUpload, FiImage } from "react-icons/fi";
import { useNavigate } from 'react-router-dom';
import "./sidebar.css";

export function SideBar() {
  const navigate = useNavigate();

  return (
    <div className="sidebar sidebar-open">
      <nav className="sidebar-nav">
        <button onClick={() => alert("Upload clicked")} className="sidebar-btn">
          <FiUpload size={24} />
          <span>Upload</span>
        </button>

        <button
          onClick={() => navigate('/convert')}
          className="sidebar-btn"
        >
          <FiImage size={24} />
          <span>Convert to Panorama</span>
        </button>
      </nav>
    </div>
  );
}
