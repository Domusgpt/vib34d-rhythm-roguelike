/**
 * MobileOptimizationManager
 * ---------------------------------------------
 * Dedicated orchestration layer that adapts the experience to mobile hardware.
 * It inspects the device profile, configures rendering scale, audio analysis
 * quality, and exposes UX hooks (graphics presets, haptics, tilt controls).
 */

export class MobileOptimizationManager {
    constructor({ canvas, visualizer, parameterManager, audioService, startScreen, onPreferenceChanged }) {
        this.canvas = canvas;
        this.visualizer = visualizer;
        this.parameterManager = parameterManager;
        this.audioService = audioService;
        this.startScreen = startScreen;
        this.onPreferenceChanged = onPreferenceChanged;

        this.isMobile = false;
        this.deviceProfile = 'desktop';
        this.graphicsProfile = 'auto';
        this.preferredRenderScale = 1;
        this.frameSamples = [];
        this.hapticsEnabled = false;
        this.tiltEnabled = true;
        this.motionPermissionRequested = false;

        this.performanceLabel = document.getElementById('mobile-performance-status');
        this.latencyLabel = document.getElementById('latency-value');
        this.orientationBanner = document.getElementById('orientation-warning');
        this.graphicsButtons = Array.from(document.querySelectorAll('[data-graphics-profile]'));
        this.hapticsButton = document.getElementById('toggle-haptics');
        this.tiltButton = document.getElementById('toggle-tilt');
    }

    async initialize() {
        this.detectDeviceProfile();
        this.applyDeviceDefaults();
        this.setupOrientationWatcher();
        this.bindUiControls();
    }

    detectDeviceProfile() {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') {
            this.isMobile = false;
            this.deviceProfile = 'desktop';
            this.preferredRenderScale = 1;
            return;
        }

        const ua = navigator.userAgent || '';
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 1;
        const smallestSide = Math.min(window.innerWidth, window.innerHeight);
        this.isMobile = /Mobi|Android|iP(ad|hone|od)/i.test(ua) || (isTouch && smallestSide < 1024);

        if (!this.isMobile) {
            this.deviceProfile = 'desktop';
            this.preferredRenderScale = 1;
            return;
        }

        const deviceMemory = navigator.deviceMemory || 4;
        const cores = navigator.hardwareConcurrency || 4;

        if (deviceMemory >= 8 && cores >= 8) {
            this.deviceProfile = 'flagship';
            this.preferredRenderScale = 1.05;
        } else if (deviceMemory >= 4 && cores >= 6) {
            this.deviceProfile = 'performance';
            this.preferredRenderScale = 0.9;
        } else {
            this.deviceProfile = 'battery';
            this.preferredRenderScale = 0.75;
        }

        const dpr = window.devicePixelRatio || 1;
        if (dpr > 1.5) {
            this.preferredRenderScale /= dpr / 1.5;
        }

