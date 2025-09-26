/**
 * VIB34D Quantum Holographic Visualizer - Working Implementation
 * Extracted from the actual working VIB34D system at visual-codex-enhanced/demos/noise-machine
 */

export class QuantumHolographicVisualizer {
    constructor(canvasInput, role = 'content', reactivity = 1.0, variantOrOptions = 0, maybeOptions = {}) {
        let variant = variantOrOptions;
        let options = maybeOptions;

        if (variantOrOptions && typeof variantOrOptions === 'object') {
            options = variantOrOptions;
            variant = typeof variantOrOptions.variant === 'number' ? variantOrOptions.variant : 0;
        }

        this.role = role;
        this.reactivity = reactivity;
        this.variant = variant;
        this.sharedResources = options?.sharedResources || null;
        this.externalContext = options?.context || null;

        this.canvas = this.resolveCanvas(canvasInput, options);
        this.canvasId = typeof canvasInput === 'string'
            ? canvasInput
            : this.canvas?.id || options?.canvasId || 'quantum-layer';

        // Mobile detection and optimization
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        // WebGL context options with mobile optimization
        this.contextOptions = {
            alpha: true,
            depth: false,
            antialias: this.isMobile ? false : true,
            premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            failIfMajorPerformanceCaveat: false
        };

        this.gl = null;
        this.program = null;
        this.buffer = null;
        this.uniforms = {};

        // Timing and interaction state
        this.startTime = Date.now();
        this.mouseX = 0.5;
        this.mouseY = 0.5;
        this.mouseIntensity = 0.0;
        this.clickIntensity = 0.0;

        // Default parameters - will be overridden by ParameterManager
        this.params = {
            geometry: 1, // Quantum defaults to hypercube
            gridDensity: 15,
            morphFactor: 1.0,
            chaos: 0.2,
            speed: 1.0,
            hue: 200,
            intensity: 0.8,
            saturation: 0.8,
            dimension: 3.5,
            rot4dXW: 0.0,
            rot4dYW: 0.0,
            rot4dZW: 0.0
        };

        this.vertexCount = 4;
        this.bufferStride = 0;

        this.init();
    }

    init() {
        if (!this.canvas) {
            console.error(`Canvas not found: ${this.canvasId}`);
            return;
        }

        this.createWebGLContext();
        if (this.gl) {
            this.initShaders();
            this.initBuffers();
            this.resize();
        }
    }

