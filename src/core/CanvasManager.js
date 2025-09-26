/**
 * CanvasResourcePool
 * ------------------------------------------------------------
 * Implements the professional canvas lifecycle architecture from the
 * PROPER_ARCHITECTURE_SOLUTIONS.md document. Each visualisation system
 * receives a fixed set of layered canvases with persistent WebGL
 * contexts so mode switches never churn the DOM or lose GPU state.
 */

const DEFAULT_SYSTEMS = ['faceted', 'quantum', 'holographic', 'polychora'];
const DEFAULT_LAYER_SCHEMAS = {
  faceted: [
    { key: 'background', id: 'background-canvas' },
    { key: 'shadow', id: 'shadow-canvas' },
    { key: 'content', id: 'content-canvas' },
    { key: 'highlight', id: 'highlight-canvas' },
    { key: 'accent', id: 'accent-canvas' },
  ],
  quantum: [
    { key: 'background', id: 'quantum-background-canvas' },
    { key: 'shadow', id: 'quantum-shadow-canvas' },
    { key: 'content', id: 'quantum-content-canvas' },
    { key: 'highlight', id: 'quantum-highlight-canvas' },
    { key: 'accent', id: 'quantum-accent-canvas' },
  ],
  holographic: [
    { key: 'background', id: 'holo-background-canvas' },
    { key: 'shadow', id: 'holo-shadow-canvas' },
    { key: 'content', id: 'holo-content-canvas' },
    { key: 'highlight', id: 'holo-highlight-canvas' },
    { key: 'accent', id: 'holo-accent-canvas' },
  ],
  polychora: [
    { key: 'background', id: 'polychora-background-canvas' },
    { key: 'shadow', id: 'polychora-shadow-canvas' },
    { key: 'content', id: 'polychora-content-canvas' },
    { key: 'highlight', id: 'polychora-highlight-canvas' },
    { key: 'accent', id: 'polychora-accent-canvas' },
  ],
  default: [
    { key: 'background' },
    { key: 'content' },
    { key: 'accent' },
  ],
};

const DEFAULT_CONTEXT_ATTRIBUTES = {
  alpha: true,
  antialias: true,
  depth: true,
  stencil: false,
  preserveDrawingBuffer: false,
  powerPreference: 'high-performance',
};

export class CanvasResourcePool {
  constructor({
    systems = DEFAULT_SYSTEMS,
    layerSchemas = DEFAULT_LAYER_SCHEMAS,
    contextAttributes = DEFAULT_CONTEXT_ATTRIBUTES,
    resourceManager = null,
    maxCanvasesPerSystem = 5,
  } = {}) {
    this.systems = systems;
    this.layerSchemas = layerSchemas;
    this.contextAttributes = contextAttributes;
    this.resourceManager = resourceManager;
    this.maxCanvasesPerSystem = maxCanvasesPerSystem;

    this.containerElements = new Map();
    this.canvases = new Map();
    this.contextRecords = new Map();
    this.layerMetadata = new Map();
    this.resizeHandler = null;
    this.activeSystem = null;
    this.initialised = false;
  }

  initialize() {
    if (this.initialised) {
      return;
    }

    this.createContainerElements();
    this.preallocateCanvases();
    this.setupResizeHandler();
    this.initialised = true;
  }

