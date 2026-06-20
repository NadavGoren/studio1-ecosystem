"""
app.py

Flask server for the Flow Field Generator web interface.
Provides API endpoints for generating flow fields and exporting SVG.
"""

from flask import Flask, render_template, request, jsonify, send_file
import io
import os
import json
import uuid
import re
from datetime import datetime, timezone
import xml.etree.ElementTree as ET

app = Flask(__name__)

# A3 size in mm (portrait orientation: width × height)
A3_WIDTH_MM = 297
A3_HEIGHT_MM = 420

# Conversion: mm to pixels at 96 DPI
MM_TO_PX = 96 / 25.4

# Directory where saved projects live (one JSON file per project)
PROJECTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'projects')

# Fields returned to the project browser (everything except the heavy "state" blob)
PROJECT_META_FIELDS = ('id', 'name', 'createdAt', 'updatedAt', 'thumbnail',
                       'lineCount', 'layerCount')


def _ensure_projects_dir():
    """Make sure the projects directory exists."""
    os.makedirs(PROJECTS_DIR, exist_ok=True)


def _is_valid_project_id(project_id):
    """Only allow ids we generate to avoid path traversal."""
    return bool(re.fullmatch(r'proj-[a-zA-Z0-9]+', project_id or ''))


def _project_path(project_id):
    return os.path.join(PROJECTS_DIR, f'{project_id}.json')


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _read_project(project_id):
    path = _project_path(project_id)
    if not os.path.exists(path):
        return None
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _write_project(project):
    with open(_project_path(project['id']), 'w', encoding='utf-8') as f:
        json.dump(project, f)


def _project_meta(project):
    return {k: project.get(k) for k in PROJECT_META_FIELDS}


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


@app.route('/api/projects', methods=['GET'])
def list_projects():
    """Return metadata (incl. thumbnail) for every saved project, newest first."""
    _ensure_projects_dir()
    projects = []
    for fname in os.listdir(PROJECTS_DIR):
        if not fname.endswith('.json'):
            continue
        try:
            with open(os.path.join(PROJECTS_DIR, fname), 'r', encoding='utf-8') as f:
                data = json.load(f)
            projects.append(_project_meta(data))
        except (json.JSONDecodeError, OSError):
            # Skip corrupt/unreadable files rather than failing the whole list
            continue
    projects.sort(key=lambda p: p.get('updatedAt') or '', reverse=True)
    return jsonify({'projects': projects})


@app.route('/api/projects', methods=['POST'])
def create_project():
    """Create a new saved project from the posted state + thumbnail."""
    _ensure_projects_dir()
    data = request.get_json() or {}
    name = (data.get('name') or 'Untitled').strip() or 'Untitled'
    project_id = 'proj-' + uuid.uuid4().hex[:12]
    now = _now_iso()
    project = {
        'id': project_id,
        'name': name,
        'createdAt': now,
        'updatedAt': now,
        'thumbnail': data.get('thumbnail'),
        'lineCount': data.get('lineCount', 0),
        'layerCount': data.get('layerCount', 0),
        'state': data.get('state') or {},
    }
    _write_project(project)
    return jsonify({'success': True, 'project': _project_meta(project)})


@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    """Return a full project (including state) for loading into the editor."""
    if not _is_valid_project_id(project_id):
        return jsonify({'error': 'Invalid project id'}), 400
    project = _read_project(project_id)
    if project is None:
        return jsonify({'error': 'Project not found'}), 404
    return jsonify(project)


@app.route('/api/projects/<project_id>', methods=['PUT'])
def update_project(project_id):
    """Update an existing project's name/state/thumbnail."""
    if not _is_valid_project_id(project_id):
        return jsonify({'error': 'Invalid project id'}), 400
    project = _read_project(project_id)
    if project is None:
        return jsonify({'error': 'Project not found'}), 404
    data = request.get_json() or {}
    if data.get('name'):
        project['name'] = data['name'].strip()
    if 'state' in data:
        project['state'] = data['state']
    if 'thumbnail' in data:
        project['thumbnail'] = data['thumbnail']
    if 'lineCount' in data:
        project['lineCount'] = data['lineCount']
    if 'layerCount' in data:
        project['layerCount'] = data['layerCount']
    project['updatedAt'] = _now_iso()
    _write_project(project)
    return jsonify({'success': True, 'project': _project_meta(project)})


@app.route('/api/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Delete a saved project."""
    if not _is_valid_project_id(project_id):
        return jsonify({'error': 'Invalid project id'}), 400
    path = _project_path(project_id)
    if os.path.exists(path):
        os.remove(path)
    return jsonify({'success': True})


if __name__ == '__main__':
    print("=" * 50)
    print("Flow Field Generator")
    print("=" * 50)
    print("\nStarting server at http://localhost:8000")
    print("Press Ctrl+C to stop\n")
    
    # Run the Flask development server
    app.run(host='127.0.0.1', port=8000, debug=True)