    createWebGLContext() {
        // Try WebGL2 first, fallback to WebGL1
        if (this.externalContext) {
            this.gl = this.externalContext;
        } else {
            this.gl = this.canvas.getContext('webgl2', this.contextOptions) ||
                      this.canvas.getContext('webgl', this.contextOptions) ||
                      this.canvas.getContext('experimental-webgl', this.contextOptions);

            if (!this.gl) {
                console.error(`WebGL not supported for ${this.canvasId}`);
                this.showWebGLError();
                return;
            }
        }

        // Enable blending for transparency
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    initShaders() {
        const vertexShaderSource = `
            attribute vec2 a_position;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = this.getQuantumFragmentShader();

        this.program = this.createProgram(vertexShaderSource, fragmentShaderSource);
        if (!this.program) return;

        // Get uniform locations
        this.uniforms = {
            resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
            time: this.gl.getUniformLocation(this.program, 'u_time'),
            mouse: this.gl.getUniformLocation(this.program, 'u_mouse'),
            geometry: this.gl.getUniformLocation(this.program, 'u_geometry'),
            gridDensity: this.gl.getUniformLocation(this.program, 'u_gridDensity'),
            morphFactor: this.gl.getUniformLocation(this.program, 'u_morphFactor'),
            chaos: this.gl.getUniformLocation(this.program, 'u_chaos'),
            speed: this.gl.getUniformLocation(this.program, 'u_speed'),
            hue: this.gl.getUniformLocation(this.program, 'u_hue'),
            intensity: this.gl.getUniformLocation(this.program, 'u_intensity'),
            saturation: this.gl.getUniformLocation(this.program, 'u_saturation'),
            dimension: this.gl.getUniformLocation(this.program, 'u_dimension'),
            rot4dXW: this.gl.getUniformLocation(this.program, 'u_rot4dXW'),
            rot4dYW: this.gl.getUniformLocation(this.program, 'u_rot4dYW'),
            rot4dZW: this.gl.getUniformLocation(this.program, 'u_rot4dZW'),
            mouseIntensity: this.gl.getUniformLocation(this.program, 'u_mouseIntensity'),
            clickIntensity: this.gl.getUniformLocation(this.program, 'u_clickIntensity'),
            roleIntensity: this.gl.getUniformLocation(this.program, 'u_roleIntensity')
        };
    }

    getQuantumFragmentShader() {
        return `
#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
#else
    precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_geometry;
uniform float u_gridDensity;
uniform float u_morphFactor;
uniform float u_chaos;
uniform float u_speed;
uniform float u_hue;
uniform float u_intensity;
uniform float u_saturation;
uniform float u_dimension;
uniform float u_rot4dXW;
uniform float u_rot4dYW;
uniform float u_rot4dZW;
uniform float u_mouseIntensity;
uniform float u_clickIntensity;
uniform float u_roleIntensity;

// 4D rotation matrices
mat4 rotateXW(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat4(c, 0.0, 0.0, -s, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, s, 0.0, 0.0, c);
}

mat4 rotateYW(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat4(1.0, 0.0, 0.0, 0.0, 0.0, c, 0.0, -s, 0.0, 0.0, 1.0, 0.0, 0.0, s, 0.0, c);
}

mat4 rotateZW(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat4(1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, c, -s, 0.0, 0.0, s, c);
}

vec3 project4Dto3D(vec4 p) {
    float w = 2.5 / (2.5 + p.w);
    return vec3(p.x * w, p.y * w, p.z * w);
}

// Quantum-specific geometry functions
float quantumHypercube(vec3 p, float gridSize) {
    vec3 grid = fract(p * gridSize);
    vec3 edges = min(grid, 1.0 - grid);
    float minEdge = min(min(edges.x, edges.y), edges.z);

    // Create hypercube lattice structure
    float lattice = 1.0 - smoothstep(0.0, 0.03, minEdge);

    // Add quantum interference patterns
    float interference = sin(p.x * 20.0) * sin(p.y * 20.0) * sin(p.z * 20.0) * 0.1;

    // Vertices at cube corners
    vec3 centers = abs(grid - 0.5);
    float maxCenter = max(max(centers.x, centers.y), centers.z);
    float vertices = 1.0 - smoothstep(0.45, 0.5, maxCenter);

    return max(lattice * 0.7, vertices) + interference;
}

float quantumSphere(vec3 p, float gridSize) {
    vec3 cell = fract(p * gridSize) - 0.5;
    float sphere = 1.0 - smoothstep(0.15, 0.25, length(cell));

    // Quantum energy rings
    float rings = 0.0;
    float ringRadius = length(cell.xy);
    rings = max(rings, 1.0 - smoothstep(0.0, 0.02, abs(ringRadius - 0.3)));
    rings = max(rings, 1.0 - smoothstep(0.0, 0.02, abs(ringRadius - 0.2)));
    rings = max(rings, 1.0 - smoothstep(0.0, 0.02, abs(ringRadius - 0.1)));

    // Add quantum tunneling effects
    float tunneling = sin(length(cell) * 50.0 + u_time * 0.005) * 0.05;

    return max(sphere, rings * 0.6) + tunneling;
}

float quantumTorus(vec3 p, float gridSize) {
    vec3 cell = fract(p * gridSize) - 0.5;
    float majorRadius = 0.3;
    float minorRadius = 0.1;

    float toroidalDist = length(vec2(length(cell.xy) - majorRadius, cell.z));
    float torus = 1.0 - smoothstep(minorRadius - 0.02, minorRadius + 0.02, toroidalDist);

    // Quantum field lines
    float angle = atan(cell.y, cell.x);
    float fieldLines = sin(angle * 12.0 + u_time * 0.003) * 0.03;

    return max(torus, 0.0) + fieldLines;
}

// Main geometry function
float geometryFunction(vec4 p) {
    int geomType = int(u_geometry);
    vec3 p3d = project4Dto3D(p);
    float gridSize = u_gridDensity * 0.08;

    if (geomType == 1) {
        return quantumHypercube(p3d, gridSize) * u_morphFactor;
    }
    else if (geomType == 2) {
        return quantumSphere(p3d, gridSize) * u_morphFactor;
    }
    else if (geomType == 3) {
        return quantumTorus(p3d, gridSize) * u_morphFactor;
    }
    else {
        return quantumHypercube(p3d, gridSize) * u_morphFactor;
    }
}

// HSV to RGB conversion
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - u_resolution.xy * 0.5) / min(u_resolution.x, u_resolution.y);

    // Enhanced 4D position with quantum fluctuations
    float timeSpeed = u_time * 0.0001 * u_speed;
    vec4 pos = vec4(uv * 3.0, sin(timeSpeed * 3.0), cos(timeSpeed * 2.0));
    pos.xy += (u_mouse - 0.5) * u_mouseIntensity * 2.0;

    // Apply 4D rotations
    pos = rotateXW(u_rot4dXW + timeSpeed * 0.5) * pos;
    pos = rotateYW(u_rot4dYW + timeSpeed * 0.3) * pos;
    pos = rotateZW(u_rot4dZW + timeSpeed * 0.7) * pos;

    // Calculate quantum geometry
    float value = geometryFunction(pos);

    // Quantum noise and interference
    float noise = sin(pos.x * 7.0) * cos(pos.y * 11.0) * sin(pos.z * 13.0);
    value += noise * u_chaos;

    // Quantum energy intensity
    float geometryIntensity = 1.0 - clamp(abs(value * 0.8), 0.0, 1.0);
    geometryIntensity = pow(geometryIntensity, 1.5);
    geometryIntensity += u_clickIntensity * 0.4;

    // Quantum shimmer effect
    float shimmer = sin(uv.x * 25.0 + timeSpeed * 6.0) * cos(uv.y * 20.0 + timeSpeed * 4.0) * 0.15;
    geometryIntensity += shimmer * geometryIntensity;

    // Apply role-based intensity
    float roleIntensity = u_roleIntensity;
    geometryIntensity *= roleIntensity;

    // Quantum color system - enhanced blues and cyans with energy bursts
    float hue = u_hue + value * 60.0 + timeSpeed * 20.0;
    float saturation = u_saturation * (0.8 + geometryIntensity * 0.4);
    float brightness = geometryIntensity * u_intensity;

    vec3 color = hsv2rgb(vec3(hue / 360.0, saturation, brightness));

    // Quantum energy bursts - bright cyan highlights
    float energyBurst = sin(value * 30.0 + timeSpeed * 15.0) * 0.5 + 0.5;
    if (energyBurst > 0.8) {
        color += vec3(0.0, 0.8, 1.0) * (energyBurst - 0.8) * 2.0;
    }

    // Final quantum alpha with transparency
    float alpha = geometryIntensity * (0.6 + roleIntensity * 0.4);

    gl_FragColor = vec4(color, alpha);
}
        `;
    }

    createProgram(vertexSource, fragmentSource) {
        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentSource);

        if (!vertexShader || !fragmentShader) {
            return null;
        }

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program linking failed:', this.gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compilation failed:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }

    initBuffers() {
        const sharedBuffer = this.sharedResources?.buffers?.screen_quad;

        if (sharedBuffer?.handle) {
            this.buffer = sharedBuffer.handle;
            this.vertexCount = sharedBuffer.vertexCount ?? 4;
            this.bufferStride = sharedBuffer.stride ?? 0;
        } else {
            const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
            this.buffer = this.gl.createBuffer();
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
            this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
            this.vertexCount = 4;
            this.bufferStride = 0;
        }

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);

        const positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.gl.enableVertexAttribArray(positionLocation);
        this.gl.vertexAttribPointer(positionLocation, 2, this.gl.FLOAT, false, this.bufferStride, 0);
    }

    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, this.isMobile ? 1.5 : 2);
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
            this.canvas.width = width * dpr;
            this.canvas.height = height * dpr;
            this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        }
    }

    updateParameters(params) {
        this.params = { ...this.params, ...params };
    }

    updateInteraction(x, y, intensity) {
        this.mouseX = x;
        this.mouseY = y;
        this.mouseIntensity = intensity;
    }

    render() {
        if (!this.program) return;

        this.resize();
        this.gl.useProgram(this.program);

        // Clear with transparency
        this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // Role-specific intensity mapping
        const roleIntensities = {
            'background': 0.4,
            'shadow': 0.6,
            'content': 1.0,
            'highlight': 1.3,
            'accent': 1.6
        };

        const time = Date.now() - this.startTime;

        // Set uniforms
        this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
        this.gl.uniform1f(this.uniforms.time, time);
        this.gl.uniform2f(this.uniforms.mouse, this.mouseX, this.mouseY);
        this.gl.uniform1f(this.uniforms.geometry, this.params.geometry);
        this.gl.uniform1f(this.uniforms.gridDensity, this.params.gridDensity);
        this.gl.uniform1f(this.uniforms.morphFactor, this.params.morphFactor);
        this.gl.uniform1f(this.uniforms.chaos, this.params.chaos);
        this.gl.uniform1f(this.uniforms.speed, this.params.speed);
        this.gl.uniform1f(this.uniforms.hue, this.params.hue);
        this.gl.uniform1f(this.uniforms.intensity, this.params.intensity);
        this.gl.uniform1f(this.uniforms.saturation, this.params.saturation);
        this.gl.uniform1f(this.uniforms.dimension, this.params.dimension);
        this.gl.uniform1f(this.uniforms.rot4dXW, this.params.rot4dXW);
        this.gl.uniform1f(this.uniforms.rot4dYW, this.params.rot4dYW);
        this.gl.uniform1f(this.uniforms.rot4dZW, this.params.rot4dZW);
        this.gl.uniform1f(this.uniforms.mouseIntensity, this.mouseIntensity);
        this.gl.uniform1f(this.uniforms.clickIntensity, this.clickIntensity);
        this.gl.uniform1f(this.uniforms.roleIntensity, roleIntensities[this.role] || 1.0);

        const vertexCount = this.vertexCount || 4;
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, vertexCount);
    }

    resolveCanvas(canvasInput, options) {
        if (!canvasInput) {
            return options?.canvas || null;
        }

        if (typeof HTMLCanvasElement !== 'undefined' && canvasInput instanceof HTMLCanvasElement) {
            return canvasInput;
        }

        if (typeof HTMLCanvasElement !== 'undefined' && canvasInput?.canvas instanceof HTMLCanvasElement) {
            return canvasInput.canvas;
        }

        if (typeof canvasInput === 'string') {
            return document.getElementById(canvasInput);
        }

        return options?.canvas || null;
    }

    showWebGLError() {
        if (!this.canvas) return;
        const ctx = this.canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            ctx.fillStyle = '#0ff';
            ctx.font = '16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('WebGL Required', this.canvas.width / 2, this.canvas.height / 2);
        }
    }

    destroy() {
        if (this.gl && this.program) {
            this.gl.deleteProgram(this.program);
        }
        if (this.gl && this.buffer) {
            this.gl.deleteBuffer(this.buffer);
        }
    }
}