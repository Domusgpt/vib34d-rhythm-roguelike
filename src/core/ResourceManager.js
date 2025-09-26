/**
 * ResourceManager
 * ------------------------------------------------------------
 * A lightweight WebGL resource tracker that centralises lifecycle
 * management for contexts, buffers, textures and programs. The
 * previous implementation attempted to eagerly manage every possible
 * GPU object which made the system brittle and extremely noisy. This
 * version embraces the production guidelines from
 * PROPER_ARCHITECTURE_SOLUTIONS.md by:
 *   • registering WebGL contexts once and reacting to context loss
 *   • tracking resource ownership so we can dispose them deterministically
 *   • exposing small helpers for creating buffers and textures when the
 *     coordinator needs shared assets
 */

const RESOURCE_TYPES = ['buffer', 'texture', 'program', 'framebuffer'];

export class ResourceManager {
  constructor() {
    this.contexts = new Map(); // contextId -> { gl, resources:Set }
    this.resources = new Map(); // resourceId -> { type, gl, handle, dispose }
    this.nextResourceId = 1;
  }

  /**
   * Register a WebGL context so the manager can clean up its resources
   * when the context is lost or when the application is torn down.
   */
  registerWebGLContext(contextId, gl) {
    if (!contextId || !gl) {
      throw new Error('ResourceManager.registerWebGLContext requires an id and context');
    }

    const existing = this.contexts.get(contextId);
    if (existing && existing.gl === gl) {
      return existing;
    }

    const record = { gl, resources: new Set() };
    this.contexts.set(contextId, record);

    // Attach context loss handling so we can tear down gracefully.
    if (typeof gl.canvas?.addEventListener === 'function') {
      gl.canvas.addEventListener('webglcontextlost', () => {
        this.releaseContextResources(contextId);
      });
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

  /**
   * Track a WebGL resource so it can be reclaimed later.
   */
  trackResource(contextId, type, handle, dispose) {
    if (!RESOURCE_TYPES.includes(type)) {
      throw new Error(`ResourceManager: unsupported resource type ${type}`);
    }

    const record = this.contexts.get(contextId);
    if (!record) {
      throw new Error(`ResourceManager: unknown context ${contextId}`);
    }

    const resourceId = `${type}-${this.nextResourceId += 1}`;
    this.resources.set(resourceId, {
      type,
      gl: record.gl,
      handle,
      dispose,
      contextId,
    });

    record.resources.add(resourceId);
    return resourceId;
  }

  releaseResource(resourceId) {
    const resource = this.resources.get(resourceId);
    if (!resource) {
      return;
    }

    try {
      if (typeof resource.dispose === 'function') {
        resource.dispose(resource.gl, resource.handle);
      }
    } finally {
      this.resources.delete(resourceId);
      const contextRecord = this.contexts.get(resource.contextId);
      contextRecord?.resources.delete(resourceId);
    }
  }

  releaseContextResources(contextId) {
    const record = this.contexts.get(contextId);
    if (!record) {
      return;
    }

    [...record.resources].forEach((resourceId) => this.releaseResource(resourceId));
    record.resources.clear();
  }

  createBuffer(contextId, data, usage) {
    const record = this.contexts.get(contextId);
    if (!record) {
      throw new Error(`ResourceManager: context ${contextId} not registered`);
    }

    const { gl } = record;
    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error('ResourceManager: failed to create buffer');
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage ?? gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.trackResource(contextId, 'buffer', buffer, (ctx, handle) => {
      ctx.deleteBuffer(handle);
    });

    return buffer;
  }

  createTexture(contextId, { width = 1, height = 1, data = null, format, type, minFilter, magFilter } = {}) {
    const record = this.contexts.get(contextId);
    if (!record) {
      throw new Error(`ResourceManager: context ${contextId} not registered`);
    }

    const { gl } = record;
    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('ResourceManager: failed to create texture');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter ?? gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter ?? gl.LINEAR);

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

    this.trackResource(contextId, 'texture', texture, (ctx, handle) => {
      ctx.deleteTexture(handle);
    });

    return texture;
  }

  createProgram(contextId, vertexSource, fragmentSource) {
    const record = this.contexts.get(contextId);
    if (!record) {
      throw new Error(`ResourceManager: context ${contextId} not registered`);
    }

    const { gl } = record;
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

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    this.trackResource(contextId, 'program', program, (ctx, handle) => {
      ctx.deleteProgram(handle);
    });

    return program;
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

  dispose() {
    [...this.resources.keys()].forEach((resourceId) => this.releaseResource(resourceId));
    this.contexts.clear();
  }

  destroy() {
    this.dispose();
  }
}

export default ResourceManager;
