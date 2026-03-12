import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useMeshSlice, useTransformSlice, useUISlice } from '../ui/store';
import { useSVGViewportSlice } from '../ui/store';
import { getCoordinateSystemRotation } from '../core/transforms';

export function ThreeViewport() {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshObjectRef = useRef<THREE.Group | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);

  // Get state from stores
  const mesh = useMeshSlice((state) => state.mesh);
  const boundingBox = useMeshSlice((state) => state.boundingBox);
  const transform = useTransformSlice((state) => state.transform);
  const setError = useUISlice((state) => state.setError);
  const showGrid = useSVGViewportSlice((state) => state.showGrid);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFAFAFA); // Light background
    sceneRef.current = scene;

    // Create camera
    // For Z-up coordinate system: position camera to view X-Y plane (flow plane) with Z as vertical
    const camera = new THREE.PerspectiveCamera(
      50, // FOV
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      100000 // Increased far plane
    );
    // Position camera for Z-up: look from above the X-Y plane
    camera.position.set(200, 200, 200);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;
    
    console.log('ThreeViewport: Camera initialized', {
      position: camera.position,
      aspect: camera.aspect,
      near: camera.near,
      far: camera.far
    });

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 10;
    controls.maxDistance = 1000;
    controls.maxPolarAngle = Math.PI; // Allow full rotation
    controlsRef.current = controls;

    // Add grid helper - for Z-up: grid should be in X-Y plane (flow plane)
    // Three.js GridHelper defaults to X-Z plane (Y-up), so we rotate 90° around X to get X-Y plane (Z-up)
    // Initial grid with default size (will be updated when mesh loads)
    const gridHelper = new THREE.GridHelper(500, 50, 0x999999, 0xcccccc);
    gridHelper.rotation.x = Math.PI / 2; // Rotate to X-Y plane (Z-up)
    gridHelper.visible = true; // Will be controlled by showGrid
    scene.add(gridHelper);

    // Create custom axes helper for Z-up coordinate system (matching application's coordinate system)
    // Z-up: X=red (right), Y=green (forward), Z=blue (up/vertical)
    // Note: Three.js uses Y-up internally, but we display axes for Z-up to match the application
    const axisLength = 200;
    
    // X axis (red) - horizontal right
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(axisLength, 0, 0)
    ]);
    const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
    const xAxis = new THREE.Line(xGeometry, xMaterial);
    scene.add(xAxis);
    
    // Y axis (green) - forward/backward (in Three.js Z direction for Z-up display)
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, axisLength)
    ]);
    const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 });
    const yAxis = new THREE.Line(yGeometry, yMaterial);
    scene.add(yAxis);
    
    // Z axis (blue) - vertical up (in Three.js Y direction for Z-up display)
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, axisLength, 0)
    ]);
    const zMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff });
    const zAxis = new THREE.Line(zGeometry, zMaterial);
    scene.add(zAxis);
    
    // Store reference for potential toggling
    axesHelperRef.current = zAxis; // Store one as reference
    
    // Add text labels for axes to make it clear which is which
    const createAxisLabel = (text: string, position: THREE.Vector3, color: number) => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) return null;
      
      canvas.width = 64;
      canvas.height = 64;
      context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
      context.font = 'Bold 48px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, 32, 32);
      
      const texture = new THREE.CanvasTexture(canvas);
      const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.copy(position);
      sprite.scale.set(40, 40, 1);
      return sprite;
    };
    
    // Labels at the end of each axis (220 units away)
    // Z-up axes: X=red (right), Y=green (forward), Z=blue (up/vertical)
    // Y axis (green) extends in Z direction (0,0,axisLength), so Y label goes at (0, 0, 220)
    // Z axis (blue) extends in Y direction (0,axisLength,0), so Z label goes at (0, 220, 0)
    const xLabel = createAxisLabel('X', new THREE.Vector3(220, 0, 0), 0xff0000); // Red label at red X axis
    const yLabel = createAxisLabel('Y', new THREE.Vector3(0, 220, 0), 0x00ff00); // Green Y label at end of blue Z axis (extends in Y direction)
    const zLabel = createAxisLabel('Z', new THREE.Vector3(0, 0, 220), 0x0000ff); // Blue Z label at end of green Y axis (extends in Z direction)
    
    if (xLabel) scene.add(xLabel);
    if (yLabel) scene.add(yLabel);
    if (zLabel) scene.add(zLabel);
    
    // Store references for toggling
    gridHelperRef.current = gridHelper;
    axesHelperRef.current = axesHelper;

    // Add ambient light - brighter for better visibility
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // Add multiple directional lights for better model visibility
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight1.position.set(50, 100, 50);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-50, 50, -50);
    scene.add(directionalLight2);

    // Animation loop
    const animate = () => {
      animationFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle resize (both window and container resize)
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      // Only update if size actually changed
      if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
        
        console.log('ThreeViewport: Resized', { width, height });
      }
    };
    
    // Initial resize
    handleResize();
    
    window.addEventListener('resize', handleResize);
    
    // Use ResizeObserver to watch for container size changes (from splitter)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Use requestAnimationFrame to ensure DOM has updated
          requestAnimationFrame(() => {
            handleResize();
          });
        }
      }
    });
    
    resizeObserverRef.current = resizeObserver;
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      controls.dispose();
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);
  
  // Add a resize handler that can be triggered externally
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      if (width > 0 && height > 0) {
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };
    
    // Listen for custom resize events (triggered by splitter)
    const handleCustomResize = () => {
      requestAnimationFrame(handleResize);
    };
    
    window.addEventListener('resize', handleCustomResize);
    window.addEventListener('splitter-resize', handleCustomResize);
    
    return () => {
      window.removeEventListener('resize', handleCustomResize);
      window.removeEventListener('splitter-resize', handleCustomResize);
    };
  }, []);

  // Load and display STL mesh
  useEffect(() => {
    if (!mesh || !sceneRef.current) {
      console.log('ThreeViewport: No mesh or scene available', { mesh: !!mesh, scene: !!sceneRef.current });
      return;
    }

    try {
      console.log('ThreeViewport: Loading mesh', {
        vertices: mesh.vertices.length,
        faces: mesh.faces.length,
        boundingBox: boundingBox
      });

      // Remove existing mesh object if present
      if (meshObjectRef.current) {
        // Remove all children first
        while (meshObjectRef.current.children.length > 0) {
          const child = meshObjectRef.current.children[0];
          meshObjectRef.current.remove(child);
          // Dispose of geometries and materials if needed
          if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(m => m.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        }
        sceneRef.current.remove(meshObjectRef.current);
        meshObjectRef.current = null;
      }

      // Create Three.js geometry from mesh data
      const geometry = new THREE.BufferGeometry();

      // Convert vertices to flat array
      const positions = new Float32Array(mesh.faces.length * 9); // 3 vertices per triangle, 3 components per vertex
      let posIdx = 0;
      let skippedFaces = 0;

      for (const face of mesh.faces) {
        if (face.indices.length < 3) {
          console.warn('Face has less than 3 vertices, skipping');
          skippedFaces++;
          continue;
        }
        for (const vertexIdx of face.indices) {
          if (vertexIdx >= mesh.vertices.length) {
            console.error(`Invalid vertex index ${vertexIdx}, mesh has ${mesh.vertices.length} vertices`);
            skippedFaces++;
            break;
          }
          const vertex = mesh.vertices[vertexIdx];
          positions[posIdx++] = vertex.x;
          positions[posIdx++] = vertex.y;
          positions[posIdx++] = vertex.z;
        }
      }

      console.log('ThreeViewport: Processed faces', {
        totalFaces: mesh.faces.length,
        skippedFaces,
        validPositions: posIdx / 3
      });

      // Only set attribute if we have valid positions
      if (posIdx > 0) {
        // Create a trimmed array if we skipped some faces
        const trimmedPositions = posIdx < positions.length 
          ? positions.slice(0, posIdx) 
          : positions;
        
        geometry.setAttribute('position', new THREE.BufferAttribute(trimmedPositions, 3));
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        
        // Check if geometry is valid
        if (geometry.attributes.position.count === 0) {
          throw new Error('Geometry has no vertices');
        }
        
        console.log('ThreeViewport: Geometry created', {
          vertexCount: geometry.attributes.position.count,
          hasNormals: !!geometry.attributes.normal,
          boundingBox: geometry.boundingBox,
          boundingSphere: geometry.boundingSphere
        });
      } else {
        throw new Error('No valid vertices found in mesh');
      }

      // Create coordinate system group (applies base orientation)
      const coordSystemGroup = new THREE.Group();
      
      // Create mesh group (applies user transforms)
      const meshGroup = new THREE.Group();

      // Create wireframe - more visible
      const wireframeMaterial = new THREE.LineBasicMaterial({ 
        color: 0x2563EB, // Brighter blue
        linewidth: 2,
        opacity: 0.8,
        transparent: true
      });
      const wireframeGeometry = new THREE.WireframeGeometry(geometry);
      const wireframe = new THREE.LineSegments(wireframeGeometry, wireframeMaterial);
      meshGroup.add(wireframe);

      // Create solid mesh with better visibility
      const solidMaterial = new THREE.MeshPhongMaterial({
        color: 0x4B5563, // Darker gray for better contrast
        opacity: 0.7, // More opaque
        transparent: true,
        side: THREE.DoubleSide,
        shininess: 30
      });
      const solidMesh = new THREE.Mesh(geometry, solidMaterial);
      meshGroup.add(solidMesh);
      
      console.log('ThreeViewport: Mesh materials created', {
        wireframeColor: wireframeMaterial.color.getHexString(),
        solidColor: solidMaterial.color.getHexString(),
        wireframeOpacity: wireframeMaterial.opacity,
        solidOpacity: solidMaterial.opacity
      });

      // Center mesh at origin
      if (boundingBox) {
        const centerX = boundingBox.center.x;
        const centerY = boundingBox.center.y;
        const centerZ = boundingBox.center.z;
        
        console.log('ThreeViewport: Centering mesh', {
          center: { x: centerX, y: centerY, z: centerZ },
          size: boundingBox.size
        });
        
        meshGroup.position.set(-centerX, -centerY, -centerZ);
      } else {
        // If no bounding box, try to center using center of mass
        if (mesh.centerOfMass) {
          console.log('ThreeViewport: Centering using COM', mesh.centerOfMass);
          meshGroup.position.set(
            -mesh.centerOfMass.x,
            -mesh.centerOfMass.y,
            -mesh.centerOfMass.z
          );
        }
      }

      // Add bounding box helper for debugging
      if (boundingBox) {
        const boxSize = boundingBox.size;
        const boxGeometry = new THREE.BoxGeometry(boxSize.x, boxSize.y, boxSize.z);
        const boxEdges = new THREE.EdgesGeometry(boxGeometry);
        const boxMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
        const boxHelper = new THREE.LineSegments(boxEdges, boxMaterial);
        boxHelper.position.set(-boundingBox.center.x, -boundingBox.center.y, -boundingBox.center.z);
        meshGroup.add(boxHelper);
        console.log('ThreeViewport: Added bounding box helper', {
          size: boxSize,
          center: boundingBox.center
        });
      }

      // Add mesh group to coordinate system group
      coordSystemGroup.add(meshGroup);
      
      // Add coordinate system group to scene
      sceneRef.current.add(coordSystemGroup);
      meshObjectRef.current = coordSystemGroup;
      
      console.log('ThreeViewport: Mesh group structure', {
        coordSystemGroup: !!coordSystemGroup,
        meshGroup: !!meshGroup,
        meshGroupChildren: meshGroup.children.length
      });
      
      // Force a render update
      if (rendererRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      
      console.log('ThreeViewport: Mesh added to scene', {
        meshGroupPosition: meshGroup.position,
        meshGroupChildren: meshGroup.children.length,
        sceneChildren: sceneRef.current.children.length,
        geometryBounds: geometry.boundingBox,
        geometryCenter: geometry.boundingSphere?.center
      });

      // Auto-fit camera to mesh
      if (boundingBox && cameraRef.current && controlsRef.current) {
        const maxDim = Math.max(boundingBox.size.x, boundingBox.size.y, boundingBox.size.z);
        
        console.log('ThreeViewport: Setting up camera', {
          maxDim,
          boundingBox: boundingBox.size
        });
        
        // Ensure we have a valid size
        if (maxDim > 0) {
          const distance = Math.max(maxDim * 2.5, 10); // Minimum distance of 10
          
          // Position camera at isometric angle for Z-up coordinate system
          // For Z-up: camera should look at X-Y plane from above
          const camX = distance * 0.7;
          const camY = distance * 0.7;
          const camZ = distance * 0.7;
          
          cameraRef.current.position.set(camX, camY, camZ);
          cameraRef.current.lookAt(0, 0, 0);
          controlsRef.current.target.set(0, 0, 0);
          controlsRef.current.update();
          
          console.log('ThreeViewport: Camera positioned', {
            position: cameraRef.current.position,
            target: controlsRef.current.target
          });
        } else {
          // Fallback if bounding box is invalid
          console.warn('ThreeViewport: Invalid bounding box, using fallback camera');
          cameraRef.current.position.set(100, 100, 100);
          cameraRef.current.lookAt(0, 0, 0);
          controlsRef.current.target.set(0, 0, 0);
          controlsRef.current.update();
        }
      } else if (cameraRef.current && controlsRef.current) {
        // Fallback if no bounding box
        console.warn('ThreeViewport: No bounding box, using fallback camera');
        cameraRef.current.position.set(100, 100, 100);
        cameraRef.current.lookAt(0, 0, 0);
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }

      console.log('ThreeViewport: STL mesh loaded successfully', {
        meshGroup: !!meshGroup,
        wireframe: !!wireframe,
        solidMesh: !!solidMesh,
        position: meshGroup.position
      });
    } catch (error) {
      console.error('ThreeViewport: Error creating Three.js mesh:', error);
      setError(`Failed to display mesh in viewport: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [mesh, boundingBox, setError]);

  // Apply transforms to mesh
  useEffect(() => {
    if (!meshObjectRef.current || meshObjectRef.current.children.length === 0) return;

    // meshObjectRef.current is the coordinate system group
    // meshObjectRef.current.children[0] is the mesh group
    const coordSystemGroup = meshObjectRef.current;
    const meshGroup = coordSystemGroup.children[0] as THREE.Group;
    
    if (!meshGroup) return;

    // Apply coordinate system rotation to the coordinate system group
    const coordRotation = getCoordinateSystemRotation(transform.coordinateSystem);
    coordSystemGroup.rotation.x = (coordRotation.x * Math.PI) / 180;
    coordSystemGroup.rotation.y = (coordRotation.y * Math.PI) / 180;
    coordSystemGroup.rotation.z = (coordRotation.z * Math.PI) / 180;

    // Apply user rotation to the mesh group
    meshGroup.rotation.x = (transform.rotation.x * Math.PI) / 180;
    meshGroup.rotation.y = (transform.rotation.y * Math.PI) / 180;
    meshGroup.rotation.z = (transform.rotation.z * Math.PI) / 180;

    // Apply translation to the mesh group
    const basePosition = boundingBox ? {
      x: -boundingBox.center.x,
      y: -boundingBox.center.y,
      z: -boundingBox.center.z
    } : { x: 0, y: 0, z: 0 };

    meshGroup.position.set(
      basePosition.x + transform.translation.x,
      basePosition.y + transform.translation.y,
      basePosition.z + transform.translation.z
    );

    // Apply flip (scale by -1 on respective axis) to the mesh group
    meshGroup.scale.set(
      transform.flipX ? -1 : 1,
      transform.flipY ? -1 : 1,
      transform.flipZ ? -1 : 1
    );
  }, [transform, boundingBox]);

  // Update grid size dynamically based on bounding box
  useEffect(() => {
    if (!sceneRef.current || !gridHelperRef.current) return;

    // Remove existing grid
    if (gridHelperRef.current) {
      sceneRef.current.remove(gridHelperRef.current);
      gridHelperRef.current.geometry.dispose();
      if (Array.isArray(gridHelperRef.current.material)) {
        gridHelperRef.current.material.forEach(m => m.dispose());
      } else {
        gridHelperRef.current.material.dispose();
      }
    }

    // Create new grid with size based on bounding box
    let gridSize = 500; // Default size
    let gridDivisions = 50; // Default divisions
    
    if (boundingBox) {
      const maxDim = Math.max(boundingBox.size.x, boundingBox.size.y, boundingBox.size.z);
      gridSize = maxDim * 8; // Grid extends 8x the largest dimension - much larger!
      gridDivisions = Math.max(30, Math.min(100, Math.floor(gridSize / (maxDim / 15)))); // More divisions for visibility
    }

    // Create new grid helper with better visibility - darker lines
    const newGridHelper = new THREE.GridHelper(gridSize, gridDivisions, 0x888888, 0xbbbbbb);
    newGridHelper.rotation.x = Math.PI / 2; // Rotate to X-Y plane (Z-up)
    newGridHelper.visible = showGrid;
    sceneRef.current.add(newGridHelper);
    gridHelperRef.current = newGridHelper;
  }, [boundingBox, showGrid]);

  // Toggle grid visibility based on showGrid setting
  useEffect(() => {
    if (gridHelperRef.current) {
      gridHelperRef.current.visible = showGrid;
    }
  }, [showGrid]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full"
      style={{ 
        touchAction: 'none', // Prevent touch scrolling on canvas
        minWidth: 0,
        minHeight: 0
      }}
    />
  );
}
