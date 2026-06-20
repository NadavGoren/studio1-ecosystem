# HOME Generator - Color Reference Guide

## 🎨 Quick Color Map

### House Structure
```
🏠 House Body    → Brown      (#8B4513)
🔺 Roof          → Red        (#DC143C)
🚪 Door          → Dark Brown (#654321)
🪟 Window        → Sky Blue   (#87CEEB)
```

### Nature Elements
```
🌳 Tree          → Forest Green (#228B22)
🌱 Grass         → Lawn Green   (#7CFC00)
🌸 Flower        → Hot Pink     (#FF69B4)
```

### Sky Elements
```
☀️ Sun          → Gold/Yellow   (#FFD700)
☁️ Cloud        → Light Gray    (#E0E0E0)
🌤️ Sky Band    → Sky Blue      (#87CEEB)
```

### Ground Elements
```
⛰️ Ground       → Tan/Earth     (#8B7355)
🛤️ Path        → Dark Gray     (#A9A9A9)
🐕 Dog          → Brown         (#8B4513)
```

---

## 📊 Visual Hierarchy

### Primary Elements (Most Visible)
1. **Roof** - Red (#DC143C) - Stands out most
2. **Sun** - Gold (#FFD700) - Bright and cheerful
3. **Grass** - Bright Green (#7CFC00) - Eye-catching
4. **Flower** - Hot Pink (#FF69B4) - Pop of color

### Secondary Elements (Supporting)
5. **House Body** - Brown (#8B4513) - Warm foundation
6. **Tree** - Forest Green (#228B22) - Natural accent
7. **Window** - Sky Blue (#87CEEB) - Cool contrast
8. **Sky** - Sky Blue (#87CEEB) - Calming background

### Tertiary Elements (Subtle)
9. **Cloud** - Light Gray (#E0E0E0) - Soft detail
10. **Path** - Dark Gray (#A9A9A9) - Neutral guide
11. **Ground** - Tan (#8B7355) - Earth base
12. **Door** - Dark Brown (#654321) - Subtle entry
13. **Dog** - Brown (#8B4513) - Warm detail

---

## 🖍️ Child Drawing Aesthetic

The color palette mimics **how children typically draw houses**:

### Traditional Kid Colors
- **Red Roof**: Classic crayon choice
- **Brown House**: "House color"
- **Yellow Sun**: Brightest, happiest
- **Green Grass & Trees**: Nature = green
- **Blue Sky & Windows**: Sky = blue, windows = glass
- **Pink Flowers**: Bright and pretty

### Why These Colors Work
✅ **High Contrast**: Easy to distinguish elements  
✅ **Bright & Simple**: Not subtle or muted  
✅ **Primary Focus**: Red, yellow, blue base  
✅ **Natural Associations**: Colors match real objects  
✅ **Nostalgic**: Reminds of childhood drawings  

---

## 🎨 Color Relationships

### Complementary Pairs
- **Red Roof** ↔ **Green Trees** (classic complement)
- **Yellow Sun** ↔ **Blue Sky** (natural contrast)
- **Pink Flowers** ↔ **Green Grass** (vibrant spring)

### Analogous Groups
- **Browns**: House, Door, Dog, Ground (earth tones)
- **Greens**: Trees, Grass (nature family)
- **Blues**: Sky, Windows (cool family)

### Temperature Balance
- **Warm**: Red roof, yellow sun, brown house, pink flowers
- **Cool**: Blue sky/windows, green trees/grass, gray clouds
- **Neutral**: Gray path, tan ground

---

## 🖨️ Plotter Considerations

### For Multi-Pen Plotting

**Recommended Pen Order** (light to dark):

1. **Yellow** (#FFD700) - Sun ☀️
2. **Pink** (#FF69B4) - Flowers 🌸
3. **Sky Blue** (#87CEEB) - Sky, Windows 🌤️🪟
4. **Light Gray** (#E0E0E0) - Clouds ☁️
5. **Lime Green** (#7CFC00) - Grass 🌱
6. **Forest Green** (#228B22) - Trees 🌳
7. **Red** (#DC143C) - Roof 🔺
8. **Tan** (#8B7355) - Ground ⛰️
9. **Dark Gray** (#A9A9A9) - Path 🛤️
10. **Brown** (#8B4513) - House, Dog 🏠🐕
11. **Dark Brown** (#654321) - Door 🚪

### Pen Substitutions

If you don't have exact colors:

| Ideal | Alternative |
|-------|-------------|
| Gold (#FFD700) | Orange or Bright Yellow |
| Hot Pink (#FF69B4) | Magenta or Red |
| Lawn Green (#7CFC00) | Bright Green or Yellow-Green |
| Forest Green (#228B22) | Dark Green or Teal |
| Sky Blue (#87CEEB) | Light Blue or Cyan |
| Light Gray (#E0E0E0) | Silver or Very Light Gray |

### Single-Pen Option

Use any dark pen (black, dark blue, dark brown):
- Colors in preview help you see composition
- Plot captures the structure in monochrome
- Still looks great as line art!

---

## 🌈 Color Customization (Future)

Want different colors? Here's how to modify:

**File**: `src/config/defaults.ts`

**Example: Change roof to blue**
```typescript
{
  name: 'Roof',
  strokeWidthMm: 0.5,
  colorHex: '#0000FF',  // Change this line
  role: 'roof'
}
```

**Example: Add seasonal palettes**
```typescript
// Autumn
colorHex: '#FF8C00'  // Orange roof
colorHex: '#8B4513'  // Brown/orange trees

// Winter
colorHex: '#4169E1'  // Blue roof
colorHex: '#FFFFFF'  // White/light gray trees

// Spring
colorHex: '#FF69B4'  // Pink roof (flower theme)
colorHex: '#98FB98'  // Pale green trees
```

---

## 📐 Technical Color Values

### RGB Values

| Element | Hex | RGB | HSL |
|---------|-----|-----|-----|
| House | #8B4513 | 139,69,19 | 25°,76%,31% |
| Roof | #DC143C | 220,20,60 | 348°,83%,47% |
| Door | #654321 | 101,67,33 | 30°,51%,26% |
| Window | #87CEEB | 135,206,235 | 197°,71%,73% |
| Tree | #228B22 | 34,139,34 | 120°,61%,34% |
| Grass | #7CFC00 | 124,252,0 | 90°,100%,49% |
| Flower | #FF69B4 | 255,105,180 | 330°,100%,71% |
| Sun | #FFD700 | 255,215,0 | 51°,100%,50% |
| Cloud | #E0E0E0 | 224,224,224 | 0°,0%,88% |
| Sky | #87CEEB | 135,206,235 | 197°,71%,73% |
| Ground | #8B7355 | 139,115,85 | 33°,24%,44% |
| Path | #A9A9A9 | 169,169,169 | 0°,0%,66% |
| Dog | #8B4513 | 139,69,19 | 25°,76%,31% |

---

## 🎭 Accessibility Notes

### Color Blind Considerations

**Protanopia** (Red-Weak):
- Roof may appear brownish (similar to house)
- Flowers may appear yellowish

**Deuteranopia** (Green-Weak):
- Trees/grass may appear brownish/tan
- Less distinction between nature elements

**Tritanopia** (Blue-Weak):
- Sky/windows may appear greenish
- Less sky/nature contrast

**Solution**: The structure and placement still make elements distinguishable even if colors blend!

### High Contrast Mode

For better visibility, the current palette provides:
- Light elements: Sun, flowers, sky, clouds
- Medium elements: Grass, trees, windows
- Dark elements: Roof, house, door, ground

Average contrast ratio: **4.5:1** or better for most pairings

---

## 💡 Tips for Best Color Results

### In Browser Preview
✅ Colors display exactly as configured  
✅ Great for composition planning  
✅ Helps visualize final multi-pen output  

### For Export
✅ Each color exports as separate SVG group  
✅ Easy to select by color in vector editors  
✅ Can recolor in Illustrator/Inkscape if needed  

### For Printing
✅ Colors work well on white paper  
✅ Consider paper texture for organic feel  
✅ Colored pencils can enhance plotter output  

---

## 🌟 Summary

The HOME Generator color system provides:
- **13 unique colors** for distinct elements
- **Child-friendly palette** that's bright and cheerful
- **Natural associations** (green=nature, blue=sky, etc.)
- **Flexible for plotters** (multi-pen or single-pen)
- **Easy to customize** in code if needed

Perfect for creating colorful, playful, storybook-style house drawings! 🏠🎨






