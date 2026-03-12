#!/usr/bin/env python3
"""
MIDI to SVG Converter
=====================

Converts piano MIDI files into high-quality SVG line art suitable for pen plotters.

Features:
- Individual notes as horizontal lines
- Chords as vertical "pillars"
- Sustain pedal segments as shaded vertical bands
- Global energy curve along the bottom

Usage:
    python midi2svg.py input.mid [-o output.svg] [--width 420] [--height 297]
"""

import argparse
import sys
from pathlib import Path

from midi_parser import parse_midi
from svg_renderer import render_svg, save_svg, RenderConfig


def main():
    parser = argparse.ArgumentParser(
        description="Convert piano MIDI files to plotter-friendly SVG visualizations.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s piano.mid
    %(prog)s piano.mid -o visualization.svg
    %(prog)s piano.mid --width 594 --height 420 --margin 20
    %(prog)s piano.mid --monochrome
        """
    )
    
    parser.add_argument(
        "input",
        type=Path,
        help="Input MIDI file path"
    )
    
    parser.add_argument(
        "-o", "--output",
        type=Path,
        default=None,
        help="Output SVG file path (default: input_name.svg)"
    )
    
    # Canvas dimensions
    parser.add_argument(
        "--width",
        type=float,
        default=420.0,
        help="Canvas width in mm (default: 420, A3)"
    )
    
    parser.add_argument(
        "--height",
        type=float,
        default=297.0,
        help="Canvas height in mm (default: 297, A3)"
    )
    
    parser.add_argument(
        "--margin",
        type=float,
        default=15.0,
        help="Margin around content in mm (default: 15)"
    )
    
    # Visual options
    parser.add_argument(
        "--stroke-width",
        type=float,
        default=0.35,
        help="Base stroke width in mm (default: 0.35)"
    )
    
    parser.add_argument(
        "--monochrome",
        action="store_true",
        help="Use single color (black) for all elements"
    )
    
    # Chord detection
    parser.add_argument(
        "--chord-threshold",
        type=int,
        default=10,
        help="Maximum tick difference for chord detection (default: 10)"
    )
    
    # Paper size presets
    parser.add_argument(
        "--paper",
        choices=["a4", "a3", "a2", "letter", "tabloid"],
        default=None,
        help="Paper size preset (overrides --width and --height)"
    )
    
    parser.add_argument(
        "--portrait",
        action="store_true",
        help="Use portrait orientation (default: landscape)"
    )
    
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Print detailed information"
    )
    
    args = parser.parse_args()
    
    # Validate input file
    if not args.input.exists():
        print(f"Error: Input file not found: {args.input}", file=sys.stderr)
        sys.exit(1)
    
    # Determine output path
    output_path = args.output
    if output_path is None:
        output_path = args.input.with_suffix(".svg")
    
    # Apply paper size presets
    paper_sizes = {
        "a4": (297, 210),
        "a3": (420, 297),
        "a2": (594, 420),
        "letter": (279.4, 215.9),
        "tabloid": (431.8, 279.4),
    }
    
    width = args.width
    height = args.height
    
    if args.paper:
        width, height = paper_sizes[args.paper]
    
    if args.portrait:
        width, height = height, width
    
    # Configure renderer
    config = RenderConfig(
        width_mm=width,
        height_mm=height,
        margin_mm=args.margin,
        stroke_width=args.stroke_width,
    )
    
    if args.monochrome:
        config.note_color = "#000000"
        config.chord_color = "#000000"
        config.sustain_color = "#000000"
        config.energy_color = "#000000"
        config.frame_color = "#000000"
    
    # Parse MIDI
    if args.verbose:
        print(f"Parsing MIDI file: {args.input}")
    
    try:
        midi_data = parse_midi(str(args.input), chord_threshold_ticks=args.chord_threshold)
    except Exception as e:
        print(f"Error parsing MIDI file: {e}", file=sys.stderr)
        sys.exit(1)
    
    if args.verbose:
        print(f"  Duration: {midi_data.duration_seconds:.1f} seconds")
        print(f"  Notes: {len(midi_data.notes)}")
        print(f"  Chords detected: {len(midi_data.chords)}")
        print(f"  Sustain segments: {len(midi_data.sustain_segments)}")
        print(f"  Pitch range: {midi_data.pitch_range[0]}-{midi_data.pitch_range[1]}")
    
    # Render SVG
    if args.verbose:
        print(f"Rendering SVG ({width}mm × {height}mm)...")
    
    try:
        drawing = render_svg(midi_data, config)
        save_svg(drawing, str(output_path))
    except Exception as e:
        print(f"Error rendering SVG: {e}", file=sys.stderr)
        sys.exit(1)
    
    if args.verbose:
        print(f"Saved: {output_path}")
    else:
        print(f"Created: {output_path}")


if __name__ == "__main__":
    main()






