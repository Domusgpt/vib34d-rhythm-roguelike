import { BaseLayeredEngine } from './BaseLayeredEngine.js';

const POLYCHORA_PALETTE = {
  background: {
    hueOffset: -200,
    saturation: 0.6,
    lightness: 0.16,
    mix: 0.7,
    intensity: 0.85,
    energyImpact: 0.4,
    beatImpact: 0.3,
    energyMix: 0.3,
  },
  shadow: {
    hueOffset: -230,
    saturation: 0.5,
    lightness: 0.1,
    mix: 0.3,
    intensity: 0.55,
    energyImpact: 0.18,
    damageImpact: 0.4,
  },
  content: {
    hueOffset: -40,
    saturation: 0.9,
    lightness: 0.28,
    mix: 0.75,
    intensity: 1.05,
    energyImpact: 0.55,
    beatImpact: 0.6,
    highlightImpact: 0.5,
    energyMix: 0.35,
  },
  highlight: {
    hueOffset: 10,
    saturation: 1.0,
    lightness: 0.44,
    mix: 0.85,
    intensity: 1.3,
    energyImpact: 0.7,
    beatImpact: 0.55,
    highlightImpact: 0.7,
    energyMix: 0.45,
  },
  accent: {
    hueOffset: 90,
    hueSpread: 80,
    saturation: 1.0,
    lightness: 0.6,
    mix: 0.92,
    intensity: 1.4,
    energyImpact: 0.75,
    beatImpact: 0.8,
    highlightImpact: 0.75,
    energyMix: 0.5,
  },
};

export class PolychoraSystem extends BaseLayeredEngine {
  constructor(options = {}) {
    super({
      ...options,
      palette: POLYCHORA_PALETTE,
    });

    this.fourDimensionalState = {
      topologyPulse: 0,
      rotationDrift: 0,
    };
  }

  getDefaultParameters() {
    return {
      ...super.getDefaultParameters(),
      hue: 320,
      intensity: 0.65,
      saturation: 0.92,
      dimension: 3.8,
      chaos: 0.25,
    };
  }

  onParametersUpdated() {
    super.onParametersUpdated();
    const dimension = this.parameters.dimension ?? 3.8;
    this.fourDimensionalState.rotationDrift = (dimension - 3) / 1.5;
  }

  onAudioData(audioData = {}) {
    super.onAudioData(audioData);
    this.fourDimensionalState.topologyPulse = Math.max(this.fourDimensionalState.topologyPulse, this.audioState.bass * 0.9);
    this.effectState.chaos = Math.max(this.effectState.chaos, this.audioState.mid * 0.7);
  }

  render(timestamp) {
    this.effectState.combo = Math.max(this.effectState.combo, this.fourDimensionalState.rotationDrift * 0.4);
    super.render(timestamp);
    this.fourDimensionalState.topologyPulse = Math.max(0, this.fourDimensionalState.topologyPulse * 0.88);
  }

  computeLayerUniforms(pipeline, palette) {
    const uniforms = super.computeLayerUniforms(pipeline, palette);
    const dimension = this.parameters.dimension ?? 3.8;
    const rotationFactor = this.fourDimensionalState.rotationDrift;
    uniforms.detail = Math.min(1, uniforms.detail + (dimension - 3) * 0.15);
    uniforms.morph = Math.min(1, uniforms.morph + rotationFactor * 0.3 + this.fourDimensionalState.topologyPulse * 0.25);
    uniforms.chaos = Math.min(2, uniforms.chaos + rotationFactor * 0.4);
    uniforms.mix = Math.min(1, uniforms.mix + this.fourDimensionalState.topologyPulse * 0.2);
    return uniforms;
  }
}

export default PolychoraSystem;
