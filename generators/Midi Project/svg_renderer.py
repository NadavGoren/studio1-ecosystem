"""
SVG Renderer Module
Creates plotter-friendly SVG visualizations from structured MIDI data.

Design Philosophy:
- Blueprint aesthetic with clean, technical lines
- Only uses lines, polylines, and stroked rectangles (no fills)
- All shapes are paths suitable for pen plotters
- Deterministic output for reproducibility
"""

from dataclasses import dataclass
from typing import Optional, List, Tuple
import math
import svgwrite
from svgwrite import Drawing
from svgwrite.container import Group
from noise import pnoise2
from shapely.geometry import LineString, MultiLineString
from shapely.ops import unary_union

from midi_parser import MidiData, Note, Chord, SustainSegment

# Pitch Class (0-11) to Color Mapping (Synesthesia)
PITCH_CLASS_COLORS = {
    0: '#FFD700',   # C - Yellow
    1: '#FF8C00',   # C# - DarkOrange
    2: '#32CD32',   # D - LimeGreen
    3: '#00FA9A',   # D# - MediumSpringGreen
    4: '#0000FF',   # E - Blue
    5: '#8A2BE2',   # F - BlueViolet
    6: '#FF00FF',   # F# - Magenta
    7: '#FF0000',   # G - Red
    8: '#FF1493',   # G# - DeepPink
    9: '#00CED1',   # A - DarkTurquoise
    10: '#8B4513',  # A# - SaddleBrown
    11: '#808080',  # B - Gray
}


def get_pitch_class_color(pitch: int) -> str:
    """Get color for a pitch based on its pitch class (0-11)."""
    pitch_class = pitch % 12
    return PITCH_CLASS_COLORS[pitch_class]


@dataclass
class RenderConfig:
    """Configuration for SVG rendering."""
    # Canvas dimensions
    width_mm: float = 420.0          # A3 width
    height_mm: float = 297.0         # A3 height
    margin_mm: float = 15.0          # Margin around content
    
    # Layout proportions
    note_area_height_ratio: float = 0.75   # Main note area
    energy_area_height_ratio: float = 0.15  # Energy curve area
    gap_ratio: float = 0.05                 # Gap between areas
    
    # Visual styling - SINGLE consistent stroke width for pen plotter
    stroke_width: float = 0.35       # Line thickness in mm (same for all lines)
    
    # Multi-line spacing for "thick" effects (drawn with multiple parallel lines)
    thick_line_spacing: float = 0.3  # Spacing between parallel lines for thick effect
    
    # Sustain hatching
    sustain_hatch_spacing_mm: float = 1.5  # Space between hatch lines
    
    # Colors (for preview; plotters typically use single color)
    note_color: str = "#1a1a2e"
    chord_color: str = "#16213e"
    sustain_color: str = "#4a4e69"
    energy_color: str = "#0f4c75"
    frame_color: str = "#1a1a2e"
    
    @property
    def content_width(self) -> float:
        return self.width_mm - 2 * self.margin_mm
    
    @property
    def content_height(self) -> float:
        return self.height_mm - 2 * self.margin_mm
    
    @property
    def note_area_height(self) -> float:
        return self.content_height * self.note_area_height_ratio
    
    @property
    def energy_area_height(self) -> float:
        return self.content_height * self.energy_area_height_ratio


