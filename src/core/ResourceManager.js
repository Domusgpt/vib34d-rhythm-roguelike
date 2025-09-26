/**
 * ResourceManager tracks WebGL allocations, manages memory pressure,
 * and coordinates context health as described in
 * PROPER_ARCHITECTURE_SOLUTIONS.md. The implementation is defensive
 * and browser-friendly while remaining safe to import in non-browser
 * environments (tests, SSR).
 */

const DEFAULT_MAX_MEMORY = 256 * 1024 * 1024; // 256MB
const DEFAULT_CLEANUP_THRESHOLD = 0.8; // 80%

export class ResourceManager {
  constructor(options = {}) {
    this.resources = new Map();
    this.resourceTypes = new Map();
    this.resourceUsers = new Map();
    this.glContexts = new Map();
    this.memoryUsage = {
      textures: 0,
      buffers: 0,
      shaders: 0,
      total: 0,
    };

    this.resourceTracking = options.resourceTracking !== undefined
      ? options.resourceTracking
      : true;

    this.maxMemoryUsage = options.maxMemoryUsage || DEFAULT_MAX_MEMORY;
    this.cleanupThreshold = options.cleanupThreshold || DEFAULT_CLEANUP_THRESHOLD;
    this.primaryContextId = null;

    this.monitorIntervals = [];
    this.initializeMonitoring();
  }

  initializeMonitoring() {
    if (typeof setInterval !== 'function') {
      return;
    }

    const memoryInterval = setInterval(() => {
      this.updateMemoryUsage();
      this.checkMemoryPressure();
    }, 5000);

    const contextInterval = setInterval(() => {
      this.checkWebGLContexts();
    }, 10000);

    this.monitorIntervals.push(memoryInterval, contextInterval);
  }

  createTexture(gl, options = {}) {
    const resourceId = this.generateResourceId('texture');
    const texture = gl.createTexture();

    if (!texture) {
      throw new Error('ResourceManager: Failed to create WebGL texture');
    }

    const textureInfo = {
      glTexture: texture,
      width: options.width || 1,
      height: options.height || 1,
      depth: options.depth || 1,
      format: options.format || gl.RGBA,
      type: options.type || gl.UNSIGNED_BYTE,
      mipLevels: options.mipLevels || 1,
      target: options.target || gl.TEXTURE_2D,
      memorySize: this.calculateTextureMemory(options),
      createdAt: Date.now(),
      lastUsed: Date.now(),
      contextId: options.contextId || this.getPrimaryContextId(),
    };

    this.resources.set(resourceId, textureInfo);
    this.resourceTypes.set(resourceId, 'texture');
    this.resourceUsers.set(resourceId, new Set());

    this.memoryUsage.textures += textureInfo.memorySize;
    this.memoryUsage.total += textureInfo.memorySize;

    if (this.resourceTracking) {
      console.log(`ResourceManager: texture created ${resourceId} (${textureInfo.memorySize} bytes)`);
    }

    return { resourceId, texture };
  }

  createBuffer(gl, data, usage = gl.STATIC_DRAW, type = gl.ARRAY_BUFFER, options = {}) {
    const resourceId = this.generateResourceId('buffer');
    const buffer = gl.createBuffer();

    if (!buffer) {
      throw new Error('ResourceManager: Failed to create WebGL buffer');
    }

    gl.bindBuffer(type, buffer);
    gl.bufferData(type, data, usage);

    const bufferInfo = {
      glBuffer: buffer,
      size: data.byteLength,
      usage,
      type,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      contextId: options.contextId || this.getPrimaryContextId(),
    };

    this.resources.set(resourceId, bufferInfo);
    this.resourceTypes.set(resourceId, 'buffer');
    this.resourceUsers.set(resourceId, new Set());

    this.memoryUsage.buffers += bufferInfo.size;
    this.memoryUsage.total += bufferInfo.size;

    if (this.resourceTracking) {
      console.log(`ResourceManager: buffer created ${resourceId} (${bufferInfo.size} bytes)`);
    }

    return { resourceId, buffer };
  }

