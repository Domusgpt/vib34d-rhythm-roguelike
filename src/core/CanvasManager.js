/**
 * CanvasResourcePool
 * Modernized canvas management that pre-allocates and reuses canvases
 * across visualization systems. Prevents expensive DOM churn and WebGL
 * context loss described in the comprehensive architecture analysis.
 */

const SYSTEM_NAMES = ['faceted', 'quantum', 'holographic', 'polychora'];
const LAYER_NAMES = ['background', 'shadow', 'content', 'highlight', 'accent'];

export class CanvasResourcePool {
  constructor(options = {}) {
    this.canvases = new Map(); // system -> [canvas]
    this.contexts = new Map(); // canvas -> WebGL context
    this.containerElements = new Map(); // system -> container element
    this.activeSystem = null;

    this.maxLayersPerSystem = options.maxLayersPerSystem || LAYER_NAMES.length;
    this.contextAttributes = {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
      ...options.contextAttributes,
    };

    this.resizeListener = null;
  }

  /**
   * Initialize containers, canvases, and resize listeners.
   */
  initialize() {
    this.createContainerElements();
    this.preAllocateCanvases();
    this.setupResizeHandler();
  }

  /**
   * Ensure container elements exist for each visualization system.
   */
  createContainerElements() {
    const root = document.getElementById('game-container') || document.body;

    SYSTEM_NAMES.forEach((systemName) => {
      const containerId = systemName === 'faceted' ? 'vib34dLayers' : `${systemName}Layers`;
      let container = document.getElementById(containerId);

      if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'visualization-container';
        Object.assign(container.style, {
          position: 'absolute',
          top: '0',
          left: '0',
          width: '100%',
          height: '100%',
          display: 'none',
          pointerEvents: 'none',
        });
        root.appendChild(container);
      }

      this.containerElements.set(systemName, container);
    });
  }

  /**
   * Pre-create canvases and WebGL contexts for every system/layer combo.
   */
  preAllocateCanvases() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const viewWidth = window.innerWidth;
    const viewHeight = window.innerHeight;

    SYSTEM_NAMES.forEach((systemName) => {
      const container = this.containerElements.get(systemName);
      if (!container) {
        console.warn(`CanvasResourcePool: Missing container for ${systemName}`);
        return;
      }

      const canvases = [];

      for (let layerIndex = 0; layerIndex < this.maxLayersPerSystem; layerIndex += 1) {
        const canvas = this.createCanvas(systemName, layerIndex, viewWidth, viewHeight, dpr);
        container.appendChild(canvas);
        canvases.push(canvas);

        this.initializeContext(canvas, systemName, layerIndex);
      }

      this.canvases.set(systemName, canvases);
    });
  }

  createCanvas(systemName, layerIndex, viewWidth, viewHeight, dpr) {
    const canvas = document.createElement('canvas');
    const baseName = LAYER_NAMES[layerIndex] || `layer-${layerIndex}`;
    const prefix = systemName === 'faceted' ? '' : `${systemName}-`;
    const canvasId = `${prefix}${baseName}-canvas`;

    canvas.id = canvasId;
    canvas.className = 'visualization-layer';

    canvas.width = viewWidth * dpr;
    canvas.height = viewHeight * dpr;
    Object.assign(canvas.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      zIndex: layerIndex + 1,
      pointerEvents: 'none',
    });

    return canvas;
  }

  initializeContext(canvas, systemName, layerIndex) {
    try {
      const gl = canvas.getContext('webgl2', this.contextAttributes)
        || canvas.getContext('webgl', this.contextAttributes);

      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        this.contexts.set(canvas, gl);
      } else {
        console.warn(`CanvasResourcePool: Unable to create WebGL context for ${systemName} layer ${layerIndex}`);
      }
    } catch (error) {
      console.error(`CanvasResourcePool: WebGL initialization failed for ${systemName} layer ${layerIndex}`, error);
    }
  }

  /**
   * Swap visibility between systems without destroying WebGL contexts.
   */
  switchToSystem(systemName) {
    if (!SYSTEM_NAMES.includes(systemName)) {
      console.warn(`CanvasResourcePool: Unknown system ${systemName}`);
      return;
    }

    if (this.activeSystem === systemName) {
      return;
    }

    if (this.activeSystem) {
      const currentContainer = this.containerElements.get(this.activeSystem);
      if (currentContainer) {
        currentContainer.style.display = 'none';
      }

      const currentCanvases = this.canvases.get(this.activeSystem) || [];
      currentCanvases.forEach((canvas) => {
        const gl = this.contexts.get(canvas);
        if (gl && !gl.isContextLost()) {
          gl.finish();
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
      const gl = this.contexts.get(canvas);
      if (gl && gl.isContextLost()) {
        this.recoverContext(canvas, systemName);
      }
    });

    this.activeSystem = systemName;
  }

  recoverContext(canvas, systemName) {
    try {
      const gl = canvas.getContext('webgl2', this.contextAttributes)
        || canvas.getContext('webgl', this.contextAttributes);

      if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0);
        this.contexts.set(canvas, gl);
        console.log(`CanvasResourcePool: Recovered WebGL context for ${systemName}`);
      }
    } catch (error) {
      console.error(`CanvasResourcePool: Failed to recover context for ${systemName}`, error);
    }
  }

  getCanvasResources(systemName, layerIndex = 0) {
    const canvases = this.canvases.get(systemName);
    if (!canvases || layerIndex >= canvases.length) {
      console.error(`CanvasResourcePool: Invalid canvas request ${systemName}[${layerIndex}]`);
      return null;
    }

    const canvas = canvases[layerIndex];
    const context = this.contexts.get(canvas);
    return {
      canvas,
      context,
      isValid: Boolean(context && !context.isContextLost()),
    };
  }

  getCanvasSet(systemName) {
    return this.canvases.get(systemName) || [];
  }

  setupResizeHandler() {
    if (this.resizeListener) {
      return;
    }

    let resizeTimeout = null;
    this.resizeListener = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => this.handleResize(), 100);
    };

    window.addEventListener('resize', this.resizeListener);
  }

  handleResize(width = window.innerWidth, height = window.innerHeight) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvases.forEach((systemCanvases) => {
      systemCanvases.forEach((canvas) => {
        canvas.width = width * dpr;
        canvas.height = height * dpr;

        const gl = this.contexts.get(canvas);
        if (gl && !gl.isContextLost()) {
          gl.viewport(0, 0, canvas.width, canvas.height);
        }
      });
    });
  }

  cleanup() {
    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
      this.resizeListener = null;
    }

    this.contexts.forEach((gl) => {
      if (gl && !gl.isContextLost()) {
        const loseContext = gl.getExtension('WEBGL_lose_context');
        if (loseContext) {
          loseContext.loseContext();
        }
      }
    });

    this.contexts.clear();
    this.canvases.clear();
    this.containerElements.clear();
    this.activeSystem = null;
  }
}

// Backwards compatibility for existing imports
export class CanvasManager extends CanvasResourcePool {}
