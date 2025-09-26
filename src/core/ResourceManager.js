/**
 * ResourceManager
 * ------------------------------------------------------------
 * Tracks WebGL contexts and GPU resources in a way that works with the
 * existing engines.  It keeps small registries so we can release buffers
 * or textures when a system shuts down, and exposes helper methods for
 * registering custom disposal callbacks.
 */

const RESOURCE_TYPES = ['buffers', 'textures', 'framebuffers', 'programs'];

export class ResourceManager {
  constructor() {
    this.contexts = new Map(); // canvasId -> { systemName, gl }
    this.resources = RESOURCE_TYPES.reduce((acc, type) => {
      acc[type] = new Map();
      return acc;
    }, {});
  }

  registerContext(systemName, canvasId, gl) {
    this.contexts.set(canvasId, { systemName, gl });
  }

  getContextForCanvas(canvasId) {
    const entry = this.contexts.get(canvasId);
    return entry ? entry.gl : null;
  }

  getContextsForSystem(systemName) {
    return [...this.contexts.values()]
      .filter((entry) => entry.systemName === systemName)
      .map((entry) => entry.gl);
  }

  releaseContext(canvasId) {
    this.contexts.delete(canvasId);
  }

  trackResource(type, id, handle, { owner, dispose } = {}) {
    if (!RESOURCE_TYPES.includes(type)) {
      throw new Error(`ResourceManager: unsupported resource type "${type}"`);
    }

    this.resources[type].set(id, { handle, owner, dispose });
    return handle;
  }

  getResource(type, id) {
    return this.resources[type]?.get(id)?.handle ?? null;
  }

  releaseResource(type, id) {
    const entry = this.resources[type]?.get(id);
    if (!entry) {
      return;
    }

    if (typeof entry.dispose === 'function') {
      try {
        entry.dispose(entry.handle);
      } catch (error) {
        console.warn(`ResourceManager: dispose failed for ${type}:${id}`, error);
      }
    }

    this.resources[type].delete(id);
  }

  releaseResourcesOwnedBy(owner) {
    if (!owner) {
      return;
    }

    RESOURCE_TYPES.forEach((type) => {
      const entries = this.resources[type];
      entries.forEach((entry, id) => {
        if (entry.owner === owner) {
          this.releaseResource(type, id);
        }
      });
    });
  }

  cleanupSystem(systemName) {
    this.contexts.forEach((entry, canvasId) => {
      if (entry.systemName === systemName) {
        const gl = entry.gl;
        if (gl && !gl.isContextLost()) {
          const loseContext = gl.getExtension('WEBGL_lose_context');
          if (loseContext) {
            loseContext.loseContext();
          }
        }
        this.contexts.delete(canvasId);
      }
    });

    RESOURCE_TYPES.forEach((type) => {
      const entries = this.resources[type];
      entries.forEach((entry, id) => {
        if (entry.owner === systemName) {
          this.releaseResource(type, id);
        }
      });
    });
  }

  cleanup() {
    [...this.contexts.keys()].forEach((canvasId) => this.releaseContext(canvasId));
    RESOURCE_TYPES.forEach((type) => {
      const entries = this.resources[type];
      entries.forEach((_entry, id) => this.releaseResource(type, id));
    });
  }
}

export default ResourceManager;
