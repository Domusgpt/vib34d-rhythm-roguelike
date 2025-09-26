import { BaseLayeredEngine } from '../core/BaseLayeredEngine.js';

const HOLOGRAPHIC_PALETTE = {
  background: {
    hueOffset: -60,
    saturation: 0.55,
    lightness: 0.15,
    mix: 0.75,
    intensity: 0.8,
    energyImpact: 0.35,
    beatImpact: 0.2,
    energyMix: 0.3,
  },
  shadow: {
    hueOffset: -90,
    saturation: 0.45,
    lightness: 0.1,
    mix: 0.35,
    intensity: 0.55,
    energyImpact: 0.15,
    damageImpact: 0.35,
  },
  content: {
    hueOffset: 0,
    saturation: 0.8,
    lightness: 0.32,
    mix: 0.8,
    intensity: 1.05,
    energyImpact: 0.5,
    highlightImpact: 0.55,
    energyMix: 0.35,
  },
  highlight: {
    hueOffset: 40,
    saturation: 0.95,
    lightness: 0.48,
    mix: 0.85,
    intensity: 1.25,
    energyImpact: 0.65,
    beatImpact: 0.45,
    highlightImpact: 0.8,
    energyMix: 0.45,
  },
  accent: {
    hueOffset: 90,
    hueSpread: 70,
    saturation: 1.0,
    lightness: 0.58,
    mix: 0.9,
    intensity: 1.35,
    energyImpact: 0.7,
    beatImpact: 0.65,
    highlightImpact: 0.85,
    energyMix: 0.5,
  },
};

export class RealHolographicSystem extends BaseLayeredEngine {
  constructor(options = {}) {
    super({
      ...options,
      palette: HOLOGRAPHIC_PALETTE,
    });

    this.hologramState = {
      shimmer: 0,
      lensFlare: 0,
    };
  }

  getDefaultParameters() {
    return {
      ...super.getDefaultParameters(),
      hue: 180,
      intensity: 0.7,
      saturation: 0.9,
      chaos: 0.15,
    };
  }

  onAudioData(audioData = {}) {
    super.onAudioData(audioData);
    this.hologramState.shimmer = Math.max(this.hologramState.shimmer, this.audioState.high * 1.2);
    this.hologramState.lensFlare = Math.max(this.hologramState.lensFlare, this.audioState.mid * 0.8);
  }

  render(timestamp) {
    this.effectState.highlight = Math.max(this.effectState.highlight, this.hologramState.shimmer * 0.6);
    this.effectState.combo = Math.max(this.effectState.combo, this.hologramState.lensFlare * 0.35);
    super.render(timestamp);
    this.hologramState.shimmer = Math.max(0, this.hologramState.shimmer * 0.9);
    this.hologramState.lensFlare = Math.max(0, this.hologramState.lensFlare * 0.9);
  }

  computeLayerUniforms(pipeline, palette) {
    const uniforms = super.computeLayerUniforms(pipeline, palette);
    uniforms.mix = Math.min(1, uniforms.mix + this.hologramState.shimmer * 0.2);
    uniforms.morph = Math.min(1, uniforms.morph + this.hologramState.lensFlare * 0.25);
    uniforms.chaos = Math.min(2, uniforms.chaos + this.hologramState.shimmer * 0.3);
    return uniforms;
  }
}

export default RealHolographicSystem;
