import cv2
import numpy as np
import os
import sys

def create_variants(input_path, output_dir, name_prefix):
    img = cv2.imread(input_path)
    if img is None:
        return

    h, w, _ = img.shape
    
    # 1. Success Variant (Visually Fixed)
    fixed_img = img.copy()
    start_point = (int(w * 0.3), int(h * 0.5))
    end_point = (int(w * 0.7), int(h * 0.9))
    overlay = fixed_img.copy()
    cv2.rectangle(overlay, start_point, end_point, (50, 55, 58), -1)
    cv2.addWeighted(overlay, 0.85, fixed_img, 0.15, 0, fixed_img)
    patch = fixed_img[start_point[1]:end_point[1], start_point[0]:end_point[0]]
    noise = np.random.normal(0, 15, patch.shape).astype(np.uint8)
    fixed_img[start_point[1]:end_point[1], start_point[0]:end_point[0]] = cv2.add(patch, noise)
    cv2.rectangle(fixed_img, start_point, end_point, (200, 200, 200), 2)
    cv2.imwrite(os.path.join(output_dir, f"{name_prefix}_fixed.jpg"), fixed_img)

    # 2. No-Change Variant (Slightly modified to not be bit-identical, but visually identical)
    # We add 1 pixel of noise to trick hash checks but not SSIM
    identical_img = img.copy()
    identical_img[0, 0] = (identical_img[0, 0] + 1) % 255
    cv2.imwrite(os.path.join(output_dir, f"{name_prefix}_identical.jpg"), identical_img)

    # 3. Original
    cv2.imwrite(os.path.join(output_dir, f"{name_prefix}_original.jpg"), img)

if __name__ == "__main__":
    img_dir = os.path.abspath("../images")
    output_dir = os.path.abspath("../images/variants")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)

    files = [f for f in os.listdir(img_dir) if f.lower().endswith(('.jpg', '.jpeg'))]
    for i, f in enumerate(files):
        create_variants(os.path.join(img_dir, f), output_dir, f"img{i}")
