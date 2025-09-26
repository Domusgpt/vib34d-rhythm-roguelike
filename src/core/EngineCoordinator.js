/**
 * EngineCoordinator orchestrates initialization, activation, and
 * parameter flow between visualization engines while sharing the
 * CanvasResourcePool created during startup. This implementation
 * follows the production-ready architecture described in
 * PROPER_ARCHITECTURE_SOLUTIONS.md, including shared resource
 * preparation, engine validation, and error recovery.
 */

const DEFAULT_ENGINE_CONFIGS = {
  faceted: {
    className: 'VIB34DIntegratedEngine',
    requiredLayers: ['background', 'content', 'highlight', 'shadow', 'accent'],
    initializationOrder: 1,
  },
  quantum: {
    className: 'QuantumEngine',
    requiredLayers: ['background', 'shadow', 'content', 'highlight', 'accent'],
    initializationOrder: 2,
  },
  holographic: {
    className: 'RealHolographicSystem',
    requiredLayers: ['background', 'shadow', 'content', 'highlight', 'accent'],
    initializationOrder: 3,
  },
  polychora: {
    className: 'PolychoraSystem',
    requiredLayers: ['background', 'shadow', 'content', 'highlight', 'accent'],
    initializationOrder: 4,
  },
};

export class EngineCoordinator {
  constructor(canvasPool, options = {}) {
    this.canvasPool = canvasPool;
    this.resourceManager = options.resourceManager || null;
    this.stateManager = options.stateManager || null;
    this.logger = options.logger || console;

    this.engines = new Map();
    this.engineClasses = new Map();
    this.engineConfigs = new Map();
    this.sharedResources = new Map();
    this.transitionState = 'idle';
    this.activeEngine = null;
    this.currentParameters = {};
    this.sharedResourcesInitialized = false;

    this.initializeEngineConfigs(options.engineConfigs);
  }

  initializeEngineConfigs(overrides = {}) {
    Object.entries(DEFAULT_ENGINE_CONFIGS).forEach(([systemName, config]) => {
      const override = overrides[systemName] || {};
      this.engineConfigs.set(systemName, {
        ...config,
        ...override,
      });
    });
  }

  registerEngine(systemName, EngineClass) {
    if (!EngineClass) {
      return;
    }

    this.engineClasses.set(systemName, EngineClass);
  }

  async initializeEngines(engineClassMap = {}) {
    Object.entries(engineClassMap).forEach(([systemName, EngineClass]) => {
      this.registerEngine(systemName, EngineClass);
    });

    await this.initializeSharedResources();

    const orderedConfigs = Array.from(this.engineConfigs.entries())
      .sort((a, b) => (a[1].initializationOrder || 0) - (b[1].initializationOrder || 0));

    for (const [systemName] of orderedConfigs) {
      if (!this.engineClasses.has(systemName)) {
        continue;
      }

      if (!this.engines.has(systemName)) {
        await this.initializeEngine(systemName);
      }
    }
  }

  async initializeSharedResources() {
    if (this.sharedResourcesInitialized) {
      return;
    }

    const glResource = this.canvasPool?.getCanvasResources('faceted', 0)
      || this.canvasPool?.getCanvasResources('quantum', 0)
      || this.canvasPool?.getCanvasResources('holographic', 0)
      || this.canvasPool?.getCanvasResources('polychora', 0);

    const gl = glResource?.context;
    if (!gl) {
      this.logger.warn('EngineCoordinator: Unable to initialize shared resources (no WebGL context available)');
      return;
    }

    const shaders = this.createSharedShaderPrograms(gl);
    const buffers = this.createSharedBuffers(gl);
    const textures = this.createSharedTextures(gl);

    this.sharedResources.set('shaders', shaders);
    this.sharedResources.set('buffers', buffers);
    this.sharedResources.set('textures', textures);

    this.sharedResourcesInitialized = true;
    this.logger.log('EngineCoordinator: Shared resources initialized');
  }