        this.preferredRenderScale = Math.max(0.55, Math.min(1.1, this.preferredRenderScale));
    }

    applyDeviceDefaults() {
        if (!this.isMobile || typeof document === 'undefined') return;

        document.body.classList.add('mobile-experience');
        window.tiltInputEnabled = true;

        if (this.visualizer?.setRenderScale) {
            this.visualizer.setRenderScale(this.preferredRenderScale);
        }

        const initialProfile = this.deviceProfile === 'flagship'
            ? 'ultra'
            : this.deviceProfile === 'performance'
                ? 'auto'
                : 'battery';

        this.setGraphicsProfile(initialProfile, false);
        this.updateLatencyDisplay(this.audioService?.latencyHint || 'interactive');
    }

    bindUiControls() {
        if (!this.isMobile) return;

        this.graphicsButtons.forEach(button => {
            button.addEventListener('click', () => {
                const profile = button.dataset.graphicsProfile;
                this.setGraphicsProfile(profile);
            });
        });

        if (this.hapticsButton) {
            this.hapticsButton.addEventListener('click', () => {
                this.toggleHaptics();
            });
        }

        if (this.tiltButton) {
            this.tiltButton.addEventListener('click', () => {
                if (!this.motionPermissionRequested && typeof DeviceOrientationEvent !== 'undefined' &&
                    typeof DeviceOrientationEvent.requestPermission === 'function') {
                    DeviceOrientationEvent.requestPermission().finally(() => {
                        this.motionPermissionRequested = true;
                        this.toggleTilt(true);
                    });
                } else {
                    this.toggleTilt();
                }
            });
        }
    }

    setGraphicsProfile(profile, emitPreference = true) {
        if (!profile) return;

        this.graphicsProfile = profile;

        if (!this.isMobile) {
            if (emitPreference) {
                this.onPreferenceChanged?.('graphicsProfile', profile);
            }
            return;
        }

        this.graphicsButtons.forEach(button => {
            button.classList.toggle('active', button.dataset.graphicsProfile === profile);
        });

        let renderScale = this.preferredRenderScale;
        let parameterOverrides = {};
        let audioPreset = 'standard';

        switch (profile) {
            case 'ultra':
                renderScale = Math.min(1.2, this.preferredRenderScale * 1.2);
                parameterOverrides = {
                    gridDensity: Math.max(this.parameterManager.getParameter('gridDensity') || 18, 24),
                    chaos: Math.min(0.35, this.parameterManager.getParameter('chaos') || 0.2),
                    intensity: 0.85,
                    saturation: 0.95
                };
                audioPreset = 'ultra';
                break;

            case 'battery':
                renderScale = Math.max(0.5, this.preferredRenderScale * 0.75);
                parameterOverrides = {
                    gridDensity: 12,
                    chaos: 0.15,
                    intensity: 0.5,
                    speed: 0.9
                };
                audioPreset = 'battery';
                break;

            default:
                renderScale = this.preferredRenderScale;
                parameterOverrides = {
                    gridDensity: 18,
                    chaos: 0.22,
                    intensity: 0.65,
                    speed: 1.0
                };
                audioPreset = 'mobile';
                break;
        }

        if (this.visualizer?.setRenderScale) {
            this.visualizer.setRenderScale(renderScale);
        }

        if (this.parameterManager?.applyProfile) {
            this.parameterManager.applyProfile(parameterOverrides);
        }

        if (this.audioService?.setQualityPreset) {
            this.audioService.setQualityPreset(audioPreset);
        }

        this.updateLatencyDisplay(this.audioService?.latencyHint || 'interactive');

        if (emitPreference) {
            this.onPreferenceChanged?.('graphicsProfile', profile);
        }
    }

    toggleHaptics(forceValue) {
        const nextValue = typeof forceValue === 'boolean' ? forceValue : !this.hapticsEnabled;
        this.hapticsEnabled = nextValue;

        if (this.hapticsButton) {
            this.hapticsButton.classList.toggle('active', this.hapticsEnabled);
            this.hapticsButton.textContent = this.hapticsEnabled ? 'HAPTICS ✓' : 'HAPTICS';
        }

        this.onPreferenceChanged?.('hapticsEnabled', this.hapticsEnabled);
    }

    toggleTilt(forceValue) {
        const nextValue = typeof forceValue === 'boolean' ? forceValue : !this.tiltEnabled;
        this.tiltEnabled = nextValue;
        window.tiltInputEnabled = this.tiltEnabled;

        if (this.tiltButton) {
            this.tiltButton.classList.toggle('active', this.tiltEnabled);
            this.tiltButton.textContent = this.tiltEnabled ? 'TILT ✓' : 'TILT';
        }

        this.onPreferenceChanged?.('tiltEnabled', this.tiltEnabled);
    }

    pulseHaptics(tag, intensity = 0.5, extras = {}) {
        if (!this.hapticsEnabled) return;
        if (typeof navigator === 'undefined' || !navigator.vibrate) return;

        const magnitude = Math.min(40, Math.max(6, Math.round(12 + intensity * 28)));
        let pattern;

        switch (tag) {
            case 'beat':
                pattern = extras.source === 'metronome'
                    ? [0, Math.max(6, Math.round(magnitude * 0.6))]
                    : [0, magnitude];
                break;
            case 'challenge':
                pattern = [0, magnitude, 50, Math.round(magnitude * 0.6)];
                break;
            case 'surge':
                pattern = [0, magnitude, 40, Math.round(magnitude * 0.5)];
                break;
            case 'danger':
                pattern = [0, magnitude, 60, magnitude, 120, Math.round(magnitude * 0.7)];
                break;
            case 'combo':
                pattern = [0, magnitude, 35, magnitude, 70, Math.round(magnitude * 0.7)];
                break;
            case 'comboBreak':
                pattern = [0, magnitude, 60, magnitude, 160, Math.round(magnitude * 0.9)];
                break;
            case 'level':
                pattern = [0, magnitude, 50, magnitude, 100, magnitude];
                break;
            case 'geometry':
                pattern = [0, magnitude, 40, Math.round(magnitude * 0.7)];
                break;
            case 'flow':
                pattern = [0, magnitude, 70, Math.round(magnitude * 0.6)];
                break;
            case 'momentum':
                pattern = [0, magnitude, 40, magnitude, 120, Math.round(magnitude * 0.8)];
                break;
            case 'momentumDip':
                pattern = [0, Math.round(magnitude * 0.6), 70, Math.round(magnitude * 0.45)];
                break;
            case 'vital':
                pattern = [0, Math.round(magnitude * 0.8), 60, Math.round(magnitude * 0.5)];
                break;
            case 'score':
                pattern = [0, Math.round(magnitude * 0.7), 40, Math.round(magnitude * 0.5)];
                break;
            case 'start':
                pattern = [0, magnitude, 80, Math.round(magnitude * 0.6)];
                break;
            case 'pause':
                pattern = [0, Math.round(magnitude * 0.5)];
                break;
            case 'resume':
                pattern = [0, magnitude, 50, Math.round(magnitude * 0.6)];
                break;
            case 'quit':
                pattern = [0, Math.round(magnitude * 0.6), 60, Math.round(magnitude * 0.4)];
                break;
            default:
                pattern = [0, magnitude];
                break;
        }

        try {
            navigator.vibrate(pattern);
        } catch (error) {
            console.warn('Haptic feedback failed:', error);
        }
    }

    recordFrame(deltaTime) {
        if (!this.isMobile || !this.performanceLabel) return;

        const fps = Math.max(0, Math.min(120, Math.round(1 / Math.max(deltaTime, 0.00001))));
        this.frameSamples.push(fps);

        if (this.frameSamples.length >= 30) {
            const average = Math.round(this.frameSamples.reduce((sum, value) => sum + value, 0) / this.frameSamples.length);
            this.performanceLabel.textContent = `${average} FPS`;
            this.frameSamples = [];
        }
    }

    handleBeat(beatData) {
        this.pulseHaptics('beat', Math.min(1, beatData?.energy || 0.5), { source: beatData?.source });
    }

    updateLatencyDisplay(latencyHint) {
        if (!this.latencyLabel) return;
        this.latencyLabel.textContent = latencyHint || 'interactive';
    }

    setupOrientationWatcher() {
        if (!this.isMobile || !this.orientationBanner) return;

        const evaluateOrientation = () => {
            const landscape = window.innerWidth >= window.innerHeight;
            this.orientationBanner.classList.toggle('hidden', landscape);
        };

        window.addEventListener('resize', evaluateOrientation);
        window.addEventListener('orientationchange', evaluateOrientation);
        evaluateOrientation();
    }

    onGameStart() {
        if (!this.isMobile) return;
        this.requestWakeLock();
    }

    onReturnToMenu() {
        if (!this.isMobile) return;
        this.releaseWakeLock();
    }

    async requestWakeLock() {
        if (!('wakeLock' in navigator)) return;
        try {
            this.wakeLock = await navigator.wakeLock.request('screen');
        } catch (error) {
            console.warn('Wake lock unavailable:', error);
        }
    }

    async releaseWakeLock() {
        try {
            await this.wakeLock?.release?.();
        } catch (error) {
            console.warn('Failed to release wake lock:', error);
        }
        this.wakeLock = null;
    }
}

