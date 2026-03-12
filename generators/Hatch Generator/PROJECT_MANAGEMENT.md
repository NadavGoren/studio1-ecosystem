# Project Management Documentation

## Overview

HatchStudio includes a project save/load system that persists complete design state to browser local storage. Projects include thumbnails, metadata, and full state snapshots.

## Save System

### Save Process

**Function:** `saveProject(name: string): Promise<void>`

**Steps:**
1. Create state snapshot
2. Generate thumbnail
3. Create saved project object
4. Add to saved projects array
5. Persist to localStorage

**Code:**
```typescript
const snapshot = createStateSnapshot(state);
const thumbnail = await generateThumbnail(state);
const savedProject: SavedProject = {
  id: crypto.randomUUID(),
  name: name.trim(),
  date: Date.now(),
  data: snapshot,
  thumbnail
};
```

### State Snapshot

**Structure:**
```typescript
interface StateSnapshot {
  paper: PaperSettings;
  shapes: Shape[];
  selectedShapeIds: string[];  // Excluded from comparison
  viewTransform: ViewTransform;
  hatchParams: Record<string, HatchParams>;
  tool: ToolType;
  snapping: SnappingConfig;
}
```

**Exclusions:**
- Selection state (preserved during undo/redo)
- UI-only state (eyedropper mode, swatches)

### Thumbnail Generation

**Function:** `generateThumbnail(state: ProjectState): Promise<string>`

**Process:**
1. Export to SVG
2. Convert mm units to pixels
3. Create Image from SVG
4. Draw on Canvas
5. Convert to base64 PNG

**Specifications:**
- Size: 200×200px (maintains aspect ratio)
- Format: PNG (base64 data URL)
- Background: White

**Code:**
```typescript
const svg = exportToSVG(state);
const img = new Image();
img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
// Draw on canvas and convert to base64
```

## Load System

### Load Process

**Function:** `loadProject(id: string): Promise<void>`

**Steps:**
1. Find project by ID
2. Restore state from snapshot
3. Reset history (fresh start)
4. Update UI

**Code:**
```typescript
const project = savedProjects.find(p => p.id === id);
if (!project) return;

set({
  paper: project.data.paper,
  shapes: project.data.shapes,
  selectedShapeIds: project.data.selectedShapeIds,
  viewTransform: project.data.viewTransform,
  hatchParams: project.data.hatchParams,
  tool: project.data.tool,
  snapping: project.data.snapping,
  history: { past: [], present: project.data, future: [] }
});
```

### Confirmation

**Behavior:**
- Shows confirmation if unsaved changes exist
- Prevents accidental data loss
- User can cancel load

**Implementation:**
```typescript
if (hasUnsavedChanges) {
  if (!confirm('Load project? Unsaved changes will be lost.')) {
    return;
  }
}
```

## Delete System

### Delete Process

**Function:** `deleteProject(id: string): Promise<void>`

**Steps:**
1. Show confirmation dialog
2. Filter out project from array
3. Update localStorage
4. Update state

**Code:**
```typescript
if (confirm('Delete project?')) {
  const updated = savedProjects.filter(p => p.id !== id);
  set({ savedProjects: updated });
  saveSavedProjects(updated);
}
```

## Storage

### LocalStorage

**Key:** `hatchstudio-saved-projects`

**Format:** JSON array of `SavedProject` objects

**Structure:**
```json
[
  {
    "id": "uuid",
    "name": "Project Name",
    "date": 1234567890,
    "data": { /* StateSnapshot */ },
    "thumbnail": "data:image/png;base64,..."
  }
]
```

### Persistence

**Save:**
```typescript
localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
```

**Load:**
```typescript
const stored = localStorage.getItem(STORAGE_KEY);
if (stored) {
  return JSON.parse(stored);
}
```

### Limitations

- **Browser storage** - Limited to ~5-10MB
- **Same origin** - Projects only available in same browser
- **No sync** - Projects don't sync across devices
- **No backup** - Lost if browser data cleared

## SavedProject Interface

```typescript
interface SavedProject {
  id: string;              // UUID
  name: string;            // User-provided name
  date: number;            // Timestamp
  data: StateSnapshot;     // Complete state
  thumbnail?: string;      // Base64 PNG (optional)
}
```

### Metadata

**ID:**
- Generated with `crypto.randomUUID()`
- Unique identifier
- Used for load/delete operations

**Name:**
- User-provided
- Trimmed of whitespace
- Displayed in projects list

**Date:**
- Timestamp (milliseconds since epoch)
- Used for sorting
- Displayed as formatted date

**Thumbnail:**
- Optional (may fail to generate)
- Base64 PNG data URL
- 200×200px preview

## UI Integration

### Projects Tab

**Location:** `src/components/LeftPanel.tsx`

**Features:**
- Save current project input
- Projects list with thumbnails
- Load/Delete buttons
- Project metadata display

**Layout:**
```
[Save Section]
  - Name input
  - Save button

[Projects List]
  - Thumbnail (or placeholder)
  - Name
  - Date
  - Shape count
  - Load button
  - Delete button
```

### Project Display

**Thumbnail:**
- 64×64px display
- Maintains aspect ratio
- Fallback icon if missing

**Metadata:**
- Name (truncated if long)
- Formatted date (e.g., "Jan 15, 2:30 PM")
- Shape count

**Actions:**
- Load button (full width)
- Delete button (hover, top-right)

## State Management

### History Reset

**On Load:**
- History cleared (past: [], future: [])
- Present set to loaded snapshot
- Fresh undo/redo stack

**Reason:**
- Prevents confusion
- Clean state after load
- User can start fresh

### Selection Preservation

**On Load:**
- Selection restored from snapshot
- Maintains user's selection state
- Useful for continuing work

## Error Handling

### Thumbnail Generation

**Failure:**
- Catches errors gracefully
- Continues without thumbnail
- Logs error to console

**Code:**
```typescript
try {
  thumbnail = await generateThumbnail(state);
} catch (e) {
  console.error('Failed to generate thumbnail:', e);
  // Continue without thumbnail
}
```

### Storage Errors

**Quota Exceeded:**
- localStorage may be full
- Handle gracefully
- Warn user

**Parse Errors:**
- Invalid JSON
- Corrupted data
- Return empty array

**Code:**
```typescript
try {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
} catch (e) {
  console.error('Failed to load saved projects:', e);
  return [];
}
```

## Best Practices

### For Users

1. **Save frequently** - Prevent data loss
2. **Use descriptive names** - Easy to identify
3. **Clean up old projects** - Free storage space
4. **Export important designs** - Backup as SVG

### For Developers

1. **Handle errors** - Graceful failures
2. **Validate data** - Check snapshot structure
3. **Optimize thumbnails** - Balance quality/size
4. **Consider migration** - Future format changes

## Future Enhancements

### Potential Features

- **Export/Import** - JSON file format
- **Cloud sync** - Cross-device access
- **Version history** - Multiple saves per project
- **Auto-save** - Periodic saves
- **Project templates** - Reusable starting points

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [API_REFERENCE.md](./API_REFERENCE.md) - API details
- [EXPORT_SYSTEM.md](./EXPORT_SYSTEM.md) - SVG export

