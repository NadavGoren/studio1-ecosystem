# Extending HatchStudio

## Overview

This document outlines extension points, plugin architecture (future), and how to add new features to HatchStudio. The architecture is designed for extensibility while maintaining code quality and performance.

## Extension Points

### Adding New Shape Types

#### 1. Define Shape Type

**Location:** `src/types/index.ts`

```typescript
// Add to ShapeType union
export type ShapeType = 'rectangle' | 'ellipse' | 'polygon' | 
                        'line' | 'polyline' | 'group' | 'star'; // New type

// Define shape interface
export interface StarShape extends BaseShape {
  type: 'star';
  outerRadius: number;
  innerRadius: number;
  points: number;  // Number of star points
  cornerRadius?: number;
}

// Add to Shape union
export type Shape = RectangleShape | EllipseShape | ... | StarShape;
```

#### 2. Implement Vertex Calculation

**Location:** `src/lib/geometry.ts`

```typescript
export function getShapeVertices(shape: Shape): Point[] {
  // ... existing cases
  if (shape.type === 'star') {
    const star = shape as StarShape;
    const vertices: Point[] = [];
    // Calculate star vertices
    for (let i = 0; i < star.points * 2; i++) {
      const angle = (i * Math.PI) / star.points;
      const radius = i % 2 === 0 ? star.outerRadius : star.innerRadius;
      const x = shape.x + radius * Math.cos(angle);
      const y = shape.y + radius * Math.sin(angle);
      vertices.push({ x, y });
    }
    // Apply rotation
    return vertices.map(v => rotatePoint(v.x, v.y, shape.x, shape.y, shape.rotation));
  }
}
```

#### 3. Add Rendering

**Location:** `src/components/Canvas.tsx`

```typescript
// In shape rendering section
{shape.type === 'star' && (
  <path
    d={shapeToPath(shape, shapes)}
    stroke={color}
    strokeWidth={strokeWidth}
    fill="none"
  />
)}
```

#### 4. Add Drawing Tool

**Location:** `src/components/Canvas.tsx`

```typescript
// In handleMouseDown
if (tool === 'star') {
  isDrawing.current = true;
  drawingTool.current = 'star';
  startPoint.current = worldPoint;
  // Create initial star shape
}
```

#### 5. Add Properties Panel

**Location:** `src/components/RightPanel.tsx`

```typescript
{firstShape?.type === 'star' && (
  <div className="mt-6 space-y-2">
    <Label>Outer Radius</Label>
    <Input 
      type="number" 
      value={firstShape.outerRadius} 
      onChange={(e) => handleUpdate({ outerRadius: Number(e.target.value) })} 
    />
    {/* More properties */}
  </div>
)}
```

#### 6. Add Tool Button

**Location:** `src/components/TopBar.tsx`

```typescript
<ToolBtn id="star" icon={Star} label="Star (S)" />
```

#### 7. Add Keyboard Shortcut

**Location:** `src/hooks/useKeyboardShortcuts.ts`

```typescript
case 's': setTool('star'); break;
```

### Adding New Tools

#### 1. Add Tool Type

**Location:** `src/types/index.ts`

```typescript
export type ToolType = 'select' | 'direct_select' | ... | 'text';
```

#### 2. Implement Tool Logic

**Location:** `src/components/Canvas.tsx`

```typescript
// In handleMouseDown
if (tool === 'text') {
  // Create text shape
  // Handle text input
}

// In handleMouseMove
if (tool === 'text' && isDrawing.current) {
  // Update text position/size
}
```

#### 3. Add UI Elements

- Tool button in TopBar
- Properties panel for text
- Keyboard shortcut

### Custom Hatching Algorithms

#### 1. Extend HatchParams

**Location:** `src/types/index.ts`

```typescript
interface HatchParams {
  // ... existing params
  patternType?: 'lines' | 'circles' | 'spiral'; // New option
  spiralTurns?: number;  // For spiral pattern
}
```

#### 2. Implement Algorithm

**Location:** `src/lib/hatching.ts`

```typescript
export function generateHatchLines(shape: Shape, params: HatchParams): string[] {
  if (params.patternType === 'spiral') {
    return generateSpiralHatch(shape, params);
  }
  // ... existing algorithm
}

function generateSpiralHatch(shape: Shape, params: HatchParams): string[] {
  // Implement spiral hatching
  // Return array of SVG path strings
}
```

#### 3. Add UI Controls

**Location:** `src/components/RightPanel.tsx` or `HatchTab.tsx`

```typescript
<select 
  value={params.patternType || 'lines'} 
  onChange={(e) => handleHatchUpdate({ patternType: e.target.value })}
>
  <option value="lines">Lines</option>
  <option value="spiral">Spiral</option>
</select>
```

