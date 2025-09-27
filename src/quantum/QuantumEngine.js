import { BaseLayeredEngine } from '../core/BaseLayeredEngine.js';

const QUANTUM_PALETTE = {
  background: {
    hueOffset: -140,
    saturation: 0.65,
    lightness: 0.12,
    mix: 0.6,
    intensity: 0.75,
    energyImpact: 0.45,
    beatImpact: 0.35,
    energyMix: 0.35,
  },
  shadow: {
    hueOffset: -170,
    saturation: 0.55,
    lightness: 0.1,
    mix: 0.25,
    intensity: 0.55,
    energyImpact: 0.2,
    damageImpact: 0.4,
  },
  content: {
    hueOffset: -20,
    saturation: 0.9,
    lightness: 0.3,
    mix: 0.7,
    intensity: 1.1,
    energyImpact: 0.6,
    beatImpact: 0.7,
    highlightImpact: 0.45,
    energyMix: 0.4,
  },
  highlight: {
    hueOffset: 18,
    saturation: 1.0,
    lightness: 0.45,
    mix: 0.8,
    intensity: 1.3,
    energyImpact: 0.7,
    beatImpact: 0.55,
    highlightImpact: 0.65,
    energyMix: 0.45,
  },
  accent: {
    hueOffset: 60,
    hueSpread: 60,
    saturation: 1.0,
    lightness: 0.55,
    mix: 0.9,
    intensity: 1.35,
    energyImpact: 0.75,
    beatImpact: 0.8,
    highlightImpact: 0.7,
    energyMix: 0.5,
  },
};

export class QuantumEngine extends BaseLayeredEngine {
  constructor(options = {}) {
    super({
      ...options,
      palette: QUANTUM_PALETTE,
    });

    this.quantumState = {
      bassPulse: 0,
      trebleGlitter: 0,
    };
  }

  getDefaultParameters() {
    return {
      ...super.getDefaultParameters(),
      hue: 260,
      intensity: 0.75,
      saturation: 0.95,
      gridDensity: 20,
    };
  }

  onAudioData(audioData = {}) {
    super.onAudioData(audioData);
    this.quantumState.bassPulse = Math.max(this.quantumState.bassPulse, this.audioState.bass * 1.1);
    this.quantumState.trebleGlitter = Math.max(this.quantumState.trebleGlitter, this.audioState.high * 0.9);
    this.effectState.chaos = Math.max(this.effectState.chaos, this.audioState.mid * 0.6);
  }

  render(timestamp) {
    this.effectState.highlight = Math.max(this.effectState.highlight, this.quantumState.trebleGlitter * 0.5);
    this.effectState.combo = Math.max(this.effectState.combo, this.quantumState.bassPulse * 0.4);
    super.render(timestamp);
    this.quantumState.bassPulse = Math.max(0, this.quantumState.bassPulse * 0.85);
    this.quantumState.trebleGlitter = Math.max(0, this.quantumState.trebleGlitter * 0.88);
  }

  computeLayerUniforms(pipeline, palette) {
    const uniforms = super.computeLayerUniforms(pipeline, palette);
    const noiseInfluence = (this.parameters.chaos ?? 0) * 0.3 + this.audioState.mid * 0.2;
    uniforms.chaos = Math.min(2, uniforms.chaos + noiseInfluence);
    uniforms.mix = Math.min(1, uniforms.mix + this.quantumState.trebleGlitter * 0.25);
    uniforms.morph = Math.min(1, uniforms.morph + this.quantumState.bassPulse * 0.2);
    return uniforms;
  }
}

export default QuantumEngine;
