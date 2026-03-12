Technical Requirements Document (TRD)

1. Executive Summary

This document provides the complete technical, functional, architectural, and operational specification for a browser-based system that converts STL geometry into precision plotter-ready SVG line drawings. It defines all modules, algorithms, data structures, UI flows, constraints, and acceptance criteria required for full implementation.

⸻

2. Scope

2.1 In Scope
	•	STL loading and parsing
	•	3D viewport rendering and manipulation
	•	Lighting configuration
	•	Silhouette and contour extraction
	•	Projection and SVG generation
	•	Canvas size and orientation management
	•	Real-time update pipeline
	•	Metrics: line count, path length, estimated plot time

2.2 Out of Scope
	•	G-code export
	•	Server-side processing
	•	Multi-object scenes
	•	Photorealistic rendering

⸻

3. System Overview

The system is a single-page client-side application using React, TypeScript, Three.js, Web Workers, and a custom SVG generation pipeline. All geometry processing must occur on the client, ensuring privacy and performance.

⸻

4. Functional Requirements

4.1 STL Import
	•	Support ASCII and binary STL
	•	Parse into indexed mesh
	•	Compute normals, adjacency graph, bounding box, and center of mass

4.2 Geometry Normalization
	•	Scale to internal workspace
	•	Center along Z-axis
	•	Maintain COM alignment during transforms

4.3 3D Manipulation Tools
	•	Translation: X/Y/Z numeric + sliders
	•	Rotation: Euler XYZ, 0.1° resolution
	•	Flip: ±X/±Y/±Z reflections
	•	Reset transforms via control

4.4 Lighting Controls
	•	Directional light: azimuth, elevation
	•	Intensity and contrast
	•	Optional backlight

4.5 Rendering Pipeline
	•	Apply transforms
	•	Compute face visibility
	•	Silhouette extraction
	•	Edge detection (contour, internal, or full wireframe)
	•	Projection to 2D plane
	•	Fit to canvas
	•	Cleanup and optimization
	•	Render preview

4.6 Canvas Configuration
	•	Paper sizes: A6–A3
	•	Custom width/height (mm)
	•	Portrait/landscape toggle
	•	Auto-fit geometry

4.7 SVG Export
	•	Stroke-precise vector output
	•	Absolute path coordinates
	•	Grouping by line type
	•	Single-color line support
	•	No transforms inside SVG

4.8 Plotter Metrics
	•	Line count
	•	Total path length (mm)
	•	Estimated plot time based on mm/min

⸻

5. Non-Functional Requirements

5.1 Performance
	•	<150 ms full pipeline update
	•	<60 ms incremental updates
	•	Support at least 500k triangles
	•	Geometry processing delegated to Web Workers

5.2 Reliability
	•	Deterministic rendering
	•	Consistent SVG across sessions

5.3 Maintainability
	•	Strong TypeScript typing
	•	Separation between UI, rendering, geometry, and SVG logic

5.4 Security
	•	No server communication
	•	Fully client-side file processing

⸻

6. System Architecture

6.1 High-Level Structure
	•	UI Layer (React)
	•	State Manager (Zustand)
	•	3D Viewport (Three.js)
	•	Worker Manager
	•	Geometry Engine (Web Worker)
	•	Projection & SVG Engine

6.2 Modules
	•	FileLoader
	•	TransformManager
	•	LightingManager
	•	EdgeExtractorWorker
	•	Projector
	•	CanvasFitter
	•	SVGPipeline
	•	MetricsEngine
	•	UIModule

⸻

7. Data Structures

7.1 Mesh Representation
	•	Vertices
	•	Normals
	•	Faces (indices)
	•	Adjacency list

7.2 Transformation State
	•	Translation
	•	Rotation
	•	Flip flags
	•	Transformation matrix

7.3 Worker Messaging
	•	Mesh
	•	Transform
	•	Lighting
	•	Canvas configuration
	•	Rendering mode

⸻

8. Rendering Algorithms

8.1 Visibility Determination

Compute visible faces using face normals and view direction.

8.2 Silhouette Detection

Identify edges where adjacent faces differ in visibility.

8.3 Internal Edge Extraction

Support contour-only, contour+sharp, and wireframe modes.

8.4 Projection

Project 3D points to 2D using camera matrix.

8.5 Optimization

Merge collinear lines, remove duplicates, eliminate zero-length paths.

⸻

9. UI Requirements

9.1 Layout
	•	Left: File import, transforms, flips
	•	Center: 3D canvas
	•	Right: Lighting, canvas settings, export
	•	Bottom: Metrics and render status

9.2 Interaction

Every control must trigger a live update.

9.3 Usability

Minimalistic, clearly labeled, non-ambiguous interface.

⸻

10. Error Handling
	•	Invalid STL
	•	Excessive triangle count
	•	Invalid canvas dimensions
	•	Worker failures

Errors shown in discreet non-blocking messages.

⸻

11. Testing

11.1 Unit Tests

For STL parsing, transforms, adjacency, silhouette extraction, projection, and SVG generation.

11.2 Integration Tests

For full render cycle, UI to Worker messaging, export stability.

11.3 Performance Tests

Ensure responsiveness with large meshes.

⸻

12. Deployment Requirements
	•	Static client-side delivery
	•	Chrome/Firefox/Edge support

⸻

13. Acceptance Criteria
	•	Correct SVG output
	•	Deterministic render results
	•	UI remains responsive at all times
	•	COM alignment enforced
	•	Canvas fitting accurate
	•	SVG imports cleanly into major plotter workflows

⸻

14. Appendices

14.1 Math Notes
	•	Dot product for visibility
	•	Projection matrices
	•	Simplification tolerances

14.2 Future Features
	•	Path optimization
	•	G-code export
	•	Multiple meshes
	•	Advanced visibility filters