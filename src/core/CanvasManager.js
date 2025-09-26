/**
 * CanvasResourcePool
 * ------------------------------------------------------------
 * Provides the canvas lifecycle management described in the
 * architecture documents. Every visualisation system receives a
 * stable set of canvases and WebGL contexts so that mode switching no
 * longer causes DOM churn or context loss.
 */

const DEFAULT_SYSTEMS = ['faceted', 'quantum', 'holographic', 'polychora'];
const DEFAULT_LAYER_NAMES = ['background', 'content', 'effects'];

export class CanvasResourcePool {
  constructor({ systems = DEFAULT_SYSTEMS, layerNames = DEFAULT_LAYER_NAMES, resourceManager = null } = {}) {
    this.systems = systems;
    this.layerNames = layerNames;
    this.resourceManager = resourceManager;

    this.containerElements = new Map();
    this.canvases = new Map(); // system -> [canvas]
    this.contextRecords = new Map(); // canvas -> { context, contextId }
    this.activeSystem = null;
    this.resizeHandler = null;
  }

  initialize() {
    this.ensureContainers();
    this.preallocateCanvases();
    this.attachResizeListener();
  }

  ensureContainers() {
    const root = document.getElementById('game-container') || document.body;

    this.systems.forEach((systemName) => {
      const containerId = systemName === 'faceted' ? 'vib34dLayers' : `${systemName}Layers`;
      let container = document.getElementById(containerId);
      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'visualization-container';
        Object.assign(container.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          display: 'none',
        });
        root.appendChild(container);
      }

      this.containerElements.set(systemName, container);
    });
  }

  preallocateCanvases() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { innerWidth: viewWidth, innerHeight: viewHeight } = window;

    this.systems.forEach((systemName) => {
      const container = this.containerElements.get(systemName);
      if (!container) {
        return;
      }

      const canvases = [];
      this.layerNames.forEach((layerName, index) => {
        const canvas = document.createElement('canvas');
        canvas.id = this.getCanvasId(systemName, layerName);
        canvas.className = 'visualization-layer';
        canvas.width = viewWidth * dpr;
        canvas.height = viewHeight * dpr;
        Object.assign(canvas.style, {
          position: 'absolute',
          inset: '0',
          width: '100%',
          height: '100%',
          zIndex: String(index + 1),
          pointerEvents: 'none',
        });

        container.appendChild(canvas);
        canvases.push(canvas);

        const gl = canvas.getContext('webgl2', { antialias: true })
          || canvas.getContext('webgl', { antialias: true });
        if (gl) {
          const contextId = this.getContextId(systemName, index);
          gl.viewport(0, 0, canvas.width, canvas.height);
          this.contextRecords.set(canvas, { context: gl, contextId });
          this.resourceManager?.registerWebGLContext(contextId, gl);
        }
      });

      this.canvases.set(systemName, canvases);
    });
  }

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
    }

    const nextContainer = this.containerElements.get(systemName);
    if (nextContainer) {
      nextContainer.style.display = 'block';
    }

    this.activeSystem = systemName;
  }

  getCanvasResources(systemName, layerIndex = 0) {
    const canvases = this.canvases.get(systemName);
    if (!canvases || layerIndex >= canvases.length) {
      return null;
    }

    const canvas = canvases[layerIndex];
    const record = this.contextRecords.get(canvas);

    return {
      canvas,
      context: record?.context || null,
      contextId: record?.contextId || null,
      isValid: Boolean(record?.context && !record.context.isContextLost?.()),
    };
  }

  handleResize(width = window.innerWidth, height = window.innerHeight) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvases.forEach((systemCanvases) => {
      systemCanvases.forEach((canvas) => {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        const record = this.contextRecords.get(canvas);
        if (record?.context) {
          record.context.viewport(0, 0, canvas.width, canvas.height);
        }
      });
    });
  }

  attachResizeListener() {
    if (this.resizeHandler) {
      return;
    }

    let debounce = null;
    this.resizeHandler = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(() => this.handleResize(), 100);
    };

    window.addEventListener('resize', this.resizeHandler);
  }

  destroy() {
    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    this.contextRecords.forEach(({ contextId }) => {
      if (contextId) {
        this.resourceManager?.unregisterWebGLContext(contextId);
      }
    });

    this.canvases.clear();
    this.contextRecords.clear();
    this.containerElements.clear();
    this.activeSystem = null;
  }

  cleanup() {
    this.destroy();
  }

  getCanvasId(systemName, layerName) {
    return systemName === 'faceted'
      ? `${layerName}-canvas`
      : `${systemName}-${layerName}-canvas`;
  }

  getContextId(systemName, layerIndex) {
    return `${systemName}-layer-${layerIndex}`;
  }
}

export class CanvasManager extends CanvasResourcePool {}

export default CanvasResourcePool;
