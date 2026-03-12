# Gemini Code Generation Instructions

**READ THIS FIRST** before generating any code for `src/store/index.ts` or `src/lib/boolean.ts`.

This guide provides exact copy-paste patterns from working code. Follow these patterns exactly to avoid TypeScript errors.

---

## 🚨 CRITICAL RULES

### Rule 1: Async Functions = Promise<void>
If you use `async` in the implementation, the interface MUST declare `Promise<void>`, NOT `void`.

### Rule 2: Sync Functions = void
If you DON'T use `async`, the interface MUST declare `void`, NOT `Promise<void>`.

### Rule 3: Parameters Must Match Exactly
Every parameter in the interface must exist in the implementation with the same type, name, and optional status.

### Rule 4: Never Use `as` Type Assertions
Always use type guard functions (`isPath`, `isPathItem`, etc.) instead of `as` assertions.

### Rule 5: Always Check for Null
Paper.js operations can return `null`. Always check before using the result.

### Rule 6: Partial<Shape> Updates Need Type Assertion
When spreading `Partial<Shape>` over a `Shape`, you MUST use `as Shape` assertion because TypeScript can't narrow union types from spreads.

---

## 📋 COPY-PASTE TEMPLATES

### Template 1: Zustand Async Function

**Interface (in `AppState`):**
```typescript
myAsyncFunction: (param: string) => Promise<void>;
```

**Implementation:**
```typescript
myAsyncFunction: async (param) => {
  const state = get();  // Get state first
  // ... your implementation
},
```

**Working Example** (from `src/store/index.ts:328-334`):
```typescript
copyShapes: async () => {
  const state = get();
  const selected = state.shapes.filter(s => state.selectedShapeIds.includes(s.id));
  if (selected.length > 0) {
    internalClipboard = JSON.parse(JSON.stringify(selected));
  }
},
```

---

### Template 2: Zustand Sync Function

**Interface (in `AppState`):**
```typescript
mySyncFunction: (param: string) => void;
```

**Implementation:**
```typescript
mySyncFunction: (param) => set(s => ({
  // ... state updates
})),
```

**Working Example** (from `src/store/index.ts:113-116`):
```typescript
addShape: (shape) => set(s => {
  const newHatch = { ...s.hatchParams, [shape.id]: { enabled: false, density: 2, angle: 45, offset: 0, originX: shape.x, originY: shape.y, gradientEnabled: false, gradientStart: 2, gradientEnd: 5, crossHatchEnabled: false, crossHatchAngle: 135, crossHatchPerpendicular: true, zigZagEnabled: false, spaceMode: 'local' as const, renderOutline: true, fillRule: 'nonzero' as const } };
  return { shapes: [...s.shapes, shape], hatchParams: newHatch };
}),
```

---

### Template 3: Updating Shapes with Partial<Shape>

**CRITICAL:** When spreading `Partial<Shape>` over a `Shape`, TypeScript can't guarantee type safety. You MUST use `as Shape` assertion.

**Interface:**
```typescript
updateShape: (id: string, updates: Partial<Shape>) => void;
```

**Implementation:**
```typescript
updateShape: (id, updates) => set(state => {
  const index = state.shapes.findIndex(s => s.id === id);
  if (index === -1) return {};
  const newShapes = [...state.shapes];
  newShapes[index] = { ...newShapes[index], ...updates } as Shape;  // MUST use 'as Shape'
  return { shapes: newShapes };
}),
```

**Working Example** (from `src/store/index.ts:118-124`):
```typescript
updateShape: (id, updates) => set(state => {
  const index = state.shapes.findIndex(s => s.id === id);
  if (index === -1) return {};
  const newShapes = [...state.shapes];
  newShapes[index] = { ...newShapes[index], ...updates } as Shape;
  return { shapes: newShapes };
}),
```

**Why?** `Partial<Shape>` is a union type. When you spread it, TypeScript can't narrow the type. The `as Shape` assertion is safe because we're updating an existing shape with compatible properties.

**Also applies to:** Any function that spreads `Partial<Shape>` over a `Shape` (e.g., `distributeSelection` line 242).

---

### Template 4: Sync Function with get()

**Interface:**
```typescript
myFunction: () => void;
```

**Implementation:**
```typescript
myFunction: () => {
  const s = get();  // Get state first
  if (!s.someCondition) return;
  set({ /* updates */ });  // Then use set()
}
```

**Working Example** (from `src/store/index.ts:147-151`):
```typescript
undo: () => {
  const s = get();
  if (!s.history.past.length) return;
  const prev = s.history.past[s.history.past.length - 1];
  set({ ...prev, history: { past: s.history.past.slice(0, -1), present: prev, future: [createStateSnapshot(s), ...s.history.future] } });
},
```

---

### Template 5: Paper.js Type Guards (COPY EXACTLY)

**Copy these functions exactly** (from `src/lib/boolean.ts:27-41`):
```typescript
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
```

**Usage Pattern:**
```typescript
if (isPathItem(prev) && isPathItem(next)) {
  const newResult = prev.unite(next);  // TypeScript knows types are safe
  if (newResult) {  // Always check for null
    result = newResult;
  }
}
```

**Working Example** (from `src/lib/boolean.ts:78-92`):
```typescript
if (isPathItem(prev) && isPathItem(next)) {
  let newResult: paper.Item | null = null;
  
  if (op === 'union') newResult = prev.unite(next);
  else if (op === 'subtract') newResult = prev.subtract(next);
  else if (op === 'intersect') newResult = prev.intersect(next);
  else if (op === 'exclude') newResult = prev.exclude(next);
  
  if (prev !== newResult && prev !== items[0]) prev.remove();
  next.remove();
  
  result = newResult;
}
```