def render_svg(data: MidiData, config: Optional[RenderConfig] = None) -> Drawing:
    """
    Render MIDI data to an SVG drawing.
    
    Args:
        data: Parsed MIDI data
        config: Rendering configuration (uses defaults if None)
    
    Returns:
        svgwrite.Drawing object
    """
    if config is None:
        config = RenderConfig()
    
    # Create SVG with millimeter units
    dwg = svgwrite.Drawing(
        size=(f"{config.width_mm}mm", f"{config.height_mm}mm"),
        viewBox=f"0 0 {config.width_mm} {config.height_mm}"
    )
    
    # Add metadata
    dwg.set_desc(title="MIDI Piano Roll Visualization", desc="Generated for pen plotter")
    
    # Calculate coordinate transforms
    pitch_min, pitch_max = data.pitch_range
    # Add padding to pitch range
    pitch_min = max(0, pitch_min - 2)
    pitch_max = min(127, pitch_max + 2)
    pitch_range = pitch_max - pitch_min
    
    time_scale = config.content_width / data.total_ticks if data.total_ticks > 0 else 1
    pitch_scale = config.note_area_height / pitch_range if pitch_range > 0 else 1
    
    # Coordinate transform functions
    def tick_to_x(tick: int) -> float:
        return config.margin_mm + tick * time_scale
    
    def pitch_to_y(pitch: int) -> float:
        # Invert Y so higher pitches are at the top
        return config.margin_mm + (pitch_max - pitch) * pitch_scale
    
    # Create layer groups - organized by color for multi-pen plotting
    frame_group = dwg.g(id="frame")
    sustain_group = dwg.g(id="sustain")
    energy_group = dwg.g(id="energy")
    
    # Create color-based groups for notes (one group per pitch class color)
    color_groups = {}
    for pitch_class, color in PITCH_CLASS_COLORS.items():
        color_groups[color] = dwg.g(id=f"layer_pitch_class_{pitch_class}")
    
    # 1. Draw outer frame
    _draw_frame(dwg, frame_group, config)
    
    # 2. Draw sustain segments (hatched bands)
    _draw_sustain_segments(
        dwg, sustain_group, data.sustain_segments,
        tick_to_x, pitch_to_y, pitch_min, pitch_max, config
    )
    
    # 3. Draw individual notes (hatched rectangles grouped by color)
    _draw_notes(
        dwg, color_groups, data.notes,
        tick_to_x, pitch_to_y, config
    )
    
    # 5. Draw energy curve
    energy_y_base = config.margin_mm + config.note_area_height + config.content_height * config.gap_ratio
    _draw_energy_curve(
        dwg, energy_group, data.energy_curve,
        tick_to_x, energy_y_base, config
    )
    
    # Add groups to drawing in render order
    dwg.add(sustain_group)
    # Add color groups (in pitch class order for consistency)
    for pitch_class in range(12):
        color = PITCH_CLASS_COLORS[pitch_class]
        if color in color_groups:
            dwg.add(color_groups[color])
    dwg.add(energy_group)
    dwg.add(frame_group)
    
    return dwg


def _draw_frame(dwg: Drawing, group: Group, config: RenderConfig) -> None:
    """Draw the outer frame rectangle with consistent stroke width."""
    group.add(dwg.rect(
        insert=(config.margin_mm, config.margin_mm),
        size=(config.content_width, config.content_height),
        fill="none",
        stroke=config.frame_color,
        stroke_width=config.stroke_width
    ))
    
    # Draw separator line between note area and energy area - same stroke width
    separator_y = config.margin_mm + config.note_area_height + config.content_height * config.gap_ratio * 0.5
    group.add(dwg.line(
        start=(config.margin_mm, separator_y),
        end=(config.margin_mm + config.content_width, separator_y),
        stroke=config.frame_color,
        stroke_width=config.stroke_width
    ))


def _draw_sustain_segments(
    dwg: Drawing, 
    group: Group, 
    segments: list,
    tick_to_x, 
    pitch_to_y,
    pitch_min: int,
    pitch_max: int,
    config: RenderConfig
) -> None:
    """Draw sustain pedal segments as hatched vertical bands."""
    y_top = pitch_to_y(pitch_max)
    y_bottom = pitch_to_y(pitch_min)
    
    for segment in segments:
        x_start = tick_to_x(segment.start_tick)
        x_end = tick_to_x(segment.end_tick)
        
        # Draw hatching lines (consistent stroke width)
        x = x_start
        while x <= x_end:
            # Vertical hatch lines within the band
            group.add(dwg.line(
                start=(x, y_top),
                end=(x, y_bottom),
                stroke=config.sustain_color,
                stroke_width=config.stroke_width,
                stroke_dasharray="2,3"  # Dashed for lighter appearance
            ))
            x += config.sustain_hatch_spacing_mm
        
        # Draw boundary lines using multiple parallel lines for "thick" effect
        for x_bound in [x_start, x_end]:
            # Draw 2 parallel lines to create thicker boundary effect
            for offset in [-config.thick_line_spacing / 2, config.thick_line_spacing / 2]:
                group.add(dwg.line(
                    start=(x_bound + offset, y_top),
                    end=(x_bound + offset, y_bottom),
                    stroke=config.sustain_color,
                    stroke_width=config.stroke_width
                ))


