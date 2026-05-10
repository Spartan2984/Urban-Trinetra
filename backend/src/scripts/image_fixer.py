import cv2
import numpy as np
import os

def create_fixed_version(input_path, output_path):
    img = cv2.imread(input_path)
    if img is None:
        print("Error: Could not load image")
        return

    # Make the patch larger and more distinct
    h, w, _ = img.shape
    start_point = (int(w * 0.3), int(h * 0.5))
    end_point = (int(w * 0.7), int(h * 0.9))
    color = (50, 55, 58) # Darker asphalt
    
    fixed_img = img.copy()
    overlay = fixed_img.copy()
    cv2.rectangle(overlay, start_point, end_point, color, -1)
    
    alpha = 0.85
    cv2.addWeighted(overlay, alpha, fixed_img, 1 - alpha, 0, fixed_img)
    
    patch = fixed_img[start_point[1]:end_point[1], start_point[0]:end_point[0]]
    # Add significant noise to simulate asphalt texture
    noise = np.random.normal(0, 15, patch.shape).astype(np.uint8)
    fixed_img[start_point[1]:end_point[1], start_point[0]:end_point[0]] = cv2.add(patch, noise)

    # Add a thin white border to the patch to represent road marking paint or boundary
    cv2.rectangle(fixed_img, start_point, end_point, (200, 200, 200), 2)


    cv2.imwrite(output_path, fixed_img)
    print("Generated fixed image")

input_img = os.path.abspath("../images/abdullah-wafiyy-UkqwLshDGBY-unsplash.jpg")
output_img = os.path.abspath("../images/fixed_abdullah.jpg")
create_fixed_version(input_img, output_img)