  async initializeEngine(systemName) {
    const EngineClass = this.engineClasses.get(systemName);
    const config = this.engineConfigs.get(systemName);

    if (!EngineClass) {
      this.logger.warn(`EngineCoordinator: No engine class registered for ${systemName}`);
      return null;
    }

    const canvasResources = this.getEngineCanvasResources(systemName, config);

    let engineInstance = null;
    try {
      engineInstance = new EngineClass({
        canvasResources,
        sharedResources: this.sharedResources,
        resourceManager: this.resourceManager,
        systemName,
        config,
      });

      if (typeof engineInstance.setCanvasResources === 'function') {
        engineInstance.setCanvasResources(canvasResources);
      }

      if (this.resourceManager && typeof engineInstance.setResourceManager === 'function') {
        engineInstance.setResourceManager(this.resourceManager);
      }

      if (this.sharedResourcesInitialized && typeof engineInstance.setSharedResources === 'function') {
        engineInstance.setSharedResources(this.sharedResources);
      }

      if (typeof engineInstance.initialize === 'function') {
        await engineInstance.initialize();
      }

      if (typeof engineInstance.setActive === 'function') {
        engineInstance.setActive(false);
      }
    } catch (error) {
      this.logger.error(`EngineCoordinator: Failed to initialize ${systemName} engine`, error);
      throw error;
    }

    this.validateEngineInterface(engineInstance, systemName);

    this.engines.set(systemName, engineInstance);
    return engineInstance;
  }

  getEngineCanvasResources(systemName, config) {
    if (!config) {
      return {};
    }

    const resources = {};

    (config.requiredLayers || []).forEach((layerName, index) => {
      const canvasResource = this.canvasPool.getCanvasResources(systemName, index);
      if (canvasResource && canvasResource.isValid) {
        resources[layerName] = canvasResource;
      } else {
        throw new Error(`Invalid canvas resource for ${systemName} layer ${layerName}`);
      }
    });

    return resources;
  }

  validateEngineInterface(engine, systemName) {
    if (!engine) {
      throw new Error(`EngineCoordinator: Engine instance for ${systemName} is undefined`);
    }

    const requiredMethods = ['render', 'setActive', 'handleResize'];
    requiredMethods.forEach((method) => {
      if (typeof engine[method] !== 'function') {
        throw new Error(`Engine ${systemName} missing required method: ${method}`);
      }
    });
  }

  getEngine(systemName) {
    return this.engines.get(systemName) || null;
  }

  getCurrentEngine() {
    return this.activeEngine ? this.getEngine(this.activeEngine) : null;
  }

  async switchEngine(targetSystem) {
    if (this.transitionState !== 'idle') {
      this.logger.warn('EngineCoordinator: Transition already in progress');
      return false;
    }

    if (this.activeEngine === targetSystem) {
      return true;
    }

    if (!this.engineClasses.has(targetSystem)) {
      this.logger.error(`EngineCoordinator: Unknown target system ${targetSystem}`);
      return false;
    }

    this.transitionState = 'transitioning';

    try {
      if (!this.engines.has(targetSystem)) {
        await this.initializeEngine(targetSystem);
      }

      if (this.activeEngine) {
        await this.deactivateEngine(this.activeEngine);
      }

      this.canvasPool.switchToSystem(targetSystem);

      const engine = this.getEngine(targetSystem);
      await this.activateEngine(engine, targetSystem);

      this.activeEngine = targetSystem;
      this.transitionState = 'idle';

      if (Object.keys(this.currentParameters).length > 0) {
        this.applyParameters(this.currentParameters, targetSystem);
      }

      return true;
    } catch (error) {
      this.logger.error(`EngineCoordinator: Failed to switch to ${targetSystem}`, error);
      this.transitionState = 'error';
      return false;
    }
  }