def _draw_hatched_rect(
    dwg: Drawing,
    group: Group,
    x: float,
    y: float,
    width: float,
    height: float,
    velocity: int,
    color: str,
    config: RenderConfig
) -> None:
    """
    Draw a rectangle with outline and diagonal hatching lines.
    Hatching density is based on velocity:
    - velocity < 60 (Quiet): Wide spacing (2mm gap)
    - velocity > 100 (Loud): Tight spacing (0.5mm gap) or cross-hatching
    """
    # First, draw the rectangle outline
    group.add(dwg.rect(
        insert=(x, y),
        size=(width, height),
        fill="none",
        stroke=color,
        stroke_width=config.stroke_width
    ))
    
    # Determine hatching spacing based on velocity
    if velocity < 60:
        # Quiet: wide spacing
        hatch_spacing = 2.0  # mm
    elif velocity > 100:
        # Loud: tight spacing
        hatch_spacing = 0.5  # mm
    else:
        # Medium: interpolate between wide and tight
        ratio = (velocity - 60) / 40.0  # 0.0 to 1.0 for velocities 60-100
        hatch_spacing = 2.0 - (ratio * 1.5)  # 2.0 to 0.5
    
    # Diagonal line angle (45 degrees): from top-left to bottom-right
    # For a 45° line, use parametric form: line at angle 45° through point
    # We'll iterate across the rectangle's diagonal extent
    diagonal_length = math.sqrt(width**2 + height**2)
    
    # Perpendicular spacing for 45° lines (spacing perpendicular to the line)
    spacing_perp = hatch_spacing * math.sqrt(2)
    
    # Calculate the extent we need to cover
    # For 45° lines (y = x + c), we need to cover all lines that intersect the rectangle
    # The line y = x + c intersects the rectangle in the range:
    # min_c = y - (x + width)  (line through bottom-right)
    # max_c = (y + height) - x  (line through top-left)
    min_c = y - (x + width)
    max_c = (y + height) - x
    
    # Draw diagonal lines (45 degrees: y = x + c)
    c = min_c
    while c <= max_c + spacing_perp:  # Add small buffer to ensure coverage
        # Find intersection points with rectangle boundaries
        # For line y = x + c, check all four edges
        intersections = []
        
        # Left edge (x = x): y = x + c
        y_left = x + c
        if y <= y_left <= y + height:
            intersections.append((x, y_left))
        
        # Right edge (x = x + width): y = x + width + c
        y_right = x + width + c
        if y <= y_right <= y + height:
            intersections.append((x + width, y_right))
        
        # Top edge (y = y): x = y - c
        x_top = y - c
        if x <= x_top <= x + width:
            intersections.append((x_top, y))
        
        # Bottom edge (y = y + height): x = y + height - c
        x_bottom = y + height - c
        if x <= x_bottom <= x + width:
            intersections.append((x_bottom, y + height))
        
        # Draw line if we have exactly 2 distinct intersection points
        # (a line crossing a rectangle always has exactly 2 intersection points)
        if len(intersections) >= 2:
            # Remove duplicates and sort by x then y
            unique_points = []
            seen = set()
            for pt in intersections:
                pt_key = (round(pt[0], 6), round(pt[1], 6))  # Round to avoid floating point issues
                if pt_key not in seen:
                    seen.add(pt_key)
                    unique_points.append(pt)
            
            if len(unique_points) >= 2:
                # Sort by x coordinate (left to right)
                unique_points.sort(key=lambda p: (p[0], p[1]))
                start = unique_points[0]
                end = unique_points[-1]
                
                # Only draw if start and end are different
                if start != end:
                    group.add(dwg.line(
                        start=start,
                        end=end,
                        stroke=color,
                        stroke_width=config.stroke_width
                    ))
        
        c += spacing_perp
    
    # For loud notes (velocity > 100), add cross-hatching (lines in opposite direction)
    if velocity > 100:
        # Draw hatching in opposite direction (-45 degrees: y = -x + c)
        # For -45° lines, c ranges from y + x to (y + height) + (x + width)
        min_c_cross = y + x
        max_c_cross = (y + height) + (x + width)
        
        c = min_c_cross
        while c <= max_c_cross + spacing_perp:
            intersections = []
            
            # Left edge (x = x): y = -x + c
            y_left = -x + c
            if y <= y_left <= y + height:
                intersections.append((x, y_left))
            
            # Right edge (x = x + width): y = -(x + width) + c
            y_right = -(x + width) + c
            if y <= y_right <= y + height:
                intersections.append((x + width, y_right))
            
            # Top edge (y = y): x = -y + c
            x_top = -y + c
            if x <= x_top <= x + width:
                intersections.append((x_top, y))
            
            # Bottom edge (y = y + height): x = -(y + height) + c
            x_bottom = -(y + height) + c
            if x <= x_bottom <= x + width:
                intersections.append((x_bottom, y + height))
            
            if len(intersections) >= 2:
                unique_points = []
                seen = set()
                for pt in intersections:
                    pt_key = (round(pt[0], 6), round(pt[1], 6))
                    if pt_key not in seen:
                        seen.add(pt_key)
                        unique_points.append(pt)
                
                if len(unique_points) >= 2:
                    unique_points.sort(key=lambda p: (p[0], p[1]))
                    start = unique_points[0]
                    end = unique_points[-1]
                    
                    if start != end:
                        group.add(dwg.line(
                            start=start,
                            end=end,
                            stroke=color,
                            stroke_width=config.stroke_width
                        ))
            
            c += spacing_perp


