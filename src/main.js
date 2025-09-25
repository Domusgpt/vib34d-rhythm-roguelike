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

        // GAME STATE - NOT ENGINE PARAMETERS!
        this.score = 0;
        this.comboMultiplier = 0;
        this.health = 100;
        this.chaosLevel = 0;
        this.enemies = [];
        this.challenges = [];

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

        // 🔥💥 SETUP DEMO MODE FOR TESTING BOMBASTIC EFFECTS 💥🔥
        this.setupDemoMode();

        // 🚀 START AUTO-DEMO MODE FOR IMMEDIATE VISUAL FEEDBACK 🚀
        this.startAutoDemo();

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

    updateVisualizerFromAudio() {
        // Get audio reactive data
        if (this.audioService && this.audioService.frequencyData) {
            const audioData = {
                frequencyData: this.audioService.frequencyData,
                timeDomainData: this.audioService.timeDomainData
            };

            // Pass audio data to visualizer for reactive effects
            if (this.visualizer && this.visualizer.onAudioData) {
                this.visualizer.onAudioData(audioData);
            }

            // Update global audio reactive values
            const bassLevel = this.getFrequencyRange(this.audioService.frequencyData, 0, 0.1);
            const midLevel = this.getFrequencyRange(this.audioService.frequencyData, 0.1, 0.5);
            const highLevel = this.getFrequencyRange(this.audioService.frequencyData, 0.5, 1.0);

            window.audioReactive = {
                bass: bassLevel,
                mid: midLevel,
                high: highLevel,
                energy: (bassLevel + midLevel + highLevel) / 3
            };

            // Update visualizer parameters based on audio
            if (this.visualizer && this.visualizer.setParameters) {
                const audioParams = this.parameterManager.getAllParameters();
                // Add audio-reactive modulation
                audioParams.chaos = Math.min(1.0, audioParams.chaos + bassLevel * 0.3);
                audioParams.gridDensity = Math.max(5, audioParams.gridDensity + midLevel * 10);
                audioParams.hue = (audioParams.hue + highLevel * 60) % 360;

                this.visualizer.setParameters(audioParams);
            }
        }
    }

    render() {
        // Pass current game state to visualizer for tactical information display
        const gameState = {
            health: this.health,
            score: this.score,
            comboMultiplier: this.comboMultiplier,
            chaosLevel: this.chaosLevel,
            currentLevel: this.currentLevel,
            bossMode: this.gameState === 'boss',
            enemies: this.enemies.length,
            challenges: this.challenges.length
        };

        // Render the VIB34D visualizer with game state communication
        this.visualizer.render(performance.now(), gameState);

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
        // GAME EVENT APPROACH - NO PARAMETER TWEAKING!
        const bassLevel = audioData.frequencyData ? this.getFrequencyRange(audioData.frequencyData, 0, 0.1) : 0;
        const midLevel = audioData.frequencyData ? this.getFrequencyRange(audioData.frequencyData, 0.1, 0.5) : 0;
        const highLevel = audioData.frequencyData ? this.getFrequencyRange(audioData.frequencyData, 0.5, 1.0) : 0;

        // TRIGGER GAME EVENTS INSTEAD OF CHANGING PARAMETERS
        if (bassLevel > 0.7) {
            this.triggerBeatEvent(bassLevel);
        }

        if (midLevel > 0.6) {
            this.triggerComboEvent(midLevel);
        }

        if (highLevel > 0.8) {
            this.triggerEnemySpawnEvent(highLevel);
        }

        // Set global audio reactive values for visualizers to use
        window.audioReactive = {
            bass: bassLevel,
            mid: midLevel,
            high: highLevel,
            energy: audioData.energy || 0
        };

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

    // GAME EVENT METHODS - NO PARAMETER CONTROLS!

    triggerBeatEvent(intensity) {
        // 🎵💥 BOMBASTIC BEAT EVENT WITH CROSS-SYSTEM EXPLOSION! 💥🎵
        if (this.visualizer && this.visualizer.explodeBeat) {
            this.visualizer.explodeBeat(intensity);
        }

        // 🔥💥 ULTRA TACTILE UI FEEDBACK INTEGRATION 💥🔥
        this.gameUI.showBeatIndicator();

        // Game logic - beat creates rhythmic challenges
        this.spawnBeatChallenge(intensity);
        const scoreGain = Math.floor(intensity * 100);
        this.score += scoreGain;

        // Update UI with explosive feedback
        this.gameUI.updateScore(this.score);

        console.log(`🎵💥 BEAT EXPLOSION! Intensity: ${intensity.toFixed(2)}, Score: +${scoreGain}`);
    }

    triggerComboEvent(intensity) {
        // 🔥✨ COMBO FIREWORKS WITH SYSTEM-WIDE VISUAL CELEBRATION! ✨🔥
        const comboCount = Math.floor(intensity * 15);
        this.comboMultiplier = Math.max(this.comboMultiplier, comboCount);

        if (this.visualizer && this.visualizer.triggerComboFireworks) {
            this.visualizer.triggerComboFireworks(comboCount);
        }

        // 🔥💥 ULTRA TACTILE COMBO FEEDBACK 💥🔥
        this.gameUI.updateCombo(this.comboMultiplier);

        // 💫🎆 CROSS-SYSTEM MEGA COMBO HIGHLIGHTING 🎆💫
        if (this.comboMultiplier >= 10 && this.visualizer && this.visualizer.highlightSystemInteractions) {
            this.visualizer.highlightSystemInteractions('mega_combo', intensity);
        }

        // MASSIVE score bonus for combos!
        const comboBonus = comboCount * comboCount * 50;
        this.score += comboBonus;

        // Update score with explosive feedback
        this.gameUI.updateScore(this.score);

        console.log(`🔥✨ COMBO FIREWORKS! ${comboCount}x multiplier - Score: +${comboBonus}`);
    }

    triggerEnemySpawnEvent(intensity) {
        // 👹🌪️ ENEMY SPAWN WITH GLITCH STORM CHAOS! 🌪️👹
        if (this.visualizer && this.visualizer.enemyGlitchStorm) {
            this.visualizer.enemyGlitchStorm(intensity);
        }

        // 💥🌪️ CROSS-SYSTEM CHAOS EXPLOSION HIGHLIGHTING 🌪️💥
        if (intensity > 0.7 && this.visualizer && this.visualizer.highlightSystemInteractions) {
            this.visualizer.highlightSystemInteractions('chaos_explosion', intensity);
        }

        // Game logic - spawn enemies with visual feedback
        const enemyCount = Math.floor(intensity * 5);
        this.spawnEnemyWave(enemyCount);
        this.chaosLevel = Math.min(this.chaosLevel + intensity * 20, 100);
        console.log(`👹🌪️ ENEMY GLITCH STORM! ${enemyCount} enemies spawned, Chaos: ${this.chaosLevel.toFixed(1)}%`);
    }

    // 🎮 ADDITIONAL BOMBASTIC GAME EVENTS! 🎮

    takeDamage(amount) {
        this.health = Math.max(0, this.health - amount);

        // 💥⚡ DAMAGE SHOCKWAVE ACROSS ALL SYSTEMS! ⚡💥
        if (this.visualizer && this.visualizer.damageShockwave) {
            this.visualizer.damageShockwave(amount);
        }

        // 🔥💥 ULTRA TACTILE DAMAGE FEEDBACK 💥🔥
        this.gameUI.triggerDamageEffect(amount);

        console.log(`💥⚡ DAMAGE SHOCKWAVE! -${amount} health, Health: ${this.health}`);
    }

    collectPowerUp(powerType, powerLevel = 1.0) {
        // ⭐💫 POWER-UP NOVA EXPLOSION! 💫⭐
        if (this.visualizer && this.visualizer.powerUpNova) {
            this.visualizer.powerUpNova(powerLevel);
        }

        // 🌟💫 ULTRA TACTILE POWER-UP FEEDBACK 💫🌟
        this.gameUI.triggerPowerUpEffect(powerType);

        // Apply power-up effects
        const scoreBonus = Math.floor(powerLevel * 1000);
        this.score += scoreBonus;

        // Update score with cosmic euphoria
        this.gameUI.updateScore(this.score);

        console.log(`⭐💫 POWER-UP NOVA! Type: ${powerType}, Score: +${scoreBonus}`);
    }

    levelUp() {
        this.currentLevel++;

        // 🚀🌟 LEVEL TRANSCENDENCE WITH GEOMETRY EVOLUTION! 🌟🚀
        if (this.visualizer && this.visualizer.levelTranscendence) {
            this.visualizer.levelTranscendence(this.currentLevel);
        }

        // 🚀🌟 ULTRA TACTILE LEVEL UP TRANSCENDENCE 🌟🚀
        this.gameUI.triggerLevelUpEffect(this.currentLevel);

        // Reset some game state for new level
        this.comboMultiplier = 0;
        this.chaosLevel = 0;
        this.health = Math.min(this.health + 25, 100); // Heal on level up

        console.log(`🚀🌟 LEVEL TRANSCENDENCE! Now level ${this.currentLevel}!`);
    }

    enterBossMode() {
        // 🐲🌌 BOSS REALITY RIFT ACTIVATED! 🌌🐲
        if (this.visualizer && this.visualizer.enterBossRealityRift) {
            this.visualizer.enterBossRealityRift();
        }

        // 🐲🌌 CROSS-SYSTEM BOSS TRANSCENDENCE HIGHLIGHTING 🌌🐲
        if (this.visualizer && this.visualizer.highlightSystemInteractions) {
            this.visualizer.highlightSystemInteractions('boss_transcendence', 1.0);
        }

        this.chaosLevel = 100; // Maximum chaos for boss fights
        console.log(`🐲🌌 BOSS REALITY RIFT! PREPARE FOR DIMENSIONAL WARFARE!`);
    }

    spawnBeatChallenge(intensity) {
        // Generate geometric challenges synchronized to beat
        // Use hypertetrahedron precision mode for timing challenges
        if (this.visualizer && this.visualizer.setTacticalInfo) {
            this.visualizer.setTacticalInfo('precision_required', intensity);
        }

        // Activate hypertetrahedron mode for maximum precision feedback
        if (this.visualizer && this.visualizer.activateHypertetrahedronMode) {
            this.visualizer.activateHypertetrahedronMode();
        }

        console.log(`🎵🔍 BEAT CHALLENGE: Precision mode activated with intensity ${intensity.toFixed(2)}`);
    }

    spawnEnemyWave(intensity) {
        // Spawn enemies that player must dodge/hit in rhythm
        // Visual feedback through glitch storm and tactical info
        if (this.visualizer && this.visualizer.setTacticalInfo) {
            this.visualizer.setTacticalInfo('enemy_proximity', intensity);
        }

        // Trigger tactical glitch storm to communicate danger
        if (this.visualizer && this.visualizer.triggerTacticalGlitchStorm) {
            this.visualizer.triggerTacticalGlitchStorm(intensity);
        }

        console.log(`👹🔍 ENEMY WAVE: Tactical glitch storm activated with intensity ${intensity.toFixed(2)}`);
    }

    updateHUD() {
        // Update REAL GAME STATE - NOT PARAMETERS!
        document.getElementById('score').textContent = this.score.toLocaleString();
        document.getElementById('combo').textContent = `${this.comboMultiplier}x`;
        document.getElementById('level').textContent = `${this.currentLevel}-1`;

        // Health bar
        document.getElementById('health').style.width = `${this.health}%`;

        // Chaos level indicator
        document.getElementById('chaos').style.width = `${this.chaosLevel}%`;

        // Show current geometry based on level/game state, not parameters
        const geometryNames = ['HYPERCUBE', 'HYPERSPHERE', 'HYPERTETRAHEDRON', 'KLEIN BOTTLE', 'FRACTAL', 'WAVE', 'CRYSTAL', 'TORUS'];
        const currentGeometry = geometryNames[this.currentLevel % geometryNames.length];
        document.getElementById('geometry-display').textContent = currentGeometry;

        // Dimension meter shows game progression
        const progressPercent = ((this.currentLevel - 1) % 10) * 10; // 0-90% per 10 levels
        document.querySelector('#dimension-meter .meter-fill').style.width = `${progressPercent}%`;
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

    setupDemoMode() {
        // Add keyboard controls for testing bombastic effects
        document.addEventListener('keydown', (e) => {
            if (this.gameState !== 'playing') return;

            switch(e.key.toLowerCase()) {
                case '1':
                    this.triggerBeatEvent(0.8);
                    break;
                case '2':
                    this.triggerComboEvent(0.7);
                    break;
                case '3':
                    this.takeDamage(25);
                    break;
                case '4':
                    this.collectPowerUp('ENERGY_SURGE', 0.8);
                    break;
                case '5':
                    this.levelUp();
                    break;
                case '6':
                    this.gameUI.showPerfectHit();
                    // Activate perfect moment tactical info for crystal clear precision
                    if (this.visualizer && this.visualizer.setTacticalInfo) {
                        this.visualizer.setTacticalInfo('perfect_moment', 1.0);
                    }
                    // 💫🔍 CROSS-SYSTEM PERFECT PRECISION HIGHLIGHTING 🔍💫
                    if (this.visualizer && this.visualizer.highlightSystemInteractions) {
                        this.visualizer.highlightSystemInteractions('perfect_precision', 1.0);
                    }
                    break;
                case '7':
                    this.enterBossMode();
                    break;
                default:
                    break;
            }
        });

        console.log('🎮🔥 DEMO MODE ACTIVATED! Use keys 1-7 to test BOMBASTIC effects! 🔥🎮');
        console.log('1: Beat Event | 2: Combo | 3: Damage | 4: Power-Up | 5: Level Up | 6: Perfect Hit | 7: Boss Mode');
    }

    startAutoDemo() {
        // Immediately start visual demonstration even without audio
        console.log('🚀💥 AUTO-DEMO: Starting immediate visual showcase!');

        // Start the game loop in demo mode
        this.gameState = 'playing';
        this.startGameLoop();

        // Auto-trigger events for demonstration
        let demoStep = 0;
        const demoInterval = setInterval(() => {
            if (this.gameState !== 'playing') return;

            switch (demoStep % 7) {
                case 0:
                    this.triggerBeatEvent(0.8);
                    this.spawnBeatChallenge(0.8);
                    break;
                case 1:
                    this.triggerComboEvent(0.7);
                    break;
                case 2:
                    this.collectPowerUp('ENERGY_SURGE', 0.9);
                    break;
                case 3:
                    this.triggerBeatEvent(1.0);
                    break;
                case 4:
                    this.triggerEnemySpawnEvent(0.6);
                    break;
                case 5:
                    this.triggerComboEvent(0.9);
                    break;
                case 6:
                    this.levelUp();
                    demoStep = -1; // Reset after level up
                    break;
            }

            // Simulate audio reactive data for visualization
            window.audioReactive = {
                bass: Math.random() * 0.8 + 0.2,
                mid: Math.random() * 0.7 + 0.3,
                high: Math.random() * 0.9 + 0.1,
                energy: Math.random() * 0.8 + 0.2
            };

            // Update visualizer with simulated audio
            this.updateVisualizerFromAudio();

            demoStep++;
        }, 800 + Math.random() * 400); // Variable timing for natural feel

        // Synthetic beat generation
        setInterval(() => {
            if (this.gameState === 'playing') {
                this.handleBeat({
                    energy: Math.random() * 0.8 + 0.2,
                    time: performance.now(),
                    source: 'synthetic'
                });
            }
        }, 500); // 120 BPM

        // Store interval for cleanup
        this.demoInterval = demoInterval;

        console.log('🎵💥 AUTO-DEMO: Synthetic beats and effects running!');
    }
}

export { VIB34DRhythmGame };