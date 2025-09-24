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

        // Game state
        this.gameState = 'menu'; // menu, playing, paused, gameOver
        this.currentLevel = 1;
        this.selectedAudioSource = null;

        this.initializeGame();
    }

    async initializeGame() {
        this.setupCanvas();
        this.setupUI();
        this.setupAudioSources();

        // Initialize visualizer with default parameters
        await this.visualizer.initialize();
        this.visualizer.setParameters(this.parameterManager.getAllParameters());

        console.log('VIB34D Rhythm Roguelike initialized');
    }

    setupCanvas() {
        const canvas = this.gameCanvas;
        const container = document.getElementById('game-container');

        // Set canvas size to match container
        const resizeCanvas = () => {
            const rect = container.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            if (this.visualizer) {
                this.visualizer.handleResize(canvas.width, canvas.height);
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
                this.selectAudioSource(btn.dataset.source);
                sourceButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Show/hide additional inputs
                audioFileInput.style.display = btn.dataset.source === 'file' ? 'block' : 'none';
                streamUrlInput.style.display = btn.dataset.source === 'stream' ? 'block' : 'none';

                startButton.disabled = false;
            });
        });

        // File input handler
        audioFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.selectedAudioSource = { type: 'file', data: file };
                startButton.disabled = false;
            }
        });

        // Stream URL handler
        streamUrlInput.addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                this.selectedAudioSource = { type: 'stream', data: e.target.value.trim() };
                startButton.disabled = false;
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

    selectAudioSource(sourceType) {
        this.selectedAudioSource = { type: sourceType };
    }

    async startGame() {
        try {
            this.startScreen.classList.remove('active');
            this.gameState = 'playing';

            // Initialize audio based on selected source
            await this.initializeAudio();

            // Start the game loop
            this.startGameLoop();

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

        // Update visualizer parameters based on audio
        this.updateVisualizerFromAudio();

        // Update game UI
        this.gameUI.update(deltaTime);
    }

    render() {
        // Render the VIB34D visualizer
        this.visualizer.render();

        // Update HUD displays
        this.updateHUD();
    }

    handleBeat(beatData) {
        // Generate geometric challenges based on beat
        this.generateBeatChallenge(beatData);

        // Update UI beat indicator
        this.gameUI.showBeatIndicator();

        console.log('Beat detected:', beatData);
    }

    handleAudioData(audioData) {
        // Use audio frequency data to modulate visualizer parameters
        const params = this.parameterManager.getAllParameters();

        // Map audio bands to parameter changes
        const bassLevel = audioData.frequencyData ? this.getFrequencyRange(audioData.frequencyData, 0, 0.1) : 0;
        const midLevel = audioData.frequencyData ? this.getFrequencyRange(audioData.frequencyData, 0.1, 0.5) : 0;
        const highLevel = audioData.frequencyData ? this.getFrequencyRange(audioData.frequencyData, 0.5, 1.0) : 0;

        // Update parameters based on audio analysis
        params.gridDensity = 15 + (bassLevel * 25); // 15-40 range
        params.chaos = Math.min(highLevel * 0.8, 1.0); // 0-0.8 range
        params.speed = 0.8 + (midLevel * 1.2); // 0.8-2.0 range
        params.hue = (params.hue + (audioData.energy || 0) * 30) % 360;

        this.parameterManager.setParameters(params);
        this.visualizer.setParameters(params);

        // Update audio visualization bars in HUD
        this.updateAudioBars(bassLevel, midLevel, highLevel);
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

    generateBeatChallenge(beatData) {
        // Generate geometric challenge based on current parameters and beat strength
        const params = this.parameterManager.getAllParameters();
        const challengeType = this.getChallengeType(params.geometry, beatData.energy);

        // This will be expanded to generate specific challenges
        console.log('Generated challenge:', challengeType, 'for geometry:', params.geometry);
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
        // Update score, combo, level displays
        // This will be connected to actual game state
        document.getElementById('score').textContent = '0';
        document.getElementById('combo').textContent = '0x';
        document.getElementById('level').textContent = `${this.currentLevel}-1`;

        // Update geometry display
        const geometryNames = ['TETRAHEDRON', 'HYPERCUBE', 'SPHERE', 'TORUS', 'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL'];
        const params = this.parameterManager.getAllParameters();
        document.getElementById('geometry-display').textContent = geometryNames[params.geometry] || 'HYPERCUBE';

        // Update dimension meter
        const dimensionPercent = ((params.dimension - 3.0) / 1.5) * 100;
        document.querySelector('#dimension-meter .meter-fill').style.width = `${dimensionPercent}%`;
    }

    updateAudioBars(bass, mid, high) {
        document.getElementById('bass-band').style.height = `${bass * 100}%`;
        document.getElementById('mid-band').style.height = `${mid * 100}%`;
        document.getElementById('high-band').style.height = `${high * 100}%`;
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
    }

    resumeGame() {
        this.gameState = 'playing';
        this.audioService.play();
        document.getElementById('pause-menu').classList.remove('active');
        this.startGameLoop();
    }

    restartLevel() {
        // Restart current level
        this.resumeGame();
        // Additional restart logic will be added
    }

    quitToMenu() {
        this.gameState = 'menu';
        this.audioService.stop();
        document.getElementById('pause-menu').classList.remove('active');
        this.startScreen.classList.add('active');

        // Reset game state
        this.currentLevel = 1;
        this.selectedAudioSource = null;
    }
}

export { VIB34DRhythmGame };