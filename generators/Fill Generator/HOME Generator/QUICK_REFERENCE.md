# HOME Generator - Quick Reference Card

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`

## 📐 Paper Sizes

| Preset | Portrait (mm) | Landscape (mm) |
|--------|---------------|----------------|
| A3     | 297 × 420     | 420 × 297      |
| A4     | 210 × 297     | 297 × 210      |
| A5     | 148 × 210     | 210 × 148      |

## 🎨 Moods at a Glance

| Mood      | Best For              | Key Features                    |
|-----------|-----------------------|---------------------------------|
| Cozy      | Family homes          | Soft corners, symmetrical       |
| Temporary | Shacks, fragility     | High jitter, sparse windows     |
| Fortress  | Castles, strength     | Large, minimal jitter           |
| Minimal   | Modern, clean         | Perfect lines, simple           |
| Playful   | Fun, whimsical        | Tall roof, many windows         |

## 🖊️ Default Pens

| Role       | Width | Usage                          |
|------------|-------|--------------------------------|
| Outline    | 0.8mm | House body, roof, ground       |
| Detail     | 0.4mm | Windows, doors, tree, dog      |
| Hatch      | 0.2mm | (Reserved for textures)        |
| Background | 0.3mm | Sky, sun/moon                  |

## ⚙️ Key Parameters

### House Proportions
- **Width Ratio**: 0.2 - 0.7 (0.45 = balanced)
- **Height Ratio**: 0.2 - 0.6 (0.35 = balanced)
- **Roof Height**: 0.2 - 0.7 (0.4 = typical gable)

### Style Controls
- **Corner Radius**: 0 - 10mm (0 = sharp, 5 = very soft)
- **Jitter**: 0 - 3mm (0 = perfect, 0.5 = subtle, 1.5 = sketchy)
- **Windows**: 0 - 4 (affects layout automatically)

### Environment
- **Element Density**: 0 - 1 (probability of optional elements)

## 🎲 Random Seeds

- **Same seed** = identical output (reproducible)
- **Adjacent seeds** = similar but varied (good for series)
- **Try these**: 12345, 42, 1000, 9999, 55555

## 💾 Export Tips

1. **Filename format**: `home-{mood}-{seed}-{timestamp}.svg`
2. **Groups**: Paths organized by `data-pen` attribute
3. **Plotter-ready**: No fills, continuous paths, mm units
4. **Editable**: Open in Illustrator/Inkscape for tweaks

## 🔧 Common Recipes

### Classic House
```
Mood: Cozy
Windows: 3
Jitter: 0.3mm
Elements: All enabled
```

### Minimal Test
```
Mood: Minimal
Windows: 2
Jitter: 0mm
Elements: None (except ground)
```

### Hand-drawn Feel
```
Mood: Playful
Windows: 4
Jitter: 1.0mm
Elements: All enabled
```

### Bold Statement
```
Mood: Fortress
Windows: 2
Jitter: 0.1mm
Canvas: A3 Landscape
```

## 🐛 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| SVG not showing | Click "Generate" first |
| Lines too wobbly | Reduce jitter slider |
| Too simple | Increase window count, enable elements |
| Too complex | Reduce windows, disable some elements |
| Download fails | Check popup blocker, try different browser |

## 📝 Programmatic Usage

```typescript
import { HouseGenerator, getMoodDefaults, DEFAULT_CONFIG } from './src/index';

const config = {
  ...DEFAULT_CONFIG,
  randomSeed: 42,
  style: { ...DEFAULT_CONFIG.style, ...getMoodDefaults('cozy') }
};

const generator = new HouseGenerator(config);
const pathGroups = generator.generate();
```

## 📞 Help

- **README.md**: Installation & overview
- **USAGE.md**: Detailed usage guide
- **TECHNICAL.md**: Architecture & API
- **examples/**: Code examples

## 🎯 Best Practices

1. **Start with mood presets** → customize as needed
2. **Test with jitter = 0** before adding variation
3. **Use A4 for testing**, A3 for finals
4. **Note seed values** for favorites
5. **Plot test page** before large runs
6. **Group similar seeds** for series work

## ⌨️ Keyboard Shortcuts

Currently none implemented. All controls via mouse/touch.

## 🔮 Quick Experiments

Try these combinations:

1. **Seed 12345, Cozy**: Classic starting point
2. **Seed 42, Fortress**: Strong and stable
3. **Seed 9999, Playful + Jitter 1.5mm**: Very sketchy
4. **Seed 1000-1010, Minimal**: Clean series
5. **Any seed, Temporary + All elements**: Busy and fragile

## 📊 SVG Structure

```xml
<svg viewBox="0 0 210 297">
  <g data-pen="background">...</g>  ← Sky, sun
  <g data-pen="outline">...</g>     ← House, roof
  <g data-pen="detail">...</g>      ← Windows, dog, tree
</svg>
```

## 🎪 Series Ideas

1. **Mood Journey**: One of each mood, same seed
2. **Evolution**: Sequential seeds, same mood
3. **Jitter Study**: Same house, increasing jitter
4. **Size Study**: Same design, A5 → A4 → A3
5. **Element Study**: Same base, toggle elements

---

**Last Updated**: November 2024  
**Version**: 1.0.0  
**Status**: Production Ready ✅






