/**
 * CanvasResourcePool
 * ------------------------------------------------------------
 * Implements the professional canvas lifecycle architecture from the
 * PROPER_ARCHITECTURE_SOLUTIONS.md document. Each visualisation system
 * receives a fixed set of layered canvases with persistent WebGL
 * contexts so mode switches never churn the DOM or lose GPU state.
 */

const DEFAULT_SYSTEMS = ['faceted', 'quantum', 'holographic', 'polychora', 'hypercube'];
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
  hypercube: [
    { key: 'content', id: 'hypercube-canvas' },
    { key: 'accent', id: 'hypercube-accent-canvas' },
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
      const layerSchemas = this.layerSchemas[systemName] || [];
      const container = this.containerElements.get(systemName);
      if (!container) {
        return;
      }

      const canvases = [];
      this.canvases.set(systemName, canvases);

      const totalLayers = Math.min(Math.max(layerSchemas.length, 1), this.maxCanvasesPerSystem);

      for (let index = 0; index < totalLayers; index += 1) {
        const schema = layerSchemas[index] || {};
        const record = this.createCanvas(
          systemName,
          schema,
          index,
          viewWidth,
          viewHeight,
          dpr,
          container,
        );

        canvases.push(record);
      }
    });
  }

  createCanvas(systemName, schema, layerIndex, viewWidth, viewHeight, dpr, container) {
    const entry = typeof schema === 'string' ? { key: schema } : { ...schema };
    const key = entry.key || entry.name || `layer-${layerIndex}`;
    const explicitId = entry.id;
    const generatedId = systemName === 'faceted'
      ? `${key}-canvas`
      : `${systemName}-${key}-canvas`;
    const canvasId = explicitId || generatedId;

    let canvas = (canvasId && document.getElementById(canvasId)) || null;

    if (!canvas) {
      canvas = document.createElement('canvas');
      if (canvasId) {
        canvas.id = canvasId;
      }
    }

    if (canvas.parentElement !== container) {
      container.appendChild(canvas);
    }

    canvas.dataset.visualizerSystem = systemName;
    canvas.dataset.visualizerLayer = key;

    const className = entry.className || 'visualization-layer';
    canvas.className = className;

    const style = canvas.style;
    style.position = entry.position || 'absolute';
    style.top = entry.top || '0';
    style.left = entry.left || '0';
    style.width = entry.width || '100%';
    style.height = entry.height || '100%';
    style.zIndex = String(entry.zIndex ?? layerIndex + 1);
    style.pointerEvents = entry.pointerEvents || 'none';

    canvas.width = viewWidth * dpr;
    canvas.height = viewHeight * dpr;

    return { canvas, key, layerIndex };
  }

  prepareContext(canvas, systemName, layerIndex, layerKey = null) {
    try {
      const gl = canvas.getContext('webgl2', this.contextAttributes)
        || canvas.getContext('webgl', this.contextAttributes);

      if (!gl) {
        console.warn(`CanvasResourcePool: unable to acquire WebGL context for ${systemName} layer ${layerIndex}`);
        return;
      }

      const contextId = this.getContextId(systemName, layerIndex);
      const entry = (this.canvases.get(systemName) || [])
        .find((record) => record.canvas === canvas || record.layerIndex === layerIndex);
      const resolvedLayerKey = layerKey || entry?.key || this.contextRecords.get(canvas)?.layerKey || null;
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (typeof gl.clearColor === 'function') {
        gl.clearColor(0, 0, 0, 0);
      }

      const record = {
        systemName,
        layerIndex,
        layerKey: resolvedLayerKey,
        contextId,
        context: gl,
      };

      this.contextRecords.set(canvas, record);
      this.resourceManager?.registerWebGLContext(contextId, gl, { label: `${systemName}:${layerIndex}` });

      if (typeof canvas.addEventListener === 'function') {
        canvas.addEventListener('webglcontextlost', (event) => {
          event.preventDefault?.();
          this.resourceManager?.handleContextLost?.(contextId);
        });

        canvas.addEventListener('webglcontextrestored', () => {
          this.recoverContext(canvas, systemName, layerIndex);
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
      previousCanvases.forEach(({ canvas }) => {
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
    targetCanvases.forEach((entry) => {
      const record = this.ensureContextForEntry(systemName, entry);
      if (!record?.context || record.context.isContextLost?.()) {
        this.recoverContext(entry.canvas, systemName, entry.layerIndex);
      }
    });

    this.activeSystem = systemName;
  }

  ensureContextForEntry(systemName, entry) {
    if (!entry) {
      return null;
    }

    let record = this.contextRecords.get(entry.canvas);
    const contextLost = record?.context?.isContextLost?.();

    if (!record?.context || contextLost) {
      this.prepareContext(entry.canvas, systemName, entry.layerIndex, entry.key);
      record = this.contextRecords.get(entry.canvas) || null;
    }

    return record;
  }

  recoverContext(canvas, systemName, layerIndex) {
    try {
      const gl = canvas.getContext('webgl2', this.contextAttributes)
        || canvas.getContext('webgl', this.contextAttributes);

      if (!gl) {
        console.error(`CanvasResourcePool: failed to recover context for ${systemName}`);
        return;
      }

      const entry = (this.canvases.get(systemName) || [])
        .find((record) => record.canvas === canvas || record.layerIndex === layerIndex);
      const resolvedLayerKey = entry?.key || this.contextRecords.get(canvas)?.layerKey || null;
      const contextId = this.getContextId(systemName, layerIndex);
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (typeof gl.clearColor === 'function') {
        gl.clearColor(0, 0, 0, 0);
      }

      this.contextRecords.set(canvas, {
        systemName,
        layerIndex,
        layerKey: resolvedLayerKey,
        contextId,
        context: gl,
      });

      this.resourceManager?.registerWebGLContext(contextId, gl, { label: `${systemName}:${layerIndex}` });
      console.log(`CanvasResourcePool: WebGL context recovered for ${systemName} layer ${layerIndex}`);
    } catch (error) {
      console.error(`CanvasResourcePool: context recovery failed for ${systemName}`, error);
    }
  }

  getCanvasResources(systemName, layer = 0) {
    const canvases = this.canvases.get(systemName);
    if (!canvases || canvases.length === 0) {
      console.error(`CanvasResourcePool: no canvases registered for system ${systemName}`);
      return null;
    }

    let entry = null;
    if (typeof layer === 'string') {
      entry = canvases.find((item) => item.key === layer);
    } else {
      entry = canvases[layer];
    }

    if (!entry) {
      console.error(`CanvasResourcePool: invalid canvas request ${systemName} layer ${layer}`);
      return null;
    }

    const { canvas, key, layerIndex } = entry;
    const record = this.ensureContextForEntry(systemName, entry);

    return {
      canvas,
      key,
      layerIndex,
      context: record?.context ?? null,
      contextId: record?.contextId ?? null,
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
      systemCanvases.forEach(({ canvas }) => {
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
    this.containerElements.clear();
    this.activeSystem = null;
    this.initialised = false;
  }

  cleanup() {
    this.destroy();
  }

  getContextId(systemName, layerIndex) {
    return `${systemName}-layer-${layerIndex}`;
  }
}

export class CanvasManager extends CanvasResourcePool {}

export default CanvasResourcePool;
