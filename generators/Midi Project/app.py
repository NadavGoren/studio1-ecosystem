#!/usr/bin/env python3
"""
MIDI to SVG Web Application
Flask server for interactive MIDI visualization.
"""

import os
import tempfile
from flask import Flask, render_template, request, jsonify

from midi_parser import parse_midi
from svg_renderer import render_flow_field, RenderConfig

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size


@app.route('/')
def index():
    """Serve the main application page."""
    return render_template('index.html')


@app.route('/parse', methods=['POST'])
def parse_midi_file():
    """
    Parse an uploaded MIDI file and return JSON data.
    
    Expects a multipart/form-data POST with:
    - file: The MIDI file
    - chord_threshold: (optional) Tick threshold for chord detection
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    # Get optional parameters
    chord_threshold = request.form.get('chord_threshold', 10, type=int)
    
    # Save to temporary file and parse
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mid') as tmp:
            file.save(tmp.name)
            tmp_path = tmp.name
        
        # Parse the MIDI file
        midi_data = parse_midi(tmp_path, chord_threshold_ticks=chord_threshold)
        
        # Clean up temp file
        os.unlink(tmp_path)
        
        # Return JSON response
        return jsonify({
            'success': True,
            'filename': file.filename,
            'data': midi_data.to_json()
        })
    
    except Exception as e:
        # Clean up temp file on error
        if 'tmp_path' in locals():
            try:
                os.unlink(tmp_path)
            except:
                pass
        return jsonify({'error': str(e)}), 500


@app.route('/render', methods=['POST'])
def render_svg():
    """
    Render MIDI data to SVG using specified style.
    
    Expects JSON POST with:
    - data: MIDI data (from /parse endpoint)
    - style: Rendering style ('flow_field' or 'default')
    - config: (optional) Rendering configuration
    """
    try:
        data_json = request.json
        if not data_json or 'data' not in data_json:
            return jsonify({'error': 'No MIDI data provided'}), 400
        
        style = data_json.get('style', 'default')
        
        # Reconstruct MidiData from JSON
        from midi_parser import MidiData, Note, Chord, SustainSegment, EnergyPoint
        
        midi_data_dict = data_json['data']
        notes = [Note(**n) for n in midi_data_dict['notes']]
        
        # Reconstruct chords
        chords = []
        for c in midi_data_dict.get('chords', []):
            chord_notes = [n for n in notes if n.pitch in c.get('note_pitches', [])]
            chord = Chord(start_tick=c['start_tick'], notes=chord_notes)
            chords.append(chord)
        
        # Reconstruct sustain segments
        sustain_segments = [SustainSegment(**s) for s in midi_data_dict.get('sustain_segments', [])]
        
        # Reconstruct energy curve
        energy_curve = [EnergyPoint(**e) for e in midi_data_dict.get('energy_curve', [])]
        
        midi_data = MidiData(
            ticks_per_beat=midi_data_dict['ticks_per_beat'],
            total_ticks=midi_data_dict['total_ticks'],
            tempo_us=midi_data_dict['tempo_us'],
            notes=notes,
            chords=chords,
            sustain_segments=sustain_segments,
            energy_curve=energy_curve
        )
        
        # Get config from request or use defaults
        config_dict = data_json.get('config', {})
        config = RenderConfig(
            width_mm=config_dict.get('width', 420.0),
            height_mm=config_dict.get('height', 297.0),
            margin_mm=config_dict.get('margin', 15.0),
            stroke_width=config_dict.get('stroke_width', 0.35),
            note_color=config_dict.get('note_color', '#1a1a2e'),
            frame_color=config_dict.get('frame_color', '#1a1a2e')
        )
        
        # Render based on style
        if style == 'flow_field':
            drawing = render_flow_field(midi_data, config)
        else:
            # Fallback to default renderer
            from svg_renderer import render_svg
            drawing = render_svg(midi_data, config)
        
        # Convert to SVG string
        svg_string = drawing.tostring()
        
        return jsonify({
            'success': True,
            'svg': svg_string
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'})


if __name__ == '__main__':
    print("Starting MIDI to SVG Web Application...")
    print("Open http://localhost:5050 in your browser")
    app.run(debug=True, host='0.0.0.0', port=5050)

