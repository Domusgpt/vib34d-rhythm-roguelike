/**
 * VIB34D RHYTHM ROGUELIKE
 * Main Game Entry Point
 *
 * A roguelike rhythm game that generates 4D geometric challenges
 * from any audio input using mathematical visualization parameters.
 */

import { LatticePulseGame } from './game/LatticePulseGame.js';
import { ParameterManager } from './core/Parameters.js';
import { AudioService } from './game/audio/AudioService.js';
import { GameUI } from './ui/GameUI.js';
import { VisualizerEngine } from './core/VisualizerEngine.js';
import { MobileOptimizationManager } from './game/mobile/MobileOptimizationManager.js';
import { FeedbackOrchestrator } from './game/feedback/FeedbackOrchestrator.js';

class VIB34DRhythmGame {
    constructor() {
        this.gameCanvas = document.getElementById('game-canvas');
        this.hudElement = document.getElementById('hud');
        this.startScreen = document.getElementById('start-screen');

        // Core systems
        this.parameterManager = new ParameterManager();
        this.audioService = new AudioService();
        this.gameUI = new GameUI();
        this.visualizer = new VisualizerEngine(this.gameCanvas);

        this.feedback = null;

        // Game state
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.currentLevel = 1;
        this.subLevel = 1;
        this.levelProgress = 0;
        this.selectedAudioSource = null;
        this.preferences = this.loadPreferences();
        this.mobileExperience = null;
        this.performanceSamples = [];
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.momentum = 0;
        this.health = 85;
        this.comboCooldown = 0;
        this.lastComboMilestone = 0;
        this.dangerActive = false;
        this.lastMeanEnergy = 0;
        this.lastBandSnapshot = { bass: 0, mid: 0, high: 0 };

        this.initializeGame();
    }

    async initializeGame() {
        this.setupCanvas();
        this.setupUI();
        this.setupAudioSources();

        // Initialize visualizer with default parameters
        await this.visualizer.initialize();
        this.visualizer.setParameters(this.parameterManager.getAllParameters());

        this.feedback = new FeedbackOrchestrator({
            ui: this.gameUI,
            visualizer: this.visualizer,
            parameterManager: this.parameterManager,
            audioService: this.audioService
        });

        this.mobileExperience = new MobileOptimizationManager({
            canvas: this.gameCanvas,
            visualizer: this.visualizer,
            parameterManager: this.parameterManager,
            audioService: this.audioService,
            startScreen: this.startScreen,
            onPreferenceChanged: (key, value) => this.updatePreference(key, value)
        });
        await this.mobileExperience.initialize();
        this.feedback?.setMobileManager(this.mobileExperience);
        this.applyMobilePreferences();

        console.log('VIB34D Rhythm Roguelike initialized');
    }