  async deactivateEngine(systemName) {
    const engine = this.getEngine(systemName);
    if (!engine) {
      return;
    }

    try {
      if (typeof engine.deactivate === 'function') {
        await engine.deactivate();
      }

      if (typeof engine.setActive === 'function') {
        engine.setActive(false);
      }

      if (typeof engine.saveState === 'function') {
        await engine.saveState();
      }
    } catch (error) {
      this.logger.warn(`EngineCoordinator: Error during ${systemName} deactivation`, error);
    }
  }

  async activateEngine(engine, systemName) {
    if (!engine) {
      return;
    }

    try {
      if (typeof engine.restoreState === 'function') {
        await engine.restoreState();
      }

      if (typeof engine.activate === 'function') {
        await engine.activate();
      }

      if (typeof engine.setActive === 'function') {
        engine.setActive(true);
      }

      if (typeof engine.handleResize === 'function') {
        engine.handleResize(window.innerWidth, window.innerHeight);
      }
    } catch (error) {
      this.logger.error(`EngineCoordinator: Activation failed for ${systemName}`, error);
      throw error;
    }
  }

  applyParameters(parameters, targetSystem = null) {
    this.currentParameters = { ...parameters };

    const systemName = targetSystem || this.activeEngine;
    if (!systemName) {
      return;
    }

    const engine = this.getEngine(systemName);
    if (!engine) {
      return;
    }

    if (typeof engine.setParameters === 'function') {
      engine.setParameters(parameters);
      return;
    }

    if (engine.parameterManager && typeof engine.parameterManager.setParameters === 'function') {
      engine.parameterManager.setParameters(parameters);
    }

    if (typeof engine.updateParameters === 'function') {
      engine.updateParameters(parameters);
    }

    if (typeof engine.updateParameter === 'function') {
      Object.entries(parameters).forEach(([key, value]) => {
        engine.updateParameter(key, value);
      });
    }
  }

  handleResize(width, height) {
    const engine = this.getCurrentEngine();
    if (engine && typeof engine.handleResize === 'function') {
      engine.handleResize(width, height);
    }
  }

  render(timestamp, gameState) {
    if (this.transitionState !== 'idle' || !this.activeEngine) {
      return;
    }

    const engine = this.getEngine(this.activeEngine);
    if (!engine || typeof engine.render !== 'function') {
      return;
    }

    try {
      engine.render(timestamp, gameState);
    } catch (error) {
      this.logger.error('EngineCoordinator: Render error', error);
      this.handleRenderingError(this.activeEngine, error);
    }
  }

  handleRenderingError(systemName, error) {
    this.logger.error(`EngineCoordinator: Engine ${systemName} render error`, {
      message: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    });

    const canvasResource = this.canvasPool.getCanvasResources(systemName, 0);
    if (canvasResource?.context && typeof canvasResource.context.isContextLost === 'function') {
      if (canvasResource.context.isContextLost()) {
        this.logger.warn(`EngineCoordinator: WebGL context lost for ${systemName}`);
        return;
      }
    }

    const engine = this.engines.get(systemName);
    if (engine && typeof engine.setActive === 'function') {
      engine.setActive(false);
    }
  }

  destroy() {
    this.engines.forEach((engine, systemName) => {
      if (typeof engine.setActive === 'function') {
        engine.setActive(false);
      }
      if (typeof engine.destroy === 'function') {
        engine.destroy();
      }
    });

    this.destroySharedResources();

    this.engines.clear();
    this.engineClasses.clear();
    this.sharedResources.clear();
    this.activeEngine = null;
    this.transitionState = 'idle';
  }

