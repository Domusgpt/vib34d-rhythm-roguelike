import { LatticePulseGame } from './game/LatticePulseGame.js';

class GameBootstrap {
    constructor() {
        this.visualizerRoot = document.getElementById('visualizer-root');
        this.hudElement = document.getElementById('hud');
        this.startScreen = document.getElementById('start-screen');
        this.pauseMenu = document.getElementById('pause-menu');
        this.startButton = document.getElementById('start-game');
        this.sourceButtons = Array.from(document.querySelectorAll('.source-btn'));
        this.fileInput = document.getElementById('audio-file');
        this.streamInput = document.getElementById('stream-url');
        this.resumeButton = document.getElementById('resume');
        this.restartButton = document.getElementById('restart');
        this.quitButton = document.getElementById('quit');
        this.dimensionFill = document.getElementById('dimension-fill');
        this.chaosDisplay = document.getElementById('chaos-display');
        this.bassBand = document.getElementById('bass-band');
        this.midBand = document.getElementById('mid-band');
        this.highBand = document.getElementById('high-band');

        this.game = null;
        this.gameInitialized = false;
        this.audioAnalyserDisposer = null;
        this.audioErrorDisposer = null;
        this.selectedAudio = null;
        this.isStarting = false;
        this.state = 'menu';
        this.statusMessage = document.getElementById('start-status');
        this.errorMessage = document.getElementById('start-error');
        this.defaultStartLabel = this.startButton?.textContent || 'START GAME';
        this.visibilityHandler = () => this.handleVisibilityChange();

        document.addEventListener('visibilitychange', this.visibilityHandler);
        this.bindUI();
        this.updateStartButtonState();
    }

    bindUI() {
        this.sourceButtons.forEach(button => {
            button.addEventListener('click', () => this.selectAudioSource(button));
        });

        if (this.fileInput) {
            this.fileInput.addEventListener('change', event => {
                const file = event.target.files?.[0] || null;
                this.handleFileSelection(file);
            });
        }

        if (this.streamInput) {
            this.streamInput.addEventListener('input', event => {
                const value = event.target.value;
                this.handleStreamInput(value);
            });
        }

        if (this.startButton) {
            this.startButton.addEventListener('click', () => {
                this.startGame().catch(error => this.handleAudioError(error));
            });
        }

        if (this.resumeButton) {
            this.resumeButton.addEventListener('click', () => {
                this.resumeGame().catch(error => this.handleAudioError(error));
            });
        }

        if (this.restartButton) {
            this.restartButton.addEventListener('click', () => {
                this.restartLevel().catch(error => this.handleAudioError(error));
            });
        }

        if (this.quitButton) {
            this.quitButton.addEventListener('click', () => {
                this.quitToMenu().catch(error => this.handleAudioError(error));
            });
        }

        document.addEventListener('keydown', event => {
            if (event.code === 'Space') {
                if (['INPUT', 'TEXTAREA'].includes(event.target.tagName)) {
                    return;
                }
                event.preventDefault();
                this.togglePause();
            }
        });
    }

    handleFileSelection(file) {
        if (this.selectedAudio?.type !== 'file') {
            this.selectedAudio = { type: 'file', data: null };
        }

        if (file) {
            this.selectedAudio = { type: 'file', data: file };
            this.clearError();
            this.showStatus(`Loaded ${file.name}`, 'success');
        } else if (this.selectedAudio) {
            this.selectedAudio.data = null;
            this.showStatus('Choose an audio file to begin.', 'info');
        }

        this.updateStartButtonState();
    }

    handleStreamInput(value) {
        const trimmed = value?.trim() || '';

        if (this.selectedAudio?.type !== 'stream') {
            this.selectedAudio = { type: 'stream', data: null };
        }

        if (!trimmed) {
            if (this.selectedAudio) {
                this.selectedAudio.data = null;
            }
            this.showStatus('Paste a direct stream URL to enable start.', 'info');
            this.clearError();
        } else if (!this.isValidStreamUrl(trimmed)) {
            this.selectedAudio.data = null;
            this.showError('Enter a valid https:// audio stream URL.');
        } else {
            this.selectedAudio.data = trimmed;
            this.clearError();
            this.showStatus('Stream source linked. Press start to connect.', 'success');
        }

        this.updateStartButtonState();
    }

