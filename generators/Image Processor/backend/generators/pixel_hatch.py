"""
Pixel Hatch generator (Slicer Style).
"""
import cv2
import numpy as np
import svgwrite
import math

def generate_pixel_hatch(
    image_path,
    margin_mm,
    rotation=0,
    fit_mode="cover",
    grid_size_mm=10,
    contrast=1.0,
    stroke_width=0.3,
    hatch_angle=45,
    show_grid=True,
):
    # --- 1. CONFIGURATION ---
    A3_WIDTH_MM = 297
    A3_HEIGHT_MM = 420
    
    print_w = A3_WIDTH_MM - (margin_mm * 2)
    print_h = A3_HEIGHT_MM - (margin_mm * 2)
    
    cols = max(1, int(print_w / grid_size_mm))
    rows = max(1, int(print_h / grid_size_mm))
    
    cell_w = print_w / cols
    cell_h = print_h / rows
    
    # --- 2. IMAGE PROCESSING ---
    img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
    
    if rotation == 90: img = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    elif rotation == 180: img = cv2.rotate(img, cv2.ROTATE_180)
    elif rotation == 270: img = cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE)
        
    img_h, img_w = img.shape
    aspect_img = img_w / img_h
    aspect_target = cols / rows 
    
    is_cover = (fit_mode == 'cover')
    if (is_cover and aspect_img > aspect_target) or (not is_cover and aspect_img < aspect_target):
        scale = rows / img_h
    else:
        scale = cols / img_w
        
    new_w, new_h = int(img_w * scale), int(img_h * scale)
    img_resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
    
    grid_data = np.full((rows, cols), 255, dtype=np.uint8)
    y_off, x_off = (rows - new_h) // 2, (cols - new_w) // 2
    
    y1, y2 = max(0, -y_off), min(new_h, rows - y_off)
    x1, x2 = max(0, -x_off), min(new_w, cols - x_off)
    grid_data[max(0, y_off):max(0, y_off)+(y2-y1), max(0, x_off):max(0, x_off)+(x2-x1)] = img_resized[y1:y2, x1:x2]

    # --- 3. DRAWING ---
    dwg = svgwrite.Drawing(size=(f"{A3_WIDTH_MM}mm", f"{A3_HEIGHT_MM}mm"), profile='tiny')
    dwg.viewbox(0, 0, A3_WIDTH_MM, A3_HEIGHT_MM)
    group = dwg.g(stroke="black", fill="none", stroke_width=stroke_width)

    # A. GRID LINES (Conditional)
    if show_grid:
        for r in range(rows + 1):
            y = margin_mm + r * cell_h
            group.add(dwg.line((margin_mm, y), (A3_WIDTH_MM - margin_mm, y)))
        for c in range(cols + 1):
            x = margin_mm + c * cell_w
            group.add(dwg.line((x, margin_mm), (x, A3_HEIGHT_MM - margin_mm)))

    # B. HATCH INFILL
    rads = math.radians(hatch_angle)
    nx, ny = -math.sin(rads), math.cos(rads)
    dx, dy = math.cos(rads), math.sin(rads)

    for r in range(rows):
        for c in range(cols):
            brightness = grid_data[r, c]
            if brightness > 250: continue
            
            darkness = 1.0 - (brightness / 255.0)
            darkness = np.clip(darkness * contrast, 0, 1)
            if darkness < 0.05: continue 

            min_spacing = float(stroke_width) * 1.5
            max_spacing = min(cell_w, cell_h)
            spacing = max_spacing - (darkness * (max_spacing - min_spacing))
            
            x0 = margin_mm + c * cell_w
            y0 = margin_mm + r * cell_h
            x1, y1 = x0 + cell_w, y0 + cell_h
            
            corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
            projections = [p[0]*nx + p[1]*ny for p in corners]
            min_p, max_p = min(projections), max(projections)
            start_p = min_p + spacing/2
            
            segments = []
            curr_p = start_p
            while curr_p < max_p:
                intersections = []
                if abs(ny) > 1e-9:
                    iy = (curr_p - x0 * nx) / ny
                    if y0 <= iy <= y1: intersections.append((x0, iy))
                    iy = (curr_p - x1 * nx) / ny
                    if y0 <= iy <= y1: intersections.append((x1, iy))
                if abs(nx) > 1e-9:
                    ix = (curr_p - y0 * ny) / nx
                    if x0 <= ix <= x1: intersections.append((ix, y0))
                    ix = (curr_p - y1 * ny) / nx
                    if x0 <= ix <= x1: intersections.append((ix, y1))
                
                unique = []
                for p in intersections:
                    if not any(math.hypot(p[0]-u[0], p[1]-u[1]) < 0.01 for u in unique):
                        unique.append(p)
                
                if len(unique) == 2:
                    unique.sort(key=lambda p: p[0]*dx + p[1]*dy)
                    segments.append(unique)
                curr_p += spacing

            if segments:
                zig = []
                for i, seg in enumerate(segments):
                    if i % 2 == 0: zig.extend([seg[0], seg[1]])
                    else: zig.extend([seg[1], seg[0]])
                
                rounded = [(round(p[0], 3), round(p[1], 3)) for p in zig]
                group.add(dwg.polyline(rounded))

    dwg.add(group)
    return dwg.tostring()