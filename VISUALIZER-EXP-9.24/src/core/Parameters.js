/**
 * VIB34D Parameter Management System - Working Implementation
 * Extracted from the actual working VIB34D system at visual-codex-enhanced/demos/noise-machine
 */

export class ParameterManager {
    constructor() {
        // Base parameters - core VIB34D system values
        this.baseParams = {
            geometry: 0,
            gridDensity: 15,
            morphFactor: 1.0,
            chaos: 0.2,
            speed: 1.0,
            hue: 200,
            intensity: 0.5,
            saturation: 0.8,
            dimension: 3.5,
            rot4dXW: 0.0,
            rot4dYW: 0.0,
            rot4dZW: 0.0
        };

        // Audio reactive modulation values
        this.audioModulation = {
            rot4dXW: 0.0,
            rot4dYW: 0.0,
            rot4dZW: 0.0,
            gridDensity: 0.0,
            morphFactor: 0.0,
            chaos: 0.0,
            hue: 0.0,
            intensity: 0.0
        };

        // Current audio reactive state
        this.audioReactive = {
            enabled: false,
            frequency: 440, // Current frequency in Hz
            cutoff: 1000,   // Current filter cutoff in Hz
            amplitude: 0.0  // Current amplitude 0-1
        };

        // Final computed parameters (base + audio modulation)
        this.finalParams = { ...this.baseParams };

        // Parameter definitions for validation
        this.parameterDefs = {
            geometry: { min: 0, max: 7, step: 1, type: 'int' },
            gridDensity: { min: 5, max: 100, step: 0.1, type: 'float' },
            morphFactor: { min: 0, max: 2, step: 0.01, type: 'float' },
            chaos: { min: 0, max: 1, step: 0.01, type: 'float' },
            speed: { min: 0.1, max: 3, step: 0.01, type: 'float' },
            hue: { min: 0, max: 360, step: 1, type: 'int' },
            intensity: { min: 0, max: 1, step: 0.01, type: 'float' },
            saturation: { min: 0, max: 1, step: 0.01, type: 'float' },
            dimension: { min: 3.0, max: 4.5, step: 0.01, type: 'float' },
            rot4dXW: { min: -2, max: 2, step: 0.01, type: 'float' },
            rot4dYW: { min: -2, max: 2, step: 0.01, type: 'float' },
            rot4dZW: { min: -2, max: 2, step: 0.01, type: 'float' }
        };
    }

    /**
     * Set base parameter value with validation
     */
    setParameter(name, value) {
        if (this.parameterDefs[name]) {
            const def = this.parameterDefs[name];

            // Clamp value to valid range
            value = Math.max(def.min, Math.min(def.max, value));

            // Apply type conversion
            if (def.type === 'int') {
                value = Math.round(value);
            }

            this.baseParams[name] = value;
            this.computeFinalParameters();
            return true;
        }

        console.warn(`Unknown parameter: ${name}`);
        return false;
    }

    /**
     * Set multiple parameters at once
     */
    setParameters(params) {
        for (const [name, value] of Object.entries(params)) {
            if (this.baseParams.hasOwnProperty(name)) {
                this.setParameter(name, value);
            }
        }
    }

    /**
     * Get current parameter value (base + audio modulation)
     */
    getParameter(name) {
        return this.finalParams[name] !== undefined ? this.finalParams[name] : this.baseParams[name];
    }

    /**
     * Get all final parameters (for rendering)
     */
    getAllParameters() {
        return { ...this.finalParams };
    }

    /**
     * Get base parameters (without audio modulation)
     */
    getBaseParameters() {
        return { ...this.baseParams };
    }

    /**
     * Update audio reactive state
     */
    updateAudioReactive(frequency, cutoff, amplitude) {
        this.audioReactive.frequency = frequency;
        this.audioReactive.cutoff = cutoff;
        this.audioReactive.amplitude = amplitude;

        if (this.audioReactive.enabled) {
            this.updateAudioReactiveParams();
        }
    }

    /**
     * Enable/disable audio reactivity
     */
    setAudioReactive(enabled) {
        this.audioReactive.enabled = enabled;
        if (!enabled) {
            // Clear audio modulation
            Object.keys(this.audioModulation).forEach(key => {
                this.audioModulation[key] = 0.0;
            });
        }
        this.computeFinalParameters();
    }

    /**
     * Update audio reactive parameter modulations
     */
    updateAudioReactiveParams() {
        if (!this.audioReactive.enabled) return;

        // Normalize frequency and cutoff to 0-1 range
        const freqNorm = Math.max(0, Math.min(1, (this.audioReactive.frequency - 200) / 1800)); // 200Hz-2000Hz
        const cutoffNorm = Math.max(0, Math.min(1, (this.audioReactive.cutoff - 150) / 4850)); // 150Hz-5000Hz

        // Map audio parameters to visual modulations
        this.audioModulation.rot4dXW = (freqNorm - 0.5) * 0.5; // Frequency affects XW rotation
        this.audioModulation.rot4dYW = (cutoffNorm - 0.5) * 0.3; // Cutoff affects YW rotation
        this.audioModulation.rot4dZW = this.audioReactive.amplitude * 0.4; // Amplitude affects ZW rotation

        this.audioModulation.gridDensity = freqNorm * 20; // Higher frequency = denser grid
        this.audioModulation.morphFactor = cutoffNorm * 0.5; // Filter affects morphing
        this.audioModulation.chaos = this.audioReactive.amplitude * 0.3; // Amplitude adds chaos

        this.audioModulation.hue = freqNorm * 60; // Frequency shifts hue
        this.audioModulation.intensity = this.audioReactive.amplitude * 0.3; // Amplitude affects brightness

        this.computeFinalParameters();
    }

