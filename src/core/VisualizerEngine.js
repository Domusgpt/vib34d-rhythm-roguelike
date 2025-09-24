/**
 * VIB34D Visualizer Engine
 * Integrates all 4D visualization systems for the rhythm game
 */

import { Engine as FacetedEngine } from './Engine.js';
import { QuantumEngine } from '../quantum/QuantumEngine.js';
import { RealHolographicSystem as HolographicEngine } from '../holograms/RealHolographicSystem.js';
import { PolychoraSystem } from './PolychoraSystem.js';
import { CanvasManager } from './CanvasManager.js';
import { ReactivityManager } from './ReactivityManager.js';

export class VisualizerEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;

        // Available visualization systems
        this.systems = {
            faceted: null,
            quantum: null,
            holographic: null,
            polychora: null
        };

        this.currentSystem = 'faceted';
        this.currentParameters = {};

        this.canvasManager = new CanvasManager();
        this.reactivityManager = null;

        // System switching state
        this.isInitialized = false;
        this.systemReady = false;
        this.renderScale = Math.min(window.devicePixelRatio || 1, 1.5);
    }

    async initialize() {
        try {
            // Initialize WebGL context
            this.gl = this.canvas.getContext('webgl2') || this.canvas.getContext('webgl');
            if (!this.gl) {
                throw new Error('WebGL not supported');
            }

            // Initialize canvas manager
            this.canvasManager.initialize(this.canvas);

            // Initialize reactivity manager
            this.reactivityManager = new ReactivityManager();
            this.reactivityManager.initialize(this.canvas);

            // Initialize with faceted system by default
            await this.switchToSystem('faceted');

            this.isInitialized = true;
            console.log('VisualizerEngine initialized successfully');

        } catch (error) {
            console.error('Failed to initialize VisualizerEngine:', error);
            throw error;
        }
    }

    async switchToSystem(systemName) {
        if (!['faceted', 'quantum', 'holographic', 'polychora'].includes(systemName)) {
            console.warn('Unknown system:', systemName);
            return false;
        }

        try {
            // Clean up current system
            if (this.systems[this.currentSystem]) {
                this.cleanupCurrentSystem();
            }

            // Initialize new system
            this.currentSystem = systemName;
            await this.initializeSystem(systemName);

            // Apply current parameters to new system
            if (Object.keys(this.currentParameters).length > 0) {
                this.setParameters(this.currentParameters);
            }

            this.systemReady = true;
            console.log(`Switched to ${systemName} system`);
            return true;

        } catch (error) {
            console.error(`Failed to switch to ${systemName} system:`, error);
            return false;
        }
    }

    async initializeSystem(systemName) {
        const canvas = this.canvas;
        const gl = this.gl;

        try {
            switch (systemName) {
                case 'faceted':
                    this.systems.faceted = new FacetedEngine();
                    if (typeof this.systems.faceted.initialize === 'function') {
                        await this.systems.faceted.initialize(canvas);
                    }
                    break;

                case 'quantum':
                    this.systems.quantum = new QuantumEngine();
                    if (typeof this.systems.quantum.initialize === 'function') {
                        await this.systems.quantum.initialize(canvas);
                    }
                    break;

                case 'holographic':
                    this.systems.holographic = new HolographicEngine();
                    if (typeof this.systems.holographic.initialize === 'function') {
                        await this.systems.holographic.initialize(canvas);
                    }
                    break;

                case 'polychora':
                    this.systems.polychora = new PolychoraSystem();
                    if (typeof this.systems.polychora.initialize === 'function') {
                        await this.systems.polychora.initialize(canvas);
                    }
                    break;
            }
        } catch (error) {
            console.warn(`Failed to initialize ${systemName} system, using fallback:`, error);
            // Create a minimal fallback system
            this.systems[systemName] = {
                render: () => {
                    // Simple fallback rendering
                    if (this.gl) {
                        this.gl.clearColor(0.0, 0.0, 0.2, 1.0);
                        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
                    }
                },
                setParameters: () => {},
                cleanup: () => {}
            };
        }
    }

    cleanupCurrentSystem() {
        const system = this.systems[this.currentSystem];
        if (system && typeof system.cleanup === 'function') {
            system.cleanup();
        }

        // Clear canvas
        if (this.gl) {
            this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
        }
    }

    setParameters(parameters) {
        this.currentParameters = { ...parameters };

        if (!this.systemReady) return;

        const system = this.systems[this.currentSystem];
        if (system) {
            // Map generic parameters to system-specific methods
            this.applyParametersToSystem(system, parameters);
        }
    }

    applyParametersToSystem(system, params) {
        // Apply geometry selection
        if (params.geometry !== undefined && typeof system.setGeometry === 'function') {
            system.setGeometry(params.geometry);
        }

        // Apply 4D rotation parameters
        if (typeof system.set4DRotation === 'function') {
            system.set4DRotation(
                params.rot4dXW || 0,
                params.rot4dYW || 0,
                params.rot4dZW || 0
            );
        }

        // Apply visual parameters
        if (typeof system.setVisualParameters === 'function') {
            system.setVisualParameters({
                gridDensity: params.gridDensity || 15,
                morphFactor: params.morphFactor || 1,
                chaos: params.chaos || 0.2,
                speed: params.speed || 1,
                hue: params.hue || 200,
                intensity: params.intensity || 0.5,
                saturation: params.saturation || 0.8
            });
        }

        // Apply dimension parameter
        if (params.dimension !== undefined && typeof system.setDimension === 'function') {
            system.setDimension(params.dimension);
        }

        // Fallback: try to update parameters via a generic method
        if (typeof system.updateParameters === 'function') {
            system.updateParameters(params);
        }
    }

    render(deltaTime = 0.016) {
        if (!this.systemReady || !this.gl) return;

        const system = this.systems[this.currentSystem];
        if (system && typeof system.render === 'function') {
            system.render(deltaTime);
        }
    }

    handleResize(width, height) {
        const scaledWidth = Math.max(1, Math.floor(width * this.renderScale));
        const scaledHeight = Math.max(1, Math.floor(height * this.renderScale));

        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.canvas.width = scaledWidth;
        this.canvas.height = scaledHeight;

        if (this.gl) {
            this.gl.viewport(0, 0, scaledWidth, scaledHeight);
        }

        // Notify current system of resize
        const system = this.systems[this.currentSystem];
        if (system && typeof system.handleResize === 'function') {
            system.handleResize(scaledWidth, scaledHeight);
        }

        if (this.canvasManager) {
            this.canvasManager.handleResize(width, height);
        }
    }

    setRenderScale(scale = 1) {
        const clamped = Math.max(0.4, Math.min(scale, 2));
        if (clamped === this.renderScale) return;
        this.renderScale = clamped;
        if (this.canvas) {
            const rect = this.canvas.getBoundingClientRect();
            this.handleResize(rect.width || this.canvas.width, rect.height || this.canvas.height);
        }
    }

    getRenderScale() {
        return this.renderScale;
    }

    // Game-specific methods for challenge generation
    getCurrentGeometryType() {
        return this.currentParameters.geometry || 0;
    }

    getCurrentSystemName() {
        return this.currentSystem;
    }

    getParameterValue(paramName) {
        return this.currentParameters[paramName];
    }

    // Audio reactivity integration
    onAudioData(audioData) {
        const system = this.systems[this.currentSystem];
        if (system && typeof system.onAudioData === 'function') {
            system.onAudioData(audioData);
        }
    }

    onBeat(beatData) {
        const system = this.systems[this.currentSystem];
        if (system && typeof system.onBeat === 'function') {
            system.onBeat(beatData);
        }
    }

    // Challenge generation helpers
    generateChallengeFromCurrentState() {
        const geometry = this.getCurrentGeometryType();
        const systemName = this.getCurrentSystemName();
        const params = this.currentParameters;

        return {
            geometryType: geometry,
            visualizerSystem: systemName,
            challengeParameters: {
                gridDensity: params.gridDensity || 15,
                dimension: params.dimension || 3.5,
                chaos: params.chaos || 0.2,
                morphFactor: params.morphFactor || 1
            },
            rotation4D: {
                xw: params.rot4dXW || 0,
                yw: params.rot4dYW || 0,
                zw: params.rot4dZW || 0
            }
        };
    }

    // Utility methods for game integration
    getSystemCapabilities() {
        return {
            faceted: {
                geometries: 8, // 0-7
                supports4D: true,
                audioReactive: true
            },
            quantum: {
                geometries: 8,
                supports4D: true,
                audioReactive: true,
                specialFeature: 'velocity_tracking'
            },
            holographic: {
                geometries: 1, // Single holographic mode
                supports4D: true,
                audioReactive: true,
                specialFeature: 'shimmer_effects'
            },
            polychora: {
                geometries: 6, // 4D polytopes
                supports4D: true,
                audioReactive: true,
                specialFeature: 'true_4d_math'
            }
        };
    }

    cleanup() {
        // Cleanup all systems
        Object.keys(this.systems).forEach(systemName => {
            const system = this.systems[systemName];
            if (system && typeof system.cleanup === 'function') {
                system.cleanup();
            }
        });

        if (this.reactivityManager) {
            this.reactivityManager.cleanup();
        }

        if (this.canvasManager) {
            this.canvasManager.cleanup();
        }
    }
}