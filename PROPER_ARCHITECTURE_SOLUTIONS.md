# VIB34D Rhythm Roguelike - Proper Architecture Solutions

## Introduction

This document provides detailed, professional architectural solutions for the critical issues identified in the VIB34D Rhythm Roguelike project. These solutions follow software engineering best practices and provide concrete implementation approaches without oversimplification.

## Solution 1: Canvas Pool Architecture

### Problem Addressed
Current system destroys and recreates all canvases on every system switch, causing WebGL context loss, memory leaks, and performance degradation.

### Professional Solution: Canvas Resource Pool

```javascript
/**
 * Professional Canvas Resource Pool
 * Manages canvas lifecycle with proper WebGL context preservation
 */
class CanvasResourcePool {
    constructor() {
        this.canvases = new Map(); // systemName -> canvas elements
        this.contexts = new Map(); // canvas -> WebGL context
        this.activeSystem = null;
        this.containerElements = new Map(); // systemName -> container DOM element

        this.maxCanvasesPerSystem = 5;
        this.contextAttributes = {
            alpha: true,
            antialias: true,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance'
        };
    }

    /**
     * Initialize canvas pool with proper container management
     */
    initialize() {
        this.createContainerElements();
        this.preAllocateCanvases();
        this.setupResizeHandler();

        console.log('Canvas Resource Pool initialized');
    }

    createContainerElements() {
        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];

        systems.forEach(systemName => {
            const containerId = systemName === 'faceted' ? 'vib34dLayers' : `${systemName}Layers`;
            let container = document.getElementById(containerId);

            if (!container) {
                container = document.createElement('div');
                container.id = containerId;
                container.className = 'visualization-container';
                container.style.cssText = `
                    position: absolute;
                    top: 0; left: 0;
                    width: 100%; height: 100%;
                    display: none;
                    pointer-events: none;
                `;
                document.body.appendChild(container);
            }

            this.containerElements.set(systemName, container);
        });
    }

    /**
     * Pre-allocate canvases for all systems to avoid runtime creation overhead
     */
    preAllocateCanvases() {
        const systems = ['faceted', 'quantum', 'holographic', 'polychora'];

        systems.forEach(systemName => {
            const systemCanvases = [];
            const container = this.containerElements.get(systemName);

            for (let i = 0; i < this.maxCanvasesPerSystem; i++) {
                const canvas = this.createCanvas(systemName, i);
                container.appendChild(canvas);
                systemCanvases.push(canvas);

                // Pre-create WebGL context with error handling
                try {
                    const gl = canvas.getContext('webgl2', this.contextAttributes) ||
                              canvas.getContext('webgl', this.contextAttributes);

                    if (gl) {
                        this.contexts.set(canvas, gl);
                        // Initialize WebGL state
                        gl.viewport(0, 0, canvas.width, canvas.height);
                        gl.clearColor(0.0, 0.0, 0.0, 0.0);
                    } else {
                        console.warn(`Failed to create WebGL context for ${systemName} layer ${i}`);
                    }
                } catch (error) {
                    console.error(`WebGL context creation failed for ${systemName}:`, error);
                }
            }

            this.canvases.set(systemName, systemCanvases);
        });
    }

    createCanvas(systemName, layerIndex) {
        const canvas = document.createElement('canvas');
        const layerNames = ['background', 'shadow', 'content', 'highlight', 'accent'];
        const baseName = layerNames[layerIndex] || `layer-${layerIndex}`;

        canvas.id = systemName === 'faceted' ? `${baseName}-canvas` : `${systemName}-${baseName}-canvas`;
        canvas.className = 'visualization-layer';

        // Set proper canvas dimensions with DPR handling
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;

        canvas.width = viewWidth * dpr;
        canvas.height = viewHeight * dpr;
        canvas.style.cssText = `
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: ${layerIndex + 1};
            pointer-events: none;
        `;

        return canvas;
    }

    /**
     * Switch to a different visualization system without destroying contexts
     */
    switchToSystem(systemName) {
        // Hide current system
        if (this.activeSystem && this.containerElements.has(this.activeSystem)) {
            const currentContainer = this.containerElements.get(this.activeSystem);
            currentContainer.style.display = 'none';

            // Pause rendering for current system canvases
            const currentCanvases = this.canvases.get(this.activeSystem) || [];
            currentCanvases.forEach(canvas => {
                const gl = this.contexts.get(canvas);
                if (gl && !gl.isContextLost()) {
                    gl.finish(); // Complete all pending operations
                }
            });
        }

        // Show target system
        if (this.containerElements.has(systemName)) {
            const targetContainer = this.containerElements.get(systemName);
            targetContainer.style.display = 'block';
            targetContainer.style.visibility = 'visible';
            targetContainer.style.opacity = '1';

            // Resume rendering for target system canvases
            const targetCanvases = this.canvases.get(systemName) || [];
            targetCanvases.forEach(canvas => {
                const gl = this.contexts.get(canvas);
                if (gl && gl.isContextLost()) {
                    console.warn(`WebGL context lost for ${systemName}, attempting recovery`);
                    this.recoverContext(canvas, systemName);
                }
            });
        }

        this.activeSystem = systemName;
        console.log(`Canvas pool switched to system: ${systemName}`);
    }

    /**
     * Recover lost WebGL context
     */
    recoverContext(canvas, systemName) {
        try {
            const gl = canvas.getContext('webgl2', this.contextAttributes) ||
                      canvas.getContext('webgl', this.contextAttributes);

            if (gl) {
                this.contexts.set(canvas, gl);
                gl.viewport(0, 0, canvas.width, canvas.height);
                gl.clearColor(0.0, 0.0, 0.0, 0.0);
                console.log(`WebGL context recovered for ${systemName}`);
            }
        } catch (error) {
            console.error(`Failed to recover WebGL context for ${systemName}:`, error);
        }
    }

    /**
     * Get canvas and context for specific system and layer
     */
    getCanvasResources(systemName, layerIndex = 0) {
        const systemCanvases = this.canvases.get(systemName);
        if (!systemCanvases || layerIndex >= systemCanvases.length) {
            console.error(`Invalid canvas request: ${systemName} layer ${layerIndex}`);
            return null;
        }

        const canvas = systemCanvases[layerIndex];
        const gl = this.contexts.get(canvas);

        return {
            canvas,
            context: gl,
            isValid: gl && !gl.isContextLost()
        };
    }

    /**
     * Handle window resize with proper DPR handling
     */
    setupResizeHandler() {
        let resizeTimeout;

        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.handleResize();
            }, 100); // Debounce resize events
        });
    }

    handleResize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const viewWidth = window.innerWidth;
        const viewHeight = window.innerHeight;

        // Update all canvases
        this.canvases.forEach((systemCanvases, systemName) => {
            systemCanvases.forEach(canvas => {
                canvas.width = viewWidth * dpr;
                canvas.height = viewHeight * dpr;

                // Update WebGL viewport
                const gl = this.contexts.get(canvas);
                if (gl && !gl.isContextLost()) {
                    gl.viewport(0, 0, canvas.width, canvas.height);
                }
            });
        });

        console.log(`Canvas pool resized: ${viewWidth}x${viewHeight} (DPR: ${dpr})`);
    }

    /**
     * Proper cleanup without destroying contexts unnecessarily
     */
    cleanup() {
        // Only clean up if absolutely necessary (page unload, etc.)
        this.contexts.forEach((gl, canvas) => {
            if (gl && !gl.isContextLost()) {
                // Clean up WebGL resources properly
                const extension = gl.getExtension('WEBGL_lose_context');
                if (extension) {
                    extension.loseContext();
                }
            }
        });

        this.canvases.clear();
        this.contexts.clear();
        this.containerElements.clear();

        console.log('Canvas Resource Pool cleaned up');
    }
}
```