  /**
   * Create DOM containers for each visualisation system. The containers
   * are layered absolutely so that switching systems is a matter of
   * toggling visibility rather than destroying/creating nodes.
   */
  createContainerElements() {
    const root = document.getElementById('game-container') || document.body;

    this.systems.forEach((systemName) => {
      const containerId = systemName === 'faceted' ? 'vib34dLayers' : `${systemName}Layers`;
      let container = document.getElementById(containerId);

      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'visualization-container';
        container.style.cssText = `
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: none;
          pointer-events: none;
        `;
        root.appendChild(container);
      }

      this.containerElements.set(systemName, container);
    });
  }

  /**
   * Pre-allocate canvases and WebGL contexts for each system up-front so
   * runtime transitions simply reuse pooled resources.
   */
  preallocateCanvases() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { innerWidth: viewWidth, innerHeight: viewHeight } = window;

    this.systems.forEach((systemName) => {
      const container = this.containerElements.get(systemName);
      if (!container) {
        return;
      }

      const layerConfigs = this.normaliseLayerSchema(systemName);
      const canvases = [];
      const totalLayers = Math.min(Math.max(layerConfigs.length, 1), this.maxCanvasesPerSystem);

      for (let index = 0; index < totalLayers; index += 1) {
        const layerConfig = layerConfigs[index];
        const canvas = this.createCanvas(systemName, layerConfig, index, viewWidth, viewHeight, dpr);
        container.appendChild(canvas);
        canvases.push(canvas);
        this.prepareContext(canvas, systemName, index, layerConfig);
      }

      this.canvases.set(systemName, canvases);
      this.layerMetadata.set(systemName, layerConfigs.slice(0, totalLayers).map((config) => ({ ...config })));
    });
  }

  normaliseLayerSchema(systemName) {
    const schema = this.layerSchemas[systemName] || this.layerSchemas.default || [];
    if (!Array.isArray(schema)) {
      return [];
    }

    const normalized = schema.map((entry, index) => {
      if (typeof entry === 'string') {
        return {
          key: entry,
          id: systemName === 'faceted' ? `${entry}-canvas` : `${systemName}-${entry}-canvas`,
          className: 'visualization-layer',
          zIndex: index + 1,
        };
      }

      if (entry && typeof entry === 'object') {
        const key = entry.key || entry.name || entry.layer || `layer-${index}`;
        const id = entry.id
          || (systemName === 'faceted' ? `${key}-canvas` : `${systemName}-${key}-canvas`);
        return {
          key,
          id,
          className: entry.className || 'visualization-layer',
          zIndex: entry.zIndex ?? (index + 1),
        };
      }

      const fallbackKey = `layer-${index}`;
      return {
        key: fallbackKey,
        id: systemName === 'faceted' ? `${fallbackKey}-canvas` : `${systemName}-${fallbackKey}-canvas`,
        className: 'visualization-layer',
        zIndex: index + 1,
      };
    });

    if (normalized.length === 0) {
      normalized.push({
        key: 'layer-0',
        id: systemName === 'faceted' ? 'layer-0-canvas' : `${systemName}-layer-0-canvas`,
        className: 'visualization-layer',
        zIndex: 1,
      });
    }

    return normalized;
  }

  createCanvas(systemName, layerConfig, layerIndex, viewWidth, viewHeight, dpr) {
    const canvas = document.createElement('canvas');
    canvas.id = layerConfig.id;
    canvas.className = layerConfig.className || 'visualization-layer';
    canvas.dataset.layerKey = layerConfig.key;
    canvas.dataset.layerIndex = String(layerIndex);

    canvas.width = viewWidth * dpr;
    canvas.height = viewHeight * dpr;
    canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: ${layerConfig.zIndex ?? layerIndex + 1};
      pointer-events: none;
    `;

    return canvas;
  }

  prepareContext(canvas, systemName, layerIndex, layerConfig) {
    try {
      const gl = canvas.getContext('webgl2', this.contextAttributes)
        || canvas.getContext('webgl', this.contextAttributes);

      if (!gl) {
        console.warn(`CanvasResourcePool: unable to acquire WebGL context for ${systemName} layer ${layerIndex}`);
        return;
      }

      const layerKey = layerConfig?.key || canvas.dataset.layerKey || `layer-${layerIndex}`;
      const contextId = this.getContextId(systemName, layerIndex, layerKey);
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (typeof gl.clearColor === 'function') {
        gl.clearColor(0, 0, 0, 0);
      }

      const record = {
        systemName,
        layerIndex,
        layerKey,
        contextId,
        context: gl,
      };

      this.contextRecords.set(canvas, record);
      this.resourceManager?.registerWebGLContext(contextId, gl, { label: `${systemName}:${layerKey}` });

      if (typeof canvas.addEventListener === 'function') {
        canvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault?.();
          this.resourceManager?.handleContextLost?.(contextId);
        });

        canvas.addEventListener('webglcontextrestored', () => {
          this.recoverContext(canvas, systemName, layerIndex, layerKey);
        });
      }
    } catch (error) {
      console.error(`CanvasResourcePool: WebGL context creation failed for ${systemName}`, error);
    }
  }

  /**
   * Switch the active system by hiding the previous container, showing
   * the next and ensuring all contexts are healthy.
   */
  switchToSystem(systemName) {
    if (!this.systems.includes(systemName)) {
      console.warn(`CanvasResourcePool: unknown system ${systemName}`);
      return;
    }

    if (this.activeSystem === systemName) {
      return;
    }

    if (this.activeSystem) {
      const previousContainer = this.containerElements.get(this.activeSystem);
      if (previousContainer) {
        previousContainer.style.display = 'none';
      }

      const previousCanvases = this.canvases.get(this.activeSystem) || [];
      previousCanvases.forEach((canvas) => {
        const record = this.contextRecords.get(canvas);
        if (record?.context && typeof record.context.finish === 'function') {
          record.context.finish();
        }
      });
    }

    const targetContainer = this.containerElements.get(systemName);
    if (targetContainer) {
      targetContainer.style.display = 'block';
      targetContainer.style.visibility = 'visible';
      targetContainer.style.opacity = '1';
    }

    const targetCanvases = this.canvases.get(systemName) || [];
    targetCanvases.forEach((canvas) => {
      const record = this.contextRecords.get(canvas);
      if (!record) {
        return;
      }

      if (!record.context || record.context.isContextLost?.()) {
        this.recoverContext(canvas, systemName, record.layerIndex, record.layerKey);
      }
    });

    this.activeSystem = systemName;
  }

  recoverContext(canvas, systemName, layerIndex, layerKey = canvas?.dataset?.layerKey) {
    try {
      const gl = canvas.getContext('webgl2', this.contextAttributes)
        || canvas.getContext('webgl', this.contextAttributes);

      if (!gl) {
        console.error(`CanvasResourcePool: failed to recover context for ${systemName}`);
        return;
      }

      const resolvedKey = layerKey || `layer-${layerIndex}`;
      const contextId = this.getContextId(systemName, layerIndex, resolvedKey);
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (typeof gl.clearColor === 'function') {
        gl.clearColor(0, 0, 0, 0);
      }

      this.contextRecords.set(canvas, {
        systemName,
        layerIndex,
        layerKey: resolvedKey,
        contextId,
        context: gl,
      });

      this.resourceManager?.registerWebGLContext(contextId, gl, { label: `${systemName}:${resolvedKey}` });
      console.log(`CanvasResourcePool: WebGL context recovered for ${systemName} layer ${layerIndex}`);
    } catch (error) {
      console.error(`CanvasResourcePool: context recovery failed for ${systemName}`, error);
    }
  }

  getCanvasResources(systemName, layerRef = 0) {
    const canvases = this.canvases.get(systemName);
    if (!canvases || canvases.length === 0) {
      console.error(`CanvasResourcePool: invalid canvas request ${systemName}`);
      return null;
    }

    let canvas = null;
    let index = -1;

    if (typeof layerRef === 'number') {
      canvas = canvases[layerRef];
      index = layerRef;
    } else if (typeof layerRef === 'string') {
      const metadata = this.layerMetadata.get(systemName) || [];
      index = metadata.findIndex((config) => config.key === layerRef || config.id === layerRef);
      if (index >= 0) {
        canvas = canvases[index];
      }

      if (!canvas) {
        canvas = canvases.find((element) => (
          element.dataset.layerKey === layerRef
          || element.id === layerRef
        ));
        index = canvas ? Number(canvas.dataset.layerIndex ?? canvases.indexOf(canvas)) : -1;
      }
    }

    if (!canvas) {
      console.error(`CanvasResourcePool: invalid canvas request ${systemName} layer ${layerRef}`);
      return null;
    }

    const record = this.contextRecords.get(canvas);

    return {
      canvas,
      context: record?.context ?? null,
      contextId: record?.contextId ?? null,
      layer: record?.layerKey ?? canvas.dataset.layerKey ?? null,
      index,
      isValid: Boolean(record?.context && !record.context.isContextLost?.()),
    };
  }

  setupResizeHandler() {
    if (this.resizeHandler) {
      return;
    }

    let resizeTimeout = null;
    this.resizeHandler = () => {
      const handler = () => {
        this.handleResize();
      };

      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout);
      }

      resizeTimeout = window.setTimeout(handler, 100);
    };

    window.addEventListener('resize', this.resizeHandler);
  }

  handleResize(width = window.innerWidth, height = window.innerHeight) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvases.forEach((systemCanvases) => {
      systemCanvases.forEach((canvas) => {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const record = this.contextRecords.get(canvas);

        if (record?.context && !record.context.isContextLost?.()) {
          record.context.viewport(0, 0, canvas.width, canvas.height);
        }
      });
    });

    console.log(`CanvasResourcePool: resized to ${width}x${height} (DPR ${dpr})`);
  }

  destroy() {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    this.contextRecords.forEach(({ context, contextId }) => {
      if (contextId) {
        this.resourceManager?.unregisterWebGLContext(contextId);
      }

      if (context && !context.isContextLost?.()) {
        const extension = context.getExtension?.('WEBGL_lose_context');
        extension?.loseContext?.();
      }
    });

    this.canvases.clear();
    this.contextRecords.clear();
    this.layerMetadata.clear();
    this.containerElements.clear();
    this.activeSystem = null;
    this.initialised = false;
  }

  cleanup() {
    this.destroy();
  }

  getContextId(systemName, layerIndex, layerKey = `layer-${layerIndex}`) {
    return `${systemName}-${layerKey}-${layerIndex}`;
  }
}

export class CanvasManager extends CanvasResourcePool {}

export default CanvasResourcePool;
