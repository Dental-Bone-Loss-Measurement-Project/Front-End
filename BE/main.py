# main.py
import os
import uuid
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import SimpleITK as sitk
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
    allow_methods=["*"],
    allow_headers=["*"],
)

def convert_mha_to_nifti(input_path: str, output_path: str) -> None:
    """Convert MHA file to NIFTI format using SimpleITK"""
    try:
        image = sitk.ReadImage(input_path)
        sitk.WriteImage(image, output_path)
    except Exception as e:
        raise RuntimeError(f"Conversion failed: {str(e)}")

@app.post("/upload-volume")
async def upload_volume(file: UploadFile = File(...)):
    """Endpoint for uploading and processing MHA volume files"""
    # Generate unique filenames
    file_ext = os.path.splitext(file.filename)[1]
    if file_ext.lower() not in ['.mha', '.mhd']:
        raise HTTPException(status_code=400, detail="Only MHA/MHD files are supported")

    temp_file_name = f"{uuid.uuid4()}{file_ext}"
    temp_file_path = os.path.join(UPLOAD_DIR, temp_file_name)
    nifti_filename = f"{uuid.uuid4()}.nii.gz"
    nifti_path = os.path.join(STATIC_DIR, nifti_filename)

    try:
        # Save uploaded file
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Convert to NIFTI
        convert_mha_to_nifti(temp_file_path, nifti_path)

        # Verify conversion
        if not os.path.exists(nifti_path):
            raise HTTPException(status_code=500, detail="Failed to convert file")

        return JSONResponse(content={
            "volumeUrl": f"/static/{nifti_filename}",
            "message": "Volume uploaded and converted successfully"
        })

    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"message": f"Error processing file: {str(e)}"}
        )

    finally:
        # Cleanup temporary files
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)