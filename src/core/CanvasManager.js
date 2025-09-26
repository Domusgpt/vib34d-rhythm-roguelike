/**
 * CanvasResourcePool
 * ------------------------------------------------------------
 * Provides a small, production-friendly wrapper around the DOM canvas
 * elements used by the visualizer subsystems.  The pool keeps a stable
 * set of layered canvases for each system, exposes helpers for acquiring
 * WebGL contexts, and hides the show/hide + resize bookkeeping that used
 * to be scattered across the engines.
 *
 * The implementation is intentionally lightweight – it follows the
 * guidance from PROPER_ARCHITECTURE_SOLUTIONS.md without introducing
 * heavyweight abstractions so the existing engines (which expect
 * specific canvas ids) can keep working.
 */

const DEFAULT_SYSTEM_CONFIG = {
  faceted: {
    containerId: 'vib34dLayers',
    layerIds: [
      'background-canvas',
      'shadow-canvas',
      'content-canvas',
      'highlight-canvas',
      'accent-canvas',
    ],
  },
  quantum: {
    containerId: 'quantumLayers',
    layerIds: [
      'quantum-background-canvas',
      'quantum-shadow-canvas',
      'quantum-content-canvas',
      'quantum-highlight-canvas',
      'quantum-accent-canvas',
    ],
  },
  holographic: {
    containerId: 'holographicLayers',
    layerIds: [
      'holo-background-canvas',
      'holo-shadow-canvas',
      'holo-content-canvas',
      'holo-highlight-canvas',
      'holo-accent-canvas',
    ],
  },
  polychora: {
    containerId: 'polychoraLayers',
    layerIds: [
      'polychora-background-canvas',
      'polychora-shadow-canvas',
      'polychora-content-canvas',
      'polychora-highlight-canvas',
      'polychora-accent-canvas',
    ],
  },
};

const CANVAS_CLASS = 'visualization-layer';
const CONTAINER_CLASS = 'visualization-container';

function ensureElement(id, className, mountNode) {
  let element = document.getElementById(id);
  if (!element) {
    element = document.createElement('div');
    element.id = id;
    element.className = className;
    element.style.position = 'absolute';
    element.style.top = '0';
    element.style.left = '0';
    element.style.width = '100%';
    element.style.height = '100%';
    element.style.pointerEvents = 'none';
    element.style.display = 'none';
    element.style.zIndex = '0';
    mountNode.appendChild(element);
  }
  return element;
}

function configureCanvas(canvas, order) {
  canvas.classList.add(CANVAS_CLASS);
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = String(order + 1);
}

export class CanvasResourcePool {
  constructor({ systems = DEFAULT_SYSTEM_CONFIG, resourceManager } = {}) {
    this.systemConfig = systems;
    this.resourceManager = resourceManager;
    this.systemCanvases = new Map();
    this.activeSystem = null;
    this.resizeHandler = () => this.handleResize();
    this.initialised = false;
  }

  initialize({ mountNode } = {}) {
    if (this.initialised) {
      return;
    }

    const targetMount = mountNode || document.body;
    Object.entries(this.systemConfig).forEach(([systemName, config]) => {
      const container = ensureElement(config.containerId, CONTAINER_CLASS, targetMount);
      const canvases = config.layerIds.map((layerId, index) => {
        let canvas = document.getElementById(layerId);
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.id = layerId;
          container.appendChild(canvas);
        } else if (canvas.parentElement !== container) {
          container.appendChild(canvas);
        }
        configureCanvas(canvas, index);
        return canvas;
      });

      this.systemCanvases.set(systemName, { container, canvases });
    });

    this.handleResize();
    window.addEventListener('resize', this.resizeHandler);
    this.initialised = true;
  }

  handleResize() {
    if (!this.initialised) {
      return;
    }

    const viewWidth = window.innerWidth || 0;
    const viewHeight = window.innerHeight || 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.systemCanvases.forEach(({ canvases }, systemName) => {
      canvases.forEach((canvas) => {
        canvas.width = Math.max(1, Math.floor(viewWidth * dpr));
        canvas.height = Math.max(1, Math.floor(viewHeight * dpr));

        const gl = this.resourceManager?.getContextForCanvas?.(canvas.id);
        if (gl && !gl.isContextLost()) {
          gl.viewport(0, 0, canvas.width, canvas.height);
        }
      });
    });
  }

  ensureContext(canvas, systemName) {
    if (!canvas) {
      return null;
    }

    let context = this.resourceManager?.getContextForCanvas?.(canvas.id);
    if (context && !context.isContextLost()) {
      return context;
    }

    const contextAttributes = {
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: false,
    };

    context = canvas.getContext('webgl2', contextAttributes) ||
      canvas.getContext('webgl', contextAttributes);

    if (context) {
      context.viewport(0, 0, canvas.width, canvas.height);
      this.resourceManager?.registerContext(systemName, canvas.id, context);
    }

    return context;
  }

  switchToSystem(systemName) {
    if (!this.systemCanvases.has(systemName)) {
      console.warn(`CanvasResourcePool: unknown system "${systemName}"`);
      return;
    }

    if (this.activeSystem === systemName) {
      return;
    }

    if (this.activeSystem && this.systemCanvases.has(this.activeSystem)) {
      const current = this.systemCanvases.get(this.activeSystem);
      current.container.style.display = 'none';
    }

    const target = this.systemCanvases.get(systemName);
    target.container.style.display = 'block';
    this.activeSystem = systemName;
  }

  getLayer(systemName, layerIndex) {
    const entry = this.systemCanvases.get(systemName);
    if (!entry) {
      return null;
    }

    const canvas = entry.canvases[layerIndex];
    if (!canvas) {
      return null;
    }

    const context = this.ensureContext(canvas, systemName);
    return { canvas, context };
  }

  getSystemResources(systemName) {
    const entry = this.systemCanvases.get(systemName);
    if (!entry) {
      return [];
    }

    return entry.canvases.map((canvas, index) => ({
      id: canvas.id,
      layerIndex: index,
      canvas,
      context: this.ensureContext(canvas, systemName),
    }));
  }

  getCanvasIds(systemName) {
    const entry = this.systemCanvases.get(systemName);
    return entry ? entry.canvases.map((canvas) => canvas.id) : [];
  }

  destroy() {
    if (!this.initialised) {
      return;
    }

    window.removeEventListener('resize', this.resizeHandler);
    this.systemCanvases.clear();
    this.activeSystem = null;
    this.initialised = false;
  }
}

export class CanvasManager extends CanvasResourcePool {}

export default CanvasResourcePool;
