# HOME Generator - Usage Guide

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Development Server
```bash
npm run dev
```

This will open the application at `http://localhost:3000`

### 3. Build for Production
```bash
npm run build
```

## Interface Overview

The HOME Generator interface is divided into two main sections:

### Left Panel: Controls

**Canvas**
- Paper Size: Choose from A3, A4, A5, or custom dimensions
- Orientation: Portrait or landscape
- Custom dimensions: Available when "Custom" size is selected

**Style**
- Mood: Select from 5 archetypal moods that affect the overall feel
- House Width/Height: Control the size of the house relative to canvas
- Roof Height: Adjust the steepness of the roof
- Corner Radius: Add rounded corners for a softer appearance
- Window Count: Set number of windows (0-4)
- Jitter: Add hand-drawn character to lines (0 = perfect, higher = more variation)

**Environment**
- Toggle various environmental elements:
  - Ground Line: Base line at bottom of house
  - Path to Door: Tapered path from bottom to door
  - Tree: Simple tree icon beside house
  - Dog: Small dog silhouette near path
  - Sky Band: Background rectangle in upper portion
  - Sun/Moon: Celestial object in corner
- Element Density: Control how frequently optional elements appear

**Random Seed**
- Manual entry or random generation
- Same seed produces identical results
- Useful for reproducing specific designs

### Right Panel: Preview

Real-time SVG preview of your generated house.

## Mood Presets Explained

### Cozy
Perfect for warm, welcoming homes:
- Moderate proportions
- Soft rounded corners (3mm)
- 3 symmetrical windows
- Low jitter (0.3mm) for stability
- Balanced roof height

**Use Case**: Family homes, holiday cards, comfort themes

### Temporary
For fragile, transient dwellings:
- Smaller, narrower structure
- Sharp corners (0mm radius)
- Single window
- High jitter (1.2mm) for instability
- Higher line break probability
- Lower roof

**Use Case**: Shacks, emergency shelters, impermanence themes

### Fortress
Solid, protective structures:
- Large, wide proportions
- Sharp corners
- Small, narrow windows (like arrow slits)
- Minimal jitter (0.1mm) for precision
- Lower, flatter roof
- No line breaks

**Use Case**: Castles, bunkers, security themes

### Minimal
Clean, modernist aesthetic:
- Balanced proportions
- No jitter (0mm)
- Perfect geometry
- 2 symmetrical windows
- Simple, clean lines

**Use Case**: Modern architecture, minimalist designs, precise plots

### Playful
Fun, whimsical houses:
- Tall, steep roof
- Rounded corners (5mm)
- 4 windows in varied arrangements
- Moderate jitter (0.6mm)
- Asymmetrical elements

**Use Case**: Children's illustrations, storybook themes, fun projects

## Plotter Tips

### Pen Organization

The SVG export groups paths by pen role. Each group has a `data-pen` attribute:

```xml
<g data-pen="outline" stroke-width="0.8">
  <!-- Main house structure -->
</g>
<g data-pen="detail" stroke-width="0.4">
  <!-- Windows, doors, environment details -->
</g>
<g data-pen="hatch" stroke-width="0.2">
  <!-- Reserved for future textures -->
</g>
<g data-pen="background" stroke-width="0.3">
  <!-- Sky, sun, distant elements -->
</g>
```

### Recommended Pen Setup

1. **Outline Pen** (0.6-1.0mm): Black or dark color
   - House body
   - Roof
   - Ground line

2. **Detail Pen** (0.3-0.5mm): Medium gray or colored
   - Windows and doors
   - Tree, dog
   - Path

3. **Background Pen** (0.2-0.4mm): Light gray or subtle color
   - Sun/moon
   - Sky band

### Optimizing for Plotting

**Reduce Pen Lifts**
- All primitives create continuous paths where possible
- Rectangles are drawn as single closed paths
- Lines with jitter are subdivided but remain continuous

**Jitter Control**
- Start with 0mm for testing
- Increase gradually to find desired hand-drawn effect
- Keep under 1.5mm for reliable plotting
- Higher jitter may cause pen registration issues

**Line Breaks**
- Controlled by mood (temporary has highest probability)
- Creates intentional gaps for artistic effect
- May increase plot time due to pen lifts

**Canvas Size Selection**
- Use A4 for testing (faster plots)
- Use A3 for final prints or larger displays
- Custom sizes for specific plotter bed dimensions

## Workflow Examples

### Quick Random Series
1. Select mood preset
2. Click "Random" seed button repeatedly
3. Download each variation you like
4. Plot entire series with same pen setup

### Refined Single Piece
1. Start with mood preset closest to your vision
2. Adjust sliders for exact proportions
3. Toggle environment elements
4. Fine-tune jitter for desired line quality
5. Test with low jitter first, increase gradually
6. Download final SVG

### Creating a Story Sequence
1. Generate "fortress" for strong beginning
2. Transition to "cozy" for middle
3. End with "temporary" for conclusion
4. Keep same seed range for visual consistency
5. Vary only mood and specific elements

## Advanced: Programmatic Generation

For batch generation or integration:

```typescript
import { HouseGenerator, getMoodDefaults, DEFAULT_CONFIG } from './src/index';

// Generate 10 variations of each mood
const moods = ['cozy', 'temporary', 'fortress', 'minimal', 'playful'];
const baseSeed = 1000;

for (const mood of moods) {
  for (let i = 0; i < 10; i++) {
    const config = {
      ...DEFAULT_CONFIG,
      randomSeed: baseSeed + i,
      style: {
        ...DEFAULT_CONFIG.style,
        ...getMoodDefaults(mood)
      }
    };
    
    const generator = new HouseGenerator(config);
    const pathGroups = generator.generate();
    
    // Export or process pathGroups
  }
}
```

## Troubleshooting

**SVG not displaying**
- Check browser console for errors
- Ensure all paths have valid coordinates
- Verify viewBox dimensions match canvas size

**Jitter too extreme**
- Reduce jitter slider
- Check that jitter < 2mm for most cases
- Very high jitter may create self-intersecting paths

**Elements not appearing**
- Check element density slider
- Verify environment toggles are enabled
- Some elements appear probabilistically

**Download not working**
- Ensure pop-ups are not blocked
- Generate at least once before downloading
- Check file permissions in download folder

## Tips for Best Results

1. **Start Simple**: Begin with minimal mood and no jitter
2. **Iterate**: Make small adjustments, regenerate frequently
3. **Save Seeds**: Note seed values for favorites
4. **Test Plot**: Print one design before batch plotting
5. **Paper Choice**: Smoother paper works better with jitter
6. **Pen Quality**: Quality pens handle jitter better
7. **Combine Moods**: Use mood as starting point, then customize

## Sharing Your Work

When sharing generated houses:
- Include seed number for reproducibility
- Note any customizations made to mood preset
- Document pen types and colors used
- Share plotter settings if helpful to community