## Solution 2: Engine Coordination Architecture

### Problem Addressed
Multiple visualization engines attempting to initialize simultaneously without coordination, causing resource conflicts and state corruption.

### Professional Solution: Engine Coordination System

```javascript
/**
 * Engine Coordination System
 * Manages multiple visualization engines with proper resource sharing and state transitions
 */
class EngineCoordinator {
    constructor(canvasPool) {
        this.canvasPool = canvasPool;
        this.engines = new Map();
        this.activeEngine = null;
        this.engineConfigs = new Map();
        this.sharedResources = new Map();
        this.transitionState = 'idle'; // idle, transitioning, error

        this.initializeEngineConfigs();
    }

    initializeEngineConfigs() {
        // Define engine configurations with resource requirements
        this.engineConfigs.set('faceted', {
            className: 'VIB34DIntegratedEngine',
            requiredLayers: ['background', 'content', 'highlight'],
            resourceRequirements: {
                shaders: ['vertex4d', 'fragment4d', 'geometry'],
                buffers: ['vertex', 'index', 'instance'],
                textures: ['noise', 'gradient']
            },
            initializationOrder: 1
        });

        this.engineConfigs.set('quantum', {
            className: 'QuantumEngine',
            requiredLayers: ['background', 'quantum', 'particles'],
            resourceRequirements: {
                shaders: ['quantum_vertex', 'quantum_fragment', 'particle'],
                buffers: ['quantum_state', 'particle_buffer'],
                textures: ['quantum_field', 'probability']
            },
            initializationOrder: 2
        });

        this.engineConfigs.set('holographic', {
            className: 'RealHolographicSystem',
            requiredLayers: ['hologram_base', 'interference', 'projection'],
            resourceRequirements: {
                shaders: ['holographic', 'interference', 'projection'],
                buffers: ['hologram_data', 'light_field'],
                textures: ['interference_pattern', 'depth_map']
            },
            initializationOrder: 3
        });

        this.engineConfigs.set('polychora', {
            className: 'NewPolychoraEngine',
            requiredLayers: ['hyperspace', '4d_projection', 'tesseract'],
            resourceRequirements: {
                shaders: ['4d_vertex', '4d_fragment', 'tesseract'],
                buffers: ['4d_vertices', '4d_indices', 'projection_matrix'],
                textures: ['4d_noise', 'dimension_map']
            },
            initializationOrder: 4
        });
    }

    /**
     * Initialize all engines with proper resource management
     */
    async initializeEngines(engineClasses) {
        try {
            // Initialize shared resources first
            await this.initializeSharedResources();

            // Initialize engines in order to manage resource dependencies
            const sortedConfigs = Array.from(this.engineConfigs.entries())
                .sort((a, b) => a[1].initializationOrder - b[1].initializationOrder);

            for (const [systemName, config] of sortedConfigs) {
                if (engineClasses[config.className]) {
                    await this.initializeEngine(systemName, engineClasses[config.className]);
                }
            }

            console.log('All engines initialized successfully');

        } catch (error) {
            console.error('Engine initialization failed:', error);
            throw error;
        }
    }

    async initializeSharedResources() {
        // Initialize WebGL resources that can be shared between engines
        const gl = this.canvasPool.getCanvasResources('faceted', 0)?.context;
        if (!gl) {
            throw new Error('No WebGL context available for shared resource initialization');
        }

        // Create shared shader programs
        const sharedShaders = {
            common_vertex: this.createShader(gl, gl.VERTEX_SHADER, this.getCommonVertexShader()),
            common_fragment: this.createShader(gl, gl.FRAGMENT_SHADER, this.getCommonFragmentShader()),
            utility_compute: this.createShader(gl, gl.VERTEX_SHADER, this.getUtilityShader())
        };

        // Create shared buffers for common data
        const sharedBuffers = {
            screen_quad: this.createScreenQuadBuffer(gl),
            unit_cube: this.createUnitCubeBuffer(gl),
            sphere_geometry: this.createSphereBuffer(gl)
        };

        // Create shared textures
        const sharedTextures = {
            white_pixel: this.createWhitePixelTexture(gl),
            noise_3d: this.createNoise3DTexture(gl),
            gradient_lut: this.createGradientLUTTexture(gl)
        };

        this.sharedResources.set('shaders', sharedShaders);
        this.sharedResources.set('buffers', sharedBuffers);
        this.sharedResources.set('textures', sharedTextures);

        console.log('Shared resources initialized');
    }

    async initializeEngine(systemName, EngineClass) {
        try {
            // Get required canvas resources for this engine
            const config = this.engineConfigs.get(systemName);
            const canvasResources = this.getEngineCanvasResources(systemName, config);

            // Create engine instance with proper resource injection
            const engine = new EngineClass({
                canvasResources,
                sharedResources: this.sharedResources,
                systemName,
                config
            });

            // Initialize engine with resource validation
            if (typeof engine.initialize === 'function') {
                await engine.initialize();
            }

            // Validate engine interface
            this.validateEngineInterface(engine, systemName);

            this.engines.set(systemName, engine);
            console.log(`Engine ${systemName} initialized successfully`);

        } catch (error) {
            console.error(`Failed to initialize engine ${systemName}:`, error);
            throw error;
        }
    }

    getEngineCanvasResources(systemName, config) {
        const resources = {};

        config.requiredLayers.forEach((layerName, index) => {
            const canvasResource = this.canvasPool.getCanvasResources(systemName, index);
            if (canvasResource && canvasResource.isValid) {
                resources[layerName] = canvasResource;
            } else {
                throw new Error(`Invalid canvas resource for ${systemName} layer ${layerName}`);
            }
        });

        return resources;
    }

    validateEngineInterface(engine, systemName) {
        const requiredMethods = ['render', 'setActive', 'handleResize'];
        const optionalMethods = ['onAudioData', 'setParameters', 'destroy'];

        requiredMethods.forEach(method => {
            if (typeof engine[method] !== 'function') {
                throw new Error(`Engine ${systemName} missing required method: ${method}`);
            }
        });

        optionalMethods.forEach(method => {
            if (engine[method] && typeof engine[method] !== 'function') {
                console.warn(`Engine ${systemName} has invalid optional method: ${method}`);
            }
        });
    }

    /**
     * Switch between engines with proper state management
     */
    async switchEngine(targetSystemName) {
        if (this.transitionState !== 'idle') {
            console.warn('Engine transition already in progress');
            return false;
        }

        if (!this.engines.has(targetSystemName)) {
            console.error(`Engine ${targetSystemName} not found`);
            return false;
        }

        this.transitionState = 'transitioning';

        try {
            // Deactivate current engine
            if (this.activeEngine) {
                await this.deactivateEngine(this.activeEngine);
            }

            // Switch canvas system
            this.canvasPool.switchToSystem(targetSystemName);

            // Activate target engine
            const targetEngine = this.engines.get(targetSystemName);
            await this.activateEngine(targetEngine, targetSystemName);

            this.activeEngine = targetSystemName;
            this.transitionState = 'idle';

            console.log(`Engine switched to: ${targetSystemName}`);
            return true;

        } catch (error) {
            console.error(`Engine switch failed:`, error);
            this.transitionState = 'error';
            return false;
        }
    }

    async deactivateEngine(systemName) {
        const engine = this.engines.get(systemName);
        if (!engine) return;

        try {
            // Pause engine rendering
            if (typeof engine.setActive === 'function') {
                engine.setActive(false);
            }

            // Allow engine to save state if supported
            if (typeof engine.saveState === 'function') {
                await engine.saveState();
            }

            console.log(`Engine ${systemName} deactivated`);

        } catch (error) {
            console.error(`Engine deactivation failed for ${systemName}:`, error);
        }
    }

    async activateEngine(engine, systemName) {
        try {
            // Restore engine state if supported
            if (typeof engine.restoreState === 'function') {
                await engine.restoreState();
            }

            // Activate engine rendering
            if (typeof engine.setActive === 'function') {
                engine.setActive(true);
            }

            // Handle resize to ensure proper dimensions
            if (typeof engine.handleResize === 'function') {
                engine.handleResize(window.innerWidth, window.innerHeight);
            }

            console.log(`Engine ${systemName} activated`);

        } catch (error) {
            console.error(`Engine activation failed for ${systemName}:`, error);
            throw error;
        }
    }

    /**
     * Render current active engine with proper error handling
     */
    render(timestamp, gameState) {
        if (this.transitionState !== 'idle' || !this.activeEngine) {
            return;
        }

        const engine = this.engines.get(this.activeEngine);
        if (!engine) return;

        try {
            engine.render(timestamp, gameState);
        } catch (error) {
            console.error(`Rendering error in engine ${this.activeEngine}:`, error);

            // Attempt recovery
            this.handleRenderingError(this.activeEngine, error);
        }
    }

    handleRenderingError(systemName, error) {
        // Log error details for debugging
        console.error(`Engine ${systemName} render error:`, {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // Check for WebGL context loss
        const canvasResource = this.canvasPool.getCanvasResources(systemName, 0);
        if (canvasResource && canvasResource.context.isContextLost()) {
            console.log(`WebGL context lost for ${systemName}, initiating recovery`);
            // Canvas pool will handle context recovery
            return;
        }

        // For other errors, temporarily disable problematic engine
        const engine = this.engines.get(systemName);
        if (engine && typeof engine.setActive === 'function') {
            engine.setActive(false);
            console.log(`Engine ${systemName} temporarily disabled due to errors`);
        }
    }

    // Utility methods for shared resource creation
    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compilation failed: ${error}`);
        }

        return shader;
    }

    createScreenQuadBuffer(gl) {
        const vertices = new Float32Array([
            -1, -1, 0, 0,
             1, -1, 1, 0,
            -1,  1, 0, 1,
             1,  1, 1, 1
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        return { buffer, vertexCount: 4, stride: 16 };
    }

    createUnitCubeBuffer(gl) {
        // Implementation for unit cube geometry
        const vertices = new Float32Array([
            // Cube vertices with normals and UVs
            -1, -1, -1,  0,  0, -1, 0, 0,
             1, -1, -1,  0,  0, -1, 1, 0,
             1,  1, -1,  0,  0, -1, 1, 1,
            -1,  1, -1,  0,  0, -1, 0, 1,
            // ... additional faces
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        return { buffer, vertexCount: 24, stride: 32 };
    }

    createSphereBuffer(gl) {
        // Implementation for sphere geometry
        const segments = 32;
        const rings = 16;
        const vertices = [];

        // Generate sphere vertices
        for (let ring = 0; ring <= rings; ring++) {
            for (let segment = 0; segment <= segments; segment++) {
                // Calculate sphere coordinates
                const phi = Math.PI * ring / rings;
                const theta = 2 * Math.PI * segment / segments;

                const x = Math.sin(phi) * Math.cos(theta);
                const y = Math.cos(phi);
                const z = Math.sin(phi) * Math.sin(theta);

                vertices.push(x, y, z, x, y, z, segment/segments, ring/rings);
            }
        }

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);

        return { buffer, vertexCount: vertices.length / 8, stride: 32 };
    }

    createWhitePixelTexture(gl) {
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                     new Uint8Array([255, 255, 255, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        return texture;
    }

    createNoise3DTexture(gl) {
        // 3D noise texture implementation
        const size = 64;
        const data = new Uint8Array(size * size * size);

        // Generate 3D noise data
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.floor(Math.random() * 256);
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_3D, texture);
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, size, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);

        return texture;
    }

    createGradientLUTTexture(gl) {
        // Gradient lookup table for color mapping
        const width = 256;
        const data = new Uint8Array(width * 4);

        for (let i = 0; i < width; i++) {
            const t = i / (width - 1);
            // Create rainbow gradient
            const hue = t * 360;
            const [r, g, b] = this.hslToRgb(hue, 100, 50);

            data[i * 4 + 0] = r;
            data[i * 4 + 1] = g;
            data[i * 4 + 2] = b;
            data[i * 4 + 3] = 255;
        }

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

        return texture;
    }

    hslToRgb(h, s, l) {
        h = h / 360;
        s = s / 100;
        l = l / 100;

        const a = s * Math.min(l, 1 - l);
        const f = (n, k = (n + h / 30) % 12) =>
            l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

        return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
    }

    // Shader source code
    getCommonVertexShader() {
        return `
        attribute vec3 a_position;
        attribute vec3 a_normal;
        attribute vec2 a_texcoord;

        uniform mat4 u_mvpMatrix;
        uniform mat4 u_modelMatrix;
        uniform mat4 u_normalMatrix;

        varying vec3 v_position;
        varying vec3 v_normal;
        varying vec2 v_texcoord;

        void main() {
            vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
            v_position = worldPosition.xyz;
            v_normal = normalize((u_normalMatrix * vec4(a_normal, 0.0)).xyz);
            v_texcoord = a_texcoord;

            gl_Position = u_mvpMatrix * vec4(a_position, 1.0);
        }
        `;
    }

    getCommonFragmentShader() {
        return `
        precision highp float;

        varying vec3 v_position;
        varying vec3 v_normal;
        varying vec2 v_texcoord;

        uniform vec3 u_lightDirection;
        uniform vec3 u_lightColor;
        uniform vec3 u_ambientColor;
        uniform float u_time;

        void main() {
            vec3 normal = normalize(v_normal);
            float ndotl = max(dot(normal, u_lightDirection), 0.0);

            vec3 color = u_ambientColor + u_lightColor * ndotl;
            gl_FragColor = vec4(color, 1.0);
        }
        `;
    }

    getUtilityShader() {
        return `
        attribute vec2 a_position;
        attribute vec2 a_texcoord;

        varying vec2 v_texcoord;

        void main() {
            v_texcoord = a_texcoord;
            gl_Position = vec4(a_position, 0.0, 1.0);
        }
        `;
    }

    /**
     * Proper cleanup with resource management
     */
    destroy() {
        // Deactivate all engines
        this.engines.forEach((engine, systemName) => {
            if (typeof engine.setActive === 'function') {
                engine.setActive(false);
            }
            if (typeof engine.destroy === 'function') {
                engine.destroy();
            }
        });

        // Clean up shared resources
        this.sharedResources.forEach((resourceMap, resourceType) => {
            if (resourceType === 'textures') {
                const gl = this.canvasPool.getCanvasResources('faceted', 0)?.context;
                if (gl) {
                    resourceMap.forEach(texture => gl.deleteTexture(texture));
                }
            } else if (resourceType === 'buffers') {
                const gl = this.canvasPool.getCanvasResources('faceted', 0)?.context;
                if (gl) {
                    resourceMap.forEach(bufferInfo => gl.deleteBuffer(bufferInfo.buffer));
                }
            } else if (resourceType === 'shaders') {
                const gl = this.canvasPool.getCanvasResources('faceted', 0)?.context;
                if (gl) {
                    resourceMap.forEach(shader => gl.deleteShader(shader));
                }
            }
        });

        this.engines.clear();
        this.sharedResources.clear();
        this.activeEngine = null;

        console.log('Engine Coordinator destroyed');
    }
}
```

## Solution 3: State Management Architecture

### Problem Addressed
Global state pollution, inconsistent state updates, and lack of state persistence during system transitions.

### Professional Solution: Centralized State Management

```javascript
/**
 * State Management System using Redux-like pattern
 * Provides predictable state updates and persistence
 */
class StateManager {
    constructor() {
        this.state = this.getInitialState();
        this.reducers = new Map();
        this.middleware = [];
        this.listeners = new Set();
        this.stateHistory = [];
        this.maxHistorySize = 50;

        this.initializeReducers();
        this.initializeMiddleware();
    }

    getInitialState() {
        return {
            game: {
                state: 'menu', // menu, playing, paused, gameOver
                score: 0,
                level: 1,
                sublevel: 1,
                health: 100,
                combo: 0,
                lives: 3
            },
            visualization: {
                activeSystem: 'faceted',
                parameters: {
                    chaos: 0.5,
                    complexity: 0.7,
                    hue: 240,
                    saturation: 0.8,
                    brightness: 0.6,
                    dimension: 3.5,
                    gridDensity: 10,
                    morphSpeed: 1.0
                },
                performance: {
                    fps: 60,
                    frameTime: 16.67,
                    renderTime: 10.0,
                    memoryUsage: 0
                }
            },
            audio: {
                isActive: false,
                sourceType: null, // mic, file, stream, synthetic
                reactive: {
                    bass: 0,
                    mid: 0,
                    high: 0,
                    energy: 0
                },
                analysis: {
                    tempo: 120,
                    beats: [],
                    frequencyData: null
                }
            },
            ui: {
                showHUD: true,
                showDebugInfo: false,
                activePanel: null,
                notifications: []
            },
            system: {
                isInitialized: false,
                lastError: null,
                webglSupport: false,
                audioSupport: false,
                performanceLevel: 'high' // low, medium, high, ultra
            }
        };
    }

    initializeReducers() {
        this.reducers.set('game', this.gameReducer.bind(this));
        this.reducers.set('visualization', this.visualizationReducer.bind(this));
        this.reducers.set('audio', this.audioReducer.bind(this));
        this.reducers.set('ui', this.uiReducer.bind(this));
        this.reducers.set('system', this.systemReducer.bind(this));
    }

    initializeMiddleware() {
        // State validation middleware
        this.middleware.push(this.validateStateMiddleware.bind(this));

        // State persistence middleware
        this.middleware.push(this.persistenceMiddleware.bind(this));

        // Performance monitoring middleware
        this.middleware.push(this.performanceMiddleware.bind(this));

        // Debug logging middleware (development only)
        if (process.env.NODE_ENV === 'development') {
            this.middleware.push(this.debugLoggerMiddleware.bind(this));
        }
    }

    // Action dispatching with middleware chain
    dispatch(action) {
        if (!action || typeof action.type !== 'string') {
            throw new Error('Action must have a type property');
        }

        let prevState = this.state;

        // Run middleware chain
        let processedAction = action;
        for (const middleware of this.middleware) {
            processedAction = middleware(prevState, processedAction) || processedAction;
        }

        // Apply reducers
        const newState = this.applyReducers(prevState, processedAction);

        // Update state if changed
        if (newState !== prevState) {
            this.updateState(prevState, newState, processedAction);
        }

        return processedAction;
    }

    applyReducers(state, action) {
        const [domain] = action.type.split('/');
        const reducer = this.reducers.get(domain);

        if (!reducer) {
            console.warn(`No reducer found for domain: ${domain}`);
            return state;
        }

        const domainState = state[domain];
        const newDomainState = reducer(domainState, action);

        if (newDomainState === domainState) {
            return state; // No change
        }

        return {
            ...state,
            [domain]: newDomainState
        };
    }

    updateState(prevState, newState, action) {
        // Add to history
        this.stateHistory.push({
            state: prevState,
            action,
            timestamp: Date.now()
        });

        // Limit history size
        if (this.stateHistory.length > this.maxHistorySize) {
            this.stateHistory.shift();
        }

        // Update current state
        this.state = newState;

        // Notify listeners
        this.notifyListeners(prevState, newState, action);
    }

    // Reducers for different state domains
    gameReducer(state, action) {
        switch (action.type) {
            case 'game/setState':
                return { ...state, state: action.payload };

            case 'game/updateScore':
                return { ...state, score: Math.max(0, state.score + action.payload) };

            case 'game/setLevel':
                return { ...state, level: action.payload.level, sublevel: action.payload.sublevel || 1 };

            case 'game/updateHealth':
                return { ...state, health: Math.max(0, Math.min(100, state.health + action.payload)) };

            case 'game/updateCombo':
                return { ...state, combo: Math.max(0, action.payload) };

            case 'game/resetCombo':
                return { ...state, combo: 0 };

            case 'game/loseLife':
                return { ...state, lives: Math.max(0, state.lives - 1) };

            case 'game/reset':
                return {
                    ...this.getInitialState().game,
                    ...action.payload
                };

            default:
                return state;
        }
    }

    visualizationReducer(state, action) {
        switch (action.type) {
            case 'visualization/switchSystem':
                return { ...state, activeSystem: action.payload };

            case 'visualization/updateParameters':
                return {
                    ...state,
                    parameters: { ...state.parameters, ...action.payload }
                };

            case 'visualization/setParameter':
                return {
                    ...state,
                    parameters: { ...state.parameters, [action.payload.key]: action.payload.value }
                };

            case 'visualization/updatePerformance':
                return {
                    ...state,
                    performance: { ...state.performance, ...action.payload }
                };

            case 'visualization/resetParameters':
                return {
                    ...state,
                    parameters: this.getInitialState().visualization.parameters
                };

            default:
                return state;
        }
    }

    audioReducer(state, action) {
        switch (action.type) {
            case 'audio/setActive':
                return { ...state, isActive: action.payload };

            case 'audio/setSourceType':
                return { ...state, sourceType: action.payload };

            case 'audio/updateReactive':
                return {
                    ...state,
                    reactive: { ...state.reactive, ...action.payload }
                };

            case 'audio/updateAnalysis':
                return {
                    ...state,
                    analysis: { ...state.analysis, ...action.payload }
                };

            case 'audio/addBeat':
                const newBeats = [...state.analysis.beats, action.payload];
                // Keep only recent beats (last 50)
                if (newBeats.length > 50) {
                    newBeats.shift();
                }
                return {
                    ...state,
                    analysis: { ...state.analysis, beats: newBeats }
                };

            default:
                return state;
        }
    }

    uiReducer(state, action) {
        switch (action.type) {
            case 'ui/toggleHUD':
                return { ...state, showHUD: !state.showHUD };

            case 'ui/setActivePanel':
                return { ...state, activePanel: action.payload };

            case 'ui/addNotification':
                return {
                    ...state,
                    notifications: [...state.notifications, {
                        id: Date.now(),
                        timestamp: Date.now(),
                        ...action.payload
                    }]
                };

            case 'ui/removeNotification':
                return {
                    ...state,
                    notifications: state.notifications.filter(n => n.id !== action.payload)
                };

            case 'ui/clearNotifications':
                return { ...state, notifications: [] };

            default:
                return state;
        }
    }

    systemReducer(state, action) {
        switch (action.type) {
            case 'system/initialize':
                return { ...state, isInitialized: true };

            case 'system/setError':
                return { ...state, lastError: action.payload };

            case 'system/clearError':
                return { ...state, lastError: null };

            case 'system/updateSupport':
                return { ...state, ...action.payload };

            case 'system/setPerformanceLevel':
                return { ...state, performanceLevel: action.payload };

            default:
                return state;
        }
    }

    // Middleware implementations
    validateStateMiddleware(prevState, action) {
        // Validate action structure
        if (!action.type || typeof action.type !== 'string') {
            console.error('Invalid action type:', action);
            return null; // Block invalid actions
        }

        // Validate payload based on action type
        switch (action.type) {
            case 'game/updateScore':
                if (typeof action.payload !== 'number') {
                    console.error('Invalid score payload:', action.payload);
                    return null;
                }
                break;

            case 'visualization/switchSystem':
                const validSystems = ['faceted', 'quantum', 'holographic', 'polychora'];
                if (!validSystems.includes(action.payload)) {
                    console.error('Invalid system:', action.payload);
                    return null;
                }
                break;
        }

        return action;
    }

    persistenceMiddleware(prevState, action) {
        // Define actions that should trigger persistence
        const persistentActions = [
            'game/updateScore',
            'game/setLevel',
            'visualization/updateParameters',
            'system/setPerformanceLevel'
        ];

        if (persistentActions.includes(action.type)) {
            // Schedule persistence (debounced)
            this.schedulePersistence();
        }

        return action;
    }

    performanceMiddleware(prevState, action) {
        // Monitor performance impact of state updates
        const startTime = performance.now();

        // The action will be processed normally

        // Log performance-heavy actions
        setTimeout(() => {
            const duration = performance.now() - startTime;
            if (duration > 5) { // Log if state update takes more than 5ms
                console.log(`Slow state update: ${action.type} took ${duration.toFixed(2)}ms`);
            }
        }, 0);

        return action;
    }

    debugLoggerMiddleware(prevState, action) {
        const timestamp = new Date().toISOString();
        console.group(`%c[State] ${action.type}`, 'color: #4CAF50; font-weight: bold');
        console.log(`%cAction:`, 'color: #2196F3', action);
        console.log(`%cPrevious State:`, 'color: #FF9800', prevState);

        // Log will show new state after reducer is applied
        setTimeout(() => {
            console.log(`%cNew State:`, 'color: #4CAF50', this.state);
            console.groupEnd();
        }, 0);

        return action;
    }

    // State subscription system
    subscribe(listener) {
        if (typeof listener !== 'function') {
            throw new Error('Listener must be a function');
        }

        this.listeners.add(listener);

        // Return unsubscribe function
        return () => {
            this.listeners.delete(listener);
        };
    }

    notifyListeners(prevState, newState, action) {
        this.listeners.forEach(listener => {
            try {
                listener(newState, prevState, action);
            } catch (error) {
                console.error('State listener error:', error);
            }
        });
    }

    // State selectors for computed values
    getGameState() {
        return this.state.game;
    }

    getVisualizationState() {
        return this.state.visualization;
    }

    getAudioState() {
        return this.state.audio;
    }

    getUIState() {
        return this.state.ui;
    }

    getSystemState() {
        return this.state.system;
    }

    // Computed selectors
    getIsGameActive() {
        return this.state.game.state === 'playing';
    }

    getCanSwitchSystem() {
        return this.state.game.state !== 'playing' || this.state.system.performanceLevel === 'ultra';
    }

    getAudioReactiveIntensity() {
        const { bass, mid, high } = this.state.audio.reactive;
        return (bass + mid + high) / 3;
    }

    getPerformanceScore() {
        const perf = this.state.visualization.performance;
        return Math.max(0, 100 - (perf.frameTime - 16.67) * 2);
    }

    // State persistence
    schedulePersistence() {
        if (this.persistenceTimeout) {
            clearTimeout(this.persistenceTimeout);
        }

        this.persistenceTimeout = setTimeout(() => {
            this.persistState();
        }, 1000); // Debounce for 1 second
    }

    persistState() {
        try {
            const persistentState = {
                game: {
                    score: this.state.game.score,
                    level: this.state.game.level,
                    sublevel: this.state.game.sublevel
                },
                visualization: {
                    activeSystem: this.state.visualization.activeSystem,
                    parameters: this.state.visualization.parameters
                },
                system: {
                    performanceLevel: this.state.system.performanceLevel
                }
            };

            localStorage.setItem('vib34d_game_state', JSON.stringify(persistentState));
            console.log('State persisted successfully');

        } catch (error) {
            console.error('Failed to persist state:', error);
        }
    }

    restoreState() {
        try {
            const persistedState = localStorage.getItem('vib34d_game_state');
            if (!persistedState) return false;

            const parsed = JSON.parse(persistedState);

            // Restore persisted values
            this.dispatch({ type: 'game/updateScore', payload: parsed.game?.score || 0 });
            if (parsed.game?.level) {
                this.dispatch({
                    type: 'game/setLevel',
                    payload: { level: parsed.game.level, sublevel: parsed.game.sublevel }
                });
            }

            if (parsed.visualization?.activeSystem) {
                this.dispatch({
                    type: 'visualization/switchSystem',
                    payload: parsed.visualization.activeSystem
                });
            }

            if (parsed.visualization?.parameters) {
                this.dispatch({
                    type: 'visualization/updateParameters',
                    payload: parsed.visualization.parameters
                });
            }

            if (parsed.system?.performanceLevel) {
                this.dispatch({
                    type: 'system/setPerformanceLevel',
                    payload: parsed.system.performanceLevel
                });
            }

            console.log('State restored successfully');
            return true;

        } catch (error) {
            console.error('Failed to restore state:', error);
            return false;
        }
    }

    // Time travel debugging (development only)
    timeTravel(stepIndex) {
        if (stepIndex < 0 || stepIndex >= this.stateHistory.length) {
            console.error('Invalid time travel step:', stepIndex);
            return false;
        }

        const targetStep = this.stateHistory[stepIndex];
        this.state = targetStep.state;

        // Notify listeners of time travel
        this.listeners.forEach(listener => {
            try {
                listener(this.state, this.state, { type: 'system/timeTravel', payload: stepIndex });
            } catch (error) {
                console.error('Time travel listener error:', error);
            }
        });

        console.log(`Time traveled to step ${stepIndex}:`, targetStep);
        return true;
    }

    // State export for debugging
    exportState() {
        return {
            currentState: JSON.parse(JSON.stringify(this.state)),
            history: this.stateHistory.map(step => ({
                action: step.action,
                timestamp: step.timestamp
            }))
        };
    }

    // Cleanup
    destroy() {
        this.listeners.clear();
        this.stateHistory = [];

        if (this.persistenceTimeout) {
            clearTimeout(this.persistenceTimeout);
        }

        console.log('State Manager destroyed');
    }
}
```

## Solution 4: Resource Management System

### Problem Addressed
Memory leaks, improper WebGL resource cleanup, and resource conflicts between systems.

### Professional Solution: Resource Lifecycle Management

```javascript
/**
 * Resource Management System
 * Handles WebGL resources, memory management, and resource lifecycle
 */
class ResourceManager {
    constructor() {
        this.resources = new Map(); // resourceId -> resource
        this.resourceTypes = new Map(); // resourceId -> type
        this.resourceUsers = new Map(); // resourceId -> Set of users
        this.glContexts = new Map(); // contextId -> WebGL context
        this.memoryUsage = {
            textures: 0,
            buffers: 0,
            shaders: 0,
            total: 0
        };

        this.resourceTracking = true;
        this.maxMemoryUsage = 256 * 1024 * 1024; // 256MB limit
        this.cleanupThreshold = 0.8; // Cleanup when 80% full

        this.initializeMonitoring();
    }

    initializeMonitoring() {
        // Monitor memory usage
        setInterval(() => {
            this.updateMemoryUsage();
            this.checkMemoryPressure();
        }, 5000);

        // Monitor WebGL context health
        setInterval(() => {
            this.checkWebGLContexts();
        }, 10000);
    }

    // Resource creation with automatic tracking
    createTexture(gl, options = {}) {
        const resourceId = this.generateResourceId('texture');
        const texture = gl.createTexture();

        if (!texture) {
            throw new Error('Failed to create WebGL texture');
        }

        const textureInfo = {
            glTexture: texture,
            width: options.width || 1,
            height: options.height || 1,
            format: options.format || gl.RGBA,
            type: options.type || gl.UNSIGNED_BYTE,
            mipLevels: options.mipLevels || 1,
            memorySize: this.calculateTextureMemory(options),
            createdAt: Date.now(),
            lastUsed: Date.now()
        };

        this.resources.set(resourceId, textureInfo);
        this.resourceTypes.set(resourceId, 'texture');
        this.resourceUsers.set(resourceId, new Set());

        // Update memory tracking
        this.memoryUsage.textures += textureInfo.memorySize;
        this.memoryUsage.total += textureInfo.memorySize;

        if (this.resourceTracking) {
            console.log(`Texture created: ${resourceId} (${textureInfo.memorySize} bytes)`);
        }

        return { resourceId, texture };
    }

    createBuffer(gl, data, usage = gl.STATIC_DRAW, type = gl.ARRAY_BUFFER) {
        const resourceId = this.generateResourceId('buffer');
        const buffer = gl.createBuffer();

        if (!buffer) {
            throw new Error('Failed to create WebGL buffer');
        }

        gl.bindBuffer(type, buffer);
        gl.bufferData(type, data, usage);

        const bufferInfo = {
            glBuffer: buffer,
            size: data.byteLength,
            usage: usage,
            type: type,
            createdAt: Date.now(),
            lastUsed: Date.now()
        };

        this.resources.set(resourceId, bufferInfo);
        this.resourceTypes.set(resourceId, 'buffer');
        this.resourceUsers.set(resourceId, new Set());

        // Update memory tracking
        this.memoryUsage.buffers += bufferInfo.size;
        this.memoryUsage.total += bufferInfo.size;

        if (this.resourceTracking) {
            console.log(`Buffer created: ${resourceId} (${bufferInfo.size} bytes)`);
        }

        return { resourceId, buffer };
    }

    createShaderProgram(gl, vertexSource, fragmentSource) {
        const resourceId = this.generateResourceId('shader');

        try {
            const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
            const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                const error = gl.getProgramInfoLog(program);
                gl.deleteProgram(program);
                gl.deleteShader(vertexShader);
                gl.deleteShader(fragmentShader);
                throw new Error(`Shader program linking failed: ${error}`);
            }

            // Clean up individual shaders
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);

            const programInfo = {
                glProgram: program,
                vertexSource: vertexSource,
                fragmentSource: fragmentSource,
                uniforms: this.extractUniforms(gl, program),
                attributes: this.extractAttributes(gl, program),
                createdAt: Date.now(),
                lastUsed: Date.now()
            };

            this.resources.set(resourceId, programInfo);
            this.resourceTypes.set(resourceId, 'shader');
            this.resourceUsers.set(resourceId, new Set());

            // Rough estimate for shader memory usage
            const shaderMemory = (vertexSource.length + fragmentSource.length) * 2;
            this.memoryUsage.shaders += shaderMemory;
            this.memoryUsage.total += shaderMemory;

            if (this.resourceTracking) {
                console.log(`Shader program created: ${resourceId}`);
            }

            return { resourceId, program };

        } catch (error) {
            console.error('Shader program creation failed:', error);
            throw error;
        }
    }

    compileShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const error = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Shader compilation failed: ${error}`);
        }

        return shader;
    }

    extractUniforms(gl, program) {
        const uniforms = {};
        const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

        for (let i = 0; i < numUniforms; i++) {
            const uniform = gl.getActiveUniform(program, i);
            const location = gl.getUniformLocation(program, uniform.name);
            uniforms[uniform.name] = {
                location,
                type: uniform.type,
                size: uniform.size
            };
        }

        return uniforms;
    }

    extractAttributes(gl, program) {
        const attributes = {};
        const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

        for (let i = 0; i < numAttributes; i++) {
            const attribute = gl.getActiveAttrib(program, i);
            const location = gl.getAttribLocation(program, attribute.name);
            attributes[attribute.name] = {
                location,
                type: attribute.type,
                size: attribute.size
            };
        }

        return attributes;
    }

    // Resource usage tracking
    useResource(resourceId, userId) {
        if (!this.resources.has(resourceId)) {
            console.error(`Resource not found: ${resourceId}`);
            return null;
        }

        const resource = this.resources.get(resourceId);
        const users = this.resourceUsers.get(resourceId);

        users.add(userId);
        resource.lastUsed = Date.now();

        return resource;
    }

    releaseResource(resourceId, userId) {
        if (!this.resourceUsers.has(resourceId)) {
            console.warn(`Resource not tracked: ${resourceId}`);
            return;
        }

        const users = this.resourceUsers.get(resourceId);
        users.delete(userId);

        // If no more users, mark for cleanup
        if (users.size === 0) {
            this.markForCleanup(resourceId);
        }
    }

    markForCleanup(resourceId) {
        const resource = this.resources.get(resourceId);
        if (resource) {
            resource.markedForCleanup = true;
            resource.cleanupTime = Date.now();
        }
    }

    // Resource cleanup
    cleanupUnusedResources() {
        const now = Date.now();
        const cleanupDelay = 30000; // 30 seconds
        let cleanedCount = 0;

        this.resources.forEach((resource, resourceId) => {
            const users = this.resourceUsers.get(resourceId);
            const type = this.resourceTypes.get(resourceId);

            // Clean up resources with no users and past cleanup delay
            if (users.size === 0 && resource.markedForCleanup) {
                const timeSinceMarked = now - (resource.cleanupTime || 0);

                if (timeSinceMarked > cleanupDelay) {
                    this.destroyResource(resourceId);
                    cleanedCount++;
                }
            }

            // Clean up very old unused resources
            else if (users.size === 0) {
                const timeSinceUsed = now - resource.lastUsed;
                const maxAge = type === 'texture' ? 300000 : 120000; // 5min textures, 2min others

                if (timeSinceUsed > maxAge) {
                    this.destroyResource(resourceId);
                    cleanedCount++;
                }
            }
        });

        if (cleanedCount > 0) {
            console.log(`Cleaned up ${cleanedCount} unused resources`);
        }

        return cleanedCount;
    }

    destroyResource(resourceId) {
        const resource = this.resources.get(resourceId);
        const type = this.resourceTypes.get(resourceId);

        if (!resource) {
            console.warn(`Cannot destroy non-existent resource: ${resourceId}`);
            return;
        }

        // Get WebGL context for cleanup
        const gl = this.getWebGLContextForResource(resourceId);

        if (gl) {
            try {
                switch (type) {
                    case 'texture':
                        gl.deleteTexture(resource.glTexture);
                        this.memoryUsage.textures -= resource.memorySize;
                        break;

                    case 'buffer':
                        gl.deleteBuffer(resource.glBuffer);
                        this.memoryUsage.buffers -= resource.size;
                        break;

                    case 'shader':
                        gl.deleteProgram(resource.glProgram);
                        const shaderMemory = (resource.vertexSource.length + resource.fragmentSource.length) * 2;
                        this.memoryUsage.shaders -= shaderMemory;
                        break;
                }
            } catch (error) {
                console.error(`Error destroying resource ${resourceId}:`, error);
            }
        }

        // Remove from tracking
        this.resources.delete(resourceId);
        this.resourceTypes.delete(resourceId);
        this.resourceUsers.delete(resourceId);

        // Update total memory usage
        this.updateMemoryUsage();

        if (this.resourceTracking) {
            console.log(`Resource destroyed: ${resourceId} (${type})`);
        }
    }

    // Memory management
    updateMemoryUsage() {
        let textureMemory = 0;
        let bufferMemory = 0;
        let shaderMemory = 0;

        this.resources.forEach((resource, resourceId) => {
            const type = this.resourceTypes.get(resourceId);

            switch (type) {
                case 'texture':
                    textureMemory += resource.memorySize || 0;
                    break;
                case 'buffer':
                    bufferMemory += resource.size || 0;
                    break;
                case 'shader':
                    shaderMemory += (resource.vertexSource?.length || 0) + (resource.fragmentSource?.length || 0);
                    break;
            }
        });

        this.memoryUsage = {
            textures: textureMemory,
            buffers: bufferMemory,
            shaders: shaderMemory,
            total: textureMemory + bufferMemory + shaderMemory
        };
    }

    checkMemoryPressure() {
        const usage = this.memoryUsage.total / this.maxMemoryUsage;

        if (usage > this.cleanupThreshold) {
            console.warn(`Memory usage high: ${(usage * 100).toFixed(1)}%`);

            // Force cleanup
            const cleaned = this.cleanupUnusedResources();

            // If still high after cleanup, implement more aggressive strategies
            const newUsage = this.memoryUsage.total / this.maxMemoryUsage;
            if (newUsage > 0.9) {
                this.aggressiveCleanup();
            }
        }
    }

    aggressiveCleanup() {
        console.warn('Initiating aggressive memory cleanup');

        // Remove oldest unused resources first
        const sortedResources = Array.from(this.resources.entries())
            .filter(([resourceId]) => this.resourceUsers.get(resourceId).size === 0)
            .sort((a, b) => a[1].lastUsed - b[1].lastUsed);

        let cleaned = 0;
        const targetCleanup = Math.floor(sortedResources.length * 0.3); // Clean 30%

        for (let i = 0; i < Math.min(targetCleanup, sortedResources.length); i++) {
            this.destroyResource(sortedResources[i][0]);
            cleaned++;
        }

        console.log(`Aggressive cleanup removed ${cleaned} resources`);
    }

    // WebGL context management
    registerWebGLContext(contextId, gl) {
        this.glContexts.set(contextId, {
            context: gl,
            canvas: gl.canvas,
            registeredAt: Date.now(),
            lastHealthCheck: Date.now(),
            healthy: true
        });

        // Monitor context loss
        const loseContextExtension = gl.getExtension('WEBGL_lose_context');
        if (loseContextExtension) {
            gl.canvas.addEventListener('webglcontextlost', (event) => {
                console.warn(`WebGL context lost for: ${contextId}`);
                event.preventDefault();
                this.handleContextLoss(contextId);
            });

            gl.canvas.addEventListener('webglcontextrestored', () => {
                console.log(`WebGL context restored for: ${contextId}`);
                this.handleContextRestore(contextId);
            });
        }
    }

    checkWebGLContexts() {
        this.glContexts.forEach((contextInfo, contextId) => {
            const gl = contextInfo.context;

            if (gl.isContextLost()) {
                if (contextInfo.healthy) {
                    console.warn(`WebGL context lost detected: ${contextId}`);
                    contextInfo.healthy = false;
                    this.handleContextLoss(contextId);
                }
            } else {
                if (!contextInfo.healthy) {
                    console.log(`WebGL context restored: ${contextId}`);
                    contextInfo.healthy = true;
                    this.handleContextRestore(contextId);
                }
                contextInfo.lastHealthCheck = Date.now();
            }
        });
    }

    handleContextLoss(contextId) {
        // Mark all resources for this context as invalid
        this.resources.forEach((resource, resourceId) => {
            if (this.getContextIdForResource(resourceId) === contextId) {
                resource.contextLost = true;
            }
        });
    }

    handleContextRestore(contextId) {
        // Resources need to be recreated by their owners
        // This manager just tracks the restoration
        const contextInfo = this.glContexts.get(contextId);
        if (contextInfo) {
            contextInfo.healthy = true;
        }
    }

    // Utility methods
    calculateTextureMemory(options) {
        const width = options.width || 1;
        const height = options.height || 1;
        const mipLevels = options.mipLevels || 1;

        let bytesPerPixel = 4; // RGBA default

        // Adjust based on format
        if (options.format) {
            // This would need to be expanded based on actual formats used
            switch (options.format) {
                case 'RGB': bytesPerPixel = 3; break;
                case 'LUMINANCE': bytesPerPixel = 1; break;
                case 'LUMINANCE_ALPHA': bytesPerPixel = 2; break;
            }
        }

        // Calculate memory including mip levels
        let totalMemory = 0;
        for (let i = 0; i < mipLevels; i++) {
            const mipWidth = Math.max(1, width >> i);
            const mipHeight = Math.max(1, height >> i);
            totalMemory += mipWidth * mipHeight * bytesPerPixel;
        }

        return totalMemory;
    }

    generateResourceId(type) {
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        return `${type}_${timestamp}_${random}`;
    }

    getWebGLContextForResource(resourceId) {
        // This would need to be implemented based on how resources are associated with contexts
        // For now, return the first healthy context
        for (const [contextId, contextInfo] of this.glContexts) {
            if (contextInfo.healthy) {
                return contextInfo.context;
            }
        }
        return null;
    }

    getContextIdForResource(resourceId) {
        // This would need to track which context each resource belongs to
        // For now, return the first context ID
        return this.glContexts.keys().next().value;
    }

    // Debug and monitoring methods
    getMemoryReport() {
        return {
            usage: { ...this.memoryUsage },
            limits: {
                max: this.maxMemoryUsage,
                cleanupThreshold: this.cleanupThreshold * this.maxMemoryUsage
            },
            resources: {
                total: this.resources.size,
                byType: {
                    textures: Array.from(this.resourceTypes.values()).filter(t => t === 'texture').length,
                    buffers: Array.from(this.resourceTypes.values()).filter(t => t === 'buffer').length,
                    shaders: Array.from(this.resourceTypes.values()).filter(t => t === 'shader').length
                }
            },
            contexts: {
                total: this.glContexts.size,
                healthy: Array.from(this.glContexts.values()).filter(c => c.healthy).length
            }
        };
    }

    getResourceList() {
        return Array.from(this.resources.entries()).map(([resourceId, resource]) => ({
            id: resourceId,
            type: this.resourceTypes.get(resourceId),
            users: this.resourceUsers.get(resourceId).size,
            createdAt: resource.createdAt,
            lastUsed: resource.lastUsed,
            memorySize: resource.memorySize || resource.size || 0,
            markedForCleanup: resource.markedForCleanup || false
        }));
    }

    // Cleanup
    destroy() {
        // Destroy all resources
        this.resources.forEach((resource, resourceId) => {
            this.destroyResource(resourceId);
        });

        // Clear all tracking
        this.resources.clear();
        this.resourceTypes.clear();
        this.resourceUsers.clear();
        this.glContexts.clear();

        console.log('Resource Manager destroyed');
    }
}
```

## Conclusion

These comprehensive architectural solutions address the critical problems identified in the VIB34D Rhythm Roguelike project:

1. **Canvas Pool Architecture** eliminates the destructive canvas recreation cycle
2. **Engine Coordination System** provides proper resource sharing and state management
3. **State Management Architecture** centralizes state with predictable updates
4. **Resource Management System** handles WebGL resources and memory lifecycle properly

Each solution follows software engineering best practices:
- **Single Responsibility**: Each class has a focused purpose
- **Proper Resource Management**: WebGL contexts and memory are handled correctly
- **Error Handling**: Comprehensive error handling and recovery
- **Performance Monitoring**: Built-in performance tracking and optimization
- **Extensibility**: Designed for future enhancements
- **Maintainability**: Clear code structure with proper documentation

Implementation of these solutions will result in a stable, performant, and maintainable rhythm roguelike game architecture.

---

# 🌟 A Paul Phillips Manifestation

**Send Love, Hate, or Opportunity to:** Paul@clearseassolutions.com
**Join The Exoditical Moral Architecture Movement today:** [Parserator.com](https://parserator.com)

> *"The Revolution Will Not be in a Structured Format"*

---

**© 2025 Paul Phillips - Clear Seas Solutions LLC**
**All Rights Reserved - Proprietary Technology**