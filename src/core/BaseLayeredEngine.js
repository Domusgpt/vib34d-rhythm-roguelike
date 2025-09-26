/**
 * BaseLayeredEngine
 * ------------------------------------------------------------
 * Shared implementation for the refactored visualization engines.
 * Each engine consumes pooled canvases, clones the required shared GPU
 * assets through the ResourceManager, and renders layered shader-driven
 * visuals that react to audio and gameplay events. The design follows
 * the production architecture captured in COMPREHENSIVE_ARCHITECTURE_ANALYSIS.md
 * and PROPER_ARCHITECTURE_SOLUTIONS.md by centralising lifecycle
 * management, enforcing deterministic initialisation, and ensuring all
 * GPU allocations flow through the ResourceManager.
 */

const DEFAULT_VERTEX_SHADER = `
  attribute vec2 a_position;
  attribute vec2 a_uv;

  varying vec2 v_uv;

  void main() {
    v_uv = a_uv;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const DEFAULT_FRAGMENT_SHADER = `
  precision highp float;

  varying vec2 v_uv;

  uniform sampler2D u_gradient;
  uniform vec3 u_colorA;
  uniform vec3 u_colorB;
  uniform float u_time;
  uniform float u_intensity;
  uniform float u_energy;
  uniform float u_detail;
  uniform float u_morph;
  uniform float u_chaos;
  uniform float u_combo;
  uniform float u_highlight;
  uniform float u_mix;

  void main() {
    vec2 uv = v_uv;
    float wave = sin(u_time * (0.7 + u_detail * 0.6) + uv.y * (6.28318 + u_chaos * 9.0)) * 0.5 + 0.5;
    vec3 gradientColour = texture2D(u_gradient, vec2(fract(uv.x + u_combo * 0.1), fract(u_time * 0.08 + u_energy * 0.2))).rgb;
    vec3 mixed = mix(u_colorA, u_colorB, wave);
    mixed = mix(mixed, gradientColour, clamp(u_mix, 0.0, 1.0));
    mixed += u_highlight * 0.25;
    float alpha = clamp(u_intensity + u_energy * 0.4 + u_highlight * 0.3, 0.0, 1.0);
    gl_FragColor = vec4(mixed * (0.25 + u_intensity * 0.75), alpha);
  }
