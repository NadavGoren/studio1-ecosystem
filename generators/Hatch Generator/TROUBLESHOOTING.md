# Troubleshooting Guide

## Overview

This document covers common issues, performance optimization, known limitations, debugging tips, and error handling in HatchStudio.

## Common Issues

### Shapes Not Appearing

**Symptoms:**
- Shape created but not visible
- Shape disappears after creation

**Solutions:**
1. **Check visibility** - Eye icon in layers panel
2. **Check bounds** - Shape may be outside viewport
3. **Zoom out** - Shape may be very small
4. **Check color** - Shape may be same color as background
5. **Check stroke width** - May be too thin to see

**Debug:**
```typescript
// Check shape properties
console.log(shape.visible, shape.color, shape.strokeWidth);
```

### Hatching Not Rendering

**Symptoms:**
- Hatching enabled but no lines appear
- Hatching disappears

**Solutions:**
1. **Check enabled** - Hatching toggle must be on
2. **Check density** - May be too sparse (increase value)
3. **Check shape size** - Shape may be too small
4. **Check angle** - Lines may be outside shape bounds
5. **Check visibility** - Shape must be visible

**Debug:**
```typescript
// Check hatch params
console.log(hatchParams[shapeId]);
// Check generated lines
const lines = generateHatchLines(shape, params);
console.log('Lines:', lines.length);
```

### Boolean Operations Fail

**Symptoms:**
- Operation produces no result
- Operation produces incorrect result
- Error in console

**Solutions:**
1. **Check selection** - Need 2+ overlapping shapes
2. **Check overlap** - Shapes must actually overlap
3. **Check shape validity** - Shapes must be valid
4. **Check Paper.js** - Library may not be initialized
5. **Try simpler shapes** - Complex shapes may fail

**Debug:**
```typescript
// Check shapes
console.log('Shapes:', selectedShapes);
// Check overlap
const bounds1 = getShapeBounds(shape1);
const bounds2 = getShapeBounds(shape2);
console.log('Overlap:', checkOverlap(bounds1, bounds2));
```

### Export Issues

**Symptoms:**
- SVG file empty
- SVG file incorrect
- Export fails

**Solutions:**
1. **Check visibility** - Only visible shapes exported
2. **Check file size** - May be too large
3. **Check browser** - Some browsers have limits
4. **Try different filename** - Invalid characters
5. **Check console** - Look for errors

**Debug:**
```typescript
// Check export
const svg = exportToSVG(state);
console.log('SVG length:', svg.length);
console.log('Shapes:', shapes.filter(s => s.visible).length);
```

### Performance Issues

**Symptoms:**
- Slow rendering
- Laggy interactions
- High CPU usage

**Solutions:**
1. **Reduce shape count** - Too many shapes
2. **Reduce hatch density** - Too many lines
3. **Disable outlines** - Reduce rendering
4. **Close other tabs** - Free up resources
5. **Check browser** - Update browser

**Optimization:**
- Use zig-zag hatching (fewer paths)
- Reduce hatch density
- Hide invisible shapes
- Simplify complex shapes

### Snapping Not Working

**Symptoms:**
- Shapes don't snap
- Snap guides don't appear

**Solutions:**
1. **Check snapping settings** - Must be enabled
2. **Check threshold** - May be too small
3. **Check distance** - Must be within 5mm
4. **Check shape validity** - Invalid shapes don't snap
5. **Try different shapes** - Some shapes may not snap

**Debug:**
```typescript
// Check snapping config
console.log(snapping);
// Check snap result
const snap = getNearestSnap(bounds, state);
console.log('Snap:', snap);
```

## Performance Optimization

### Rendering Optimization

**Strategies:**
1. **Viewport culling** - Only render visible shapes
2. **Level of detail** - Simplify at low zoom
3. **Debounce updates** - Batch state changes
4. **Memoization** - Cache calculations
5. **Virtual scrolling** - For large layer lists

**Implementation:**
```typescript
// Viewport culling
const visibleShapes = shapes.filter(shape => {
  const bounds = getShapeBounds(shape);
  return isInViewport(bounds, viewTransform);
});
```

### State Optimization

**Strategies:**
1. **Selective subscriptions** - Only subscribe to needed state
2. **Batch updates** - Group related changes
3. **History limits** - Limit undo/redo stack
4. **Lazy loading** - Load on demand
5. **Cleanup** - Remove unused data

**Implementation:**
```typescript
// Selective subscription
const shapes = useAppStore(state => state.shapes);
// Instead of
const state = useAppStore(); // Subscribes to everything
```