    showStatus(message, tone = 'info') {
        if (!this.statusMessage) return;
        this.statusMessage.textContent = message;
        this.statusMessage.classList.remove('success', 'warning');
        if (tone === 'success' || tone === 'warning') {
            this.statusMessage.classList.add(tone);
        }
    }

    showError(message) {
        if (this.errorMessage) {
            this.errorMessage.textContent = message;
        }
    }

    clearError() {
        if (this.errorMessage) {
            this.errorMessage.textContent = '';
        }
    }

    getStartButtonLabel(canStart) {
        if (!canStart || !this.selectedAudio) {
            return this.defaultStartLabel;
        }

        const map = {
            mic: 'Start with Microphone',
            file: 'Start with File',
            stream: 'Start with Stream'
        };

        return map[this.selectedAudio.type] || this.defaultStartLabel;
    }

    isValidStreamUrl(value) {
        try {
            const url = new URL(value);
            return url.protocol === 'https:' || url.protocol === 'http:';
        } catch (error) {
            return false;
        }
    }

    selectAudioSource(button) {
        const type = button.dataset.source;
        this.selectedAudio = { type, data: null };
        this.sourceButtons.forEach(btn => btn.classList.toggle('active', btn === button));
        if (this.fileInput) {
            this.fileInput.style.display = type === 'file' ? 'block' : 'none';
            if (type !== 'file') {
                this.fileInput.value = '';
            }
        }
        if (this.streamInput) {
            this.streamInput.style.display = type === 'stream' ? 'block' : 'none';
            if (type !== 'stream') {
                this.streamInput.value = '';
            }
        }
        if (type === 'mic') {
            this.selectedAudio.data = null;
        }
        this.clearError();
        switch (type) {
            case 'mic':
                this.showStatus('Microphone selected. Permission will be requested on start.', 'warning');
                if (!navigator.mediaDevices?.getUserMedia) {
                    this.showError('Microphone input is not supported in this browser.');
                }
                break;
            case 'file':
                this.showStatus('Choose an audio file to feed the lattice.', 'info');
                break;
            case 'stream':
                this.handleStreamInput(this.streamInput?.value || '');
                break;
            default:
                this.showStatus('Select an audio source to begin.', 'info');
        }
        this.updateStartButtonState();
    }

    updateStartButtonState() {
        if (!this.startButton) return;
        const canStart = this.canStart();
        this.startButton.disabled = !canStart;
        if (!this.startButton.classList.contains('loading')) {
            this.startButton.textContent = this.getStartButtonLabel(canStart);
        }
    }

    canStart() {
        if (!this.selectedAudio) return false;
        switch (this.selectedAudio.type) {
            case 'mic':
                return true;
            case 'file':
            case 'stream':
                return Boolean(this.selectedAudio.data) && (this.selectedAudio.type !== 'stream' || this.isValidStreamUrl(this.selectedAudio.data));
            default:
                return false;
        }
    }

    async ensureGame() {
        if (this.gameInitialized) {
            return;
        }
        if (!this.visualizerRoot || !this.hudElement) {
            throw new Error('Missing required game DOM nodes');
        }
        this.game = new LatticePulseGame({ container: this.visualizerRoot, hudElement: this.hudElement });
        await this.game.start();
        this.bindAudioServiceListeners();
        this.gameInitialized = true;
        this.updateParameterHud();
    }

    bindAudioServiceListeners() {
        if (!this.game?.audioService) return;
        this.cleanupAudioHandlers();
        this.audioAnalyserDisposer = this.game.audioService.onAnalyser(() => {
            this.updateAudioBars(this.game.audioService.getBandLevels());
            this.updateParameterHud();
        });
        this.audioErrorDisposer = this.game.audioService.onError(event => {
            this.handleAudioError(event.error, event);
        });
    }