  destroySharedResources() {
    if (!this.sharedResourcesInitialized) {
      return;
    }

    const glResource = this.canvasPool?.getCanvasResources('faceted', 0)
      || this.canvasPool?.getCanvasResources('quantum', 0)
      || this.canvasPool?.getCanvasResources('holographic', 0)
      || this.canvasPool?.getCanvasResources('polychora', 0);

    const gl = glResource?.context;

    const shaders = this.sharedResources.get('shaders') || {};
    Object.values(shaders).forEach((shaderInfo) => {
      if (!shaderInfo) {
        return;
      }

      if (this.resourceManager && shaderInfo.resourceId) {
        this.resourceManager.releaseResource(shaderInfo.resourceId, 'engine-coordinator');
      } else if (gl && shaderInfo.program) {
        gl.deleteProgram(shaderInfo.program);
      }
    });

    const buffers = this.sharedResources.get('buffers') || {};
    Object.values(buffers).forEach((bufferInfo) => {
      if (!bufferInfo) {
        return;
      }

      if (this.resourceManager && bufferInfo.resourceId) {
        this.resourceManager.releaseResource(bufferInfo.resourceId, 'engine-coordinator');
      } else if (gl && bufferInfo.buffer) {
        gl.deleteBuffer(bufferInfo.buffer);
      }
    });

    const textures = this.sharedResources.get('textures') || {};
    Object.values(textures).forEach((textureInfo) => {
      if (!textureInfo) {
        return;
      }

      if (this.resourceManager && textureInfo.resourceId) {
        this.resourceManager.releaseResource(textureInfo.resourceId, 'engine-coordinator');
      } else if (gl && textureInfo.texture) {
        gl.deleteTexture(textureInfo.texture);
      }
    });

    this.sharedResourcesInitialized = false;
  }

  createSharedShaderPrograms(gl) {
    const shaders = {};

    try {
      if (this.resourceManager) {
        const commonProgram = this.resourceManager.createShaderProgram(
          gl,
          this.getCommonVertexShader(),
          this.getCommonFragmentShader(),
        );
        this.resourceManager.useResource(commonProgram.resourceId, 'engine-coordinator');
        shaders.common = {
          program: commonProgram.program,
          resourceId: commonProgram.resourceId,
        };

        const utilityProgram = this.resourceManager.createShaderProgram(
          gl,
          this.getUtilityVertexShader(),
          this.getUtilityFragmentShader(),
        );
        this.resourceManager.useResource(utilityProgram.resourceId, 'engine-coordinator');
        shaders.utility = {
          program: utilityProgram.program,
          resourceId: utilityProgram.resourceId,
        };
      } else {
        shaders.common = {
          program: this.createShaderProgram(gl, this.getCommonVertexShader(), this.getCommonFragmentShader()),
        };
        shaders.utility = {
          program: this.createShaderProgram(gl, this.getUtilityVertexShader(), this.getUtilityFragmentShader()),
        };
      }
    } catch (error) {
      this.logger.error('EngineCoordinator: Failed to create shared shaders', error);
    }

    return shaders;
  }

  createSharedBuffers(gl) {
    const buffers = {};

    try {
      const screenQuadData = this.getScreenQuadGeometry();
      const unitCubeData = this.getUnitCubeGeometry();
      const sphereData = this.getSphereGeometry();

      if (this.resourceManager) {
        const quadBuffer = this.resourceManager.createBuffer(gl, screenQuadData, gl.STATIC_DRAW, gl.ARRAY_BUFFER);
        this.resourceManager.useResource(quadBuffer.resourceId, 'engine-coordinator');
        buffers.screenQuad = {
          buffer: quadBuffer.buffer,
          resourceId: quadBuffer.resourceId,
          vertexCount: 4,
          stride: 16,
        };

        const cubeBuffer = this.resourceManager.createBuffer(gl, unitCubeData, gl.STATIC_DRAW, gl.ARRAY_BUFFER);
        this.resourceManager.useResource(cubeBuffer.resourceId, 'engine-coordinator');
        buffers.unitCube = {
          buffer: cubeBuffer.buffer,
          resourceId: cubeBuffer.resourceId,
          vertexCount: unitCubeData.length / 8,
          stride: 32,
        };

        const sphereBuffer = this.resourceManager.createBuffer(gl, sphereData, gl.STATIC_DRAW, gl.ARRAY_BUFFER);
        this.resourceManager.useResource(sphereBuffer.resourceId, 'engine-coordinator');
        buffers.sphere = {
          buffer: sphereBuffer.buffer,
          resourceId: sphereBuffer.resourceId,
          vertexCount: sphereData.length / 8,
          stride: 32,
        };
      } else {
        buffers.screenQuad = this.createBuffer(gl, screenQuadData, 4, 16);
        buffers.unitCube = this.createBuffer(gl, unitCubeData, unitCubeData.length / 8, 32);
        buffers.sphere = this.createBuffer(gl, sphereData, sphereData.length / 8, 32);
      }
    } catch (error) {
      this.logger.error('EngineCoordinator: Failed to create shared buffers', error);
    }

    return buffers;
  }

