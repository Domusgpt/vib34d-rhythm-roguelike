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
        this.listeners = { beat: new Set(), analyser: new Set(), structure: new Set() };
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
        this.beatIntervals = [];
        this.detectedTempo = DEFAULT_BPM;
        this.rhythmStability = 0;
        this.lastBeatSource = 'metronome';
        this.lastAnalysis = null;
        this.sectionState = 'intro';
        this.sectionTimer = 0;
        this.structureBaseline = 1;
        this.structureHistory = [];
        this.structureMinDuration = 4.2; // seconds before large transitions
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

    onStructureChange(callback) {
        this.listeners.structure.add(callback);
        return () => this.listeners.structure.delete(callback);
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
            this.recordBeatInterval(timeSinceLastBeat);
            this.lastBeatSource = 'audio';
            this.emitBeat({ energy, time: currentTime, source: 'audio' });
        } else if (this.metronomeEnabled && timeSinceLastBeat > beatInterval) {
            this.lastBeatTime = currentTime;
            this.recordBeatInterval(beatInterval);
            this.lastBeatSource = 'metronome';
            this.emitBeat({ energy: meanEnergy, time: currentTime, source: 'metronome' });
        }

        const deltaTime = Number.isFinite(dt) ? dt : 0;
        const bandProfile = this.computeBandProfile(this.frequencyData);
        const structureEvent = this.updateStructureAnalysis(energy, meanEnergy, deltaTime, bandProfile);
        const analysis = this.composeAnalysisSnapshot({
            energy,
            meanEnergy,
            bandProfile,
            structureEvent
        });

        this.lastAnalysis = analysis;

        if (structureEvent) {
            this.emitStructure(structureEvent);
        }

        this.listeners.analyser.forEach(cb => cb({
            frequencyData: this.frequencyData,
            timeDomainData: this.timeDomainData,
            energy,
            meanEnergy,
            analysis
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

    emitStructure(event) {
        this.listeners.structure.forEach(cb => cb(event));
    }

    recordBeatInterval(interval) {
        if (!Number.isFinite(interval) || interval <= 0) {
            return;
        }

        this.beatIntervals.push(interval);
        if (this.beatIntervals.length > 12) {
            this.beatIntervals.shift();
        }

        const average = this.beatIntervals.reduce((acc, value) => acc + value, 0) / this.beatIntervals.length;
        if (average > 0) {
            this.detectedTempo = 60 / average;
        }

        const variance = this.beatIntervals.reduce((acc, value) => {
            const diff = value - average;
            return acc + diff * diff;
        }, 0) / (this.beatIntervals.length || 1);

        const deviation = Math.sqrt(Math.max(variance, 0));
        const stability = average > 0 ? 1 - Math.min(1, deviation / average) : 0;
        this.rhythmStability = Math.max(0, Math.min(1, stability));
    }

    computeBandProfile(frequencyData) {
        if (!frequencyData || !frequencyData.length) {
            return {
                subBass: 0,
                bass: 0,
                lowMid: 0,
                mid: 0,
                highMid: 0,
                presence: 0,
                brilliance: 0,
                lowComposite: 0,
                highComposite: 0,
                spectralCentroid: 0,
                spectralSlope: 0
            };
        }

        const ranges = [
            { key: 'subBass', start: 0.0, end: 0.03 },
            { key: 'bass', start: 0.03, end: 0.08 },
            { key: 'lowMid', start: 0.08, end: 0.2 },
            { key: 'mid', start: 0.2, end: 0.4 },
            { key: 'highMid', start: 0.4, end: 0.6 },
            { key: 'presence', start: 0.6, end: 0.8 },
            { key: 'brilliance', start: 0.8, end: 1.0 }
        ];

        const profile = {};
        const length = frequencyData.length;
        let totalAmplitude = 0;
        let weightedSum = 0;

        ranges.forEach(range => {
            let sum = 0;
            let count = 0;
            const startIndex = Math.floor(length * range.start);
            const endIndex = Math.floor(length * range.end);

            for (let i = startIndex; i < endIndex; i++) {
                const value = frequencyData[i];
                if (value === -Infinity) continue;
                const amplitude = Math.pow(10, value / 20);
                sum += amplitude;
                totalAmplitude += amplitude;
                weightedSum += amplitude * (i / length);
                count++;
            }

            profile[range.key] = count > 0 ? sum / count : 0;
        });

        const lowComposite = (profile.subBass + profile.bass + profile.lowMid) / 3;
        const highComposite = (profile.highMid + profile.presence + profile.brilliance) / 3;

        profile.lowComposite = lowComposite || 0;
        profile.highComposite = highComposite || 0;
        profile.total = totalAmplitude / length || 0;
        profile.spectralCentroid = totalAmplitude > 0 ? weightedSum / totalAmplitude : 0;
        profile.spectralSlope = highComposite - lowComposite;

        return profile;
    }

    updateStructureAnalysis(energy, meanEnergy, dt, bandProfile = {}) {
        const safeDt = Number.isFinite(dt) ? dt : 0;
        this.sectionTimer += safeDt;

        const normalizedEnergy = meanEnergy > 0 ? energy / meanEnergy : energy;
        const clampedNormalized = Number.isFinite(normalizedEnergy) ? normalizedEnergy : 0;

        this.structureBaseline = this.structureBaseline * 0.97 + clampedNormalized * 0.03;
        const deviation = clampedNormalized - this.structureBaseline;

        this.structureHistory.push(deviation);
        if (this.structureHistory.length > 240) {
            this.structureHistory.shift();
        }

        let targetSection = this.sectionState;

        if (this.sectionState === 'intro' && this.sectionTimer > 8) {
            targetSection = 'groove';
        }

        if (deviation > 0.28) {
            targetSection = 'chorus';
        } else if (deviation < -0.22) {
            targetSection = 'verse';
        } else if (Math.abs(deviation) > 0.1) {
            targetSection = 'bridge';
        } else if (this.sectionState !== 'intro') {
            targetSection = 'groove';
        }

        const highEnergyLift = (bandProfile.highComposite || 0) - (bandProfile.lowComposite || 0);
        if (highEnergyLift > 0.35) {
            targetSection = 'finale';
        }

        if (targetSection !== this.sectionState && this.sectionTimer >= this.structureMinDuration) {
            this.sectionState = targetSection;
            this.sectionTimer = 0;
            return {
                section: targetSection,
                deviation,
                normalizedEnergy: clampedNormalized,
                timestamp: this.context ? this.context.currentTime : 0
            };
        }

        return null;
    }

    composeAnalysisSnapshot({ energy, meanEnergy, bandProfile, structureEvent }) {
        const lowComposite = bandProfile?.lowComposite || 0;
        const highComposite = bandProfile?.highComposite || 0;
        const total = bandProfile?.total || 0;
        const normalizedEnergy = meanEnergy > 0 ? energy / meanEnergy : energy;
        const clampedNormalized = Number.isFinite(normalizedEnergy) ? normalizedEnergy : 0;
        const tonalTilt = bandProfile?.spectralSlope || 0;
        const tension = Math.max(0, highComposite - lowComposite * 0.6);

        return {
            energy,
            meanEnergy,
            normalizedEnergy: clampedNormalized,
            energyDelta: meanEnergy > 0 ? (energy - meanEnergy) / meanEnergy : 0,
            bands: bandProfile,
            tonalTilt,
            tension,
            totalAmplitude: total,
            section: structureEvent?.section || this.sectionState,
            sectionDuration: this.sectionTimer,
            sectionDeviation: structureEvent?.deviation ?? (clampedNormalized - this.structureBaseline),
            tempo: this.detectedTempo,
            rhythmStability: this.rhythmStability,
            beatConfidence: this.rhythmStability,
            lastBeatSource: this.lastBeatSource
        };
    }

    getBandLevels() {
        if (this.lastAnalysis?.bands) {
            const bands = this.lastAnalysis.bands;
            const bassComposite = (bands.subBass + bands.bass) / 2 || 0;
            const midComposite = (bands.lowMid + bands.mid) / 2 || 0;
            const highComposite = (bands.highMid + bands.presence + bands.brilliance) / 3 || 0;

            return {
                bass: bassComposite,
                mid: midComposite,
                high: highComposite,
                subBass: bands.subBass || 0,
                lowMid: bands.lowMid || 0,
                highMid: bands.highMid || 0,
                presence: bands.presence || 0,
                brilliance: bands.brilliance || 0,
                energy: this.lastAnalysis.energy || 0,
                section: this.lastAnalysis.section,
                tension: this.lastAnalysis.tension,
                rhythmStability: this.lastAnalysis.rhythmStability
            };
        }

        return { bass: 0, mid: 0, high: 0, energy: 0 };
    }

    getAnalysisSnapshot() {
        if (!this.lastAnalysis) return null;
        return { ...this.lastAnalysis, bands: { ...this.lastAnalysis.bands } };
    }
}
