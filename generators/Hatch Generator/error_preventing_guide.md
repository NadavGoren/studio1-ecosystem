# TypeScript Error Prevention Guide

**Reference Document** - For detailed copy-paste templates, see `GEMINI_INSTRUCTIONS.md`.

This guide explains the common TypeScript errors and their fixes. It references actual working code in the codebase.

---

## FILE 1: `src/store/index.ts` - Zustand Store Type Safety

### CRITICAL RULE #1: Async Functions Return Type Mismatch

**THE MOST COMMON ERROR:** Async functions MUST have `Promise<void>` in the interface, NOT `void`.

**Reference:** See working examples in `src/store/index.ts:72-77` (interface) and `src/store/index.ts:328-334` (implementation).

❌ **WRONG** - This causes TypeScript compilation error:
```typescript
interface AppState {
  saveProject: (name: string) => void;  // Says void
}

// Implementation:
saveProject: async (name) => { ... }  // But async ALWAYS returns Promise<void>!
```

✅ **CORRECT** - Interface MUST match implementation:
```typescript
interface AppState {
  // All async functions MUST return Promise<void>
  copyShapes: () => Promise<void>;
  pasteShapes: () => Promise<void>;
  saveProject: (name: string) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

// Implementations MUST use async keyword
copyShapes: async () => {
  const state = get();
  // ... implementation
},
```

**Rule:** If the implementation uses `async`, the interface MUST declare `Promise<void>`, NOT `void`.

**Working Code Reference:** `src/store/index.ts:73-77` (interface), `src/store/index.ts:328-334` (copyShapes implementation)

---

### CRITICAL RULE #2: Synchronous Functions Return Type

**Reference:** See working example in `src/store/index.ts:45` (interface) and `src/store/index.ts:113-116` (implementation).

❌ **WRONG:**
```typescript
interface AppState {
  addShape: (shape: Shape) => Promise<void>;  // Wrong type!
}

addShape: (shape) => set(s => ({ ... }))  // Returns void, not Promise!
```

✅ **CORRECT:**
```typescript
interface AppState {
  addShape: (shape: Shape) => void;  // Synchronous = void
}

addShape: (shape) => set(s => ({ 
  shapes: [...s.shapes, shape],
  hatchParams: { ...s.hatchParams, [shape.id]: { ... } }
}))
```

**Rule:** Non-async functions MUST return `void` in the interface.

**Working Code Reference:** `src/store/index.ts:45` (interface), `src/store/index.ts:113-116` (implementation)

---

### CRITICAL RULE #3: Function Parameter Matching

**Reference:** See working example in `src/store/index.ts:65` (interface) and `src/store/index.ts:201-244` (implementation).

Every parameter in the interface MUST exist in the implementation with matching type and optional status.

❌ **WRONG:**
```typescript
interface AppState {
  distributeSelection: (type: 'horizontal' | 'vertical') => void;
}

distributeSelection: () => {}  // Missing required parameter!
```

✅ **CORRECT:**
```typescript
interface AppState {
  distributeSelection: (type: 'horizontal' | 'vertical') => void;
}

distributeSelection: (type: 'horizontal' | 'vertical') => set((state) => {
  // Must use the 'type' parameter
  const selected = state.shapes.filter(s => state.selectedShapeIds.includes(s.id));
  if (selected.length < 3) return {};
  
  const sorted = [...selected].sort((a, b) => {
    const bA = getShapeBounds(a);
    const bB = getShapeBounds(b);
    if (type === 'horizontal') return (bA.x + bA.width/2) - (bB.x + bB.width/2);
    return (bA.y + bA.height/2) - (bB.y + bB.height/2);
  });
  // ... rest of implementation
})
```

**Rule:** Parameter count, types, names, and optional markers (`?`) must match exactly between interface and implementation.

**Working Code Reference:** `src/store/index.ts:65` (interface), `src/store/index.ts:201-244` (implementation)

---

### CRITICAL RULE #4: Zustand Setter Patterns

**Pattern for synchronous functions (use `set()` directly):**
**Reference:** `src/store/index.ts:113-116`
```typescript
addShape: (shape) => set(s => ({ 
  shapes: [...s.shapes, shape],
  hatchParams: { ...s.hatchParams, [shape.id]: defaultHatch }
}))
```