def _draw_notes(
    dwg: Drawing,
    color_groups: dict,
    notes: list,
    tick_to_x,
    pitch_to_y,
    config: RenderConfig
) -> None:
    """
    Draw individual notes as hatched rectangles grouped by color (pitch class).
    Each note is drawn with velocity-based hatching density.
    """
    # Fixed row height to ensure notes don't overlap
    row_height = 3.0  # mm - fixed height for each note
    
    for note in notes:
        x_start = tick_to_x(note.start_tick)
        x_end = tick_to_x(note.end_tick)
        width = max(x_end - x_start, 0.5)  # Minimum width
        
        # Get Y position (center of note row)
        y_center = pitch_to_y(note.pitch)
        y = y_center - row_height / 2
        height = row_height
        
        # Get color based on pitch class
        color = get_pitch_class_color(note.pitch)
        
        # Get the appropriate color group
        if color not in color_groups:
            continue
        
        group = color_groups[color]
        
        # Draw hatched rectangle
        _draw_hatched_rect(
            dwg, group, x_start, y, width, height,
            note.velocity, color, config
        )


def _draw_chords(
    dwg: Drawing,
    group: Group,
    chords: list,
    tick_to_x,
    pitch_to_y,
    config: RenderConfig
) -> None:
    """Draw chord pillars as vertical lines connecting chord notes with consistent stroke width."""
    for chord in chords:
        x = tick_to_x(chord.start_tick)
        y_top = pitch_to_y(chord.max_pitch)
        y_bottom = pitch_to_y(chord.min_pitch)
        
        # Main pillar line - consistent stroke width
        group.add(dwg.line(
            start=(x, y_top),
            end=(x, y_bottom),
            stroke=config.chord_color,
            stroke_width=config.stroke_width,
            stroke_linecap="round"
        ))
        
        # Small horizontal ticks at each note in the chord - same stroke width
        tick_length = 1.2
        for note in chord.notes:
            y = pitch_to_y(note.pitch)
            group.add(dwg.line(
                start=(x - tick_length, y),
                end=(x + tick_length, y),
                stroke=config.chord_color,
                stroke_width=config.stroke_width
            ))


