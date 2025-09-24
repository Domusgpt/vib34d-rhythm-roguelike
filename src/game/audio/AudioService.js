const DEFAULT_BPM = 120;

export class AudioService {
    constructor() {
        this.context = null;
        this.analyser = null;
        this.source = null;
        this.trackBuffer = null;
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.fftSize = 2048;
        this.frequencyData = null;
        this.timeDomainData = null;
        this.listeners = { beat: new Set(), analyser: new Set() };
        this.lastBeatTime = 0;
        this.bpm = DEFAULT_BPM;
        this.metronomePhase = 0;
        this.beatThreshold = 1.4;
        this.energyHistory = [];
        this.historySize = 43; // ~0.7 seconds at 60fps
        this.metronomeEnabled = true;
        this.latencyHint = 'interactive';
        this.targetSampleRate = null;
        this.qualityPreset = 'standard';
        this.analysisSmoothing = 0.8;
        this.volumeCeiling = 0.85;
    }

    async init() {
        if (this.context) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const options = {};
        if (this.latencyHint) options.latencyHint = this.latencyHint;
        if (this.targetSampleRate) options.sampleRate = this.targetSampleRate;

        try {
            this.context = new AudioContextClass(options);
        } catch (error) {
            console.warn('Falling back to default AudioContext', error);
            this.context = new AudioContextClass();
        }
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = this.analysisSmoothing;
        this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Float32Array(this.analyser.fftSize);
        this.gainNode = this.context.createGain();
        this.gainNode.gain.value = this.volumeCeiling;
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.context.destination);
    }

    async loadTrack(url) {
        await this.init();
        this.stop();
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        this.trackBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.resetState();
    }

    useBuffer(buffer) {
        this.trackBuffer = buffer;
        this.resetState();
    }

    async initializeMicrophone() {
        await this.init();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            this.microphoneSource = this.context.createMediaStreamSource(stream);
            this.microphoneSource.connect(this.analyser);
            this.isPlaying = true;

            console.log('Microphone initialized successfully');
        } catch (error) {
            console.error('Failed to initialize microphone:', error);
            throw new Error('Microphone access denied or not available');
        }
    }

    async loadFile(file) {
        await this.init();
        this.stop();

        try {
            const arrayBuffer = await file.arrayBuffer();
            this.trackBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.resetState();
            console.log('Audio file loaded successfully');
        } catch (error) {
            console.error('Failed to load audio file:', error);
            throw new Error('Invalid audio file format');
        }
    }

    resetState() {
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.metronomePhase = 0;
        this.lastBeatTime = 0;
        this.energyHistory = [];
    }

    play() {
        if (!this.trackBuffer || !this.context) {
            return;
        }

        if (this.isPlaying) return;

        this.source = this.context.createBufferSource();
        this.source.buffer = this.trackBuffer;
        this.source.connect(this.analyser);
        const offset = this.pauseTime || 0;
        this.source.start(0, offset);
        this.startTime = this.context.currentTime - offset;
        this.isPlaying = true;
        this.source.onended = () => {
            this.isPlaying = false;
            this.pauseTime = 0;
        };
    }

    pause() {
        if (!this.isPlaying) return;
        this.pauseTime = this.context.currentTime - this.startTime;
        this.stopSource();
    }

    stop() {
        if (!this.context) return;
        this.pauseTime = 0;
        this.stopSource();
        this.isPlaying = false;
    }

    stopSource() {
        if (this.source) {
            try {
                this.source.stop(0);
            } catch (e) {
                console.warn('Audio stop error:', e);
            }
            this.source.disconnect();
            this.source = null;
        }
    }

    setVolume(value) {
        if (this.gainNode) {
            const clamped = Math.max(0, Math.min(this.volumeCeiling, value));
            this.gainNode.gain.value = clamped;
        }
    }

    setBpm(bpm) {
        this.bpm = bpm || DEFAULT_BPM;
    }

    enableMetronome(enabled) {
        this.metronomeEnabled = enabled;
    }

    setLatencyHint(latencyHint, sampleRate) {
        this.latencyHint = latencyHint || this.latencyHint;
        this.targetSampleRate = sampleRate ?? this.targetSampleRate;
        if (this.context) {
            this.rebuildAudioGraph();
        }
    }

    async rebuildAudioGraph() {
        if (!this.context) return this.init();

        const wasPlaying = this.isPlaying;
        const resumeOffset = this.isPlaying
            ? this.context.currentTime - this.startTime
            : this.pauseTime;

        this.stop();

        try {
            await this.context.close();
        } catch (error) {
            console.warn('Failed to close AudioContext cleanly', error);
        }

        this.context = null;
        await this.init();

        if (this.trackBuffer) {
            this.pauseTime = resumeOffset;
            if (wasPlaying) {
                this.play();
            }
        }
    }

    setQualityPreset(preset) {
        const presets = {
            ultra: { fftSize: 4096, smoothing: 0.7, gain: 0.95 },
            mobile: { fftSize: 2048, smoothing: 0.8, gain: 0.85 },
            battery: { fftSize: 1024, smoothing: 0.9, gain: 0.75 },
            standard: { fftSize: 2048, smoothing: 0.8, gain: 0.85 }
        };

        const config = presets[preset] || presets.standard;
        this.qualityPreset = preset || 'standard';
        this.fftSize = config.fftSize;
        this.analysisSmoothing = config.smoothing;
        this.volumeCeiling = config.gain;

        if (this.analyser) {
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = this.analysisSmoothing;
            this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
            this.timeDomainData = new Float32Array(this.analyser.fftSize);
        }

        if (this.gainNode) {
            this.setVolume(this.gainNode.gain.value);
        }
    }

    onBeat(callback) {
        this.listeners.beat.add(callback);
        return () => this.listeners.beat.delete(callback);
    }

    onAnalyser(callback) {
        this.listeners.analyser.add(callback);
        return () => this.listeners.analyser.delete(callback);
    }

    update(dt) {
        if (!this.analyser) return;

        this.analyser.getFloatFrequencyData(this.frequencyData);
        this.analyser.getFloatTimeDomainData(this.timeDomainData);

        const energy = this.computeEnergy(this.frequencyData);
        this.energyHistory.push(energy);
        if (this.energyHistory.length > this.historySize) {
            this.energyHistory.shift();
        }

        const meanEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / (this.energyHistory.length || 1);
        const threshold = meanEnergy * this.beatThreshold;

        const currentTime = this.context ? this.context.currentTime : 0;
        const timeSinceLastBeat = currentTime - this.lastBeatTime;
        const beatInterval = 60 / this.bpm;

        const beatDetected = energy > threshold && timeSinceLastBeat > beatInterval * 0.5;

        if (beatDetected) {
            this.lastBeatTime = currentTime;
            this.emitBeat({ energy, time: currentTime, source: 'audio' });
        } else if (this.metronomeEnabled && timeSinceLastBeat > beatInterval) {
            this.lastBeatTime = currentTime;
            this.emitBeat({ energy: meanEnergy, time: currentTime, source: 'metronome' });
        }

        this.listeners.analyser.forEach(cb => cb({
            frequencyData: this.frequencyData,
            timeDomainData: this.timeDomainData,
            energy,
            meanEnergy
        }));
    }

    computeEnergy(frequencyData) {
        let sum = 0;
        const len = frequencyData.length;
        for (let i = 0; i < len; i++) {
            const value = frequencyData[i];
            if (value !== -Infinity) {
                sum += Math.pow(10, value / 20);
            }
        }
        return sum / len;
    }

    emitBeat(event) {
        this.listeners.beat.forEach(cb => cb(event));
    }

    getBandLevels() {
        if (!this.frequencyData) {
            return { bass: 0, mid: 0, high: 0, energy: 0 };
        }

        const bassEnd = Math.floor(this.frequencyData.length * 0.08);
        const midEnd = Math.floor(this.frequencyData.length * 0.4);

        let bass = 0;
        let mid = 0;
        let high = 0;

        for (let i = 0; i < this.frequencyData.length; i++) {
            const value = this.frequencyData[i];
            if (value === -Infinity) continue;
            const amplitude = Math.pow(10, value / 20);
            if (i < bassEnd) {
                bass += amplitude;
            } else if (i < midEnd) {
                mid += amplitude;
            } else {
                high += amplitude;
            }
        }

        return {
            bass: bass / bassEnd || 0,
            mid: mid / (midEnd - bassEnd || 1),
            high: high / (this.frequencyData.length - midEnd || 1),
            energy: this.energyHistory.length
                ? this.energyHistory[this.energyHistory.length - 1]
                : 0
        };
    }

    playTransientAccent({ frequency = 440, intensity = 0.6, duration = 0.18, type = 'sine', sweep = 0 } = {}) {
        if (!this.context || !this.gainNode) {
            this.init?.().catch(() => {});
        }
        if (!this.context || !this.gainNode) {
            return;
        }

        const now = this.context.currentTime;
        const safeDuration = Math.max(0.05, duration);

        if (type === 'noise') {
            const length = Math.max(1, Math.floor(this.context.sampleRate * safeDuration));
            const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < length; i++) {
                const fade = 1 - i / length;
                data[i] = (Math.random() * 2 - 1) * fade;
            }
            const source = this.context.createBufferSource();
            source.buffer = buffer;
            const gain = this.context.createGain();
            const targetGain = Math.min(0.25, 0.05 + intensity * 0.15);
            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(targetGain, now + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + safeDuration);
            source.connect(gain);
            gain.connect(this.gainNode);
            source.start(now);
            source.stop(now + safeDuration + 0.05);
            return;
        }

        const osc = this.context.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, now);
        if (sweep) {
            osc.frequency.linearRampToValueAtTime(frequency + sweep, now + safeDuration);
        }

        const gain = this.context.createGain();
        const peak = Math.min(0.2, 0.03 + intensity * 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(peak, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + safeDuration);
        osc.connect(gain);
        gain.connect(this.gainNode);
        osc.start(now);
        osc.stop(now + safeDuration + 0.05);
    }
}
