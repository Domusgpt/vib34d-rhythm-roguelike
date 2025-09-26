/**
 * ResourceManager
 * ------------------------------------------------------------
 * Production-ready WebGL resource lifecycle manager that tracks GPU
 * allocations, monitors memory pressure and ensures contexts are
 * cleaned up deterministically. The implementation follows the
 * Resource Management System defined in PROPER_ARCHITECTURE_SOLUTIONS.md.
 */

const SUPPORTED_RESOURCE_TYPES = ['buffer', 'texture', 'program', 'shader'];

const DEFAULT_MEMORY_LIMIT = 256 * 1024 * 1024; // 256MB

const PERF = typeof performance !== 'undefined'
  ? performance
  : { now: () => Date.now() };

function getWindow() {
  if (typeof window !== 'undefined') {
    return window;
  }
  return undefined;
}

export class ResourceManager {
  constructor() {
    this.contexts = new Map();
    this.resources = new Map();
    this.resourceTypes = new Map();
    this.resourceUsers = new Map();
    this.sharedResources = new Map();

    this.memoryUsage = {
      buffers: 0,
      textures: 0,
      shaders: 0,
      total: 0,
    };

    this.maxMemoryUsage = DEFAULT_MEMORY_LIMIT;
    this.cleanupThreshold = 0.8;
    this.nextResourceId = 1;

    this.memoryMonitor = null;
    this.healthMonitor = null;
    this.startMonitoring();
  }

  startMonitoring() {
    const globalWindow = getWindow();
    const setIntervalFn = globalWindow?.setInterval ?? setInterval;

    this.memoryMonitor = setIntervalFn(() => {
      this.checkMemoryPressure();
    }, 5000);

    this.healthMonitor = setIntervalFn(() => {
      this.checkContextHealth();
    }, 10000);
  }

  stopMonitoring() {
    const globalWindow = getWindow();
    const clearIntervalFn = globalWindow?.clearInterval ?? clearInterval;

    if (this.memoryMonitor) {
      clearIntervalFn(this.memoryMonitor);
      this.memoryMonitor = null;
    }

    if (this.healthMonitor) {
      clearIntervalFn(this.healthMonitor);
      this.healthMonitor = null;
    }
  }

  registerWebGLContext(contextId, gl, { label } = {}) {
    if (!contextId || !gl) {
      throw new Error('ResourceManager: registerWebGLContext requires an id and context');
    }

    const existing = this.contexts.get(contextId);
    if (existing && existing.gl === gl) {
      return existing;
    }

    const record = {
      id: contextId,
      label: label || contextId,
      gl,
      resources: new Set(),
      lastCheck: PERF.now(),
      lost: false,
    };

    this.contexts.set(contextId, record);

    if (typeof gl.canvas?.addEventListener === 'function') {
      gl.canvas.addEventListener('webglcontextlost', () => this.handleContextLost(contextId));
      gl.canvas.addEventListener('webglcontextrestored', () => this.handleContextRestored(contextId));
    }

    return record;
  }

  unregisterWebGLContext(contextId) {
    const record = this.contexts.get(contextId);
    if (!record) {
      return;
    }

    this.releaseContextResources(contextId);
    this.contexts.delete(contextId);
  }

  handleContextLost(contextId) {
    const record = this.contexts.get(contextId);
    if (!record) {
      return;
    }

    record.lost = true;
    this.releaseContextResources(contextId);
  }

  handleContextRestored(contextId) {
    const record = this.contexts.get(contextId);
    if (!record) {
      return;
    }

    record.lost = false;
    record.lastCheck = PERF.now();
  }

  generateResourceId(type) {
    return `${type}-${this.nextResourceId += 1}`;
  }

