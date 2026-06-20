House Generator – Functional & Visual Requirements

This document defines the full specification for the House Generator system.

All implementation tasks must follow these requirements.

⸻

1. Canvas, Paper, Orientation & Margins

1.1 Orientation Toggle

	•	Provide a single UI toggle to switch between portrait and landscape.
	•	The toggle must modify canvas orientation only.
	•	Element proportions and visual scaling must remain unchanged when switching orientations.
	•	No automatic stretching, resizing, repositioning, or redistribution of elements due to orientation changes.

1.2 Margins

	•	Provide a margin slider located at the top of the menu, immediately after paper size and orientation controls.
	•	Default value: 15 mm.
	•	The margin defines the active drawing boundary.
	•	No element may cross or overlap this margin boundary.
	•	Adjusting the margin must update layout constraints without distorting any element.

⸻

2. Pen & Stroke Parameters

2.1 Stroke Width Control

	•	Provide a global pen-width (stroke-width) slider.
	•	Range: 0.1 mm → 4.0 mm.
	•	The stroke width must update in real time.
	•	All drawn elements (house, roof, windows, trees, flowers, clouds, grass, sun, rays, sky lines, etc.) must consistently adopt the selected width.

⸻

3. Element Randomness & Placement Logic

3.1 General Randomness

	•	Elements such as sun rays, clouds, tree shapes, heights, widths, and other natural features must include controlled randomness.
	•	Each random variation must remain within reasonable bounds to maintain visual stability.

3.2 Sun Rays

	•	Each ray must vary in rotation and length each time the randomize action is used.
	•	Variation must remain within a consistent, visually stable range.

3.3 Trees & Flowers – No Overlap

	•	Trees must not overlap with:
	•	Other trees
	•	Flowers
	•	Implement a collision-avoidance system:
	•	Before placing a tree or flower, check if its position intersects an existing element.
	•	If overlap occurs, reposition within the available area until a valid location is found.
	•	Collision avoidance may reposition elements, but must never scale or distort them.

⸻

4. Clouds & Jittering Behavior

4.1 Cloud Rendering

	•	Cloud generation must revert to the previous zigzag-based outline method, which produced natural, playful cloud shapes.
	•	Clouds must retain a soft, organic silhouette, not rigid or geometric.
	•	Clouds must be rendered behind the roof (in the background layer), never in front of it.

4.2 Jittering Algorithm

	•	The jitter slider remains the primary control for jitter intensity.
	•	Internal jitter must be:
	•	Smooth
	•	Rounded
	•	Continuous
	•	"Child-like" wobble quality (no sharp, abrupt deviations)
	•	Avoid sharp, chaotic jitter outputs.
	•	Jittering should create a visible, hand-drawn effect with strong wobble.
	•	Lines must be automatically subdivided to create many breakpoints (at least 1 point per 2mm of line length).
	•	More breakpoints create more visible jitter while maintaining smooth, rounded curves.
	•	The jitter effect should be strong and clearly visible, like a child's drawing with natural hand wobble.

⸻

5. Sky Band Rendering

5.1 Subtle Sky Infill

	•	The sky band must not be a framed rectangle.
	•	Replace the frame with a gentle infill made of subtle lines, suggesting sky presence.
	•	The linework should:
	•	Resemble how a child would color the sky—fluid, organic coloring strokes rather than sharp drawing lines.
	•	Be dense and well-distributed within the sky band bounds to create good coverage.
	•	Use long strokes—almost the full length of the sky band (70-95% of the longer dimension) to create sweeping coloring motions.
	•	Be fluent and smooth—use curved, flowing strokes that avoid sharp, jagged, or thunder-like appearances.
	•	Avoid angular or sharp transitions between lines; maintain continuous, rounded curves.
	•	Lines should flow organically in various directions, not rigidly horizontal or with abrupt angle changes.
	•	Use smooth, rounded strokes that suggest a child's coloring motion rather than precise drawing.
	•	Lines should be light and subtle, but dense enough to create a visible sky texture.
	•	The effect should visually support the illustration without overpowering other elements.
	•	Sky lines must be rendered behind the sun and clouds (in the deepest background layer).
	•	Sky lines must be rendered in a layer below the roof (under the roof).
	•	All sky lines that would appear behind the roof triangle must be hidden/eclipsed by the roof.
	•	No sky lines should be visible behind the roof triangle—they must be completely hidden or clipped by the roof geometry.

⸻

6. Color Assignments

6.1 Fixed Colors Per Element

Each element type must have a fixed and predefined color, for example:

	•	Roof → Red
	•	Sun → Yellow
	•	Grass → Green
	•	Sky lines → Light/soft blue
	•	Clouds → Neutral/light tone
	•	Trees → Green foliage + brown trunk
	•	House → Appropriate consistent base color
	•	Any other element → Assign a consistent, appropriate color

Colors must be consistently applied across renders unless explicitly randomized in a future requirement.

⸻

7. General Design Philosophy

	•	Maintain a child-like drawing aesthetic with smooth imperfection, playful wobble, and consistency.
	•	Preserve proportions of all elements across all UI interactions.
	•	The system should generate clean, visually coherent, non-overlapping compositions while retaining organic variation.