**Pattern for async functions (use `get()` and optionally `set()`):**
**Reference:** `src/store/index.ts:328-334`
```typescript
copyShapes: async () => {
  const state = get();  // Get current state first
  const selected = state.shapes.filter(s => state.selectedShapeIds.includes(s.id));
  if (selected.length > 0) {
    internalClipboard = JSON.parse(JSON.stringify(selected));
  }
},
```

**Pattern for synchronous functions that need `get()`:**
**Reference:** `src/store/index.ts:147-151`
```typescript
undo: () => {
  const s = get();  // Get state first
  if (!s.history.past.length) return;
  const prev = s.history.past[s.history.past.length - 1];
  set({ ...prev, history: { ... } });  // Then use set()
}
```

---

## FILE 2: `src/lib/boolean.ts` - Paper.js Type Safety

### CRITICAL RULE #5: Never Use Unsafe Type Assertions

**Reference:** Type guard functions are defined in `src/lib/boolean.ts:27-41`. Usage example in `src/lib/boolean.ts:78-92`.

❌ **WRONG** - Dangerous type assertions:
```typescript
const result = items[0];
const newResult = result.unite(next) as paper.PathItem;  // UNSAFE!
// What if unite returns null? What if it returns Group?
```

❌ **WRONG** - Unsafe child type assumption:
```typescript
const children = (item.children as paper.Path[]).sort(...);
// CompoundPath.children returns Item[], not Path[]!
```

✅ **CORRECT** - Use Type Guards:
```typescript
// Define type guard functions (copy from src/lib/boolean.ts:27-41):
function isPathItem(item: paper.Item | null): item is paper.PathItem {
  return item !== null && (item instanceof paper.Path || item instanceof paper.CompoundPath);
}

function isPath(item: paper.Item): item is paper.Path {
  return item instanceof paper.Path;
}

function isCompoundPath(item: paper.Item): item is paper.CompoundPath {
  return item instanceof paper.CompoundPath;
}

function isGroup(item: paper.Item): item is paper.Group {
  return item instanceof paper.Group;
}

// Use type guards to safely narrow types:
if (isPathItem(prev) && isPathItem(next)) {
  const newResult = prev.unite(next);  // TypeScript knows types are safe
  if (newResult) {
    result = newResult;
  }
}
```

**Rule:** Always use type guards (`instanceof` checks in functions) instead of `as` type assertions when working with Paper.js types.

**Working Code Reference:** `src/lib/boolean.ts:27-41` (type guards), `src/lib/boolean.ts:78-92` (usage)

---

### CRITICAL RULE #6: Always Handle Null Returns

**Reference:** See null handling pattern in `src/lib/boolean.ts:61-97`.

Paper.js boolean operations can return `null` when operations fail or produce no result.

❌ **WRONG:**
```typescript
let result: paper.PathItem = items[0];
result = result.unite(next);  // Could be null!
result.remove();  // CRASH if result is null!
```

✅ **CORRECT** - Always check for null:
```typescript
let result: paper.Item | null = items[0];  // Allow null in type

for (let i = 1; i < items.length; i++) {
  const next = items[i];
  const prev = result;
  
  // Check for null BEFORE using
  if (!prev) {
    if (op === 'union') {
      result = next;
      continue;
    } else {
      next.remove();
      continue;
    }
  }
  
  if (isPathItem(prev) && isPathItem(next)) {
    let newResult: paper.Item | null = null;
    if (op === 'union') newResult = prev.unite(next);
    else if (op === 'subtract') newResult = prev.subtract(next);
    // ... other operations
    
    result = newResult;  // Could still be null
  }
}

// Always check before using result
if (!result) return [];
result.remove();  // Safe now
```

**Rule:** Paper.js boolean operations (`unite`, `subtract`, `intersect`, `exclude`) can return `null`. Always check for null before using the result.

**Working Code Reference:** `src/lib/boolean.ts:61-97`

---

### CRITICAL RULE #7: Handle All Possible Return Types

**Reference:** See complete type handling in `src/lib/boolean.ts:101-130`.

Paper.js boolean operations can return multiple types:
- `paper.Path` (simple shape, no holes)
- `paper.CompoundPath` (shape with holes)
- `paper.Group` (disjoint shapes)
- `null` (operation failed)