  trackResource(contextId, type, handle, dispose, metadata = {}) {
    if (!SUPPORTED_RESOURCE_TYPES.includes(type)) {
      throw new Error(`ResourceManager: unsupported resource type ${type}`);
    }

    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`ResourceManager: context ${contextId} not registered`);
    }

    const resourceId = this.generateResourceId(type);
    this.resources.set(resourceId, {
      id: resourceId,
      type,
      contextId,
      handle,
      dispose,
      metadata,
    });

    this.resourceTypes.set(resourceId, type);
    this.resourceUsers.set(resourceId, new Set());
    context.resources.add(resourceId);

    if (type === 'buffer') {
      this.memoryUsage.buffers += metadata.size ?? 0;
      this.memoryUsage.total += metadata.size ?? 0;
    } else if (type === 'texture') {
      this.memoryUsage.textures += metadata.size ?? 0;
      this.memoryUsage.total += metadata.size ?? 0;
    } else if (type === 'shader' || type === 'program') {
      this.memoryUsage.shaders += metadata.size ?? 0;
      this.memoryUsage.total += metadata.size ?? 0;
    }

    return resourceId;
  }

  releaseResource(resourceId) {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return;
    }

    const { contextId, type, metadata } = resource;

    try {
      if (typeof resource.dispose === 'function') {
        const context = this.contexts.get(contextId);
        resource.dispose(context?.gl, resource.handle, metadata);
      }
    } finally {
      this.resources.delete(resourceId);
      this.resourceTypes.delete(resourceId);
      this.resourceUsers.delete(resourceId);

      const context = this.contexts.get(contextId);
      context?.resources.delete(resourceId);

      if (type === 'buffer') {
        this.memoryUsage.buffers -= metadata.size ?? 0;
        this.memoryUsage.total -= metadata.size ?? 0;
      } else if (type === 'texture') {
        this.memoryUsage.textures -= metadata.size ?? 0;
        this.memoryUsage.total -= metadata.size ?? 0;
      } else if (type === 'shader' || type === 'program') {
        this.memoryUsage.shaders -= metadata.size ?? 0;
        this.memoryUsage.total -= metadata.size ?? 0;
      }
    }
  }

  releaseContextResources(contextId) {
    const context = this.contexts.get(contextId);
    if (!context) {
      return;
    }

    [...context.resources].forEach((resourceId) => this.releaseResource(resourceId));
    context.resources.clear();
  }

  attachResourceToUser(resourceId, userId) {
    const users = this.resourceUsers.get(resourceId);
    if (!users) {
      return;
    }
    users.add(userId);
  }

  detachResourceFromUser(resourceId, userId) {
    const users = this.resourceUsers.get(resourceId);
    if (!users) {
      return;
    }
    users.delete(userId);
  }

  createBuffer(contextId, data, usage) {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`ResourceManager: context ${contextId} not registered`);
    }

    const { gl } = context;
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('ResourceManager: failed to create buffer');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage ?? gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const metadata = { size: data?.byteLength ?? 0 };
    const resourceId = this.trackResource(contextId, 'buffer', buffer, (ctx, handle) => {
      ctx?.deleteBuffer(handle);
    }, metadata);

    return {
      id: resourceId,
      handle: buffer,
      buffer,
      metadata,
    };
  }

  createTexture(contextId, {
    width = 1,
    height = 1,
    data = null,
    format,
    type,
    minFilter,
    magFilter,
    wrapS,
    wrapT,
  } = {}) {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`ResourceManager: context ${contextId} not registered`);
    }

    const { gl } = context;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('ResourceManager: failed to create texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter ?? gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter ?? gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS ?? gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT ?? gl.CLAMP_TO_EDGE);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      format ?? gl.RGBA,
      width,
      height,
      0,
      format ?? gl.RGBA,
      type ?? gl.UNSIGNED_BYTE,
      data,
    );

    gl.bindTexture(gl.TEXTURE_2D, null);

    const metadata = { size: width * height * 4 };
    const resourceId = this.trackResource(contextId, 'texture', texture, (ctx, handle) => {
      ctx?.deleteTexture(handle);
    }, metadata);

    return {
      id: resourceId,
      handle: texture,
      texture,
      metadata,
    };
  }

  createGradientTexture(contextId, stops = 256) {
    const data = new Uint8Array(stops * 4);
    for (let i = 0; i < stops; i += 1) {
      const t = i / (stops - 1);
      const hue = t * 360;
      const [r, g, b] = this.hslToRgb(hue, 100, 50);
      data[i * 4 + 0] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }

    return this.createTexture(contextId, {
      width: stops,
      height: 1,
      data,
    });
  }

  createNoiseTexture(contextId, size = 32) {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`ResourceManager: context ${contextId} not registered`);
    }

    const { gl } = context;
    const supports3D = typeof gl.TEXTURE_3D !== 'undefined' && typeof gl.texImage3D === 'function';
    const data = new Uint8Array(size * size * (supports3D ? size : 1));
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.floor(Math.random() * 256);
    }

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('ResourceManager: failed to create noise texture');
    }

    const metadata = { size: data.length };

    if (supports3D) {
      gl.bindTexture(gl.TEXTURE_3D, texture);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, size, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);
      gl.bindTexture(gl.TEXTURE_3D, null);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.ALPHA, size, size, 0, gl.ALPHA, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }

    const resourceId = this.trackResource(contextId, 'texture', texture, (ctx, handle) => {
      ctx?.deleteTexture(handle);
    }, metadata);

    return {
      id: resourceId,
      handle: texture,
      texture,
      target: supports3D ? gl.TEXTURE_3D : gl.TEXTURE_2D,
      metadata,
    };
  }

  createProgram(contextId, vertexSource, fragmentSource) {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`ResourceManager: context ${contextId} not registered`);
    }

    const { gl } = context;
    const vertexShader = this.compileShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    const program = gl.createProgram();
    if (!program) {
      throw new Error('ResourceManager: failed to create program');
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error(`ResourceManager: program link failed: ${log}`);
    }

    const metadata = { size: 0 };
    const resourceId = this.trackResource(contextId, 'program', program, (ctx, handle) => {
      ctx?.deleteProgram(handle);
    }, metadata);

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return {
      id: resourceId,
      handle: program,
      program,
      metadata,
    };
  }

  createShaderSuite(contextId, shaderSources) {
    const context = this.contexts.get(contextId);
    if (!context) {
      throw new Error(`ResourceManager: context ${contextId} not registered`);
    }

    const { gl } = context;
    const collection = new Map();

    Object.entries(shaderSources).forEach(([key, source]) => {
      const shader = this.compileShader(gl, key.includes('vertex') ? gl.VERTEX_SHADER : gl.FRAGMENT_SHADER, source);
      const metadata = { size: source.length };
      const resourceId = this.trackResource(contextId, 'shader', shader, (ctx, handle) => {
        ctx?.deleteShader(handle);
      }, metadata);
      collection.set(key, {
        id: resourceId,
        handle: shader,
        shader,
        metadata,
      });
    });

    return collection;
  }

  compileShader(gl, shaderType, source) {
    const shader = gl.createShader(shaderType);
    if (!shader) {
      throw new Error('ResourceManager: failed to create shader');
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`ResourceManager: shader compile failed: ${log}`);
    }

    return shader;
  }

  releaseSharedResource(type, key, resource) {
    const handle = resource?.handle
      ?? resource?.buffer
      ?? resource?.texture
      ?? resource?.shader
      ?? resource?.program
      ?? resource;

    if (type === 'buffers') {
      this.releaseByHandle(handle);
    } else if (type === 'textures') {
      this.releaseByHandle(handle);
    } else if (type === 'shaders') {
      this.releaseByHandle(handle);
    } else if (type === 'programs') {
      this.releaseByHandle(handle);
    }
  }

  releaseByHandle(handle) {
    if (!handle) {
      return;
    }

    for (const [resourceId, record] of this.resources.entries()) {
      if (record.handle === handle) {
        this.releaseResource(resourceId);
        return;
      }
    }
  }

  checkMemoryPressure() {
    if (this.memoryUsage.total < this.maxMemoryUsage * this.cleanupThreshold) {
      return;
    }

    const excess = this.memoryUsage.total - this.maxMemoryUsage * this.cleanupThreshold;
    if (excess <= 0) {
      return;
    }

    const candidates = [...this.resources.values()]
      .filter((resource) => (resource.metadata?.size ?? 0) > 0)
      .sort((a, b) => (a.metadata?.lastUsed ?? 0) - (b.metadata?.lastUsed ?? 0));

    let freed = 0;
    for (const candidate of candidates) {
      if (freed >= excess) {
        break;
      }
      freed += candidate.metadata?.size ?? 0;
      this.releaseResource(candidate.id);
    }
  }

  checkContextHealth() {
    this.contexts.forEach((record, contextId) => {
      if (record.lost) {
        return;
      }

      const gl = record.gl;
      if (gl && typeof gl.isContextLost === 'function' && gl.isContextLost()) {
        console.warn(`ResourceManager: detected lost context ${contextId}`);
        this.handleContextLost(contextId);
      }
    });
  }

  hslToRgb(h, s, l) {
    const sat = s / 100;
    const light = l / 100;
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = light - c / 2;

    let r = 0;
    let g = 0;
    let b = 0;

    if (h < 60) {
      r = c; g = x; b = 0;
    } else if (h < 120) {
      r = x; g = c; b = 0;
    } else if (h < 180) {
      r = 0; g = c; b = x;
    } else if (h < 240) {
      r = 0; g = x; b = c;
    } else if (h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    return [
      Math.round((r + m) * 255),
      Math.round((g + m) * 255),
      Math.round((b + m) * 255),
    ];
  }

  dispose() {
    [...this.resources.keys()].forEach((resourceId) => this.releaseResource(resourceId));
    this.contexts.clear();
    this.sharedResources.clear();
    this.stopMonitoring();
  }

  destroy() {
    this.dispose();
  }
}

export default ResourceManager;
