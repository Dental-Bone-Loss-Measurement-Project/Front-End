from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, FileResponse
import shutil
import uuid
import os

app = FastAPI()

# Assuming your panorama extraction function is defined here
def extract_panorama_from_scan(input_file_path: str, output_file_path: str) -> bool:
    """
    Replace this stub with your actual panorama extraction code.
    Returns True if processing is successful.
    """
    # Your Python code processing the scan and saving the panorama.
    # For example:
    # panorama = your_extraction_function(input_file_path)
    # panorama.save(output_file_path)
    return True

@app.post("/process-scan")
async def process_scan(scan: UploadFile = File(...)):
    # Create a unique file name for the input file
    input_file_name = f"temp_{uuid.uuid4()}_{scan.filename}"
    input_file_path = os.path.join("uploads", input_file_name)
    
    # Save the uploaded file to a temporary location
    try:
        with open(input_file_path, "wb") as buffer:
            shutil.copyfileobj(scan.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to save uploaded file") from e

    # Define output path for panorama
    output_file_name = f"panorama_{uuid.uuid4()}.jpg"
    output_file_path = os.path.join("static", output_file_name)

    # Process the scan to generate the panorama image
    try:
        success = extract_panorama_from_scan(input_file_path, output_file_path)
        if not success:
            raise Exception("Extraction failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Panorama extraction failed") from e
    finally:
        # Optionally remove the temporary file if no longer needed
        os.remove(input_file_path)

    # Return the URL of the extracted panorama image
    # Ensure your server hosts the static files in the /static directory
    image_url = f"http://localhost:8000/static/{output_file_name}"
    return JSONResponse(content={"imageUrl": image_url})
