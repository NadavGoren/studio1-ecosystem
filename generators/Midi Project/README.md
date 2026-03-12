# MIDI to SVG Converter

A deterministic, production-grade pipeline that converts piano MIDI files into high-quality SVG line art suitable for pen plotters.

## Features

- **Individual notes** rendered as horizontal lines (thickness varies with velocity)
- **Chords** displayed as vertical "pillars" connecting simultaneous notes
- **Sustain pedal** segments shown as hatched vertical bands
- **Energy curve** at the bottom representing musical intensity over time
- **Plotter-friendly** output: only lines, polylines, and stroked shapes (no raster fills)
- **Interactive Web App** with live preview and real-time controls

## Installation

```bash
pip install -r requirements.txt
```

## Web Application (Recommended)

Launch the interactive web app for real-time visualization control:

```bash
python3 app.py
```

Then open **http://localhost:5050** in your browser.

### Web App Features

- **Drag & drop** MIDI files directly into the browser
- **Live preview** with instant updates
- **Visibility toggles** for notes, chords, sustain, energy curve, frame, beat grid, bar markers, time labels
- **Color pickers** for each element + monochrome/blueprint presets
- **Stroke width sliders** for fine control
- **Layout options**: paper size presets (A4/A3/A2/Letter/Tabloid), orientation, margins
- **Sustain styling**: hatch spacing, style (dashed/solid/dotted)
- **Energy curve**: smoothing window, fill lines toggle
- **Export**: Download as SVG or PNG

## Command Line Usage

### Basic

```bash
python3 midi2svg.py input.mid
```

This creates `input.svg` in the same directory.

### Options

```bash
python midi2svg.py input.mid -o output.svg      # Custom output path
python midi2svg.py input.mid --paper a3         # A3 paper size
python midi2svg.py input.mid --paper a4 --portrait  # A4 portrait
python midi2svg.py input.mid --monochrome       # Single color output
python midi2svg.py input.mid -v                 # Verbose output
```

### Paper Sizes

| Preset   | Dimensions (mm)  |
|----------|------------------|
| a4       | 297 × 210        |
| a3       | 420 × 297        |
| a2       | 594 × 420        |
| letter   | 279.4 × 215.9    |
| tabloid  | 431.8 × 279.4    |

### All Options

```
-o, --output PATH       Output SVG file path
--width MM              Canvas width in mm (default: 420)
--height MM             Canvas height in mm (default: 297)
--margin MM             Margin around content (default: 15)
--stroke-width MM       Base stroke width (default: 0.35)
--monochrome            Use black for all elements
--chord-threshold N     Tick threshold for chord detection (default: 10)
--paper SIZE            Paper size preset
--portrait              Use portrait orientation
-v, --verbose           Print detailed information
```

## Output Structure

The SVG contains organized groups:
- `#sustain` - Sustain pedal hatching (rendered first, in background)
- `#notes` - Individual note lines
- `#chords` - Chord pillar lines
- `#energy` - Energy curve and baseline
- `#frame` - Outer frame and separator

## For Pen Plotters

The output is optimized for pen plotters:
- All shapes are strokes (no fills)
- Consistent stroke widths
- Clean, organized paths
- Uses millimeter units

For best results:
1. Use `--monochrome` for single-pen plots
2. Adjust `--stroke-width` based on your pen
3. Match `--paper` to your plotting surface

## Architecture

```
app.py              # Flask web server
midi2svg.py         # CLI entry point
midi_parser.py      # MIDI file parsing and music analysis
svg_renderer.py     # SVG generation (CLI version)
templates/
  index.html        # Web app UI
static/
  app.js            # SVG rendering engine + controls
  style.css         # Dark blueprint styling
```

## Requirements

- Python 3.8+
- mido (MIDI parsing)
- svgwrite (SVG generation for CLI)
- flask (Web application)

