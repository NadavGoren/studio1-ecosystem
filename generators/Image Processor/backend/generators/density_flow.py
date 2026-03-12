"""
Density-based flow field generator (contour-aligned).
Includes "Smart Physics" to scale resolution and line count based on pen width.
"""

import cv2
import numpy as np
import svgwrite
import math

def generate_density_flow(
    image_path,
    margin_mm,
    rotation=0,
    fit_mode="cover",
    stroke_width=0.3,
    line_count=4000,
    line_length=100,
    blur_radius=21,
    contrast=200,
):
    # --- 1. CONFIGURATION & PHYSICS ---
    A3_WIDTH_MM = 297
    A3_HEIGHT_MM = 420
    
    # Validate inputs
    stroke_width = max(0.05, float(stroke_width))
    
    # A. SMART RESOLUTION
    # Thinner pen = Higher grid resolution to capture details.
    # 0.1mm -> 10 px/mm. 1.0mm -> 1 px/mm.
    # We cap it at 1.0 (lowest res) to avoid issues with thick pens.
    PIXELS_PER_MM = max(1.0, 1.0 / stroke_width)
    
    # B. AUTO-DENSITY SCALING (Crucial for "Detail")
    # If the pen is thin (e.g. 0.1mm), we need MORE lines to see the image.
    # We normalize around a standard 0.3mm pen.
    # Example: 0.1mm pen gets 3x lines. 0.6mm pen gets 0.5x lines.
    density_multiplier = 0.3 / stroke_width
    effective_line_count = int(line_count * density_multiplier)
    
    print_width_mm = A3_WIDTH_MM - (margin_mm * 2)
    print_height_mm = A3_HEIGHT_MM - (margin_mm * 2)
    
    target_w = max(1, int(print_width_mm * PIXELS_PER_MM))
    target_h = max(1, int(print_height_mm * PIXELS_PER_MM))
    
    # --- 2. IMAGE PROCESSING ---
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise ValueError("Unable to read image")
        
    # Rotation
    rotation = rotation % 360
    if rotation == 90:
        img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif rotation == 180:
        img = cv2.rotate(img, cv2.ROTATE_180)
    elif rotation == 270:
        img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
        
    # Fit / Cover Logic
    img_h, img_w = img.shape
    aspect_img = img_w / img_h
    aspect_target = target_w / target_h
    
    is_cover = (fit_mode == 'cover')
    if (is_cover and aspect_img > aspect_target) or (not is_cover and aspect_img < aspect_target):
        scale = target_h / img_h
    else:
        scale = target_w / img_w
        
    new_w = max(1, int(img_w * scale))
    new_h = max(1, int(img_h * scale))
    img_resized = cv2.resize(img, (new_w, new_h))
    
    # Canvas Placement
    canvas = np.full((target_h, target_w), 255, dtype=np.uint8)
    y_offset = (target_h - new_h) // 2
    x_offset = (target_w - new_w) // 2
    
    y1, y2 = max(0, -y_offset), min(new_h, target_h - y_offset)
    x1, x2 = max(0, -x_offset), min(new_w, target_w - x_offset)
    target_y1 = max(0, y_offset)
    target_x1 = max(0, x_offset)
    
    canvas[target_y1:target_y1+(y2-y1), target_x1:target_x1+(x2-x1)] = img_resized[y1:y2, x1:x2]
    
    # --- 3. FLOW FIELD GENERATION ---
    blur_rad = int(blur_radius)
    if blur_rad < 1: blur_rad = 1
    if blur_rad % 2 == 0: blur_rad += 1
    
    blurred = cv2.GaussianBlur(canvas, (blur_rad, blur_rad), 0)
    sobelx = cv2.Sobel(blurred, cv2.CV_64F, 1, 0, ksize=5)
    sobely = cv2.Sobel(blurred, cv2.CV_64F, 0, 1, ksize=5)
    angles = np.arctan2(sobely, sobelx) + (math.pi / 2)
    
    # --- 4. PARTICLE SYSTEM ---
    lines = []
    # Step size matches pen resolution so traces are consistent
    step_size = 0.5 * PIXELS_PER_MM
    num_steps = max(1, int(line_length))
    contrast_cutoff = int(contrast)
    
    # Use the Calculated Effective Count
    for _ in range(effective_line_count):
        px = np.random.randint(0, target_w)
        py = np.random.randint(0, target_h)
        
        path = []
        for _ in range(num_steps):
            if not (0 <= px < target_w and 0 <= py < target_h):
                break
                
            if canvas[int(py), int(px)] > contrast_cutoff:
                break
                
            path.append((px, py))
            
            angle = angles[int(py), int(px)]
            px += math.cos(angle) * step_size
            py += math.sin(angle) * step_size
            
        if len(path) > 5:
            lines.append(path)
            
    # --- 5. SVG EXPORT ---
    dwg = svgwrite.Drawing(size=(f"{A3_WIDTH_MM}mm", f"{A3_HEIGHT_MM}mm"), profile='tiny')
    dwg.viewbox(0, 0, A3_WIDTH_MM, A3_HEIGHT_MM)
    
    # FIXED: Unitless stroke_width for correct preview scaling
    # We pass the raw float number. The browser interprets this as "units", 
    # and since our viewbox matches the physical mm, it scales correctly.
    group = dwg.g(stroke="black", fill="none", stroke_width=stroke_width)
    
    for path in lines:
        mm_path = []
        for (px, py) in path:
            mm_x = (px / PIXELS_PER_MM) + margin_mm
            mm_y = (py / PIXELS_PER_MM) + margin_mm
            mm_path.append((round(mm_x, 3), round(mm_y, 3)))
        group.add(dwg.polyline(mm_path))
        
    dwg.add(group)
    return dwg.tostring()