### Calculation Optimization

**Strategies:**
1. **Cache results** - Store computed values
2. **Early exits** - Skip unnecessary work
3. **Efficient algorithms** - Use optimal complexity
4. **Web Workers** - Offload heavy calculations
5. **Incremental updates** - Update only changed parts

**Implementation:**
```typescript
// Cache bounding boxes
const boundsCache = new Map<string, Bounds>();
function getCachedBounds(shape: Shape): Bounds {
  if (!boundsCache.has(shape.id)) {
    boundsCache.set(shape.id, getShapeBounds(shape));
  }
  return boundsCache.get(shape.id)!;
}
```

## Known Limitations

### Browser Limitations

- **localStorage size** - Limited to ~5-10MB
- **Canvas size** - Some browsers have limits
- **Memory** - Large projects may be slow
- **SVG complexity** - Very complex SVGs may not render

### Feature Limitations

- **No text tool** - Text not yet implemented
- **No image import** - Images not supported
- **No gradients** - Only solid colors
- **No patterns** - Only hatching patterns
- **No layers** - Flat shape list (groups only)

### Precision Limitations

- **Floating point** - May have precision errors
- **Sub-millimeter** - Very small values may be inaccurate
- **Large coordinates** - May cause overflow
- **Rotation** - Accumulated errors possible

## Debugging Tips

### Console Logging

**State Inspection:**
```typescript
// Log current state
console.log('State:', useAppStore.getState());

// Log specific values
console.log('Shapes:', shapes);
console.log('Selection:', selectedShapeIds);
console.log('View:', viewTransform);
```

### Breakpoints

**Browser DevTools:**
1. Open DevTools (F12)
2. Go to Sources tab
3. Set breakpoints in code
4. Step through execution

**React DevTools:**
1. Install React DevTools extension
2. Inspect component props/state
3. Track re-renders
4. Profile performance

### Error Boundaries

**Location:** `src/components/ErrorBoundary.tsx`

**Usage:**
- Catches React errors
- Displays error message
- Prevents app crash
- Logs errors to console

### Performance Profiling

**React Profiler:**
1. Enable Profiler in React DevTools
2. Record interaction
3. Analyze render times
4. Identify bottlenecks

**Chrome Performance:**
1. Open Performance tab
2. Record interaction
3. Analyze timeline
4. Find slow operations

## Error Handling

### Error Types

**Runtime Errors:**
- Invalid state
- Calculation errors
- Rendering errors

**User Errors:**
- Invalid input
- Impossible operations
- Missing data

**System Errors:**
- Storage failures
- Network errors (future)
- Browser limitations

### Error Recovery

**Strategies:**
1. **Graceful degradation** - Continue with reduced functionality
2. **User feedback** - Show error messages
3. **State recovery** - Restore previous state
4. **Validation** - Prevent invalid operations
5. **Fallbacks** - Provide alternatives

**Implementation:**
```typescript
try {
  const result = performOperation();
} catch (error) {
  console.error('Operation failed:', error);
  // Show user-friendly message
  alert('Operation failed. Please try again.');
  // Restore state if needed
  undo();
}
```

### Validation

**Input Validation:**
```typescript
function validateShape(shape: Shape): boolean {
  if (!shape || !shape.id) return false;
  if (!Number.isFinite(shape.x) || !Number.isFinite(shape.y)) return false;
  if (shape.type === 'rectangle' && (!shape.width || !shape.height)) return false;
  // More validation...
  return true;
}
```

**State Validation:**
```typescript
function validateState(state: ProjectState): boolean {
  // Check required fields
  if (!state.paper || !state.shapes) return false;
  // Check shape validity
  if (!state.shapes.every(validateShape)) return false;
  // More validation...
  return true;
}
```

## Getting Help

### Resources

- **Documentation** - See other .md files
- **Code comments** - Inline documentation
- **Type definitions** - TypeScript types
- **Examples** - Feature examples

### Reporting Issues

**Include:**
1. **Description** - What happened
2. **Steps** - How to reproduce
3. **Expected** - What should happen
4. **Actual** - What actually happened
5. **Environment** - Browser, OS, version
6. **Console logs** - Any error messages

### Common Solutions

**Clear Cache:**
- Clear browser cache
- Clear localStorage
- Hard refresh (Ctrl+Shift+R)

**Reset State:**
- Create new project
- Reload page
- Clear all data

**Update:**
- Update browser
- Update dependencies
- Check for updates

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API_REFERENCE.md](./API_REFERENCE.md) - API details
- [FEATURES.md](./FEATURES.md) - Feature documentation

