import os
import tempfile
from flask import Flask, jsonify, request
from flask_cors import CORS
from generators.density_flow import generate_density_flow
from generators.pixel_hatch import generate_pixel_hatch

app = Flask(__name__)
CORS(app)

def _parse_int(value, default):
    try: return int(float(value))
    except: return default

def _parse_float(value, default):
    try: return float(value)
    except: return default

@app.route("/generate", methods=["POST"])
def generate():
    image_file = request.files.get("image")
    if not image_file: return jsonify({"error": "No image"}), 400

    try:
        mode = request.form.get("generatorMode", "flow")
        margin = _parse_float(request.form.get("margin"), 20)
        rotation = _parse_int(request.form.get("rotation"), 0)
        fit = request.form.get("fitMode", "cover")
        stroke = _parse_float(request.form.get("strokeWidth"), 0.3)
        contrast = _parse_float(request.form.get("contrast"), 200)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            tmp.write(image_file.read())
            tmp_path = tmp.name

        if mode == "hatch":
            grid = _parse_float(request.form.get("gridSize"), 10)
            angle = _parse_float(request.form.get("hatchAngle"), 45)
            
            # --- CRITICAL: Parse Boolean String ---
            show_grid_str = request.form.get("showGrid", "true")
            show_grid = show_grid_str.lower() == "true"
            
            svg = generate_pixel_hatch(
                tmp_path, margin, rotation, fit, 
                grid, contrast, stroke, angle, 
                show_grid=show_grid
            )
        else:
            count = _parse_int(request.form.get("lineCount"), 4000)
            length = _parse_int(request.form.get("lineLength"), 100)
            blur = _parse_int(request.form.get("blurRadius"), 21)
            svg = generate_density_flow(tmp_path, margin, rotation, fit, stroke, count, length, blur, contrast)

        return jsonify({"svg": svg})
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        if 'tmp_path' in locals(): os.remove(tmp_path)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5500, debug=True)