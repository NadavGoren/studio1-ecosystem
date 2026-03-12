# Flow Field Generator

A Flask web application for generating flow fields using Perlin noise. Export beautiful flow field patterns as SVG files for plotting.

## Features

- **A3 Canvas**: 297mm × 420mm (portrait orientation)
- **Configurable Margins**: Adjustable margins for all sides
- **Stroke Width Control**: Adjustable from 0.1mm to 2.0mm
- **Perlin Noise Flow Field**: Generate organic, flowing patterns
- **SVG Export**: Export generated flow field as SVG for plotting
- **Canvas Preview**: Real-time preview with zoom/pan

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Open your browser to `http://localhost:5000`

## Usage

1. Adjust flow field parameters (noise scale, number of particles, etc.)
2. Set margins and stroke width
3. Click "Generate" to create the flow field
4. Preview on canvas
5. Click "Export SVG" to download the SVG file for plotting

















