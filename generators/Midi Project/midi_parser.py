"""
MIDI Parser Module
Extracts structured musical data from piano MIDI files.
"""

from dataclasses import dataclass, field
from typing import List, Tuple
import mido


@dataclass
class Note:
    """Represents a single note event."""
    pitch: int          # MIDI pitch (0-127)
    start_tick: int     # Start time in ticks
    end_tick: int       # End time in ticks
    velocity: int       # Note velocity (0-127)
    
    @property
    def duration_ticks(self) -> int:
        return self.end_tick - self.start_tick
    
    @property
    def pitch_name(self) -> str:
        """Convert MIDI pitch to note name."""
        names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        octave = (self.pitch // 12) - 1
        name = names[self.pitch % 12]
        return f"{name}{octave}"


@dataclass
class Chord:
    """Represents a group of notes starting together (vertical pillar)."""
    start_tick: int
    notes: List[Note] = field(default_factory=list)
    
    @property
    def min_pitch(self) -> int:
        return min(n.pitch for n in self.notes)
    
    @property
    def max_pitch(self) -> int:
        return max(n.pitch for n in self.notes)
    
    @property
    def avg_velocity(self) -> float:
        return sum(n.velocity for n in self.notes) / len(self.notes)


@dataclass
class SustainSegment:
    """Represents a sustain pedal segment."""
    start_tick: int
    end_tick: int
    
    @property
    def duration_ticks(self) -> int:
        return self.end_tick - self.start_tick


@dataclass
class EnergyPoint:
    """Represents an energy measurement at a point in time."""
    tick: int
    energy: float  # Normalized 0-1


@dataclass
class MidiData:
    """Complete structured musical data extracted from a MIDI file."""
    ticks_per_beat: int
    total_ticks: int
    tempo_us: int  # Microseconds per beat
    notes: List[Note] = field(default_factory=list)
    chords: List[Chord] = field(default_factory=list)
    sustain_segments: List[SustainSegment] = field(default_factory=list)
    energy_curve: List[EnergyPoint] = field(default_factory=list)
    
    @property
    def duration_seconds(self) -> float:
        """Total duration in seconds."""
        beats = self.total_ticks / self.ticks_per_beat
        return beats * (self.tempo_us / 1_000_000)
    
    @property
    def pitch_range(self) -> Tuple[int, int]:
        """Return (min_pitch, max_pitch) across all notes."""
        if not self.notes:
            return (21, 108)  # Standard piano range
        pitches = [n.pitch for n in self.notes]
        return (min(pitches), max(pitches))
    
    def to_json(self) -> dict:
        """Convert to JSON-serializable dictionary for web API."""
        pitch_min, pitch_max = self.pitch_range
        return {
            "ticks_per_beat": self.ticks_per_beat,
            "total_ticks": self.total_ticks,
            "tempo_us": self.tempo_us,
            "duration_seconds": self.duration_seconds,
            "pitch_range": {"min": pitch_min, "max": pitch_max},
            "notes": [
                {
                    "pitch": n.pitch,
                    "start_tick": n.start_tick,
                    "end_tick": n.end_tick,
                    "velocity": n.velocity
                }
                for n in self.notes
            ],
            "chords": [
                {
                    "start_tick": c.start_tick,
                    "min_pitch": c.min_pitch,
                    "max_pitch": c.max_pitch,
                    "avg_velocity": c.avg_velocity,
                    "note_pitches": [n.pitch for n in c.notes]
                }
                for c in self.chords
            ],
            "sustain_segments": [
                {
                    "start_tick": s.start_tick,
                    "end_tick": s.end_tick
                }
                for s in self.sustain_segments
            ],
            "energy_curve": [
                {
                    "tick": e.tick,
                    "energy": e.energy
                }
                for e in self.energy_curve
            ]
        }


def parse_midi(filepath: str, chord_threshold_ticks: int = 10) -> MidiData:
    """
    Parse a MIDI file and extract structured musical data.
    
    Args:
        filepath: Path to the MIDI file
        chord_threshold_ticks: Maximum tick difference for notes to be grouped as a chord
    
    Returns:
        MidiData object containing all extracted information
    """
    mid = mido.MidiFile(filepath)
    ticks_per_beat = mid.ticks_per_beat
    
    # Default tempo (120 BPM = 500000 microseconds per beat)
    tempo_us = 500000
    
    # Track active notes and sustain state
    active_notes: dict = {}  # pitch -> (start_tick, velocity)
    sustain_on = False
    sustain_start_tick = 0
    
    notes: List[Note] = []
    sustain_segments: List[SustainSegment] = []
    
    current_tick = 0
    
    # Process all messages
    for track in mid.tracks:
        current_tick = 0
        for msg in track:
            current_tick += msg.time
            
            # Handle tempo changes
            if msg.type == 'set_tempo':
                tempo_us = msg.tempo
            
            # Handle note on
            elif msg.type == 'note_on' and msg.velocity > 0:
                active_notes[msg.note] = (current_tick, msg.velocity)
            
            # Handle note off (or note_on with velocity 0)
            elif msg.type == 'note_off' or (msg.type == 'note_on' and msg.velocity == 0):
                if msg.note in active_notes:
                    start_tick, velocity = active_notes.pop(msg.note)
                    notes.append(Note(
                        pitch=msg.note,
                        start_tick=start_tick,
                        end_tick=current_tick,
                        velocity=velocity
                    ))
            
            # Handle sustain pedal (CC 64)
            elif msg.type == 'control_change' and msg.control == 64:
                if msg.value >= 64 and not sustain_on:
                    # Pedal pressed
                    sustain_on = True
                    sustain_start_tick = current_tick
                elif msg.value < 64 and sustain_on:
                    # Pedal released
                    sustain_on = False
                    sustain_segments.append(SustainSegment(
                        start_tick=sustain_start_tick,
                        end_tick=current_tick
                    ))
    
    # Close any remaining sustain segment
    if sustain_on:
        sustain_segments.append(SustainSegment(
            start_tick=sustain_start_tick,
            end_tick=current_tick
        ))
    
    # Sort notes by start time
    notes.sort(key=lambda n: (n.start_tick, n.pitch))
    
    # Calculate total ticks
    total_ticks = max((n.end_tick for n in notes), default=0)
    if sustain_segments:
        total_ticks = max(total_ticks, max(s.end_tick for s in sustain_segments))
    
    # Detect chords (notes starting within threshold ticks of each other)
    chords = _detect_chords(notes, chord_threshold_ticks)
    
    # Compute energy curve
    energy_curve = _compute_energy_curve(notes, total_ticks, ticks_per_beat)
    
    return MidiData(
        ticks_per_beat=ticks_per_beat,
        total_ticks=total_ticks,
        tempo_us=tempo_us,
        notes=notes,
        chords=chords,
        sustain_segments=sustain_segments,
        energy_curve=energy_curve
    )


def _detect_chords(notes: List[Note], threshold_ticks: int) -> List[Chord]:
    """
    Group notes into chords based on start time proximity.
    Only groups of 2+ notes are considered chords.
    """
    if not notes:
        return []
    
    chords: List[Chord] = []
    current_group: List[Note] = [notes[0]]
    
    for note in notes[1:]:
        # Check if this note starts close to the first note in current group
        if note.start_tick - current_group[0].start_tick <= threshold_ticks:
            current_group.append(note)
        else:
            # Finalize current group if it's a chord (2+ notes)
            if len(current_group) >= 2:
                chords.append(Chord(
                    start_tick=current_group[0].start_tick,
                    notes=current_group.copy()
                ))
            current_group = [note]
    
    # Don't forget the last group
    if len(current_group) >= 2:
        chords.append(Chord(
            start_tick=current_group[0].start_tick,
            notes=current_group.copy()
        ))
    
    return chords


def _compute_energy_curve(
    notes: List[Note], 
    total_ticks: int, 
    ticks_per_beat: int,
    window_beats: float = 2.0
) -> List[EnergyPoint]:
    """
    Compute a smoothed energy curve based on note density and velocity.
    
    Energy is calculated as the sum of velocities of notes active in a sliding window.
    """
    if not notes or total_ticks == 0:
        return []
    
    window_ticks = int(window_beats * ticks_per_beat)
    sample_interval = ticks_per_beat // 2  # Sample twice per beat
    
    energy_points: List[EnergyPoint] = []
    max_energy = 0.0
    
    # Pre-compute energy at each sample point
    for tick in range(0, total_ticks + 1, sample_interval):
        window_start = max(0, tick - window_ticks // 2)
        window_end = tick + window_ticks // 2
        
        # Sum velocities of notes overlapping this window
        energy = 0.0
        for note in notes:
            # Check if note overlaps with window
            if note.start_tick <= window_end and note.end_tick >= window_start:
                # Weight by velocity and partial overlap
                overlap_start = max(note.start_tick, window_start)
                overlap_end = min(note.end_tick, window_end)
                overlap_ratio = (overlap_end - overlap_start) / window_ticks
                energy += note.velocity * overlap_ratio
        
        energy_points.append(EnergyPoint(tick=tick, energy=energy))
        max_energy = max(max_energy, energy)
    
    # Normalize energy values to 0-1
    if max_energy > 0:
        for point in energy_points:
            point.energy = point.energy / max_energy
    
    return energy_points


if __name__ == "__main__":
    # Quick test
    import sys
    if len(sys.argv) > 1:
        data = parse_midi(sys.argv[1])
        print(f"Parsed MIDI: {data.duration_seconds:.1f}s")
        print(f"  Notes: {len(data.notes)}")
        print(f"  Chords: {len(data.chords)}")
        print(f"  Sustain segments: {len(data.sustain_segments)}")
        print(f"  Energy points: {len(data.energy_curve)}")
        print(f"  Pitch range: {data.pitch_range}")

