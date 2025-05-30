# main.py
import os
import uuid
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import SimpleITK as sitk
import numpy as np
import matplotlib.pyplot as plt
import datetime
import pydicom


# Additional required imports for processing
import cv2
from skimage.morphology import opening, disk, skeletonize
from scipy.signal import find_peaks
from scipy.optimize import curve_fit
from scipy.interpolate import splprep, splev

# Import your panorama extraction module (replace 'pe' with your actual module name if different)
import panorama_extraction as pe

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Configuration
UPLOAD_DIR = "uploads"
STATIC_DIR = "static"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)

# Mount static files directory
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Update with your frontend URL
    allow_credentials=True,
    allow_headers=["*"],
)

def convert_mha_to_nifti(input_path: str, output_path: str) -> None:
    """Convert MHA file to NIFTI format using SimpleITK"""
    try:
        image = sitk.ReadImage(input_path)
        sitk.WriteImage(image, output_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not save the uploaded file") from e

    try:
        # Step 1: Read the image from the uploaded file using SimpleITK
        cbct_image = sitk.ReadImage(temp_file_path)
        
        # Step 2: Convert the SimpleITK image to a NumPy array
        cbct_array = sitk.GetArrayFromImage(cbct_image)
        
        # Generate a coronal maximum intensity projection (MIP)
        coronal_mip = pe.generate_coronal_mip(cbct_array)
        hist, bin_edges = np.histogram(coronal_mip[coronal_mip > 0], bins=256)
        bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
        mean, std_dev, threshold = pe.detect_and_fit_largest_valid_peak(hist, bin_centers)
        binary_mask = coronal_mip > threshold
        
        # Post-process: Morphological operations to remove small noise
        binary_mask = opening(binary_mask, disk(7))
        
        # Compute the Y-Histogram and detect peaks
        y_hist = np.sum(binary_mask, axis=1)
        y_axis = np.arange(len(y_hist))
        peaks, properties = find_peaks(y_hist, height=np.max(y_hist) * 0.5)
        if len(peaks) == 0:  
            raise ValueError("No peaks detected in the Y-Histogram!")
        highest_peak_idx = peaks[np.argmax(y_hist[peaks])]
        highest_peak_value = y_hist[highest_peak_idx]
        
        peak_width = 48  # Define a region around the highest peak for fitting
        fit_mask = (y_axis >= highest_peak_idx - peak_width) & (y_axis <= highest_peak_idx + peak_width)
        
        # Perform Gaussian fitting on the highest peak
        p0 = [highest_peak_value, highest_peak_idx, 10]  # initial guess: amplitude, mean, std_dev
        popt, _ = curve_fit(pe.gaussian, y_axis[fit_mask], y_hist[fit_mask], p0=p0)
        a, mean_t, std_dev_t = popt
        w = 3 * std_dev_t
        
        # Calculate slice range, adjust if more than one peak is detected
        axial_start_index = abs(int(mean_t - 2.5 * w))
        axial_end_index = abs(int(mean_t + 1.5 * w))
        if len(peaks) >= 2:
            sorted_peaks = peaks[np.argsort(y_hist[peaks])[::-1]]
            Eb, Et = sorted_peaks[:2]
            Eb, Et = min(Eb, Et), max(Eb, Et)
            axial_start_index = abs(int(Eb - 2.5 * w))
            axial_end_index = abs(int(Et + 1.5 * w))
        
        # Compute axial indices and plot binary mask (if needed for debugging)
        axial_start, axial_end = pe.compute_axial_indices_and_plot(binary_mask, coronal_mip)
        
        # Process the axial view (MIP) and apply Gaussian blur
        axial_mip = pe.process_cbct(cbct_array)
        axial_mip_blurred = cv2.GaussianBlur(axial_mip, (3, 3), 1.0)
        hist_axial_mip, bin_edges_axial = np.histogram(axial_mip_blurred[axial_mip_blurred > 0], bins=256)
        bin_centers_axial = (bin_edges_axial[:-1] + bin_edges_axial[1:]) / 2
        mean_axial, std_dev_axial, threshold_axial = pe.detect_and_fit_largest_valid_peak(hist_axial_mip, bin_centers_axial)
        
        # Create a binary mask for the axial view and process jaws/teeth
        binary_mask_axial = (axial_mip_blurred > threshold_axial).astype(np.uint8)
        smoothed_teeth_jaw_mask = pe.process_jaws_and_teeth(binary_mask_axial)
        
        # Extract the skeleton from the processed mask
        skeleton = skeletonize(smoothed_teeth_jaw_mask).astype(np.uint8) * 255
        
        # Detect branch points and endpoints in the skeleton
        kernel = np.ones((3, 3), dtype=np.uint8)
        branch_points = np.zeros_like(skeleton)
        end_points = np.zeros_like(skeleton)
        for i in range(1, skeleton.shape[0] - 1):
            for j in range(1, skeleton.shape[1] - 1):
                if skeleton[i, j] == 255:
                    neighbors = np.sum(skeleton[i - 1:i + 2, j - 1:j + 2] == 255)
                    if neighbors > 3:
                        branch_points[i, j] = 255
                    elif neighbors == 2:
                        end_points[i, j] = 255
        # Remove branch points from the skeleton
        skeleton[branch_points == 255] = 0

        # Get the coordinates of the skeleton pixels and sort them by x-axis
        skeleton_coords = np.column_stack(np.where(skeleton > 0))
        skeleton_coords = skeleton_coords[np.argsort(skeleton_coords[:, 1])]

        # Select insertion points for cubic B-spline fitting
        num_insertion_points = 5  # adjust to control number of points on the B-spline curve
        x_min, x_max = np.min(skeleton_coords[:, 1]), np.max(skeleton_coords[:, 1])
        insertion_x = np.linspace(x_min, x_max, num_insertion_points).astype(int)
        insertion_points = []
        for x in insertion_x:
            nearby_points = skeleton_coords[np.abs(skeleton_coords[:, 1] - x) <= 1]
            if len(nearby_points) > 0:
                avg_y = np.mean(nearby_points[:, 0])
                insertion_points.append([avg_y, x])
        insertion_points = np.array(insertion_points)

        # Fit a B-spline curve to the insertion points
        x, y = insertion_points[:, 1], insertion_points[:, 0]
        tck, u = splprep([x, y], s=0, k=2)  # s=0 forces interpolation, k=2 for quadratic (adjust k=3 for cubic if desired)
        u_fine = np.linspace(0, 1, 750)  # adjust for the desired panorama width
        spline_x, spline_y = splev(u_fine, tck)

        # Extract the panoramic view using the fitted B-spline curve
        panoramic_view = pe.extract_panoramic_view(cbct_array, spline_x, spline_y)

        # (Optional) Save the panoramic view as a JPEG image to serve later in the UI
        output_filename = f"panorama_{uuid.uuid4()}.jpg"
        output_file_path = os.path.join(STATIC_DIR, output_filename)
        plt.imshow(panoramic_view, cmap="gray")
        plt.title("Panoramic View of CBCT")
        plt.axis("off")
        plt.savefig(output_file_path, bbox_inches="tight", pad_inches=0)
        plt.close()

        # Prepare response with image shape and the URL to the panoramic view
        response_data = {
            "imageShape": cbct_array.shape,  # (Depth, Height, Width)
            "panoramicViewUrl": f"http://localhost:8000/static/{output_filename}"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail="Image processing failed") from e
    finally:
        # Clean up the temporary uploaded file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

    return JSONResponse(content=response_data)


def create_dicom_directory() -> str:
    """Create a unique directory for DICOM files"""
    dicom_dir_name = f"dicom_{uuid.uuid4()}"
    dicom_dir_path = os.path.join(STATIC_DIR, dicom_dir_name)
    os.makedirs(dicom_dir_path, exist_ok=True)
    return dicom_dir_name, dicom_dir_path

# # --- NEW Endpoint for 3D Volume Upload ---
# # This endpoint handles uploading a 3D medical volume file directly.
# # --- Modified Endpoint for MHA to DICOM Conversion ---
# @app.post("/upload-volume")
# async def upload_volume(file: UploadFile = File(...)):
#     try:
#         # Validate file type
#         if not file.filename.lower().endswith(('.mha', '.mhd')):
#             raise HTTPException(400, "Only MHA/MHD files are supported")

#         # Create temporary file path
#         temp_file_name = f"{uuid.uuid4()}_{file.filename}"
#         temp_file_path = os.path.join(UPLOAD_DIR, temp_file_name)
        
#         # Create DICOM directory
#         dicom_dir_name, dicom_dir_path = create_dicom_directory()
        
#         # Save uploaded file
#         with open(temp_file_path, "wb") as buffer:
#             shutil.copyfileobj(file.file, buffer)
        
#         try:
#             # Read MHA file
#             image = sitk.ReadImage(temp_file_path)
#             array = sitk.GetArrayFromImage(image)
            
#             # Get metadata
#             spacing = image.GetSpacing()  # (z, y, x)
#             origin = image.GetOrigin()    # (x, y, z)
#             direction = image.GetDirection()
            
#             # Generate consistent UIDs
#             study_uid = pydicom.uid.generate_uid()
#             series_uid = pydicom.uid.generate_uid()
            
#             # Create DICOM files for each slice
#             dicom_files: list[str] = []
#             direction_matrix = np.array(direction).reshape(3, 3)
            
#             for z in range(array.shape[0]):
#                 # Create DICOM dataset
#                 ds = pydicom.Dataset()
                
#                 # Patient/Study/Series info
#                 ds.PatientName = "Anonymous"
#                 ds.PatientID = "Unknown"
#                 ds.StudyInstanceUID = study_uid
#                 ds.SeriesInstanceUID = series_uid
#                 ds.SOPInstanceUID = pydicom.uid.generate_uid()
#                 ds.SOPClassUID = "1.2.840.10008.5.1.4.1.1.2"  # CT Image Storage
#                 ds.Modality = "CT"
                
#                 # Image geometry
#                 ds.PixelSpacing = [str(spacing[2]), str(spacing[1])]  # x,y spacing
#                 ds.SliceThickness = str(spacing[0])
#                 ds.ImagePositionPatient = [
#                     str(origin[0] + z * direction_matrix[0][2] * spacing[0]),
#                     str(origin[1] + z * direction_matrix[1][2] * spacing[0]),
#                     str(origin[2] + z * direction_matrix[2][2] * spacing[0])
#                 ]
#                 ds.ImageOrientationPatient = [
#                     str(direction_matrix[0][0]), str(direction_matrix[0][1]),
#                     str(direction_matrix[1][0]), str(direction_matrix[1][1]),
#                     str(direction_matrix[2][0]), str(direction_matrix[2][1])
#                 ]
                
#                 # Image parameters
#                 ds.Rows = array.shape[2]
#                 ds.Columns = array.shape[1]
#                 ds.SamplesPerPixel = 1
#                 ds.PhotometricInterpretation = "MONOCHROME2"
#                 ds.BitsAllocated = 16
#                 ds.BitsStored = 16
#                 ds.HighBit = 15
#                 ds.PixelRepresentation = 0
                
#                 # Pixel data
#                 slice_data = array[z].astype(np.float32)
#                 if slice_data.max() > 0:
#                     slice_data = ((slice_data - slice_data.min()) / 
#                                 (slice_data.max() - slice_data.min()) * 65535)
#                 pixel_data = slice_data.astype(np.uint16).tobytes()
#                 ds.PixelData = pixel_data
                
#                 # Metadata
#                 ds.ContentDate = datetime.datetime.now().strftime('%Y%m%d')
#                 ds.ContentTime = datetime.datetime.now().strftime('%H%M%S.%f')
#                 ds.StudyDate = ds.ContentDate
#                 ds.StudyTime = ds.ContentTime
#                 ds.SeriesDate = ds.ContentDate
#                 ds.SeriesTime = ds.ContentTime
                
#                 # File metadata
#                 ds.file_meta = pydicom.Dataset()
#                 ds.file_meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian
#                 ds.file_meta.MediaStorageSOPClassUID = ds.SOPClassUID
#                 ds.file_meta.MediaStorageSOPInstanceUID = ds.SOPInstanceUID
                
#                 # Save DICOM file
#                 filename = f"slice_{z:04d}.dcm"
#                 file_path = os.path.join(dicom_dir_path, filename)
#                 ds.save_as(file_path, write_like_original=False)
#                 dicom_files.append(filename)
            
#             return JSONResponse(content={
#                 "dicomBaseUrl": f"/static/{dicom_dir_name}/",
#                 "seriesInstanceUID": series_uid,
#                 "studyInstanceUID": study_uid,
#                 "sliceCount": len(dicom_files),
#                 "dimensions": {
#                     "x": array.shape[2],
#                     "y": array.shape[1],
#                     "z": array.shape[0]
#                 }
#             })
            
#         except Exception as e:
#             raise HTTPException(500, f"DICOM conversion failed: {str(e)}")
            
#         finally:
#             if os.path.exists(temp_file_path):
#                 os.remove(temp_file_path)
                
#     except Exception as e:
#         raise HTTPException(500, f"Processing failed: {str(e)}")



@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)