import { useEffect } from 'react';
import { useAppStore } from '../store';

export function useKeyboardShortcuts() {
  const { 
    setTool, undo, redo, deleteShapes, 
    selectedShapeIds, selectShapes, shapes, 
    resetView, setViewTransform, viewTransform, zoomToFit,
    nudgeSelection, groupSelection, ungroupSelection,
    copyShapes, pasteShapes, duplicateSelection,
    saveProject, currentProjectId, savedProjects
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        return;
      }

      // Tools (only when no modifiers are pressed)
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v': setTool('select'); break;
          case 'a': setTool('direct_select'); break;
          case 'm': setTool('rectangle'); break;
          case 'l': setTool('ellipse'); break; // In Illustrator L is Ellipse
          case 'p': setTool('polygon'); break;
          case '\\': setTool('line'); break; // Line tool on backslash
          case 'i': setTool('eyedropper'); break;
        }
      }

      // Actions
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedShapeIds.length > 0) {
          e.preventDefault();
          deleteShapes(selectedShapeIds);
        }
      }

      // Nudging
      if (selectedShapeIds.length > 0 && !e.ctrlKey && !e.metaKey && (e.key.startsWith('Arrow'))) {
         e.preventDefault();
         const step = e.shiftKey ? 10 : 1; 
         if (e.key === 'ArrowUp') nudgeSelection(0, -step);
         if (e.key === 'ArrowDown') nudgeSelection(0, step);
         if (e.key === 'ArrowLeft') nudgeSelection(-step, 0);
         if (e.key === 'ArrowRight') nudgeSelection(step, 0);
      }

      // Modifiers
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === 'c') {
          e.preventDefault();
          copyShapes();
          return;
        }
        if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          pasteShapes();
          return;
        }
        if (e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
             redo();
          } else {
             undo();
          }
        }
        if (e.key === 'y') {
          e.preventDefault();
          redo();
        }
        if (e.key === 'a') {
          e.preventDefault();
          // FIX: Only select unlocked shapes
          const unlockedIds = shapes.filter(s => !s.locked).map(s => s.id);
          selectShapes(unlockedIds);
        }
        if (e.key === '0') {
          e.preventDefault();
          zoomToFit(); // Call the new action
        }
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setViewTransform({ scale: viewTransform.scale * 1.2 });
        }
        if (e.key === '-') {
          e.preventDefault();
          setViewTransform({ scale: viewTransform.scale / 1.2 });
        }
        // Grouping (Ctrl+G / Cmd+G)
        if (e.key.toLowerCase() === 'g') {
          e.preventDefault(); // Stop Browser "Find"
          if (e.shiftKey) {
            ungroupSelection();
          } else {
            groupSelection();
          }
        }
        // Duplicate (Cmd+D)
        if (e.key.toLowerCase() === 'd') {
          e.preventDefault(); // Bypass Chrome Bookmark
          duplicateSelection();
        }
        // Save project (Cmd+S / Ctrl+S)
        if (e.key.toLowerCase() === 's') {
          e.preventDefault(); // Prevent browser save dialog
          if (currentProjectId) {
            // Update existing project
            const project = savedProjects.find(p => p.id === currentProjectId);
            if (project) {
              saveProject(project.name, currentProjectId);
            } else {
              // Project ID exists but project not found, create new
              saveProject('Untitled');
            }
          } else {
            // No current project, create new one
            saveProject('Untitled');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTool, undo, redo, deleteShapes, selectedShapeIds, selectShapes, shapes, resetView, setViewTransform, viewTransform, zoomToFit, nudgeSelection, groupSelection, ungroupSelection, copyShapes, pasteShapes, duplicateSelection, saveProject, currentProjectId, savedProjects]);
}