  createShaderProgram(gl, vertexSource, fragmentSource, options = {}) {
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
        throw new Error(`ResourceManager: Shader program linking failed: ${error}`);
      }

      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);

      const programInfo = {
        glProgram: program,
        vertexSource,
        fragmentSource,
        uniforms: this.extractUniforms(gl, program),
        attributes: this.extractAttributes(gl, program),
        createdAt: Date.now(),
        lastUsed: Date.now(),
        contextId: options.contextId || this.getPrimaryContextId(),
      };

      this.resources.set(resourceId, programInfo);
      this.resourceTypes.set(resourceId, 'shader');
      this.resourceUsers.set(resourceId, new Set());

      const shaderMemory = (vertexSource.length + fragmentSource.length) * 2;
      this.memoryUsage.shaders += shaderMemory;
      this.memoryUsage.total += shaderMemory;

      if (this.resourceTracking) {
        console.log(`ResourceManager: shader program created ${resourceId}`);
      }

      return { resourceId, program };
    } catch (error) {
      console.error('ResourceManager: Shader program creation failed', error);
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
      throw new Error(`ResourceManager: Shader compilation failed: ${error}`);
    }

    return shader;
  }

  extractUniforms(gl, program) {
    const uniforms = {};
    const numUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);

    for (let i = 0; i < numUniforms; i += 1) {
      const uniform = gl.getActiveUniform(program, i);
      const location = gl.getUniformLocation(program, uniform.name);
      uniforms[uniform.name] = {
        location,
        type: uniform.type,
        size: uniform.size,
      };
    }

    return uniforms;
  }

  extractAttributes(gl, program) {
    const attributes = {};
    const numAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

    for (let i = 0; i < numAttributes; i += 1) {
      const attribute = gl.getActiveAttrib(program, i);
      const location = gl.getAttribLocation(program, attribute.name);
      attributes[attribute.name] = {
        location,
        type: attribute.type,
        size: attribute.size,
      };
    }

    return attributes;
  }

  useResource(resourceId, userId) {
    if (!this.resources.has(resourceId)) {
      console.error(`ResourceManager: resource not found ${resourceId}`);
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
      return;
    }

    const users = this.resourceUsers.get(resourceId);
    users.delete(userId);

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

  cleanupUnusedResources() {
    const now = Date.now();
    const cleanupDelay = 30000;
    let cleanedCount = 0;

    this.resources.forEach((resource, resourceId) => {
      const users = this.resourceUsers.get(resourceId);
      const type = this.resourceTypes.get(resourceId);

      if (users.size === 0 && resource.markedForCleanup) {
        const timeSinceMarked = now - (resource.cleanupTime || 0);
        if (timeSinceMarked > cleanupDelay) {
          this.destroyResource(resourceId);
          cleanedCount += 1;
        }
      } else if (users.size === 0) {
        const timeSinceUsed = now - resource.lastUsed;
        const maxAge = type === 'texture' ? 300000 : 120000;
        if (timeSinceUsed > maxAge) {
          this.destroyResource(resourceId);
          cleanedCount += 1;
        }
      }
    });

    if (cleanedCount > 0 && this.resourceTracking) {
      console.log(`ResourceManager: cleaned ${cleanedCount} unused resources`);
    }

    return cleanedCount;
  }

  destroyResource(resourceId) {
    const resource = this.resources.get(resourceId);
    const type = this.resourceTypes.get(resourceId);

    if (!resource) {
      return;
    }

    const gl = this.getWebGLContextForResource(resourceId);

    if (gl) {
      try {
        switch (type) {
          case 'texture':
            gl.deleteTexture(resource.glTexture);
            this.memoryUsage.textures -= resource.memorySize || 0;
            break;
          case 'buffer':
            gl.deleteBuffer(resource.glBuffer);
            this.memoryUsage.buffers -= resource.size || 0;
            break;
          case 'shader':
            gl.deleteProgram(resource.glProgram);
            this.memoryUsage.shaders -= (resource.vertexSource?.length || 0)
              + (resource.fragmentSource?.length || 0);
            break;
          default:
            break;
        }
      } catch (error) {
        console.error(`ResourceManager: error destroying resource ${resourceId}`, error);
      }
    }

    this.resources.delete(resourceId);
    this.resourceTypes.delete(resourceId);
    this.resourceUsers.delete(resourceId);
    this.updateMemoryUsage();

    if (this.resourceTracking) {
      console.log(`ResourceManager: destroyed resource ${resourceId} (${type})`);
    }
  }

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
          shaderMemory += (resource.vertexSource?.length || 0)
            + (resource.fragmentSource?.length || 0);
          break;
        default:
          break;
      }
    });

    this.memoryUsage = {
      textures: textureMemory,
      buffers: bufferMemory,
      shaders: shaderMemory,
      total: textureMemory + bufferMemory + shaderMemory,
    };
  }

  checkMemoryPressure() {
    const usageRatio = this.memoryUsage.total / this.maxMemoryUsage;
    if (usageRatio > this.cleanupThreshold) {
      console.warn(`ResourceManager: memory usage high ${(usageRatio * 100).toFixed(1)}%`);

      this.cleanupUnusedResources();
      const newUsageRatio = this.memoryUsage.total / this.maxMemoryUsage;
      if (newUsageRatio > 0.9) {
        this.aggressiveCleanup();
      }
    }
  }

  aggressiveCleanup() {
    const unusedResources = Array.from(this.resources.entries())
      .filter(([resourceId]) => this.resourceUsers.get(resourceId).size === 0)
      .sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));

    const targetCleanup = Math.floor(unusedResources.length * 0.3);
    for (let i = 0; i < targetCleanup; i += 1) {
      this.destroyResource(unusedResources[i][0]);
    }

    if (targetCleanup > 0) {
      console.warn(`ResourceManager: aggressive cleanup removed ${targetCleanup} resources`);
    }
  }

  registerWebGLContext(contextId, gl) {
    if (!contextId || !gl) {
      return;
    }

    this.glContexts.set(contextId, {
      context: gl,
      canvas: gl.canvas,
      registeredAt: Date.now(),
      lastHealthCheck: Date.now(),
      healthy: true,
    });

    if (!this.primaryContextId) {
      this.primaryContextId = contextId;
    }

    if (typeof gl.canvas?.addEventListener === 'function') {
      gl.canvas.addEventListener('webglcontextlost', (event) => {
        console.warn(`ResourceManager: context lost ${contextId}`);
        if (event && typeof event.preventDefault === 'function') {
          event.preventDefault();
        }
        this.handleContextLoss(contextId);
      });

      gl.canvas.addEventListener('webglcontextrestored', () => {
        console.log(`ResourceManager: context restored ${contextId}`);
        this.handleContextRestore(contextId);
      });
    }
  }

  checkWebGLContexts() {
    this.glContexts.forEach((contextInfo, contextId) => {
      const gl = contextInfo.context;
      if (!gl || typeof gl.isContextLost !== 'function') {
        return;
      }

      if (gl.isContextLost()) {
        if (contextInfo.healthy) {
          console.warn(`ResourceManager: detected lost context ${contextId}`);
          contextInfo.healthy = false;
          this.handleContextLoss(contextId);
        }
      } else {
        if (!contextInfo.healthy) {
          console.log(`ResourceManager: context ${contextId} restored`);
          contextInfo.healthy = true;
          this.handleContextRestore(contextId);
        }
        contextInfo.lastHealthCheck = Date.now();
      }
    });
  }

  handleContextLoss(contextId) {
    this.resources.forEach((resource) => {
      if (resource.contextId === contextId) {
        resource.contextLost = true;
      }
    });
  }

  handleContextRestore(contextId) {
    const contextInfo = this.glContexts.get(contextId);
    if (contextInfo) {
      contextInfo.healthy = true;
    }

    this.resources.forEach((resource) => {
      if (resource.contextId === contextId) {
        resource.contextLost = false;
      }
    });
  }

  calculateTextureMemory(options = {}) {
    const width = options.width || 1;
    const height = options.height || 1;
    const depth = options.depth || 1;
    const mipLevels = options.mipLevels || 1;

    let bytesPerPixel = 4;
    const format = options.format;

    if (format) {
      switch (format) {
        case 'RGB':
        case 0x1907: // gl.RGB
          bytesPerPixel = 3;
          break;
        case 'LUMINANCE':
        case 0x1909: // gl.LUMINANCE
          bytesPerPixel = 1;
          break;
        case 'LUMINANCE_ALPHA':
        case 0x190A: // gl.LUMINANCE_ALPHA
          bytesPerPixel = 2;
          break;
        default:
          bytesPerPixel = 4;
          break;
      }
    }

    let total = 0;
    for (let i = 0; i < mipLevels; i += 1) {
      const mipWidth = Math.max(1, width >> i);
      const mipHeight = Math.max(1, height >> i);
      const mipDepth = Math.max(1, depth >> i);
      total += mipWidth * mipHeight * mipDepth * bytesPerPixel;
    }

    return total;
  }

  generateResourceId(type) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${type}_${timestamp}_${random}`;
  }

  getWebGLContextForResource(resourceId) {
    const resource = this.resources.get(resourceId);
    if (resource && resource.contextId && this.glContexts.has(resource.contextId)) {
      return this.glContexts.get(resource.contextId).context;
    }

    if (this.primaryContextId && this.glContexts.has(this.primaryContextId)) {
      return this.glContexts.get(this.primaryContextId).context;
    }

    const firstContext = this.glContexts.values().next();
    return firstContext.value ? firstContext.value.context : null;
  }

  getPrimaryContextId() {
    if (this.primaryContextId) {
      return this.primaryContextId;
    }
    const firstKey = this.glContexts.keys().next();
    return firstKey.value || null;
  }

  getMemoryReport() {
    return {
      usage: { ...this.memoryUsage },
      limits: {
        max: this.maxMemoryUsage,
        cleanupThreshold: this.cleanupThreshold * this.maxMemoryUsage,
      },
      resources: {
        total: this.resources.size,
        byType: {
          textures: Array.from(this.resourceTypes.values()).filter((t) => t === 'texture').length,
          buffers: Array.from(this.resourceTypes.values()).filter((t) => t === 'buffer').length,
          shaders: Array.from(this.resourceTypes.values()).filter((t) => t === 'shader').length,
        },
      },
      contexts: {
        total: this.glContexts.size,
        healthy: Array.from(this.glContexts.values()).filter((c) => c.healthy).length,
      },
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
      markedForCleanup: resource.markedForCleanup || false,
    }));
  }

  destroy() {
    this.resources.forEach((_, resourceId) => {
      this.destroyResource(resourceId);
    });

    this.resources.clear();
    this.resourceTypes.clear();
    this.resourceUsers.clear();
    this.glContexts.clear();

    this.monitorIntervals.forEach((intervalId) => clearInterval(intervalId));
    this.monitorIntervals = [];

    if (this.resourceTracking) {
      console.log('ResourceManager: destroyed');
    }
  }
}
