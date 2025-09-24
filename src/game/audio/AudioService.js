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
        this.listeners = { beat: new Set(), analyser: new Set(), error: new Set() };
        this.lastBeatTime = 0;
        this.bpm = DEFAULT_BPM;
        this.metronomePhase = 0;
        this.beatThreshold = 1.4;
        this.energyHistory = [];
        this.historySize = 43; // ~0.7 seconds at 60fps
        this.metronomeEnabled = true;
        this.sourceType = 'buffer';
        this.streamNode = null;
        this.mediaStream = null;
        this.mediaElement = null;
        this.mediaElementSource = null;
    }

    async init() {
        if (this.context) return;
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.context.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = 0.8;
        this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Float32Array(this.analyser.fftSize);
        this.gainNode = this.context.createGain();
        this.gainNode.gain.value = 0.8;
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.context.destination);
    }

    async loadTrack(url) {
        await this.init();
        this.stop();
        this.detachMediaElement();
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Network error (${response.status})`);
            }
            const arrayBuffer = await response.arrayBuffer();
            this.trackBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.sourceType = 'buffer';
            this.resetState();
        } catch (error) {
            this.emitError('stream', error, { url });
            throw error;
        }
    }

    async loadFile(file) {
        if (!file) {
            throw new Error('No audio file provided');
        }
        await this.init();
        this.stop();
        this.detachMediaElement();
        try {
            const arrayBuffer = await file.arrayBuffer();
            this.trackBuffer = await this.context.decodeAudioData(arrayBuffer);
            this.sourceType = 'buffer';
            this.resetState();
        } catch (error) {
            this.emitError('file', error, { name: file.name });
            throw error;
        }
    }

    async initializeMicrophone() {
        await this.init();
        this.stop();
        this.detachMediaElement();
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error('Microphone input is not supported in this browser');
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });
            this.attachStream(stream);
        } catch (error) {
            this.emitError('permissions', error);
            throw error;
        }
    }

    async loadStream(url) {
        await this.init();
        this.stop();
        this.detachMediaElement();

        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.crossOrigin = 'anonymous';
            audio.preload = 'auto';
            audio.src = url;

            const cleanup = () => {
                audio.removeEventListener('canplay', onReady);
                audio.removeEventListener('error', onError);
            };

            const onReady = () => {
                cleanup();
                try {
                    const source = this.context.createMediaElementSource(audio);
                    source.connect(this.analyser);
                    this.mediaElementSource = source;
                    this.mediaElement = audio;
                    this.mediaElement.loop = false;
                    this.mediaElement.addEventListener('ended', () => {
                        this.isPlaying = false;
                    });
                    this.trackBuffer = null;
                    this.sourceType = 'media-element';
                    this.resetState();
                    resolve();
                } catch (error) {
                    this.emitError('stream', error, { url });
                    reject(error);
                }
            };

            const onError = () => {
                cleanup();
                const err = audio.error || new Error('Unknown audio stream error');
                this.emitError('stream', err, { url });
                reject(err);
            };

            audio.addEventListener('canplay', onReady, { once: true });
            audio.addEventListener('error', onError, { once: true });

            try {
                audio.load();
            } catch (error) {
                cleanup();
                this.emitError('stream', error, { url });
                reject(error);
            }
        });
    }

    attachStream(stream) {
        this.detachStream();
        this.mediaStream = stream;
        this.streamNode = this.context.createMediaStreamSource(stream);
        this.streamNode.connect(this.analyser);
        this.trackBuffer = null;
        this.sourceType = 'mic';
        this.isPlaying = true;
        this.startTime = this.context.currentTime;
        this.pauseTime = 0;
    }

    detachStream() {
        if (this.streamNode) {
            try {
                this.streamNode.disconnect();
            } catch (e) {
                console.warn('Stream disconnect error:', e);
            }
            this.streamNode = null;
        }
        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
            this.mediaStream = null;
        }
    }

    detachMediaElement() {
        if (this.mediaElementSource) {
            try {
                this.mediaElementSource.disconnect();
            } catch (error) {
                console.warn('Media element disconnect error:', error);
            }
            this.mediaElementSource = null;
        }
        if (this.mediaElement) {
            try {
                this.mediaElement.pause();
                this.mediaElement.src = '';
                this.mediaElement.load();
            } catch (error) {
                console.warn('Media element cleanup error:', error);
            }
            this.mediaElement = null;
        }
        this.pauseTime = 0;
    }

    useBuffer(buffer) {
        this.trackBuffer = buffer;
        this.sourceType = 'buffer';
        this.resetState();
    }

    resetState() {
        this.isPlaying = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.metronomePhase = 0;
        this.lastBeatTime = 0;
        this.energyHistory = [];
        this.source = null;
    }

    async play() {
        if (!this.context) {
            return;
        }

        if (this.context.state === 'suspended') {
            try {
                await this.context.resume();
            } catch (error) {
                this.emitError('context', error);
            }
        }

        if (this.sourceType === 'mic') {
            this.isPlaying = true;
            return;
        }

        if (this.sourceType === 'media-element') {
            if (!this.mediaElement) return;
            if (typeof this.pauseTime === 'number') {
                try {
                    this.mediaElement.currentTime = this.pauseTime;
                } catch (error) {
                    console.warn('Media element seek error:', error);
                }
            }
            try {
                await this.mediaElement.play();
                this.isPlaying = true;
            } catch (error) {
                this.emitError('stream', error, { url: this.mediaElement.src });
                throw error;
            }
            return;
        }

        if (!this.trackBuffer || this.isPlaying) {
            return;
        }

        this.source = this.context.createBufferSource();
        this.source.buffer = this.trackBuffer;
        this.source.connect(this.analyser);
        const offset = this.pauseTime || 0;
        try {
            this.source.start(0, offset);
        } catch (error) {
            this.emitError('buffer', error);
            throw error;
        }
        this.startTime = this.context.currentTime - offset;
        this.isPlaying = true;
        this.source.onended = () => {
            this.isPlaying = false;
            this.pauseTime = 0;
        };
    }

    async pause() {
        if (!this.context) return;

        if (this.sourceType === 'mic') {
            this.isPlaying = false;
            if (this.context.state === 'running') {
                try {
                    await this.context.suspend();
                } catch (error) {
                    this.emitError('context', error);
                }
            }
            return;
        }

        if (this.sourceType === 'media-element') {
            if (this.mediaElement) {
                try {
                    this.pauseTime = this.mediaElement.currentTime;
                    this.mediaElement.pause();
                } catch (error) {
                    this.emitError('stream', error, { url: this.mediaElement.src });
                }
            }
            this.isPlaying = false;
            return;
        }

        if (!this.isPlaying) return;
        this.pauseTime = this.context.currentTime - this.startTime;
        this.stopSource();
        this.isPlaying = false;
    }

    stop() {
        if (!this.context) return;
        this.pauseTime = 0;
        if (this.sourceType === 'mic') {
            this.detachStream();
            this.isPlaying = false;
            return;
        }
        if (this.sourceType === 'media-element') {
            if (this.mediaElement) {
                try {
                    this.mediaElement.pause();
                    this.mediaElement.currentTime = 0;
                } catch (error) {
                    console.warn('Media element stop error:', error);
                }
            }
            this.isPlaying = false;
            return;
        }
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
            this.gainNode.gain.value = value;
        }
    }

    setBpm(bpm) {
        this.bpm = bpm || DEFAULT_BPM;
    }

    enableMetronome(enabled) {
        this.metronomeEnabled = enabled;
    }

    getSourceType() {
        return this.sourceType;
    }

    onBeat(callback) {
        this.listeners.beat.add(callback);
        return () => this.listeners.beat.delete(callback);
    }

    onAnalyser(callback) {
        this.listeners.analyser.add(callback);
        return () => this.listeners.analyser.delete(callback);
    }

    onError(callback) {
        this.listeners.error.add(callback);
        return () => this.listeners.error.delete(callback);
    }

    emitError(type, error, context = {}) {
        this.listeners.error.forEach(cb => {
            try {
                cb({ type, error, context });
            } catch (listenerError) {
                console.error('Audio error listener failed:', listenerError);
            }
        });
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

    async shutdown() {
        this.stop();
        this.detachStream();
        this.detachMediaElement();
        if (this.context && this.context.state !== 'closed') {
            try {
                await this.context.close();
            } catch (error) {
                console.warn('Audio context close error:', error);
            }
        }
        this.context = null;
        this.analyser = null;
        this.gainNode = null;
        this.frequencyData = null;
        this.timeDomainData = null;
        this.trackBuffer = null;
        this.source = null;
        this.isPlaying = false;
    }
}