  createSharedTextures(gl) {
    const textures = {};

    try {
      if (this.resourceManager) {
        const whiteTextureInfo = this.resourceManager.createTexture(gl, { width: 1, height: 1, format: gl.RGBA });
        this.resourceManager.useResource(whiteTextureInfo.resourceId, 'engine-coordinator');
        gl.bindTexture(gl.TEXTURE_2D, whiteTextureInfo.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        textures.whitePixel = {
          texture: whiteTextureInfo.texture,
          resourceId: whiteTextureInfo.resourceId,
        };

        const gradientData = this.createGradientLUTData();
        const gradientTextureInfo = this.resourceManager.createTexture(gl, { width: gradientData.width, height: 1, format: gl.RGBA });
        this.resourceManager.useResource(gradientTextureInfo.resourceId, 'engine-coordinator');
        gl.bindTexture(gl.TEXTURE_2D, gradientTextureInfo.texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gradientData.width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, gradientData.data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        textures.gradientLUT = {
          texture: gradientTextureInfo.texture,
          resourceId: gradientTextureInfo.resourceId,
        };

        const noiseTextureInfo = this.createNoiseTexture(gl);
        if (noiseTextureInfo) {
          if (noiseTextureInfo.resourceId) {
            this.resourceManager.useResource(noiseTextureInfo.resourceId, 'engine-coordinator');
          }
          textures.noise = noiseTextureInfo;
        }
      } else {
        textures.whitePixel = { texture: this.createWhitePixelTexture(gl) };
        textures.gradientLUT = { texture: this.createGradientLUTTexture(gl) };
        const noiseTexture = this.createNoiseTexture(gl);
        if (noiseTexture) {
          textures.noise = noiseTexture;
        }
      }
    } catch (error) {
      this.logger.error('EngineCoordinator: Failed to create shared textures', error);
    }

    return textures;
  }

  createNoiseTexture(gl) {
    const isWebGL2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    const size = 64;

    const data = new Uint8Array(size * size * (isWebGL2 ? size : 4));
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.floor(Math.random() * 256);
    }

    if (this.resourceManager && isWebGL2) {
      const textureInfo = this.resourceManager.createTexture(gl, {
        width: size,
        height: size,
        depth: size,
        format: gl.R8,
        type: gl.UNSIGNED_BYTE,
        mipLevels: 1,
        target: gl.TEXTURE_3D,
      });

      gl.bindTexture(gl.TEXTURE_3D, textureInfo.texture);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, size, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, data);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);

      return {
        texture: textureInfo.texture,
        resourceId: textureInfo.resourceId,
      };
    }

    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, data.subarray(0, size * size * 4));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    return { texture };
  }

  createBuffer(gl, data, vertexCount, stride) {
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    return { buffer, vertexCount, stride };
  }

  getScreenQuadGeometry() {
    return new Float32Array([
      -1, -1, 0, 0,
      1, -1, 1, 0,
      -1, 1, 0, 1,
      1, 1, 1, 1,
    ]);
  }

  getUnitCubeGeometry() {
    return new Float32Array([
      // Front face
      -1, -1, 1, 0, 0, 1, 0, 0,
      1, -1, 1, 0, 0, 1, 1, 0,
      1, 1, 1, 0, 0, 1, 1, 1,
      -1, 1, 1, 0, 0, 1, 0, 1,
      // Back face
      -1, -1, -1, 0, 0, -1, 0, 0,
      -1, 1, -1, 0, 0, -1, 0, 1,
      1, 1, -1, 0, 0, -1, 1, 1,
      1, -1, -1, 0, 0, -1, 1, 0,
    ]);
  }

  getSphereGeometry() {
    const segments = 16;
    const rings = 16;
    const vertices = [];

    for (let ring = 0; ring <= rings; ring += 1) {
      for (let segment = 0; segment <= segments; segment += 1) {
        const phi = Math.PI * ring / rings;
        const theta = 2 * Math.PI * segment / segments;

        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);

        vertices.push(x, y, z, x, y, z, segment / segments, ring / rings);
      }
    }

    return new Float32Array(vertices);
  }

  createWhitePixelTexture(gl) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    return texture;
  }

  createGradientLUTData() {
    const width = 256;
    const data = new Uint8Array(width * 4);

    for (let i = 0; i < width; i += 1) {
      const t = i / (width - 1);
      const hue = t * 360;
      const [r, g, b] = this.hslToRgb(hue, 100, 50);

      data[i * 4 + 0] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }

    return { width, data };
  }

  createGradientLUTTexture(gl) {
    const gradientData = this.createGradientLUTData();
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gradientData.width, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, gradientData.data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);

    return texture;
  }

  hslToRgb(h, s, l) {
    const hue = (h % 360) / 360;
    const saturation = s / 100;
    const lightness = l / 100;

    const a = saturation * Math.min(lightness, 1 - lightness);
    const f = (n, k = (n + hue * 12) % 12) => lightness - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);

    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  getCommonVertexShader() {
    return `
      attribute vec3 a_position;
      attribute vec3 a_normal;
      attribute vec2 a_texcoord;

      uniform mat4 u_mvpMatrix;
      uniform mat4 u_modelMatrix;
      uniform mat4 u_normalMatrix;

      varying vec3 v_position;
      varying vec3 v_normal;
      varying vec2 v_texcoord;

      void main() {
        vec4 worldPosition = u_modelMatrix * vec4(a_position, 1.0);
        v_position = worldPosition.xyz;
        v_normal = normalize((u_normalMatrix * vec4(a_normal, 0.0)).xyz);
        v_texcoord = a_texcoord;

        gl_Position = u_mvpMatrix * vec4(a_position, 1.0);
      }
    `;
  }

  getCommonFragmentShader() {
    return `
      precision highp float;

      varying vec3 v_position;
      varying vec3 v_normal;
      varying vec2 v_texcoord;

      uniform vec3 u_lightDirection;
      uniform vec3 u_lightColor;
      uniform vec3 u_ambientColor;
      uniform float u_time;

      void main() {
        vec3 normal = normalize(v_normal);
        float ndotl = max(dot(normal, u_lightDirection), 0.0);

        vec3 color = u_ambientColor + u_lightColor * ndotl;
        gl_FragColor = vec4(color, 1.0);
      }
    `;
  }

  getUtilityVertexShader() {
    return `
      attribute vec2 a_position;
      attribute vec2 a_texcoord;

      varying vec2 v_texcoord;

      void main() {
        v_texcoord = a_texcoord;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
  }

  getUtilityFragmentShader() {
    return `
      precision mediump float;
      varying vec2 v_texcoord;
      uniform sampler2D u_texture;

      void main() {
        gl_FragColor = texture2D(u_texture, v_texcoord);
      }
    `;
  }

  createShaderProgram(gl, vertexSource, fragmentSource) {
    const vertexShader = this.createShader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragmentShader = this.createShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const error = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      throw new Error(`Shader program linking failed: ${error}`);
    }

    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  }

  createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const error = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(`Shader compilation failed: ${error}`);
    }

    return shader;
  }
}