    cleanupAudioHandlers() {
        if (this.audioAnalyserDisposer) {
            this.audioAnalyserDisposer();
            this.audioAnalyserDisposer = null;
        }
        if (this.audioErrorDisposer) {
            this.audioErrorDisposer();
            this.audioErrorDisposer = null;
        }
    }

    handleAudioError(error, detail = {}) {
        if (!error) return;
        console.error('Audio error:', error);
        const message = this.describeAudioError(error, detail);
        this.showError(message);

        if (detail?.type === 'permissions') {
            this.showStatus('Microphone access denied. Update permissions and try again.', 'warning');
        } else if (this.state === 'playing') {
            this.showStatus('Audio interrupted. Game paused until the source recovers.', 'warning');
        }

        if (this.state === 'playing') {
            this.pauseGame({ reason: 'error' }).catch(err => console.error(err));
            this.pauseMenu?.classList.add('active');
        } else if (this.state === 'menu') {
            this.startScreen?.classList.add('active');
        }
        this.updateStartButtonState();
    }

    describeAudioError(error, detail = {}) {
        if (!error) return 'Unknown audio error encountered.';
        if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
            return 'Access to the audio input was blocked by the browser.';
        }
        if (error.name === 'NotFoundError') {
            return 'No audio input device was found.';
        }
        if (detail?.type === 'stream' && detail?.context?.url) {
            return `Could not load audio from ${detail.context.url}. (${error.message || error.name})`;
        }
        if (detail?.type === 'file' && detail?.context?.name) {
            return `The selected file "${detail.context.name}" could not be decoded.`;
        }
        if (error.message) {
            return error.message;
        }
        return error.name || String(error);
    }

    handleVisibilityChange() {
        if (document.hidden && this.state === 'playing') {
            this.pauseGame({ reason: 'visibility' }).catch(err => console.error(err));
        }
    }

    async prepareAudioSource() {
        if (!this.game?.audioService || !this.selectedAudio) {
            throw new Error('Audio source not ready');
        }
        const audioService = this.game.audioService;
        const { type, data } = this.selectedAudio;
        switch (type) {
            case 'mic':
                this.showStatus('Requesting microphone access…', 'warning');
                await audioService.initializeMicrophone();
                await audioService.play();
                break;
            case 'file':
                if (!data) throw new Error('Select an audio file before starting');
                this.showStatus('Loading audio file…', 'info');
                await audioService.loadFile(data);
                await audioService.play();
                break;
            case 'stream':
                if (!data) throw new Error('Provide a stream URL before starting');
                this.showStatus('Connecting to stream…', 'info');
                await audioService.loadStream(data);
                await audioService.play();
                break;
            default:
                throw new Error('Select an audio input before starting');
        }
    }

    async startGame() {
        if (this.state === 'playing' || this.isStarting) {
            return;
        }
        if (!this.canStart()) {
            this.showError('Select an audio source to begin.');
            return;
        }

        this.isStarting = true;
        if (this.startButton) {
            this.startButton.disabled = true;
            this.startButton.classList.add('loading');
            this.startButton.textContent = 'Initializing…';
        }

        try {
            this.clearError();
            this.showStatus('Booting game systems…', 'info');
            await this.ensureGame();
            await this.prepareAudioSource();
            this.game.resetRun();
            await this.game.resume();
            this.state = 'playing';
            this.startScreen?.classList.remove('active');
            this.pauseMenu?.classList.remove('active');
            this.showStatus('Audio locked. Space pauses, long press bends space.', 'success');
            this.clearError();
        } catch (error) {
            console.error('Failed to start game:', error);
            this.state = 'menu';
            const type = error?.name === 'NotAllowedError' ? 'permissions' : this.selectedAudio?.type;
            const detail = {
                type,
                context:
                    this.selectedAudio?.type === 'file'
                        ? { name: this.selectedAudio.data?.name }
                        : this.selectedAudio?.type === 'stream'
                        ? { url: this.selectedAudio.data }
                        : {}
            };
            this.handleAudioError(error, detail);
        } finally {
            this.isStarting = false;
            if (this.startButton) {
                this.startButton.classList.remove('loading');
                this.startButton.textContent = this.getStartButtonLabel(this.canStart());
            }
            this.updateStartButtonState();
        }
    }

    async pauseGame({ reason = 'manual' } = {}) {
        if (!this.game || this.state !== 'playing') return;
        try {
            await this.game.pause();
        } catch (error) {
            console.error('Pause failed:', error);
            this.showError(error.message || 'Failed to pause audio.');
            return;
        }
        this.state = 'paused';
        this.pauseMenu?.classList.add('active');
        if (reason === 'visibility') {
            this.game?.hud?.showToast?.('Paused — tab inactive');
            this.showStatus('Paused because the tab is hidden.', 'warning');
        } else if (reason === 'manual') {
            this.showStatus('Paused. Press resume or Space to continue.', 'info');
        }
    }

    async resumeGame() {
        if (!this.game || this.state !== 'paused') return;
        try {
            await this.game.resume();
        } catch (error) {
            this.handleAudioError(error);
            return;
        }
        this.state = 'playing';
        this.pauseMenu?.classList.remove('active');
        this.showStatus('Back in the grid. Space pauses.', 'success');
        this.clearError();
    }

    async restartLevel() {
        if (!this.game) return;
        this.game.resetRun();
        try {
            await this.game.resume();
        } catch (error) {
            this.handleAudioError(error);
            return;
        }
        this.state = 'playing';
        this.pauseMenu?.classList.remove('active');
        this.showStatus('Run restarted with the same audio source.', 'info');
        this.clearError();
    }

    async quitToMenu() {
        if (!this.game) return;
        this.cleanupAudioHandlers();
        try {
            await this.game.shutdown();
        } catch (error) {
            console.error('Failed to shutdown game cleanly:', error);
        }
        this.state = 'menu';
        this.pauseMenu?.classList.remove('active');
        this.startScreen?.classList.add('active');
        if (typeof window !== 'undefined') {
            window.audioReactive = { bass: 0, mid: 0, high: 0, energy: 0 };
        }
        this.updateAudioBars({ bass: 0, mid: 0, high: 0, energy: 0 });
        this.updateParameterHud();
        this.showStatus('Select an audio source to launch another run.', 'info');
        this.clearError();
        this.updateStartButtonState();
    }

    togglePause() {
        if (this.state === 'playing') {
            this.pauseGame().catch(error => this.handleAudioError(error));
        } else if (this.state === 'paused') {
            this.resumeGame().catch(error => this.handleAudioError(error));
        }
    }

    updateAudioBars(levels) {
        if (!levels) return;
        const clamp = value => Math.max(0, Math.min(1, value));
        if (this.bassBand) {
            this.bassBand.style.height = `${clamp(levels.bass * 1.4) * 100}%`;
        }
        if (this.midBand) {
            this.midBand.style.height = `${clamp(levels.mid * 1.2) * 100}%`;
        }
        if (this.highBand) {
            this.highBand.style.height = `${clamp(levels.high * 1.1) * 100}%`;
        }
    }

    updateParameterHud() {
        if (!this.game) return;
        const params = this.game.modeController.getParameters();
        if (this.dimensionFill && typeof params.dimension === 'number') {
            const percent = Math.max(0, Math.min(1, (params.dimension - 3) / 1.5));
            this.dimensionFill.style.setProperty('--dimension-level', percent.toFixed(3));
            this.dimensionFill.style.transform = `scaleX(${percent})`;
        }
        if (this.chaosDisplay && typeof params.chaos === 'number') {
            this.chaosDisplay.textContent = params.chaos.toFixed(2);
        }
        const geometryValue = this.hudElement?.querySelector('[data-hud="geometry"]');
        const geometryIndicator = this.hudElement?.querySelector('.geometry-indicator');
        if (geometryValue && geometryIndicator) {
            geometryIndicator.textContent = geometryValue.textContent;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GameBootstrap();
});
