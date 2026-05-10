from fastapi import FastAPI, UploadFile, File, HTTPException
import cv2
import numpy as np
from skimage.metrics import structural_similarity as ssim
import uvicorn
from pydantic import BaseModel

app = FastAPI(title="FixCity AI Verification Service")

class VerificationResponse(BaseModel):
    match_score: float
    verified: bool
    message: str

def calculate_similarity(img1_bytes, img2_bytes):
    # Decode images
    npimg1 = np.frombuffer(img1_bytes, np.uint8)
    npimg2 = np.frombuffer(img2_bytes, np.uint8)
    
    img1 = cv2.imdecode(npimg1, cv2.IMREAD_COLOR)
    img2 = cv2.imdecode(npimg2, cv2.IMREAD_COLOR)
    
    if img1 is None or img2 is None:
        raise ValueError("Invalid image data")

    # Resize to the same dimensions
    img1 = cv2.resize(img1, (640, 480))
    img2 = cv2.resize(img2, (640, 480))
    
    # Convert to grayscale
    gray1 = cv2.cvtColor(img1, cv2.COLOR_BGR2GRAY)
    gray2 = cv2.cvtColor(img2, cv2.COLOR_BGR2GRAY)
    
    # Compute SSIM
    score, _ = ssim(gray1, gray2, full=True)
    return score

@app.post("/verify", response_model=VerificationResponse)
async def verify_resolution(before: UploadFile = File(...), after: UploadFile = File(...)):
    try:
        before_bytes = await before.read()
        after_bytes = await after.read()
        
        # Calculate Structural Similarity
        score = calculate_similarity(before_bytes, after_bytes)
        
        # We expect some change (the issue being resolved), but overall context (background) should be similar.
        # SSIM closer to 1 means identical. 
        # A valid resolution should have a moderate SSIM (e.g., between 0.45 and 0.85)
        # If it's too high (> 0.90), no work was done.
        # If it's too low (< 0.45), it might be a completely different place or context.
        
        verified = 0.45 <= score <= 0.90
        
        if verified:
            message = "Images verified. Context matches and changes detected."
        else:
            if score > 0.90:
                message = "Images are too similar. It appears no work was done."
            else:
                message = "Images are completely different. Background context does not match."
                
        return VerificationResponse(match_score=score, verified=verified, message=message)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing images: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