`;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function hslToRgb(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const saturation = clamp(s, 0, 1);
  const lightness = clamp(l, 0, 1);

  if (saturation === 0) {
    return [lightness, lightness, lightness];
  }

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;

  const hueToRgb = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const r = hueToRgb((hue / 360) + 1 / 3);
  const g = hueToRgb(hue / 360);
  const b = hueToRgb((hue / 360) - 1 / 3);
  return [r, g, b];
}

export class BaseLayeredEngine {
  constructor({
    canvasResources = {},
    sharedResources = new Map(),
    resourceManager = null,
    systemName = 'engine',
    config = {},
    palette = {},
  } = {}) {
    this.canvasResources = canvasResources;
    this.sharedResources = sharedResources || new Map();
    this.resourceManager = resourceManager;
    this.systemName = systemName;
    this.config = config;
    this.palette = palette;

    this.layerOrder = Array.isArray(config?.requiredLayers)
      ? [...config.requiredLayers]
      : Object.keys(canvasResources);

    this.layerPipelines = new Map();
    this.parameters = { ...this.getDefaultParameters() };
    this.parameterBounds = this.getParameterBounds();

    this.audioState = {
      energy: 0,
      bass: 0,
      mid: 0,
      high: 0,
    };

    this.effectState = {
      beat: 0,
      damage: 0,
      highlight: 0,
      chaos: 0,
      combo: 0,
    };

    this.effectDecay = {
      beat: 1.8,
      damage: 1.2,
      highlight: 1.6,
      chaos: 0.9,
      combo: 0.65,
    };

    this.isActive = false;
    this.lastTimestamp = 0;

    this.sharedBlueprints = {
      buffers: new Map(),
      textures: new Map(),
      shaders: new Map(),
    };
  }

  attachSharedResources(sharedResources, requirements = {}) {
    this.sharedResources = sharedResources || new Map();

    Object.entries(requirements || {}).forEach(([type, keys]) => {
      if (!Array.isArray(keys)) {
        return;
      }

      keys.forEach((key) => {
        const store = this.sharedBlueprints[type];
        const shared = this.sharedResources.get(type)?.get(key);
        if (!store || !shared) {
          return;
        }
        store.set(key, shared);
      });
    });
  }

  getDefaultParameters() {
    return {
      geometry: 0,
      gridDensity: 15,
      morphFactor: 1,
      chaos: 0.2,
      speed: 1,
      hue: 200,
      intensity: 0.5,
      saturation: 0.8,
      dimension: 3.5,
      rot4dXW: 0,
      rot4dYW: 0,
      rot4dZW: 0,
    };
  }

  getParameterBounds() {
    return {
      geometry: { min: 0, max: 7 },
      gridDensity: { min: 4, max: 100 },
      morphFactor: { min: 0, max: 2 },
      chaos: { min: 0, max: 1 },
      speed: { min: 0.05, max: 3 },
      hue: { min: 0, max: 360 },
      intensity: { min: 0, max: 1 },
      saturation: { min: 0, max: 1 },
      dimension: { min: 3, max: 4.5 },
      rot4dXW: { min: -2, max: 2 },
      rot4dYW: { min: -2, max: 2 },
      rot4dZW: { min: -2, max: 2 },
    };
  }

  async initialize() {
    this.layerOrder.forEach((layerName) => {
      const resource = this.canvasResources[layerName];
      if (!resource) {
        return;
      }

      const pipeline = this.createLayerPipeline(layerName, resource);
      if (pipeline) {
        this.layerPipelines.set(layerName, pipeline);
      }
    });

    this.onParametersUpdated();
  }

  createLayerPipeline(layerName, resource) {
    const { canvas, context, contextId } = resource || {};
    const gl = context
      || canvas?.getContext?.('webgl2')
      || canvas?.getContext?.('webgl');

    if (!gl) {
      console.warn(`${this.systemName}: missing WebGL context for layer ${layerName}`);
      return null;
    }

    if (contextId && this.resourceManager) {
      const contexts = this.resourceManager.contexts;
      const hasContext = typeof contexts?.has === 'function' ? contexts.has(contextId) : false;
      if (!hasContext) {
        try {
          this.resourceManager.registerWebGLContext?.(contextId, gl, { label: `${this.systemName}:${layerName}` });
        } catch (error) {
          console.warn(`${this.systemName}: unable to register context ${contextId}`, error);
        }
      }
    }

    const vertexSource = this.getVertexShaderSource(layerName);
    const fragmentSource = this.getFragmentShaderSource(layerName);

    const programRecord = this.resourceManager
      ? this.resourceManager.createProgram(contextId, vertexSource, fragmentSource)
      : null;
    const programHandle = programRecord?.program || programRecord?.handle;

    if (!programHandle) {
      console.warn(`${this.systemName}: failed to create shader program for ${layerName}`);
      return null;
    }

    const bufferData = this.resolveBufferData('screen_quad');
    const bufferRecord = bufferData && this.resourceManager
      ? this.resourceManager.createBuffer(contextId, bufferData)
      : null;

    if (!bufferRecord?.buffer) {
      console.warn(`${this.systemName}: unable to create screen quad buffer for ${layerName}`);
      return null;
    }

    const gradientDescriptor = this.resolveGradientDescriptor('gradient_lut');
    const gradientRecord = gradientDescriptor && this.resourceManager
      ? this.resourceManager.createTexture(contextId, gradientDescriptor)
      : null;

    const positionLocation = gl.getAttribLocation(programHandle, 'a_position');
    const uvLocation = gl.getAttribLocation(programHandle, 'a_uv');

    const uniforms = {
      gradient: gl.getUniformLocation(programHandle, 'u_gradient'),
      colorA: gl.getUniformLocation(programHandle, 'u_colorA'),
      colorB: gl.getUniformLocation(programHandle, 'u_colorB'),
      time: gl.getUniformLocation(programHandle, 'u_time'),
      intensity: gl.getUniformLocation(programHandle, 'u_intensity'),
      energy: gl.getUniformLocation(programHandle, 'u_energy'),
      detail: gl.getUniformLocation(programHandle, 'u_detail'),
      morph: gl.getUniformLocation(programHandle, 'u_morph'),
      chaos: gl.getUniformLocation(programHandle, 'u_chaos'),
      combo: gl.getUniformLocation(programHandle, 'u_combo'),
      highlight: gl.getUniformLocation(programHandle, 'u_highlight'),
      mix: gl.getUniformLocation(programHandle, 'u_mix'),
    };

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    return {
      name: layerName,
      canvas,
      contextId,
      gl,
      program: programHandle,
      programRecord,
      buffer: bufferRecord,
      gradient: gradientRecord,
      attributes: {
        position: positionLocation,
        uv: uvLocation,
      },
      uniforms,
      resources: [programRecord?.id, bufferRecord?.id, gradientRecord?.id].filter(Boolean),
      palette: this.getLayerPalette(layerName),
    };
  }

  resolveBufferData(name) {
    const shared = this.sharedBlueprints.buffers.get(name);
    if (shared?.metadata?.data) {
      return shared.metadata.data.slice();
    }

    if (name === 'screen_quad') {
      return new Float32Array([
        -1, -1, 0, 0,
        1, -1, 1, 0,
        -1, 1, 0, 1,
        1, 1, 1, 1,
      ]);
    }

    return null;
  }

  resolveGradientDescriptor(name) {
    const shared = this.sharedBlueprints.textures.get(name);
    const metadata = shared?.metadata;

    if (metadata?.data && metadata?.width && metadata?.height) {
      return {
        width: metadata.width,
        height: metadata.height,
        data: metadata.data.slice ? metadata.data.slice() : metadata.data,
      };
    }

    const stops = 256;
    const data = new Uint8Array(stops * 4);
    for (let i = 0; i < stops; i += 1) {
      const t = i / (stops - 1);
      const hue = t * 360;
      const rgb = hslToRgb(hue, 1, 0.5);
      data[i * 4 + 0] = Math.floor(rgb[0] * 255);
      data[i * 4 + 1] = Math.floor(rgb[1] * 255);
      data[i * 4 + 2] = Math.floor(rgb[2] * 255);
      data[i * 4 + 3] = 255;
    }

    return { width: stops, height: 1, data };
  }

  getVertexShaderSource() {
    return DEFAULT_VERTEX_SHADER;
  }

  getFragmentShaderSource() {
    return DEFAULT_FRAGMENT_SHADER;
  }

  getLayerPalette(layerName) {
    return this.palette[layerName] || {};
  }

  setActive(active) {
    this.isActive = Boolean(active);
    if (this.isActive) {
      this.lastTimestamp = 0;
    }
  }

  deactivate() {
    this.setActive(false);
  }

  render(timestamp = 0) {
    if (!this.isActive) {
      return;
    }

    const deltaSeconds = this.lastTimestamp > 0
      ? Math.max(0, (timestamp - this.lastTimestamp) / 1000)
      : 0.016;
    this.lastTimestamp = timestamp;

    Object.entries(this.effectState).forEach(([key, value]) => {
      const decay = this.effectDecay[key] ?? 1;
      this.effectState[key] = Math.max(0, value - deltaSeconds * decay);
    });

    this.layerPipelines.forEach((pipeline) => {
      const { gl, canvas, program, buffer, gradient, attributes, uniforms, palette } = pipeline;

      if (!canvas || !program || !buffer?.buffer) {
        return;
      }

      const width = canvas.width || canvas.clientWidth || 1;
      const height = canvas.height || canvas.clientHeight || 1;
      gl.viewport(0, 0, width, height);

      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer.buffer);

      if (attributes.position >= 0) {
        gl.enableVertexAttribArray(attributes.position);
        gl.vertexAttribPointer(attributes.position, 2, gl.FLOAT, false, 16, 0);
      }

      if (attributes.uv >= 0) {
        gl.enableVertexAttribArray(attributes.uv);
        gl.vertexAttribPointer(attributes.uv, 2, gl.FLOAT, false, 16, 8);
      }

      if (gradient?.texture || gradient?.handle) {
        const textureHandle = gradient.texture || gradient.handle;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, textureHandle);
        if (uniforms.gradient) {
          gl.uniform1i(uniforms.gradient, 0);
        }
      }

      const uniformsPayload = this.computeLayerUniforms(pipeline, palette);

      if (uniforms.colorA && uniformsPayload.colorA) {
        gl.uniform3fv(uniforms.colorA, uniformsPayload.colorA);
      }

      if (uniforms.colorB && uniformsPayload.colorB) {
        gl.uniform3fv(uniforms.colorB, uniformsPayload.colorB);
      }

      if (uniforms.time) {
        gl.uniform1f(uniforms.time, timestamp / 1000);
      }

      if (uniforms.intensity) {
        gl.uniform1f(uniforms.intensity, uniformsPayload.intensity);
      }

      if (uniforms.energy) {
        gl.uniform1f(uniforms.energy, this.audioState.energy);
      }

      if (uniforms.detail) {
        gl.uniform1f(uniforms.detail, uniformsPayload.detail);
      }

      if (uniforms.morph) {
        gl.uniform1f(uniforms.morph, uniformsPayload.morph);
      }

      if (uniforms.chaos) {
        gl.uniform1f(uniforms.chaos, uniformsPayload.chaos);
      }

      if (uniforms.combo) {
        gl.uniform1f(uniforms.combo, this.effectState.combo);
      }

      if (uniforms.highlight) {
        gl.uniform1f(uniforms.highlight, this.effectState.highlight);
      }

      if (uniforms.mix) {
        gl.uniform1f(uniforms.mix, uniformsPayload.mix);
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (attributes.position >= 0) {
        gl.disableVertexAttribArray(attributes.position);
      }
      if (attributes.uv >= 0) {
        gl.disableVertexAttribArray(attributes.uv);
      }

      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.useProgram(null);
    });
  }

  computeLayerUniforms(pipeline, palette = {}) {
    const hue = (this.parameters.hue ?? 0) + (palette.hueOffset ?? 0);
    const hueSpread = palette.hueSpread ?? 30;
    const saturation = clamp((this.parameters.saturation ?? 0.8) * (palette.saturation ?? 1), 0, 1);
    const baseLightness = clamp(palette.lightness ?? 0.4, 0, 1);
    const highlightLightness = clamp(baseLightness + (palette.lightnessShift ?? 0.15), 0, 1);

    const colorA = hslToRgb(hue, saturation, baseLightness);
    const colorB = hslToRgb(hue + hueSpread, saturation, highlightLightness);

    const intensityBase = clamp((this.parameters.intensity ?? 0.5) * (palette.intensity ?? 1), 0, 1.5);
    const intensity = clamp(
      intensityBase
        + (palette.energyImpact ?? 0.4) * this.audioState.energy
        + (palette.beatImpact ?? 0.35) * this.effectState.beat
        + (palette.highlightImpact ?? 0.25) * this.effectState.highlight
        - (palette.damageImpact ?? 0.2) * this.effectState.damage,
      0,
      1.5,
    );

    const detail = clamp(((this.parameters.gridDensity ?? 15) - 4) / 96, 0, 1);
    const morph = clamp((this.parameters.morphFactor ?? 1) / 2, 0, 1);
    const chaosParam = clamp((this.parameters.chaos ?? 0) + this.effectState.chaos * 0.6, 0, 2);
    const mix = clamp((palette.mix ?? 0.55) + (palette.energyMix ?? 0.25) * this.audioState.mid, 0, 1);

    return {
      colorA: new Float32Array(colorA),
      colorB: new Float32Array(colorB),
      intensity,
      detail,
      morph,
      chaos: chaosParam,
      mix,
    };
  }

  handleResize(width, height) {
    this.layerPipelines.forEach(({ gl, canvas }) => {
      if (!gl || !canvas) {
        return;
      }

      const w = width || canvas.width || canvas.clientWidth || 1;
      const h = height || canvas.height || canvas.clientHeight || 1;
      gl.viewport(0, 0, w, h);
    });
  }

  setParameters(parameters = {}) {
    Object.entries(parameters || {}).forEach(([key, value]) => {
      this.parameters[key] = this.clampParameter(key, value);
    });
    this.onParametersUpdated();
  }

  updateParameters(parameters = {}) {
    this.setParameters({ ...this.parameters, ...parameters });
  }

  clampParameter(key, value) {
    const bounds = this.parameterBounds[key];
    if (!bounds) {
      return value;
    }
    const clamped = clamp(value, bounds.min, bounds.max);
    if (key === 'geometry') {
      return Math.round(clamped);
    }
    return clamped;
  }

  onParametersUpdated() {
    // Sub-classes can override to react to parameter changes.
  }

  onAudioData(audioData = {}) {
    if (audioData.energy !== undefined) {
      this.audioState.energy = clamp(audioData.energy, 0, 1);
    }
    if (audioData.bass !== undefined) {
      this.audioState.bass = clamp(audioData.bass, 0, 1);
    }
    if (audioData.mid !== undefined) {
      this.audioState.mid = clamp(audioData.mid, 0, 1);
    }
    if (audioData.high !== undefined) {
      this.audioState.high = clamp(audioData.high, 0, 1);
    }
  }

  explodeBeat(intensity = 1) {
    this.effectState.beat = Math.max(this.effectState.beat, clamp(intensity, 0, 2));
    return true;
  }

  triggerComboFireworks(comboCount = 0, normalizedIntensity = 0.5) {
    const magnitude = Math.max(comboCount / 10, normalizedIntensity);
    this.effectState.combo = Math.max(this.effectState.combo, clamp(magnitude, 0, 1.5));
    return true;
  }

  highlightSystemInteractions(eventType, intensity = 1) {
    if (eventType === 'damage') {
      return this.damageShockwave(intensity * 50);
    }

    this.effectState.highlight = Math.max(this.effectState.highlight, clamp(intensity, 0, 1.5));
    return true;
  }

  enemyGlitchStorm(intensity = 1) {
    this.effectState.chaos = Math.max(this.effectState.chaos, clamp(intensity, 0, 1.5));
    return true;
  }

  damageShockwave(amount = 0) {
    const normalized = clamp(Math.abs(amount) / 100, 0, 2);
    this.effectState.damage = Math.max(this.effectState.damage, normalized);
    return true;
  }

  powerUpNova(powerLevel = 1) {
    this.effectState.highlight = Math.max(this.effectState.highlight, clamp(powerLevel, 0, 1.5));
    this.effectState.combo = Math.max(this.effectState.combo, clamp(powerLevel * 0.5, 0, 1.5));
    return true;
  }

  levelTranscendence(level = 1) {
    this.effectState.highlight = Math.max(this.effectState.highlight, clamp(level / 10, 0, 1));
    return true;
  }

  enterBossRealityRift() {
    this.effectState.chaos = Math.max(this.effectState.chaos, 1);
    this.effectState.highlight = Math.max(this.effectState.highlight, 0.8);
    return true;
  }

  setTacticalInfo() {
    this.effectState.highlight = Math.max(this.effectState.highlight, 0.4);
    return true;
  }

  activateHypertetrahedronMode() {
    this.parameters.geometry = 0;
    this.parameters.dimension = 4;
    return true;
  }

  triggerTacticalGlitchStorm(intensity = 1) {
    return this.enemyGlitchStorm(intensity);
  }

  handleResizeForResource(resource) {
    if (!resource) {
      return;
    }
    const { canvas, gl } = resource;
    if (canvas && gl) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }

  destroy() {
    if (!this.resourceManager) {
      return;
    }

    this.layerPipelines.forEach((pipeline) => {
      pipeline.resources?.forEach((id) => {
        try {
          this.resourceManager.releaseResource?.(id);
        } catch (error) {
          console.warn(`${this.systemName}: failed to release resource ${id}`, error);
        }
      });
    });

    this.layerPipelines.clear();
  }
}

export default BaseLayeredEngine;
