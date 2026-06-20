"""
app.py

Flask server for the Ribbon Generator web interface.
Provides API endpoints for generating flow fields and exporting SVG.
"""

from flask import Flask, render_template, request, jsonify, send_file
import io
import xml.etree.ElementTree as ET

app = Flask(__name__)

# A3 size in mm (portrait orientation: width × height)
A3_WIDTH_MM = 297
A3_HEIGHT_MM = 420

# Conversion: mm to pixels at 96 DPI
MM_TO_PX = 96 / 25.4


@app.route('/')
def index():
    """Serve the main UI page."""
    return render_template('index.html')


@app.route('/api/generate', methods=['POST'])
def generate_flowfield():
    """
    Generate flow field paths based on parameters.
    Returns path data for canvas preview.
    
    Request body:
        - noise_scale: Scale of the noise (default: 0.01)
        - num_particles: Number of particles/lines (default: 1000)
        - line_length: Maximum length of each line (default: 200)
        - step_size: Step size for particle movement (default: 1)
        - margin: Margin on all sides in mm (default: 20)
    
    Returns:
        JSON with paths array and canvas dimensions
    """
    data = request.get_json() or {}
    
    # Get parameters with defaults
    noise_scale = float(data.get('noise_scale', 0.01))
    num_particles = int(data.get('num_particles', 1000))
    line_length = float(data.get('line_length', 200))
    step_size = float(data.get('step_size', 1))
    margin = float(data.get('margin', 20))
    width_mm = float(data.get('width_mm', A3_WIDTH_MM))
    height_mm = float(data.get('height_mm', A3_HEIGHT_MM))
    
    # Calculate drawing area (paper size minus margins)
    draw_width = width_mm - 2 * margin
    draw_height = height_mm - 2 * margin
    
    # Return parameters for frontend to generate paths
    # The actual path generation happens in JavaScript for better performance
    return jsonify({
        'success': True,
        'width_mm': width_mm,
        'height_mm': height_mm,
        'draw_width_mm': draw_width,
        'draw_height_mm': draw_height,
        'margin': margin,
        'noise_scale': noise_scale,
        'num_particles': num_particles,
        'line_length': line_length,
        'step_size': step_size
    })


@app.route('/api/export', methods=['POST'])
def export_svg():
    """
    Export flow field paths as SVG file.
    """
    data = request.get_json() or {}
    
    layers = data.get('layers', [])
    stroke_width = float(data.get('stroke_width', 0.4))
    width_mm = float(data.get('width_mm', A3_WIDTH_MM))
    height_mm = float(data.get('height_mm', A3_HEIGHT_MM))
    
    if not layers:
        return jsonify({'error': 'No layers provided'}), 400
    
    # 1. Define the Namespace URI clearly
    NS = 'http://www.w3.org/2000/svg'
    ET.register_namespace('', NS)

    # 2. Create elements using the namespace in the tag name: f'{{{NS}}}tagname'
    svg = ET.Element(f'{{{NS}}}svg')
    svg.set('version', '1.1')
    svg.set('width', f'{width_mm}mm')
    svg.set('height', f'{height_mm}mm')
    svg.set('viewBox', f'0 0 {width_mm} {height_mm}')
    
    # Add style (Correctly Namespaced)
    style = ET.SubElement(svg, f'{{{NS}}}style')
    style.text = f'path {{ fill: none; }}'
    
    for layer in layers:
        layer_name = layer.get('name', 'Layer')
        layer_color = layer.get('color', '#000000')
        paths = layer.get('paths', [])
        
        if not paths:
            continue
        
        # Create Group (Correctly Namespaced)
        group = ET.SubElement(svg, f'{{{NS}}}g')
        group.set('id', layer_name.replace(' ', '-').lower())
        group.set('data-layer-name', layer_name)
        
        for coords in paths:
            if len(coords) < 2:
                continue
            
            d_parts = [f"M {coords[0][0]:.4f},{coords[0][1]:.4f}"]
            for x, y in coords[1:]:
                d_parts.append(f"L {x:.4f},{y:.4f}")
            
            d = " ".join(d_parts)
            
            # Create Path (Correctly Namespaced)
            path_elem = ET.SubElement(group, f'{{{NS}}}path')
            path_elem.set('d', d)
            path_elem.set('stroke', layer_color)
            path_elem.set('stroke-width', f'{stroke_width}mm')
            path_elem.set('fill', 'none')
            path_elem.set('stroke-linecap', 'round')
            path_elem.set('stroke-linejoin', 'round')
    
    ET.indent(svg, space="  ")
    svg_content = ET.tostring(svg, encoding='utf-8', xml_declaration=True)

    return send_file(
        io.BytesIO(svg_content),
        mimetype='image/svg+xml',
        as_attachment=True,
        download_name='flowfield.svg'
    )


if __name__ == '__main__':
    import os
    ribbon_port = 8002
    print("=" * 50)
    print("Ribbon Generator")
    print("=" * 50)
    print(f"\nRunning from: {os.path.abspath(__file__)}")
    print(f"Working directory: {os.getcwd()}")
    print(f"\nStarting server at http://localhost:{ribbon_port}")
    print("Press Ctrl+C to stop\n")
    app.run(host='127.0.0.1', port=ribbon_port, debug=True)

