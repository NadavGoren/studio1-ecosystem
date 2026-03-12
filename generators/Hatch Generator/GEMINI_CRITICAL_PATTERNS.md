# 🚨 CRITICAL: Patterns Gemini Keeps Missing

This document addresses the **most common errors** Gemini makes even after reading the guide.

---

## Error #1: Partial<Shape> Type Assertion (MOST COMMON)

**The Problem:**
When you spread `Partial<Shape>` over a `Shape`, TypeScript sees a union type and can't guarantee type safety.

**❌ WRONG (causes TypeScript error):**
```typescript
updateShape: (id, updates) => set(state => {
  const index = state.shapes.findIndex(s => s.id === id);
  if (index === -1) return {};
  const newShapes = [...state.shapes];
  newShapes[index] = { ...newShapes[index], ...updates };  // ERROR!
  return { shapes: newShapes };
}),
```

**✅ CORRECT (must use `as Shape`):**
```typescript
updateShape: (id, updates) => set(state => {
  const index = state.shapes.findIndex(s => s.id === id);
  if (index === -1) return {};
  const newShapes = [...state.shapes];
  newShapes[index] = { ...newShapes[index], ...updates } as Shape;  // REQUIRED!
  return { shapes: newShapes };
}),
```

**Why this happens:**
- `Shape` is a union: `RectangleShape | EllipseShape | PolygonShape | ...`
- `Partial<Shape>` is also a union
- Spreading unions creates an incompatible type
- The `as Shape` assertion is safe because we're updating an existing shape with compatible properties

**When to use:**
- ANY time you spread `Partial<Shape>` over a `Shape`
- Examples: `updateShape`, `distributeSelection`, any function that updates shape properties

**Reference:** `src/store/index.ts:122` and `src/store/index.ts:242`

---

## Error #2: Missing Parameters in Implementation

**The Problem:**
Interface declares a parameter, but implementation doesn't include it.

**❌ WRONG:**
```typescript
interface AppState {
  distributeSelection: (type: 'horizontal' | 'vertical') => void;
}

distributeSelection: () => set((state) => {  // Missing 'type' parameter!
  // ...
})
```

**✅ CORRECT:**
```typescript
distributeSelection: (type: 'horizontal' | 'vertical') => set((state) => {
  // Must use 'type' parameter
  if (type === 'horizontal') { ... }
})
```

**Check:** Count parameters in interface vs implementation. They MUST match exactly.

---

## Error #3: Async/Sync Return Type Mismatch

**The Problem:**
Interface says `void` but implementation uses `async`, or vice versa.

**❌ WRONG:**
```typescript
interface AppState {
  saveProject: (name: string) => void;  // Says void
}

saveProject: async (name) => { ... }  // But async returns Promise<void>!
```

**✅ CORRECT:**
```typescript
interface AppState {
  saveProject: (name: string) => Promise<void>;  // Must match!
}

saveProject: async (name) => { ... }
```

**Rule:** 
- `async` in implementation → `Promise<void>` in interface
- No `async` in implementation → `void` in interface

---

## Error #4: Using `as` Instead of Type Guards (Paper.js)

**The Problem:**
Using unsafe type assertions instead of type guard functions.

**❌ WRONG:**
```typescript
const result = item.unite(next) as paper.PathItem;  // UNSAFE!
const children = (item.children as paper.Path[]).sort(...);  // UNSAFE!
```

**✅ CORRECT:**
```typescript
// First, define type guards (copy from src/lib/boolean.ts:27-41)
function isPathItem(item: paper.Item | null): item is paper.PathItem {
  return item !== null && (item instanceof paper.Path || item instanceof paper.CompoundPath);
}

// Then use them:
if (isPathItem(prev) && isPathItem(next)) {
  const result = prev.unite(next);  // Safe!
  if (result) { /* use result */ }
}

const children = item.children.filter(isPath).sort(...);  // Safe!
```

---

## Error #5: Not Checking for Null (Paper.js)

**The Problem:**
Paper.js boolean operations can return `null`, but code doesn't check.

**❌ WRONG:**
```typescript
let result: paper.PathItem = items[0];
result = result.unite(next);  // Could be null!
result.remove();  // CRASH if null!
```

**✅ CORRECT:**
```typescript
let result: paper.Item | null = items[0];  // Allow null

// ... operations ...

if (!result) return [];  // Always check!
result.remove();  // Safe now
```

---

## 🎯 QUICK FIX CHECKLIST

Before submitting code, ask:

1. ✅ **Partial<Shape> spread?** → Add `as Shape` assertion
2. ✅ **All parameters match?** → Count interface params vs implementation params
3. ✅ **Async function?** → Interface has `Promise<void>`, not `void`
4. ✅ **Sync function?** → Interface has `void`, not `Promise<void>`
5. ✅ **Paper.js type check?** → Use type guard, not `as`
6. ✅ **Paper.js operation?** → Check for `null` before using result

---

## 📝 COPY-PASTE SNIPPETS

### Safe Shape Update Pattern:
```typescript
newShapes[index] = { ...newShapes[index], ...updates } as Shape;
```

### Safe Partial Update in Map:
```typescript
const newShapes = state.shapes.map(s => 
  updates.has(s.id) ? { ...s, ...updates.get(s.id) } as Shape : s
);
```

### Async Function Pattern:
```typescript
// Interface
myFunction: (param: string) => Promise<void>;

// Implementation
myFunction: async (param) => {
  const state = get();
  // ... implementation
},
```

### Sync Function Pattern:
```typescript
// Interface
myFunction: (param: string) => void;

// Implementation
myFunction: (param) => set(s => ({
  // ... updates
})),
```

---

**Remember: When in doubt, check the working examples in `src/store/index.ts` and `src/lib/boolean.ts`!**