    /**
     * Compute final parameters (base + audio modulation)
     */
    computeFinalParameters() {
        Object.keys(this.baseParams).forEach(key => {
            let finalValue = this.baseParams[key];

            // Add audio modulation if available
            if (this.audioModulation[key] !== undefined) {
                finalValue += this.audioModulation[key];

                // Clamp to valid range
                if (this.parameterDefs[key]) {
                    const def = this.parameterDefs[key];
                    finalValue = Math.max(def.min, Math.min(def.max, finalValue));

                    // Apply type conversion for final value
                    if (def.type === 'int') {
                        finalValue = Math.round(finalValue);
                    }
                }
            }

            this.finalParams[key] = finalValue;
        });
    }

    /**
     * Generate variation-specific parameters
     */
    generateVariationParameters(variationIndex) {
        if (variationIndex < 30) {
            // Default variations with consistent patterns
            const geometryType = Math.floor(variationIndex / 4);
            const level = variationIndex % 4;

            return {
                geometry: geometryType,
                gridDensity: 8 + geometryType * 2 + level * 1.5,
                morphFactor: 0.2 + level * 0.2,
                chaos: level * 0.2,
                speed: 0.8 + level * 0.2,
                hue: (variationIndex * 12.27) % 360,
                intensity: 0.5 + level * 0.1,
                saturation: 0.8,
                rot4dXW: (level - 1.5) * 0.3,
                rot4dYW: (geometryType % 2) * 0.2,
                rot4dZW: ((geometryType + level) % 3) * 0.15,
                dimension: 3.2 + level * 0.2
            };
        } else {
            // Custom variations - return current base parameters
            return { ...this.baseParams };
        }
    }

    /**
     * Apply variation to base parameters
     */
    applyVariation(variationIndex) {
        const variationParams = this.generateVariationParameters(variationIndex);
        this.setParameters(variationParams);
    }

    /**
     * Reset to default parameters
     */
    resetToDefaults() {
        this.baseParams = {
            geometry: 0,
            gridDensity: 15,
            morphFactor: 1.0,
            chaos: 0.2,
            speed: 1.0,
            hue: 200,
            intensity: 0.5,
            saturation: 0.8,
            dimension: 3.5,
            rot4dXW: 0.0,
            rot4dYW: 0.0,
            rot4dZW: 0.0
        };
        this.computeFinalParameters();
    }

    /**
     * Randomize all base parameters
     */
    randomizeAll() {
        this.baseParams.geometry = Math.floor(Math.random() * 8);
        this.baseParams.gridDensity = 5 + Math.random() * 95;
        this.baseParams.morphFactor = Math.random() * 2;
        this.baseParams.chaos = Math.random();
        this.baseParams.speed = 0.1 + Math.random() * 2.9;
        this.baseParams.hue = Math.random() * 360;
        this.baseParams.intensity = Math.random();
        this.baseParams.saturation = 0.5 + Math.random() * 0.5; // Keep saturation reasonable
        this.baseParams.dimension = 3.0 + Math.random() * 1.5;
        this.baseParams.rot4dXW = Math.random() * 4 - 2;
        this.baseParams.rot4dYW = Math.random() * 4 - 2;
        this.baseParams.rot4dZW = Math.random() * 4 - 2;

        this.computeFinalParameters();
    }

    /**
     * Export current configuration
     */
    exportConfiguration() {
        return {
            type: 'vib34d-parameters',
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            baseParameters: { ...this.baseParams },
            audioReactive: { ...this.audioReactive }
        };
    }

    /**
     * Load parameter configuration
     */
    loadConfiguration(config) {
        if (config && config.type === 'vib34d-parameters' && config.baseParameters) {
            this.setParameters(config.baseParameters);

            if (config.audioReactive) {
                this.audioReactive = { ...this.audioReactive, ...config.audioReactive };
            }

            return true;
        }
        return false;
    }

    /**
     * Get geometry name for display
     */
    getGeometryName(geometryType = null) {
        const type = geometryType !== null ? geometryType : this.finalParams.geometry;
        const names = [
            'TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS',
            'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL'
        ];
        return names[type] || 'UNKNOWN';
    }

    /**
     * HSV to RGB color conversion
     */
    getColorRGB() {
        const hue = this.finalParams.hue % 360;
        const saturation = this.finalParams.saturation;
        const value = this.finalParams.intensity;

        const c = value * saturation;
        const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
        const m = value - c;

        let r, g, b;
        if (hue >= 0 && hue < 60) {
            [r, g, b] = [c, x, 0];
        } else if (hue >= 60 && hue < 120) {
            [r, g, b] = [x, c, 0];
        } else if (hue >= 120 && hue < 180) {
            [r, g, b] = [0, c, x];
        } else if (hue >= 180 && hue < 240) {
            [r, g, b] = [0, x, c];
        } else if (hue >= 240 && hue < 300) {
            [r, g, b] = [x, 0, c];
        } else {
            [r, g, b] = [c, 0, x];
        }

        return {
            r: Math.round((r + m) * 255),
            g: Math.round((g + m) * 255),
            b: Math.round((b + m) * 255)
        };
    }
}