### New Boolean Operations

#### 1. Add Operation Type

**Location:** `src/lib/boolean.ts`

```typescript
export function computeBooleanOperation(
  shapes: Shape[], 
  op: 'union' | 'subtract' | 'intersect' | 'exclude' | 'divide' // New
): ResultData[] {
  // ... existing operations
  if (op === 'divide') {
    // Implement divide operation
    // Paper.js: result = prev.divide(next);
  }
}
```

#### 2. Add UI Button

**Location:** `src/components/PathfinderPanel.tsx`

```typescript
<button onClick={() => performBooleanOperation('divide')}>
  Divide
</button>
```

### UI Extensions

#### Adding New Panels

**Location:** Create new component file

```typescript
// src/components/NewPanel.tsx
export function NewPanel() {
  const state = useAppStore();
  // Panel implementation
  return <div className="panel">...</div>;
}
```

**Integration:**
```typescript
// In App.tsx
<NewPanel />
```

#### Custom Design System Components

**Location:** `src/components/ui/DesignSystem.tsx`

```typescript
export function Button({ children, onClick, variant = 'default' }) {
  return (
    <button 
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

## Plugin Architecture (Future)

### Vision

A plugin system that allows:
- Third-party extensions
- Custom tools and shapes
- Additional hatching algorithms
- UI extensions

### Proposed Structure

```typescript
interface Plugin {
  id: string;
  name: string;
  version: string;
  shapeTypes?: ShapeType[];
  tools?: ToolType[];
  hatchingAlgorithms?: HatchingAlgorithm[];
  uiComponents?: React.ComponentType[];
}

// Plugin registration
function registerPlugin(plugin: Plugin): void {
  // Register shape types
  // Register tools
  // Register algorithms
  // Register UI components
}
```

### Plugin API

```typescript
// Example plugin
const myPlugin: Plugin = {
  id: 'my-plugin',
  name: 'My Plugin',
  version: '1.0.0',
  shapeTypes: ['star'],
  tools: ['star'],
  hatchingAlgorithms: [{
    name: 'spiral',
    generate: (shape, params) => { /* ... */ }
  }]
};

registerPlugin(myPlugin);
```

## Integration Points

### Store Actions

**Location:** `src/store/index.ts`

Add new actions to Zustand store:

```typescript
interface AppState {
  // ... existing state
  customAction: (param: any) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // ... existing actions
  customAction: (param) => {
    // Implementation
    set({ /* state update */ });
  }
}));
```

### Library Functions

**Location:** `src/lib/`

Create new utility files:

```typescript
// src/lib/custom-feature.ts
export function customFunction(param: any): Result {
  // Implementation
}
```

### Event Hooks

**Location:** `src/hooks/`

Create custom hooks:

```typescript
// src/hooks/useCustomFeature.ts
export function useCustomFeature() {
  const state = useAppStore();
  // Hook implementation
  return { /* hook API */ };
}
```

## Best Practices

### Code Organization

1. **Follow existing patterns** - Maintain consistency
2. **Type safety** - Use TypeScript types
3. **Modular code** - Separate concerns
4. **Documentation** - Comment complex logic

### Performance

1. **Optimize calculations** - Cache expensive operations
2. **Minimize re-renders** - Use React.memo when needed
3. **Efficient algorithms** - Consider complexity
4. **Lazy loading** - Load plugins on demand

### Testing

1. **Unit tests** - Test individual functions
2. **Integration tests** - Test feature interactions
3. **Edge cases** - Handle degenerate inputs
4. **Error handling** - Graceful failures

### Compatibility

1. **Backward compatibility** - Don't break existing features
2. **State migration** - Handle old state formats
3. **API stability** - Maintain consistent interfaces
4. **Versioning** - Track changes

## Examples

### Example: Star Shape

See "Adding New Shape Types" section above for complete example.

### Example: Spiral Hatching

```typescript
function generateSpiralHatch(shape: Shape, params: HatchParams): string[] {
  const center = { x: shape.x, y: shape.y };
  const maxRadius = getShapeBounds(shape).width / 2;
  const turns = params.spiralTurns || 5;
  const segments: string[] = [];
  
  for (let t = 0; t < turns; t += params.density / maxRadius) {
    const radius = (t / turns) * maxRadius;
    const angle = t * 2 * Math.PI;
    const x = center.x + radius * Math.cos(angle);
    const y = center.y + radius * Math.sin(angle);
    
    if (t === 0) {
      segments.push(`M ${x.toFixed(2)} ${y.toFixed(2)}`);
    } else {
      segments.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
    }
  }
  
  return [segments.join(' ')];
}
```

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API_REFERENCE.md](./API_REFERENCE.md) - API details
- [FEATURES.md](./FEATURES.md) - Existing features