    setupCanvas() {
        const canvas = this.gameCanvas;
        const container = document.getElementById('game-container');

        // Set canvas size to match container
        const resizeCanvas = () => {
            const rect = container.getBoundingClientRect();
            const width = rect.width;
            const height = rect.height;

            if (this.visualizer) {
                this.visualizer.handleResize(width, height);
            } else {
                canvas.width = width;
                canvas.height = height;
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }

    setupUI() {
        // Start screen controls
        const sourceButtons = document.querySelectorAll('.source-btn');
        const startButton = document.getElementById('start-game');
        const audioFileInput = document.getElementById('audio-file');
        const streamUrlInput = document.getElementById('stream-url');

        sourceButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const sourceType = btn.dataset.source;
                this.selectAudioSource(sourceType);
                this.applySourceSelectionUI(sourceType, this.hasSourceData(sourceType));
            });
        });

        // File input handler
        audioFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.selectAudioSource('file');
                this.selectedAudioSource.data = file;
                this.applySourceSelectionUI('file', true);
            } else {
                this.applySourceSelectionUI('file', false);
            }
        });

        // Stream URL handler
        streamUrlInput.addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                const url = e.target.value.trim();
                this.selectAudioSource('stream');
                this.selectedAudioSource.data = url;
                this.applySourceSelectionUI('stream', true);
                this.updatePreference('lastStreamUrl', url);
            } else {
                this.selectAudioSource('stream');
                this.selectedAudioSource.data = null;
                this.applySourceSelectionUI('stream', false);
                this.updatePreference('lastStreamUrl', '');
            }
        });

        // Start game button
        startButton.addEventListener('click', () => {
            this.startGame();
        });

        // Pause/resume controls
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.togglePause();
            }
        });

        // Pause menu controls
        document.getElementById('resume').addEventListener('click', () => this.resumeGame());
        document.getElementById('restart').addEventListener('click', () => this.restartLevel());
        document.getElementById('quit').addEventListener('click', () => this.quitToMenu());

        this.restoreAudioPreferences();
    }

    setupAudioSources() {
        // Configure audio service for different input types
        this.audioService.onBeat((beatData) => {
            this.handleBeat(beatData);
        });

        this.audioService.onAnalyser((audioData) => {
            this.handleAudioData(audioData);
        });
    }

    selectAudioSource(sourceType, persist = true) {
        if (!sourceType) return;
        this.selectedAudioSource = { type: sourceType };
        if (persist) {
            this.updatePreference('lastSourceType', sourceType);
        }
    }

    async startGame() {
        try {
            if (!this.selectedAudioSource) {
                alert('Select an audio source to begin.');
                return;
            }

            if ((this.selectedAudioSource.type === 'file' || this.selectedAudioSource.type === 'stream') &&
                !this.selectedAudioSource.data) {
                alert('Provide an audio file or stream URL before starting.');
                return;
            }

            this.resetRunState();
            this.startScreen.classList.remove('active');
            this.gameState = 'playing';

            // Initialize audio based on selected source
            await this.initializeAudio();

            // Start the game loop
            this.startGameLoop();

            this.updatePreference('lastSessionTimestamp', Date.now());
            const sessionCount = (this.preferences.sessionCount || 0) + 1;
            this.updatePreference('sessionCount', sessionCount);
            this.mobileExperience?.onGameStart();
            this.feedback?.handleGameStart();

            console.log('Game started with audio source:', this.selectedAudioSource.type);

        } catch (error) {
            console.error('Failed to start game:', error);
            alert('Failed to initialize audio. Please check your audio source.');
            this.quitToMenu();
        }
    }

    async initializeAudio() {
        const source = this.selectedAudioSource;

        switch (source.type) {
            case 'mic':
                await this.audioService.initializeMicrophone();
                break;

            case 'file':
                if (source.data) {
                    await this.audioService.loadFile(source.data);
                    this.audioService.play();
                }
                break;

            case 'stream':
                await this.audioService.loadTrack(source.data);
                this.audioService.play();
                break;

            default:
                throw new Error('Invalid audio source type');
        }
    }

    startGameLoop() {
        let lastTime = 0;

        const gameLoop = (currentTime) => {
            if (this.gameState !== 'playing') return;

            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            this.update(deltaTime);
            this.render();

            requestAnimationFrame(gameLoop);
        };

        requestAnimationFrame(gameLoop);
    }

    update(deltaTime) {
        // Update audio analysis
        this.audioService.update(deltaTime);

        // Update internal game state metrics
        this.updateGameState(deltaTime);

        // Update visualizer parameters based on audio
        this.updateVisualizerFromAudio();

        // Update game UI
        this.gameUI.update(deltaTime);

        // Feed performance metrics to the mobile experience layer
        this.mobileExperience?.recordFrame(deltaTime);
        this.feedback?.update(deltaTime);
    }

    render() {
        // Render the VIB34D visualizer
        this.visualizer.render();

        // Update HUD displays
        this.updateHUD();
    }

    handleBeat(beatData) {
        const bandLevels = this.audioService.getBandLevels();
        const energy = beatData.energy || bandLevels.energy || 0;
        const meanEnergy = this.lastMeanEnergy || bandLevels.energy || 0.2;
        const normalizedEnergy = meanEnergy ? Math.max(0, Math.min(1.5, energy / meanEnergy)) : energy;

        const previousMomentum = this.momentum;
        const previousHealth = this.health;

        const baseScore = 120 + normalizedEnergy * 180;
        const comboBonus = 1 + this.combo * 0.12;
        const scoreGain = Math.round(baseScore * comboBonus);
        this.score += scoreGain;
        this.combo += 1;
        this.maxCombo = Math.max(this.maxCombo, this.combo);
        this.comboCooldown = 0;

        const momentumBoost = 0.12 + normalizedEnergy * 0.18;
        this.momentum = Math.min(1, this.momentum + momentumBoost);
        if (this.momentum >= 0.92 && previousMomentum < 0.92) {
            this.feedback?.handleMomentumPeak({
                momentum: this.momentum,
                combo: this.combo,
                score: this.score
            });
        }
        const healthBoost = 0.6 + normalizedEnergy * 2.0;
        this.health = Math.min(100, this.health + healthBoost);
        if (this.health > previousHealth + 0.2) {
            this.feedback?.handleHealthShift({
                amount: this.health - previousHealth,
                direction: 'up',
                health: this.health,
                momentum: this.momentum,
                source: beatData?.source || 'audio'
            });
        }

        this.levelProgress += 0.05 + normalizedEnergy * 0.12;
        if (this.levelProgress >= 1) {
            this.advanceLevel();
        } else {
            const targetSublevel = Math.min(4, Math.floor(this.levelProgress * 4) + 1);
            if (targetSublevel !== this.subLevel) {
                this.subLevel = targetSublevel;
                this.gameUI.updateLevel(this.currentLevel, this.subLevel);
                this.feedback?.handleSublevelShift({
                    level: this.currentLevel,
                    sublevel: this.subLevel,
                    momentum: this.momentum
                });
            }
        }

        this.gameUI.updateScore(this.score);
        this.gameUI.updateCombo(this.combo);
        this.gameUI.updateHealth(this.health);
        this.gameUI.updateMomentumMeter(this.momentum);

        const challenge = this.generateBeatChallenge(beatData, bandLevels);

        if (normalizedEnergy > 1.1 && Math.random() > 0.65) {
            const currentGeometry = this.parameterManager.getParameter('geometry') || 0;
            const nextGeometry = (currentGeometry + 1) % 8;
            this.parameterManager.setParameter('geometry', nextGeometry);
            const params = this.parameterManager.getAllParameters();
            this.visualizer.setParameters(params);
            this.feedback?.handleGeometryShift(nextGeometry, 'beat-surge');
        }

        if (challenge) {
            this.feedback?.handleChallenge({ ...challenge, band: this.feedback?.getDominantBand?.(bandLevels) });
        }

        this.gameUI.showBeatIndicator();
        this.mobileExperience?.handleBeat(beatData);

        this.feedback?.handleScoreBurst({
            scoreGain,
            combo: this.combo,
            momentum: this.momentum
        });

        this.feedback?.handleBeat(beatData, {
            bandLevels,
            intensity: normalizedEnergy,
            momentum: this.momentum,
            combo: this.combo,
            scoreGain,
            level: this.currentLevel,
            sublevel: this.subLevel,
            meanEnergy
        });

        const milestone = Math.floor(this.combo / 5);
        if (milestone > this.lastComboMilestone) {
            this.lastComboMilestone = milestone;
            this.feedback?.handleComboMilestone({
                combo: this.combo,
                momentum: this.momentum,
                score: this.score
            });
        }

        console.log('Beat detected:', beatData);
    }

    handleAudioData(audioData) {
        const params = this.parameterManager.getAllParameters();

        const bassLevel = audioData.frequencyData ? this.getFrequencyRange(audioData.frequencyData, 0, 0.1) : 0;
        const midLevel = audioData.frequencyData ? this.getFrequencyRange(audioData.frequencyData, 0.1, 0.5) : 0;
        const highLevel = audioData.frequencyData ? this.getFrequencyRange(audioData.frequencyData, 0.5, 1.0) : 0;

        params.gridDensity = 15 + (bassLevel * 25);
        params.chaos = Math.min(highLevel * 0.8, 1.0);
        params.speed = 0.8 + (midLevel * 1.2);
        params.hue = (params.hue + (audioData.energy || 0) * 30) % 360;

        const blendedParams = this.feedback
            ? this.feedback.injectAudioDynamics(params, {
                bandLevels: { bass: bassLevel, mid: midLevel, high: highLevel },
                energy: audioData.energy,
                meanEnergy: audioData.meanEnergy
            })
            : params;

        this.parameterManager.setParameters(blendedParams);
        this.visualizer.setParameters(blendedParams);

        this.lastMeanEnergy = audioData.meanEnergy || 0;
        this.lastBandSnapshot = { bass: bassLevel, mid: midLevel, high: highLevel };

        this.gameUI.updateChaos(blendedParams.chaos);
        this.gameUI.updateDimension(blendedParams.dimension);
        this.gameUI.updateAudioBars(bassLevel, midLevel, highLevel);
        this.gameUI.updatePulse(Math.min(1, this.momentum * 0.6 + (audioData.energy || 0) * 0.4));

        this.feedback?.handleAudioBands({
            bass: bassLevel,
            mid: midLevel,
            high: highLevel,
            energy: audioData.energy || 0,
            meanEnergy: audioData.meanEnergy || 0,
            momentum: this.momentum
        });
    }

    getFrequencyRange(frequencyData, startPercent, endPercent) {
        const startIndex = Math.floor(frequencyData.length * startPercent);
        const endIndex = Math.floor(frequencyData.length * endPercent);

        let sum = 0;
        let count = 0;

        for (let i = startIndex; i < endIndex; i++) {
            if (frequencyData[i] !== -Infinity) {
                sum += Math.pow(10, frequencyData[i] / 20);
                count++;
            }
        }

        return count > 0 ? sum / count : 0;
    }

    generateBeatChallenge(beatData, bandLevels = {}) {
        const params = this.parameterManager.getAllParameters();
        const challengeType = this.getChallengeType(params.geometry, beatData.energy);
        const challenge = {
            type: challengeType,
            geometry: params.geometry,
            energy: beatData.energy || 0,
            meanEnergy: this.lastMeanEnergy || 0,
            band: this.feedback?.getDominantBand?.(bandLevels)
        };

        console.log('Generated challenge:', challengeType, 'for geometry:', params.geometry);
        return challenge;
    }

    getChallengeType(geometryType, energy) {
        const challenges = [
            'vertex_precision', 'edge_traversal', 'face_alignment',
            'rotation_sync', 'dimensional_shift', 'morphing_adaptation'
        ];

        const energyIndex = Math.floor(energy * challenges.length);
        return challenges[Math.min(energyIndex, challenges.length - 1)];
    }

    updateVisualizerFromAudio() {
        // Additional real-time parameter updates
        const params = this.parameterManager.getAllParameters();
        this.visualizer.setParameters(params);
    }

    updateHUD() {
        const params = this.parameterManager.getAllParameters();
        this.gameUI.updateHUD({
            params,
            score: this.score,
            combo: this.combo,
            level: { level: this.currentLevel, sublevel: this.subLevel },
            health: this.health,
            momentum: this.momentum
        });
    }

    updateGameState(deltaTime) {
        if (this.gameState !== 'playing') return;

        this.comboCooldown += deltaTime;
        if (this.combo > 0 && this.comboCooldown > 3.5) {
            const previousCombo = this.combo;
            this.combo = Math.max(0, this.combo - 1);
            this.comboCooldown = 0;
            this.gameUI.updateCombo(this.combo);
            this.feedback?.handleComboBreak({
                previousCombo,
                combo: this.combo,
                momentum: this.momentum,
                reason: 'decay'
            });
        }

        if (this.combo < this.lastComboMilestone * 5) {
            this.lastComboMilestone = Math.floor(this.combo / 5);
        }

        const previousMomentum = this.momentum;
        const momentumDecay = 0.05 + Math.max(0, 0.12 - (this.lastMeanEnergy || 0) * 0.08);
        this.momentum = Math.max(0, this.momentum - momentumDecay * deltaTime);
        if (Math.abs(this.momentum - previousMomentum) > 0.005) {
            this.gameUI.updateMomentumMeter(this.momentum);
        }
        const momentumDropped = Math.max(0, previousMomentum - this.momentum);

        const chaos = this.parameterManager.getParameter('chaos') || 0;
        const previousHealth = this.health;
        const healthDrain = Math.max(0, (chaos - 0.55) * 12 * deltaTime);
        this.health = Math.max(0, this.health - healthDrain);
        if (Math.abs(this.health - previousHealth) > 0.1) {
            this.gameUI.updateHealth(this.health);
        }
        const lostHealth = previousHealth - this.health;
        if (lostHealth > 0.3) {
            this.feedback?.handleHealthShift({
                amount: lostHealth,
                direction: 'down',
                health: this.health,
                momentum: this.momentum,
                source: 'chaos'
            });
        }
        if (momentumDropped > 0.02 || (this.momentum < 0.2 && previousMomentum >= 0.2)) {
            this.feedback?.handleMomentumDip({
                momentum: this.momentum,
                previousMomentum,
                health: this.health,
                reason: 'decay'
            });
        }

        const dangerActive = this.health < 30 || chaos > 0.7;
        if (dangerActive && !this.dangerActive) {
            this.dangerActive = true;
            this.feedback?.handleDanger({
                chaos,
                health: this.health,
                momentum: this.momentum,
                reason: this.health < 30 ? 'LOW STABILITY' : 'CHAOS SPIKE'
            });
        } else if (!dangerActive && this.dangerActive) {
            this.dangerActive = false;
        }
    }

    togglePause() {
        if (this.gameState === 'playing') {
            this.pauseGame();
        } else if (this.gameState === 'paused') {
            this.resumeGame();
        }
    }

    pauseGame() {
        this.gameState = 'paused';
        this.audioService.pause();
        document.getElementById('pause-menu').classList.add('active');
        this.feedback?.handleGamePause();
    }

    resumeGame() {
        this.gameState = 'playing';
        this.audioService.play();
        document.getElementById('pause-menu').classList.remove('active');
        this.startGameLoop();
        this.feedback?.handleGameResume();
    }

    async restartLevel() {
        try {
            this.resetRunState();
            this.audioService.stop();
            await this.initializeAudio();
            this.gameState = 'playing';
            document.getElementById('pause-menu').classList.remove('active');
            this.startGameLoop();
            this.audioService.play();
            this.mobileExperience?.onGameStart();
            this.feedback?.handleGameStart();
        } catch (error) {
            console.error('Failed to restart level:', error);
        }
    }

    quitToMenu() {
        this.gameState = 'menu';
        this.audioService.stop();
        document.getElementById('pause-menu').classList.remove('active');
        this.startScreen.classList.add('active');

        // Reset game state
        this.resetRunState();
        this.selectedAudioSource = null;
        this.mobileExperience?.onReturnToMenu();
        this.feedback?.handleGameQuit();
    }

    hasSourceData(sourceType) {
        if (sourceType === 'mic') return true;
        if (!this.selectedAudioSource) return false;
        if (this.selectedAudioSource.type !== sourceType) {
            return sourceType === 'mic';
        }
        return Boolean(this.selectedAudioSource.data);
    }

    applySourceSelectionUI(sourceType, hasData = false) {
        const sourceButtons = document.querySelectorAll('.source-btn');
        const audioFileInput = document.getElementById('audio-file');
        const streamUrlInput = document.getElementById('stream-url');
        const startButton = document.getElementById('start-game');

        sourceButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.source === sourceType);
        });

        if (audioFileInput) {
            audioFileInput.style.display = sourceType === 'file' ? 'block' : 'none';
        }

        if (streamUrlInput) {
            streamUrlInput.style.display = sourceType === 'stream' ? 'block' : 'none';
        }

        if (startButton) {
            const canStart = sourceType === 'mic' || hasData;
            startButton.disabled = !canStart;
        }
    }

    restoreAudioPreferences() {
        const sourceType = this.preferences?.lastSourceType;
        if (!sourceType) return;

        if (sourceType === 'stream' && this.preferences.lastStreamUrl) {
            const streamInput = document.getElementById('stream-url');
            if (streamInput) {
                streamInput.value = this.preferences.lastStreamUrl;
            }
            this.selectedAudioSource = { type: 'stream', data: this.preferences.lastStreamUrl };
        }

        this.selectAudioSource(sourceType, false);
        const hasData = this.hasSourceData(sourceType);
        this.applySourceSelectionUI(sourceType, hasData);
    }

    applyMobilePreferences() {
        if (!this.mobileExperience || !this.preferences) return;

        if (this.preferences.graphicsProfile) {
            this.mobileExperience.setGraphicsProfile(this.preferences.graphicsProfile, false);
        }

        if (typeof this.preferences.hapticsEnabled === 'boolean') {
            this.mobileExperience.toggleHaptics(this.preferences.hapticsEnabled);
        }

        if (typeof this.preferences.tiltEnabled === 'boolean') {
            this.mobileExperience.toggleTilt(this.preferences.tiltEnabled);
        }
    }

    advanceLevel() {
        this.levelProgress = 0;
        this.currentLevel += 1;
        this.subLevel = 1;
        this.gameUI.updateLevel(this.currentLevel, this.subLevel);
        this.feedback?.handleLevelAdvance({ level: this.currentLevel, score: this.score });
    }

    resetRunState() {
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.momentum = 0;
        this.health = 85;
        this.levelProgress = 0;
        this.currentLevel = 1;
        this.subLevel = 1;
        this.comboCooldown = 0;
        this.lastComboMilestone = 0;
        this.dangerActive = false;
        this.lastMeanEnergy = 0;

        const geometry = this.parameterManager.getParameter('geometry') || 0;
        this.gameUI.updateScore(this.score);
        this.gameUI.updateCombo(this.combo);
        this.gameUI.updateLevel(this.currentLevel, this.subLevel);
        this.gameUI.updateHealth(this.health);
        this.gameUI.updateMomentumMeter(this.momentum);
        this.gameUI.updatePulse(0);
        this.gameUI.updateGeometry(geometry);
    }

    loadPreferences() {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
            return {};
        }

        try {
            const stored = localStorage.getItem('vib34d-mobile-prefs');
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to read stored preferences', error);
            return {};
        }
    }

    savePreferences() {
        if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
            return;
        }

        try {
            localStorage.setItem('vib34d-mobile-prefs', JSON.stringify(this.preferences));
        } catch (error) {
            console.warn('Failed to persist preferences', error);
        }
    }

    updatePreference(key, value) {
        if (!this.preferences) {
            this.preferences = {};
        }

        this.preferences[key] = value;
        this.savePreferences();
    }
}

// Initialize the game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new VIB34DRhythmGame();
});

export { VIB34DRhythmGame };