def _draw_energy_curve(
    dwg: Drawing,
    group: Group,
    energy_points: list,
    tick_to_x,
    y_base: float,
    config: RenderConfig
) -> None:
    """Draw the energy curve as a polyline at the bottom with consistent stroke width."""
    if not energy_points:
        return
    
    energy_height = config.energy_area_height
    
    # Build polyline points
    points = []
    for point in energy_points:
        x = tick_to_x(point.tick)
        # Energy goes upward from the baseline
        y = y_base + energy_height - (point.energy * energy_height * 0.9)
        points.append((x, y))
    
    # Draw the main energy curve - consistent stroke width
    if len(points) >= 2:
        group.add(dwg.polyline(
            points=points,
            fill="none",
            stroke=config.energy_color,
            stroke_width=config.stroke_width,
            stroke_linejoin="round",
            stroke_linecap="round"
        ))
    
    # Draw baseline - same stroke width
    x_start = tick_to_x(0)
    x_end = tick_to_x(energy_points[-1].tick) if energy_points else x_start
    baseline_y = y_base + energy_height
    
    group.add(dwg.line(
        start=(x_start, baseline_y),
        end=(x_end, baseline_y),
        stroke=config.energy_color,
        stroke_width=config.stroke_width
    ))
    
    # Add vertical "fill" lines from curve to baseline for visual weight
    # (These are plotter-friendly hatching instead of filled area)
    step = max(1, len(points) // 100)  # Limit number of lines
    for i in range(0, len(points), step):
        x, y = points[i]
        if y < baseline_y - 1:  # Only draw if there's meaningful energy
            group.add(dwg.line(
                start=(x, y),
                end=(x, baseline_y),
                stroke=config.energy_color,
                stroke_width=config.stroke_width,
                stroke_dasharray="1,2"
            ))


class FlowFieldRenderer:
    """
    Generative art renderer using flow fields (Perlin noise) for pen plotters.
    
    Creates organic, fluid-looking paths where:
    - High velocity notes cut through the noise (straighter lines)
    - Low velocity notes are carried by the current (wobbly, curved lines)
    - Hidden line removal ensures clean output for plotters
    """
    
    def __init__(self, data: MidiData, config: RenderConfig):
        self.data = data
        self.config = config
        
        # Flow field parameters
        self.noise_scale = 0.02  # Controls noise frequency (smaller = smoother)
        self.noise_octaves = 4    # Noise detail level
        self.flow_strength = 3.0  # Base strength of flow field deflection
        self.step_size = 0.5      # Distance between path points (mm)
        
        # Calculate coordinate transforms
        pitch_min, pitch_max = data.pitch_range
        pitch_min = max(0, pitch_min - 2)
        pitch_max = min(127, pitch_max + 2)
        pitch_range = pitch_max - pitch_min
        
        self.time_scale = config.content_width / data.total_ticks if data.total_ticks > 0 else 1
        self.pitch_scale = config.note_area_height / pitch_range if pitch_range > 0 else 1
        self.pitch_min = pitch_min
        self.pitch_max = pitch_max
        
        # Coordinate transform functions
        self.tick_to_x = lambda tick: config.margin_mm + tick * self.time_scale
        self.pitch_to_y = lambda pitch: config.margin_mm + (pitch_max - pitch) * self.pitch_scale
    
    def get_flow_vector(self, x: float, y: float, time_offset: float = 0.0) -> Tuple[float, float]:
        """
        Get flow field vector at position (x, y) using Perlin noise.
        
        Returns:
            (dx, dy) - normalized direction vector
        """
        # Use noise to create smooth, organic flow
        # Sample noise at two slightly offset points to get gradient
        # This creates a more natural flow field
        n1 = pnoise2(
            x * self.noise_scale,
            y * self.noise_scale + time_offset,
            octaves=self.noise_octaves,
            persistence=0.5,
            lacunarity=2.0
        )
        n2 = pnoise2(
            (x + 1.0) * self.noise_scale,
            y * self.noise_scale + time_offset,
            octaves=self.noise_octaves,
            persistence=0.5,
            lacunarity=2.0
        )
        n3 = pnoise2(
            x * self.noise_scale,
            (y + 1.0) * self.noise_scale + time_offset,
            octaves=self.noise_octaves,
            persistence=0.5,
            lacunarity=2.0
        )
        
        # Use gradient to determine flow direction
        dx = n2 - n1
        dy = n3 - n1
        
        # Normalize
        length = math.sqrt(dx**2 + dy**2)
        if length > 0:
            dx /= length
            dy /= length
        
        return (dx, dy)
    
    def trace_note_path(self, note: Note) -> List[Tuple[float, float]]:
        """
        Trace a path for a note through the flow field.
        
        High velocity notes resist the flow (straighter).
        Low velocity notes follow the flow (curved).
        """
        x_start = self.tick_to_x(note.start_tick)
        x_end = self.tick_to_x(note.end_tick)
        y_base = self.pitch_to_y(note.pitch)
        
        # Velocity affects how much the note resists the flow
        # Normalize velocity (0-127) to resistance factor (0-1)
        velocity_factor = note.velocity / 127.0
        resistance = 0.1 + velocity_factor * 0.9  # 0.1 to 1.0
        
        # Path points
        path_points = [(x_start, y_base)]
        
        # Trace path from start to end
        current_x = x_start
        current_y = y_base
        total_distance = abs(x_end - x_start)
        distance_traveled = 0.0
        
        while distance_traveled < total_distance:
            # Get flow vector at current position
            flow_dx, flow_dy = self.get_flow_vector(current_x, current_y)
            
            # Calculate desired direction (toward end point)
            to_end_x = x_end - current_x
            to_end_y = y_base - current_y  # Keep roughly at same pitch
            to_end_dist = math.sqrt(to_end_x**2 + to_end_y**2)
            
            if to_end_dist > 0:
                to_end_x /= to_end_dist
                to_end_y /= to_end_dist
            
            # Blend flow field with desired direction based on resistance
            # High resistance = more toward end, low resistance = more flow
            direction_x = to_end_x * resistance + flow_dx * (1 - resistance) * self.flow_strength
            direction_y = to_end_y * resistance + flow_dy * (1 - resistance) * self.flow_strength
            
            # Normalize direction
            dir_length = math.sqrt(direction_x**2 + direction_y**2)
            if dir_length > 0:
                direction_x /= dir_length
                direction_y /= dir_length
            
            # Step forward
            step_x = direction_x * self.step_size
            step_y = direction_y * self.step_size
            
            # Don't overshoot the end
            remaining_x = x_end - current_x
            if abs(step_x) > abs(remaining_x):
                step_x = remaining_x
            
            current_x += step_x
            current_y += step_y
            distance_traveled += self.step_size
            
            path_points.append((current_x, current_y))
            
            # Safety check to avoid infinite loops
            if len(path_points) > 10000:
                break
        
        # Ensure we end at the target
        path_points[-1] = (x_end, y_base)
        
        return path_points
    
    def remove_hidden_lines(self, line_strings: List[LineString]) -> List[LineString]:
        """
        Remove overlapping segments using shapely.
        
        Uses unary_union to merge overlapping lines, then extracts
        the resulting line segments.
        """
        if not line_strings:
            return []
        
        try:
            # Create MultiLineString from all paths
            multi_line = MultiLineString(line_strings)
            
            # Union all lines - this merges overlapping segments
            union_result = unary_union(multi_line)
            
            # Extract individual line segments
            result_lines = []
            
            if isinstance(union_result, LineString):
                result_lines.append(union_result)
            elif isinstance(union_result, MultiLineString):
                result_lines.extend(list(union_result.geoms))
            else:
                # If it's a GeometryCollection, extract LineStrings
                for geom in union_result.geoms:
                    if isinstance(geom, LineString):
                        result_lines.append(geom)
                    elif isinstance(geom, MultiLineString):
                        result_lines.extend(list(geom.geoms))
            
            return result_lines
        except Exception as e:
            # If shapely operations fail, return original lines
            print(f"Warning: Hidden line removal failed: {e}")
            return line_strings
    
    def render(self) -> Drawing:
        """Render the flow field visualization as SVG."""
        # Create SVG
        dwg = svgwrite.Drawing(
            size=(f"{self.config.width_mm}mm", f"{self.config.height_mm}mm"),
            viewBox=f"0 0 {self.config.width_mm} {self.config.height_mm}"
        )
        
        dwg.set_desc(title="MIDI Flow Field Visualization", desc="Generative art for pen plotter")
        
        # Create groups
        paths_group = dwg.g(id="flow-paths")
        frame_group = dwg.g(id="frame")
        
        # Trace paths for all notes
        print(f"Tracing {len(self.data.notes)} notes through flow field...")
        note_paths = []
        
        for note in self.data.notes:
            path_points = self.trace_note_path(note)
            if len(path_points) >= 2:
                # Convert to shapely LineString for hidden line removal
                line_string = LineString(path_points)
                note_paths.append(line_string)
        
        # Remove hidden/overlapping lines
        print("Removing hidden lines...")
        clean_paths = self.remove_hidden_lines(note_paths)
        
        # Convert back to SVG paths
        print(f"Rendering {len(clean_paths)} clean paths...")
        for line_string in clean_paths:
            coords = list(line_string.coords)
            if len(coords) >= 2:
                # Create SVG path
                path_data = f"M {coords[0][0]},{coords[0][1]}"
                for x, y in coords[1:]:
                    path_data += f" L {x},{y}"
                
                paths_group.add(dwg.path(
                    d=path_data,
                    fill="none",
                    stroke=self.config.note_color,
                    stroke_width=self.config.stroke_width,
                    stroke_linecap="round",
                    stroke_linejoin="round"
                ))
        
        # Draw frame
        frame_group.add(dwg.rect(
            insert=(self.config.margin_mm, self.config.margin_mm),
            size=(self.config.content_width, self.config.content_height),
            fill="none",
            stroke=self.config.frame_color,
            stroke_width=self.config.stroke_width
        ))
        
        # Add groups to drawing
        dwg.add(paths_group)
        dwg.add(frame_group)
        
        return dwg


def render_flow_field(data: MidiData, config: Optional[RenderConfig] = None) -> Drawing:
    """
    Render MIDI data using flow field technique.
    
    Args:
        data: Parsed MIDI data
        config: Rendering configuration (uses defaults if None)
    
    Returns:
        svgwrite.Drawing object
    """
    if config is None:
        config = RenderConfig()
    
    renderer = FlowFieldRenderer(data, config)
    return renderer.render()


def save_svg(dwg: Drawing, filepath: str) -> None:
    """Save the drawing to a file."""
    dwg.filename = filepath
    dwg.save(pretty=True)


if __name__ == "__main__":
    # Quick test
    import sys
    from midi_parser import parse_midi
    
    if len(sys.argv) > 1:
        midi_path = sys.argv[1]
        output_path = sys.argv[2] if len(sys.argv) > 2 else "output.svg"
        
        print(f"Parsing {midi_path}...")
        data = parse_midi(midi_path)
        
        print(f"Rendering SVG...")
        dwg = render_svg(data)
        save_svg(dwg, output_path)
        
        print(f"Saved to {output_path}")



