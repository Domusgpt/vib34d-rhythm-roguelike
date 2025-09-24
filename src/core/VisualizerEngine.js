/**
 * VIB34D Visualizer Engine
 * Integrates all 4D visualization systems for the rhythm game
 */

import { Engine as FacetedEngine } from './Engine.js';
import { QuantumEngine } from '../quantum/QuantumEngine.js';
import { RealHolographicSystem as HolographicEngine } from '../holograms/RealHolographicSystem.js';
import { PolychoraSystem } from './PolychoraSystem.js';
import { HypercubeGameSystem } from '../visualizers/HypercubeGameSystem.js';
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
            polychora: null,
            hypercube: null  // BOMBASTIC HYPERCUBE SYSTEM!
        };

        this.currentSystem = 'faceted';
        this.currentParameters = {};

        this.canvasManager = new CanvasManager();
        this.reactivityManager = null;

        // System switching state
        this.isInitialized = false;
        this.systemReady = false;
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
        if (!['faceted', 'quantum', 'holographic', 'polychora', 'hypercube'].includes(systemName)) {
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

                case 'hypercube':
                    this.systems.hypercube = new HypercubeGameSystem(canvas);
                    this.systems.hypercube.startExplosion(); // ACTIVATE BOMBASTIC MODE!
                    console.log('🔥💥 HYPERCUBE GAME SYSTEM ACTIVATED - PREPARE FOR EXPLOSIVE VISUALS! 💥🔥');
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

    render(timestamp = 0, gameState = {}) {
        if (!this.systemReady || !this.gl) return;

        const system = this.systems[this.currentSystem];
        if (system && typeof system.render === 'function') {
            system.render(timestamp, gameState);
        }

        // 🎮🔍 UPDATE HYPERCUBE GAME STATE VISUALS FOR TACTICAL INFO 🔍🎮
        if (this.systems.hypercube && this.systems.hypercube.updateGameStateVisuals) {
            this.systems.hypercube.updateGameStateVisuals(gameState);
        }

        // 🔥⚡ AMPLIFY CROSS-SYSTEM CONTRASTS FOR MAXIMUM EXCITEMENT ⚡🔥
        this.amplifySystemContrasts(gameState);
    }

    // 💫🔍 TACTICAL INFORMATION OVERLAY FOR CROSS-SYSTEM COMMUNICATION 🔍💫

    setTacticalInfo(infoType, intensity = 1.0) {
        // Route tactical information to appropriate visualizer systems
        if (this.systems.hypercube && this.systems.hypercube.setTacticalInfoMode) {
            this.systems.hypercube.setTacticalInfoMode(infoType, intensity);
        }

        // Add tactical info display to other systems if they support it
        console.log(`💫🔍 TACTICAL INFO BROADCAST: ${infoType} (intensity: ${intensity.toFixed(2)}) 🔍💫`);
    }

    // Switch to hypertetrahedron mode for maximum precision feedback
    activateHypertetrahedronMode() {
        if (this.systems.hypercube) {
            this.systems.hypercube.explosiveState.hyperGeometryMode = 'hypertetrahedron';
            this.systems.hypercube.explosiveState.dimensionalIntensity = Math.max(
                this.systems.hypercube.explosiveState.dimensionalIntensity, 4.5
            );
            console.log('💫🔍 HYPERTETRAHEDRON MODE ACTIVATED FOR MAXIMUM PRECISION! 🔍💫');
        }
    }

    // Enhanced glitch storm for enemy/chaos communication
    triggerTacticalGlitchStorm(intensity = 1.0) {
        if (this.systems.hypercube) {
            this.systems.hypercube.explosiveState.glitchIntensity = Math.max(
                this.systems.hypercube.explosiveState.glitchIntensity,
                intensity * 0.8
            );
            this.systems.hypercube.explosiveState.moireDistortion = Math.max(
                this.systems.hypercube.explosiveState.moireDistortion,
                intensity * 0.6
            );
            console.log(`🌪️🔍 TACTICAL GLITCH STORM! Intensity: ${intensity.toFixed(2)} 🔍🌪️`);
        }
    }

    // 🔥⚡ CROSS-SYSTEM CONTRAST & HIGHLIGHT AMPLIFICATION SYSTEM ⚡🔥

    amplifySystemContrasts(gameState) {
        // 💥🌟 CREATE EXPLOSIVE CONTRASTS BETWEEN VISUALIZER SYSTEMS 🌟💥

        // Determine dominant emotion/state for contrast targeting
        let dominantEmotion = 'harmony';
        let contrastIntensity = 1.0;

        if (gameState.health < 30) {
            dominantEmotion = 'critical';
            contrastIntensity = 2.0;
        } else if (gameState.bossMode) {
            dominantEmotion = 'boss';
            contrastIntensity = 1.8;
        } else if (gameState.comboMultiplier > 10) {
            dominantEmotion = 'ecstasy';
            contrastIntensity = 1.5;
        } else if (gameState.chaosLevel > 70) {
            dominantEmotion = 'chaos';
            contrastIntensity = 1.3;
        }

        // Apply contrasts to active systems
        this.applyHypercubeContrasts(dominantEmotion, contrastIntensity);
        this.applyFacetedContrasts(dominantEmotion, contrastIntensity);
        this.applyQuantumContrasts(dominantEmotion, contrastIntensity);
        this.applyHolographicContrasts(dominantEmotion, contrastIntensity);

        console.log(`🔥⚡ SYSTEM CONTRASTS AMPLIFIED! Emotion: ${dominantEmotion}, Intensity: ${contrastIntensity.toFixed(2)} ⚡🔥`);
    }

    applyHypercubeContrasts(emotion, intensity) {
        if (!this.systems.hypercube) return;

        const hc = this.systems.hypercube.explosiveState;

        switch (emotion) {
            case 'critical':
                // MAXIMUM HYPERTETRAHEDRON PRECISION IN CRISIS
                hc.hyperGeometryMode = 'hypertetrahedron';
                hc.glitchIntensity = Math.max(hc.glitchIntensity, intensity * 0.9);
                hc.colorShiftChaos = Math.max(hc.colorShiftChaos, intensity * 0.7);
                hc.dimensionalIntensity = Math.max(hc.dimensionalIntensity, 4.8);
                break;

            case 'boss':
                // ULTIMATE GEOMETRIC WARFARE MODE
                hc.hyperGeometryMode = 'hypertetrahedron';
                hc.gridViolence = Math.max(hc.gridViolence, 15.0 + intensity * 10.0);
                hc.universeModifier = Math.max(hc.universeModifier, intensity * 2.0);
                hc.moireDistortion = Math.max(hc.moireDistortion, intensity * 0.8);
                break;

            case 'ecstasy':
                // EUPHORIC GEOMETRIC TRANSCENDENCE
                hc.patternIntensity = Math.max(hc.patternIntensity, 1.5 + intensity * 0.8);
                hc.dimensionalIntensity = Math.max(hc.dimensionalIntensity, 4.5 + intensity * 0.3);
                hc.morphExplosion = Math.max(hc.morphExplosion, intensity * 0.6);
                break;

            case 'chaos':
                // CHAOTIC GEOMETRIC STORM
                hc.rotationChaos = Math.max(hc.rotationChaos, intensity * 1.2);
                hc.colorShiftChaos = Math.max(hc.colorShiftChaos, intensity * 0.8);
                hc.glitchIntensity = Math.max(hc.glitchIntensity, intensity * 0.6);
                break;

            default:
                // HARMONIC BALANCE
                hc.patternIntensity = Math.max(hc.patternIntensity, 1.0 + intensity * 0.3);
                break;
        }
    }

    applyFacetedContrasts(emotion, intensity) {
        // Apply contrasting effects to faceted system if available
        if (!this.systems.faceted) return;

        // Faceted system provides GEOMETRIC STRUCTURE contrast to fluid systems
        if (this.systems.faceted.setParameters) {
            const contrastParams = {
                morphFactor: emotion === 'chaos' ? 0.8 * intensity : 0.2,
                gridDensity: emotion === 'boss' ? 15 + intensity * 5 : 8,
                speed: emotion === 'ecstasy' ? 1.5 * intensity : 0.8,
                chaos: emotion === 'critical' ? intensity * 0.9 : 0.3
            };

            // Apply parameters that CONTRAST with current hypercube state
            this.systems.faceted.setParameters(contrastParams);
            console.log('🔷⚡ FACETED GEOMETRIC CONTRAST APPLIED! ⚡🔷');
        }
    }

    applyQuantumContrasts(emotion, intensity) {
        // Apply contrasting quantum effects if quantum system available
        if (!this.systems.quantum || !this.systems.quantum.setParameters) return;

        // Quantum system provides PROBABILITY CLOUD contrast to precise geometry
        const quantumParams = {
            particleDensity: emotion === 'ecstasy' ? 2000 + intensity * 1000 : 1000,
            waveIntensity: emotion === 'chaos' ? intensity * 1.5 : 0.8,
            quantumTunneling: emotion === 'critical' ? intensity * 0.8 : 0.4,
            uncertainty: emotion === 'boss' ? intensity * 1.2 : 0.6
        };

        this.systems.quantum.setParameters(quantumParams);
        console.log('⚛️⚡ QUANTUM PROBABILITY CONTRAST APPLIED! ⚡⚛️');
    }

    applyHolographicContrasts(emotion, intensity) {
        // Apply contrasting holographic effects if holographic system available
        if (!this.systems.holographic || !this.systems.holographic.updateState) return;

        // Holographic system provides DEPTH ILLUSION contrast to flat interfaces
        const holoState = {
            layerSeparation: emotion === 'boss' ? intensity * 50 : 20,
            interferencePattern: emotion === 'chaos' ? intensity * 0.9 : 0.4,
            depthIntensity: emotion === 'ecstasy' ? intensity * 1.3 : 0.8,
            hologramStability: emotion === 'critical' ? 1.0 - intensity * 0.6 : 0.9
        };

        this.systems.holographic.updateState(holoState);
        console.log('🌈⚡ HOLOGRAPHIC DEPTH CONTRAST APPLIED! ⚡🌈');
    }

    // 💫🎆 EXPLOSIVE CROSS-SYSTEM HIGHLIGHTING EFFECTS 🎆💫

    highlightSystemInteractions(eventType, intensity = 1.0) {
        // Create EXPLOSIVE highlighting effects across ALL systems simultaneously
        switch (eventType) {
            case 'mega_combo':
                this.triggerMegaComboHighlight(intensity);
                break;

            case 'perfect_precision':
                this.triggerPerfectPrecisionHighlight(intensity);
                break;

            case 'chaos_explosion':
                this.triggerChaosExplosionHighlight(intensity);
                break;

            case 'boss_transcendence':
                this.triggerBossTranscendenceHighlight(intensity);
                break;

            default:
                this.triggerUniversalHighlight(intensity);
                break;
        }

        console.log(`💫🎆 CROSS-SYSTEM HIGHLIGHT: ${eventType} (intensity: ${intensity.toFixed(2)}) 🎆💫`);
    }

    triggerMegaComboHighlight(intensity) {
        // 🔥✨ ALL SYSTEMS EXPLODE WITH COMBO CELEBRATION ✨🔥
        if (this.systems.hypercube) {
            this.systems.hypercube.explosiveState.comboFireworks = intensity;
            this.systems.hypercube.explosiveState.cosmicEuphoria = intensity;
        }

        // Contrast: While hypercube explodes, other systems provide structured celebration
        if (this.systems.faceted) {
            this.systems.faceted.setParameters({ speed: 2.0 * intensity, chaos: 0.1 });
        }

        console.log('🔥✨ MEGA COMBO: All systems synchronized in euphoric celebration! ✨🔥');
    }

    triggerPerfectPrecisionHighlight(intensity) {
        // 💫🔍 HYPERTETRAHEDRON PRECISION WITH SYSTEM-WIDE CLARITY 🔍💫
        if (this.systems.hypercube) {
            this.systems.hypercube.explosiveState.hyperGeometryMode = 'hypertetrahedron';
            this.systems.hypercube.explosiveState.patternIntensity = 2.0;
            this.systems.hypercube.explosiveState.glitchIntensity *= 0.2; // Crystal clarity
        }

        // Contrast: Other systems become ultra-stable to highlight precision
        if (this.systems.quantum) {
            this.systems.quantum.setParameters({ uncertainty: 0.1, stability: 0.95 });
        }

        console.log('💫🔍 PERFECT PRECISION: Crystal clear hypertetrahedron with stable contrasts! 🔍💫');
    }

    triggerChaosExplosionHighlight(intensity) {
        // 🌪️💥 MAXIMUM CHAOS ACROSS ALL SYSTEMS SIMULTANEOUSLY 💥🌪️
        if (this.systems.hypercube) {
            this.systems.hypercube.explosiveState.glitchIntensity = intensity;
            this.systems.hypercube.explosiveState.colorShiftChaos = intensity;
            this.systems.hypercube.explosiveState.rotationChaos = intensity * 1.5;
        }

        // Complement: Other systems add their own chaos flavors
        if (this.systems.quantum) {
            this.systems.quantum.setParameters({ chaos: intensity, waveIntensity: intensity * 1.2 });
        }

        console.log('🌪️💥 CHAOS EXPLOSION: All systems in synchronized chaos storm! 💥🌪️');
    }

    triggerBossTranscendenceHighlight(intensity) {
        // 🐲🌌 ULTIMATE BOSS MODE ACROSS ALL REALITY 🌌🐲
        if (this.systems.hypercube) {
            this.systems.hypercube.explosiveState.bossRealityRift = intensity;
            this.systems.hypercube.explosiveState.dimensionalIntensity = 4.8;
            this.systems.hypercube.explosiveState.universeModifier = intensity * 2.5;
        }

        // All systems shift to maximum intensity boss mode
        if (this.systems.faceted) {
            this.systems.faceted.setParameters({ morphFactor: intensity * 0.8, gridDensity: 20 });
        }

        console.log('🐲🌌 BOSS TRANSCENDENCE: All reality systems at maximum dimensional warfare! 🌌🐲');
    }

    triggerUniversalHighlight(intensity) {
        // 🌟💫 UNIVERSAL HARMONY HIGHLIGHT ACROSS ALL SYSTEMS 💫🌟
        if (this.systems.hypercube) {
            this.systems.hypercube.explosiveState.patternIntensity = 1.0 + intensity * 0.5;
            this.systems.hypercube.explosiveState.cosmicEuphoria = intensity * 0.6;
        }

        console.log('🌟💫 UNIVERSAL HIGHLIGHT: Harmonic resonance across all systems! 💫🌟');
    }

    handleResize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;

        if (this.gl) {
            this.gl.viewport(0, 0, width, height);
        }

        // Notify current system of resize
        const system = this.systems[this.currentSystem];
        if (system && typeof system.handleResize === 'function') {
            system.handleResize(width, height);
        }

        if (this.canvasManager) {
            this.canvasManager.handleResize(width, height);
        }
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
            },
            hypercube: {
                geometries: 3, // hypercube, hypersphere, hypertetrahedron
                supports4D: true,
                audioReactive: true,
                specialFeature: 'BOMBASTIC_EXPLOSIONS'
            }
        };
    }

    // 🔥💥 BOMBASTIC GAME EVENT METHODS FOR MAXIMUM EXCITEMENT! 💥🔥

    explodeBeat(intensity = 1.0) {
        // Trigger beat explosion across ALL systems for MAXIMUM IMPACT
        console.log(`🎵💥 SYSTEM-WIDE BEAT EXPLOSION! Intensity: ${intensity.toFixed(2)}`);

        // Trigger beat in current system
        const system = this.systems[this.currentSystem];
        if (system) {
            if (typeof system.explodeBeat === 'function') {
                system.explodeBeat(intensity);
            } else if (typeof system.triggerClick === 'function') {
                // Fallback for other visualizers
                system.triggerClick(0.5, 0.5);
                if (system.clickIntensity !== undefined) {
                    system.clickIntensity = intensity;
                }
            }
        }

        // Trigger explosions in hypercube system if available
        if (this.systems.hypercube && this.systems.hypercube.explodeBeat) {
            this.systems.hypercube.explodeBeat(intensity);
        }
    }

    triggerComboFireworks(comboCount) {
        console.log(`🔥✨ COMBO FIREWORKS ACROSS ALL SYSTEMS! ${comboCount}x MULTIPLIER!`);

        // Trigger combo effects in current system
        const system = this.systems[this.currentSystem];
        if (system && typeof system.triggerMorphPulse === 'function') {
            system.triggerMorphPulse(comboCount / 10.0);
        }

        // Special hypercube combo fireworks
        if (this.systems.hypercube && this.systems.hypercube.triggerComboFireworks) {
            this.systems.hypercube.triggerComboFireworks(comboCount);
        }

        // Cross-system contrast effects
        this.createSystemContrast('combo', comboCount / 10.0);
    }

    damageShockwave(damageAmount) {
        console.log(`💥⚡ DAMAGE SHOCKWAVE! ${damageAmount} damage - VISUAL CHAOS ACTIVATED!`);

        // Create damage effects across systems
        const system = this.systems[this.currentSystem];
        if (system && typeof system.triggerChaos === 'function') {
            system.triggerChaos(damageAmount / 20.0);
        }

        // Hypercube damage shockwave
        if (this.systems.hypercube && this.systems.hypercube.damageShockwave) {
            this.systems.hypercube.damageShockwave(damageAmount);
        }

        // Create red flash across all systems
        this.createSystemContrast('damage', damageAmount / 100.0);
    }

    powerUpNova(powerLevel) {
        console.log(`⭐💫 POWER-UP NOVA EXPLOSION! Level: ${powerLevel}`);

        // Switch to hypercube system for maximum visual impact
        if (this.currentSystem !== 'hypercube' && this.systems.hypercube) {
            this.switchToSystem('hypercube');
        }

        // Trigger power-up effects
        if (this.systems.hypercube && this.systems.hypercube.powerUpNova) {
            this.systems.hypercube.powerUpNova(powerLevel);
        }

        this.createSystemContrast('powerup', powerLevel);
    }

    enemyGlitchStorm(intensity) {
        console.log(`👹🌪️ ENEMY GLITCH STORM! Intensity: ${intensity.toFixed(2)}`);

        // Apply glitch effects across systems
        const system = this.systems[this.currentSystem];
        if (system && typeof system.triggerGlitch === 'function') {
            system.triggerGlitch(intensity);
        }

        // Hypercube glitch storm
        if (this.systems.hypercube && this.systems.hypercube.enemyGlitchStorm) {
            this.systems.hypercube.enemyGlitchStorm(intensity);
        }

        this.createSystemContrast('glitch', intensity);
    }

    enterBossRealityRift() {
        console.log(`🐲🌌 BOSS REALITY RIFT! SWITCHING TO HYPERTETRAHEDRON MODE!`);

        // Force switch to hypercube system with hypertetrahedron mode
        this.switchToSystem('hypercube');

        if (this.systems.hypercube && this.systems.hypercube.enterBossRealityRift) {
            this.systems.hypercube.enterBossRealityRift();
        }

        // Apply reality rift effects across all systems
        this.createSystemContrast('boss', 1.0);
    }

    levelTranscendence(newLevel) {
        console.log(`🚀🌟 LEVEL TRANSCENDENCE! Level ${newLevel} - GEOMETRY EVOLUTION!`);

        // Choose geometry system based on level for visual variety
        const systemChoices = ['faceted', 'quantum', 'holographic', 'hypercube'];
        const targetSystem = systemChoices[newLevel % systemChoices.length];

        this.switchToSystem(targetSystem);

        // Trigger transcendence effects
        if (this.systems.hypercube && this.systems.hypercube.levelTranscendence) {
            this.systems.hypercube.levelTranscendence(newLevel);
        }

        this.createSystemContrast('transcendence', 1.0);
    }

    // Create contrasting effects between systems for MAXIMUM VISUAL IMPACT
    createSystemContrast(effectType, intensity) {
        const contrastEffects = {
            'combo': () => {
                // Bright explosions with color shifts
                this.applyGlobalColorShift(intensity * 60);
                this.applyGlobalIntensityBoost(intensity * 0.5);
            },
            'damage': () => {
                // Red flashes and chaos
                this.applyGlobalColorShift(-30 * intensity); // Shift toward red
                this.applyGlobalChaos(intensity * 0.8);
            },
            'powerup': () => {
                // Golden glow and smooth morphing
                this.applyGlobalColorShift(45 * intensity); // Golden yellow
                this.applyGlobalMorphing(intensity * 0.6);
            },
            'glitch': () => {
                // Chaos and distortion across all systems
                this.applyGlobalChaos(intensity);
                this.applyGlobalGlitch(intensity);
            },
            'boss': () => {
                // Purple/magenta reality distortion
                this.applyGlobalColorShift(300); // Magenta
                this.applyGlobalIntensityBoost(1.0);
                this.applyGlobalMorphing(1.0);
            },
            'transcendence': () => {
                // Rainbow explosion
                this.applyGlobalColorShift(intensity * 360);
                this.applyGlobalIntensityBoost(1.0);
            }
        };

        if (contrastEffects[effectType]) {
            contrastEffects[effectType]();
        }
    }

    // Global effect application methods
    applyGlobalColorShift(hueShift) {
        // Apply color shift to all compatible systems
        Object.keys(this.systems).forEach(systemName => {
            const system = this.systems[systemName];
            if (system && typeof system.shiftHue === 'function') {
                system.shiftHue(hueShift);
            }
        });
    }

    applyGlobalIntensityBoost(boost) {
        Object.keys(this.systems).forEach(systemName => {
            const system = this.systems[systemName];
            if (system && typeof system.boostIntensity === 'function') {
                system.boostIntensity(boost);
            }
        });
    }

    applyGlobalChaos(chaosLevel) {
        Object.keys(this.systems).forEach(systemName => {
            const system = this.systems[systemName];
            if (system && typeof system.applyChaos === 'function') {
                system.applyChaos(chaosLevel);
            }
        });
    }

    applyGlobalMorphing(morphLevel) {
        Object.keys(this.systems).forEach(systemName => {
            const system = this.systems[systemName];
            if (system && typeof system.applyMorphing === 'function') {
                system.applyMorphing(morphLevel);
            }
        });
    }

    applyGlobalGlitch(glitchLevel) {
        Object.keys(this.systems).forEach(systemName => {
            const system = this.systems[systemName];
            if (system && typeof system.applyGlitch === 'function') {
                system.applyGlitch(glitchLevel);
            }
        });
    }

    // Audio explosive reactivity for ALL systems
    updateAudioExplosion(audioData) {
        // Send audio data to hypercube system for explosive processing
        if (this.systems.hypercube && this.systems.hypercube.updateAudioExplosion) {
            this.systems.hypercube.updateAudioExplosion(audioData);
        }

        // Apply to current system as well
        if (this.systems[this.currentSystem] && typeof this.systems[this.currentSystem].onAudioData === 'function') {
            this.systems[this.currentSystem].onAudioData(audioData);
        }

        // Trigger explosive events based on audio intensity
        if (audioData.bass > 0.8) {
            this.explodeBeat(audioData.bass);
        }

        if (audioData.high > 0.9 && Math.random() < 0.3) {
            this.enemyGlitchStorm(audioData.high);
        }

        if (audioData.energy > 0.95) {
            this.triggerComboFireworks(Math.floor(audioData.energy * 20));
        }
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