✅ **CORRECT** - Handle all cases:
```typescript
const processItem = (item: paper.Item) => {
  if (isCompoundPath(item)) {
    // Handle CompoundPath (has holes)
    const pathChildren = item.children.filter(isPath);  // Type guard filter
    pathChildren.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
    
    if (pathChildren.length > 0) {
      const body = pathChildren[0];
      body.flatten(0.5);  // Safe call on Path
      const points = body.segments.map(s => ({ x: s.point.x, y: s.point.y }));
      const holes = pathChildren.slice(1).map(h => {
        h.flatten(0.5);
        return h.segments.map(s => ({ x: s.point.x, y: s.point.y }));
      });
      output.push({ points, holes });
    }
  } 
  else if (isPath(item)) {
    // Handle simple Path (no holes)
    item.flatten(0.5);
    output.push({
      points: item.segments.map(s => ({ x: s.point.x, y: s.point.y })),
      holes: []
    });
  } 
  else if (isGroup(item)) {
    // Handle Group (multiple disjoint shapes)
    item.children.forEach(child => processItem(child));  // Recurse
  }
};
```

**Rule:** Use type guards to check each possible type and handle them appropriately.

**Working Code Reference:** `src/lib/boolean.ts:101-130`

---

### CRITICAL RULE #8: Safe Child Filtering

**Reference:** See safe filtering in `src/lib/boolean.ts:105`.

❌ **WRONG:**
```typescript
const children = (item.children as paper.Path[]).sort(...);
// Unsafe! children could contain Groups or other Item types
```

✅ **CORRECT** - Use type guard filter:
```typescript
const pathChildren = item.children.filter(isPath);  // Type guard filters safely
pathChildren.sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
// Now pathChildren is guaranteed to be paper.Path[]
```

**Rule:** Use `.filter(isPath)` or `.filter(isPathItem)` instead of type assertions when filtering Paper.js item collections.

**Working Code Reference:** `src/lib/boolean.ts:105`

---

## COMPLETE CHECKLIST BEFORE GENERATING CODE

### For `src/store/index.ts`:
- [ ] Every `async` function → interface declares `Promise<void>`
- [ ] Every non-async function → interface declares `void`
- [ ] All parameters match exactly (count, types, names, optional markers)
- [ ] Zustand setters use correct pattern: `set()` for sync, `get()` + `set()` for async when needed
- [ ] No missing parameters in implementations

### For `src/lib/boolean.ts`:
- [ ] Never use `as` type assertions without validation
- [ ] Always use type guard functions (`isPath`, `isCompoundPath`, `isGroup`, `isPathItem`)
- [ ] Always check for `null` after Paper.js boolean operations
- [ ] Handle all possible return types: `Path`, `CompoundPath`, `Group`, `null`
- [ ] Use `.filter(isPath)` instead of `as paper.Path[]` for type narrowing
- [ ] Type variables as `paper.Item | null` when operations can return null

---

## QUICK REFERENCE: Common Mistakes Table

| Error Type | ❌ Wrong | ✅ Correct |
|-----------|---------|-----------|
| **Async return** | Interface: `void`, Impl: `async` | Both: `Promise<void>` |
| **Sync return** | Interface: `Promise<void>`, Impl: no `async` | Both: `void` |
| **Missing param** | Interface has param, impl doesn't | Implementation includes all params |
| **Unsafe assertion** | `item as paper.Path` | `if (isPath(item)) { ... }` |
| **Null handling** | `result.unite()` then use result | `if (!result) return [];` |
| **Child filtering** | `item.children as paper.Path[]` | `item.children.filter(isPath)` |
| **Type narrowing** | Assume type after operation | Use type guards to check |

---

## FINAL REMINDER

TypeScript will catch these errors at compile time. If you see type errors:

1. ✅ Check if async functions have `Promise<void>` in interface (not `void`)
2. ✅ Check if all parameters match between interface and implementation
3. ✅ Replace `as` assertions with type guard functions
4. ✅ Add null checks after Paper.js operations
5. ✅ Handle all possible return types with type guards

**For copy-paste templates and exact working code examples, see `GEMINI_INSTRUCTIONS.md`.**

**These rules prevent the most common TypeScript errors in this codebase. Follow them strictly when generating or modifying code.**
