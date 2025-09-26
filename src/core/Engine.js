import { BaseLayeredEngine } from './BaseLayeredEngine.js';

const FACETED_PALETTE = {
  background: {
    hueOffset: -10,
    saturation: 0.7,
    lightness: 0.18,
    mix: 0.8,
    intensity: 0.9,
    energyImpact: 0.3,
    beatImpact: 0.25,
    energyMix: 0.2,
  },
  shadow: {
    hueOffset: -40,
    saturation: 0.55,
    lightness: 0.12,
    mix: 0.2,
    intensity: 0.6,
    energyImpact: 0.15,
    damageImpact: 0.35,
  },
  content: {
    hueOffset: 0,
    saturation: 0.85,
    lightness: 0.28,
    mix: 0.65,
    intensity: 1.0,
    energyImpact: 0.45,
    beatImpact: 0.55,
    energyMix: 0.25,
  },
  highlight: {
    hueOffset: 24,
    saturation: 0.95,
    lightness: 0.4,
    mix: 0.7,
    intensity: 1.15,
    energyImpact: 0.55,
    highlightImpact: 0.65,
    beatImpact: 0.4,
    energyMix: 0.3,
  },
  accent: {
    hueOffset: 54,
    hueSpread: 45,
    saturation: 1.0,
    lightness: 0.5,
    mix: 0.85,
    intensity: 1.2,
    energyImpact: 0.65,
    highlightImpact: 0.7,
    beatImpact: 0.75,
    energyMix: 0.35,
  },
};

export class VIB34DIntegratedEngine extends BaseLayeredEngine {
  constructor(options = {}) {
    super({
      ...options,
      palette: FACETED_PALETTE,
    });

    this.geometryState = {
      lastGeometry: this.parameters.geometry,
      rotationInfluence: 0,
    };
  }

  getDefaultParameters() {
    return {
      ...super.getDefaultParameters(),
      hue: 210,
      intensity: 0.6,
      saturation: 0.85,
    };
  }

  onParametersUpdated() {
    const geometry = this.parameters.geometry ?? 0;
    if (geometry !== this.geometryState.lastGeometry) {
      this.geometryState.lastGeometry = geometry;
      this.geometryState.rotationInfluence = (geometry % 4) / 4;
      this.effectState.highlight = Math.min(1.2, this.effectState.highlight + 0.25);
    }
  }

  computeLayerUniforms(pipeline, palette) {
    const uniforms = super.computeLayerUniforms(pipeline, palette);
    const geometry = this.parameters.geometry ?? 0;
    const morphFactor = this.parameters.morphFactor ?? 1;
    const rotationInfluence = this.geometryState.rotationInfluence;

    uniforms.chaos = Math.min(2, uniforms.chaos + geometry * 0.05 + morphFactor * 0.1 + rotationInfluence * 0.35);
    uniforms.detail = Math.min(1, uniforms.detail + geometry * 0.02);
    uniforms.morph = Math.min(1, uniforms.morph + rotationInfluence * 0.25);
    uniforms.mix = Math.min(1, uniforms.mix + (this.audioState.high ?? 0) * 0.15);

    return uniforms;
  }
}

export default VIB34DIntegratedEngine;