---

### Template 6: Null Handling Pattern

**Always type as `paper.Item | null` when operations can return null:**
```typescript
let result: paper.Item | null = items[0];

// ... operations that might return null

if (!result) return [];  // Always check before use

// Now safe to use result
result.remove();
```

**Working Example** (from `src/lib/boolean.ts:61-97`):
```typescript
let result: paper.Item | null = items[0];

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
  
  // ... rest of logic
}

if (!result) return [];  // Final check
```

---

### Template 7: Safe Child Filtering

**❌ WRONG:**
```typescript
const children = (item.children as paper.Path[]).sort(...);
```

**✅ CORRECT:**
```typescript
const pathChildren = item.children.filter(isPath).sort(...);
```

**Working Example** (from `src/lib/boolean.ts:105`):
```typescript
const children = item.children.filter(isPath).sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
```

---

### Template 8: Handle All Paper.js Return Types

**Pattern for processing Paper.js results:**
```typescript
const processItem = (item: paper.Item) => {
  if (isCompoundPath(item)) {
    // Handle CompoundPath (has holes)
    const pathChildren = item.children.filter(isPath).sort(...);
    // ... process holes
  } 
  else if (isPath(item)) {
    // Handle simple Path (no holes)
    item.flatten(0.5);
    // ... process points
  } 
  else if (isGroup(item)) {
    // Handle Group (multiple disjoint shapes)
    item.children.forEach(child => processItem(child));  // Recurse
  }
};
```

**Working Example** (from `src/lib/boolean.ts:101-130`):
```typescript
const processItem = (item: paper.Item) => {
  if (isCompoundPath(item)) {
    const children = item.children.filter(isPath).sort((a, b) => Math.abs(b.area) - Math.abs(a.area));
    
    if (children.length > 0) {
      const body = children[0];
      body.flatten(0.5);
      const points = body.segments.map(s => ({ x: s.point.x, y: s.point.y }));
      const holes = children.slice(1).map(h => {
        h.flatten(0.5);
        return h.segments.map(s => ({ x: s.point.x, y: s.point.y }));
      });
      output.push({ points, holes });
    }
  } 
  else if (isPath(item)) {
    item.flatten(0.5);
    output.push({
      points: item.segments.map(s => ({ x: s.point.x, y: s.point.y })),
      holes: []
    });
  } 
  else if (isGroup(item)) {
    item.children.forEach(child => processItem(child));
  }
};
```

---

## ✅ PRE-SUBMISSION CHECKLIST

Before submitting any code, verify:

### For `src/store/index.ts`:
- [ ] Every `async` function in implementation → interface has `Promise<void>`
- [ ] Every non-`async` function → interface has `void`
- [ ] All parameters in interface match implementation (count, types, names)
- [ ] Async functions use `get()` to read state
- [ ] Sync functions use `set()` directly (or `get()` then `set()` if needed)
- [ ] Any `Partial<Shape>` spread uses `as Shape` assertion: `{ ...shape, ...updates } as Shape`

### For `src/lib/boolean.ts`:
- [ ] Type guard functions are defined (copy from lines 27-41)
- [ ] No `as` type assertions used
- [ ] All Paper.js operations check for `null` before use
- [ ] Variables typed as `paper.Item | null` when operations can return null
- [ ] Child filtering uses `.filter(isPath)` not `as paper.Path[]`
- [ ] All return types handled: `Path`, `CompoundPath`, `Group`, `null`

---

## 🔍 COMMON ERRORS → FIXES

| Error | Wrong Code | Correct Code |
|-------|-----------|--------------|
| **Async return mismatch** | Interface: `void`, Impl: `async` | Both: `Promise<void>` |
| **Sync return mismatch** | Interface: `Promise<void>`, Impl: no `async` | Both: `void` |
| **Missing parameter** | Interface has `(type: string)`, impl has `()` | Implementation includes all params |
| **Unsafe assertion** | `item as paper.Path` | `if (isPath(item)) { ... }` |
| **Null crash** | `result.unite()` then use result | `if (!result) return [];` then use |
| **Wrong child type** | `item.children as paper.Path[]` | `item.children.filter(isPath)` |
| **Partial<Shape> spread** | `{ ...shape, ...updates }` | `{ ...shape, ...updates } as Shape` |

---

## 📚 REFERENCE FILES

- **Working Zustand patterns:** `src/store/index.ts` (lines 72-77 for async, 113-116 for sync)
- **Working Paper.js patterns:** `src/lib/boolean.ts` (lines 27-41 for type guards, 61-97 for null handling)
- **Type definitions:** `src/types/index.ts`

---

## 🎯 QUICK DECISION TREE

**Adding a function to `src/store/index.ts`?**

1. Will it use `async`? → Interface: `Promise<void>`, Implementation: `async () => { const state = get(); ... }`
2. Will it NOT use `async`? → Interface: `void`, Implementation: `(param) => set(s => ({ ... }))`
3. Does it need to read state first? → Use `get()` then `set()`

**Working with Paper.js in `src/lib/boolean.ts`?**

1. Need to check item type? → Use type guard: `if (isPathItem(item)) { ... }`
2. Calling boolean operation? → Check for null: `if (!result) return [];`
3. Filtering children? → Use `.filter(isPath)` not `as paper.Path[]`
4. Processing result? → Handle all types: `isCompoundPath`, `isPath`, `isGroup`

---

**Remember: When in doubt, copy the exact pattern from the working examples above.**




