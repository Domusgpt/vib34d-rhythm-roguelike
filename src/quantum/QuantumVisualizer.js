import { CanvasVisualizer } from '../core/visualizers/CanvasVisualizer.js';

const LAYER_SETTINGS = {
    background: { fade: 0.38, strength: 0.6, hueShift: 60 },
    shadow: { fade: 0.3, strength: 0.8, hueShift: 80 },
    content: { fade: 0.18, strength: 1.15, hueShift: 100 },
    highlight: { fade: 0.14, strength: 1.35, hueShift: 120 },
    accent: { fade: 0.1, strength: 1.55, hueShift: 140 }
};

export class QuantumHolographicVisualizer extends CanvasVisualizer {
    constructor(canvasId, role, reactivity, variant) {
        super(canvasId, role, reactivity, variant);
        const settings = LAYER_SETTINGS[role] || { fade: 0.26, strength: 1, hueShift: 80 };
        this.fadeAlpha = settings.fade;
        this.layerStrength = settings.strength;
        this.layerHueShift = settings.hueShift;
    }

    drawFrame(ctx, width, height, audio, targets) {
        const { x: centerX, y: centerY } = this.getCenter(width, height, 0.4);
        const maxRadius = Math.min(width, height) * (0.55 + this.layerStrength * 0.1);
        const baseHue = (this.params.hue + this.layerHueShift + this.variant * 10) % 360;
        const intensity = Math.min(1.8, (this.params.intensity + audio.energy * 1.4) * this.layerStrength);
        const saturation = Math.min(1, this.params.saturation + audio.high * 0.6);

        // Quantum lattice grid
        const columns = Math.max(6, Math.round(this.params.gridDensity * 0.35));
        const rows = Math.max(6, Math.round(this.params.gridDensity * 0.28));
        const timeOffset = this.time * 0.4;
        const cellWidth = width / columns;
        const cellHeight = height / rows;

        ctx.globalAlpha = 0.85;
        for (let c = 0; c <= columns; c++) {
            const x = c * cellWidth;
            const wave = Math.sin(timeOffset + c * 0.4) * cellWidth * 0.3 * this.reactivity;
            ctx.strokeStyle = `hsla(${(baseHue + c * 4) % 360}, ${70 + saturation * 20}%, ${35 + intensity * 20}%, ${0.05 + intensity * 0.18})`;
            ctx.lineWidth = 0.6 + intensity * 1.2;
            ctx.beginPath();
            for (let r = 0; r <= rows; r++) {
                const y = r * cellHeight + Math.sin(timeOffset + r * 0.45 + c * 0.2) * cellHeight * 0.25 * this.reactivity;
                const px = x + wave * Math.sin(timeOffset * 1.5 + r * 0.4);
                if (r === 0) ctx.moveTo(px, y);
                else ctx.lineTo(px, y);
            }
            ctx.stroke();
        }

        for (let r = 0; r <= rows; r++) {
            const y = r * cellHeight;
            const wave = Math.cos(timeOffset + r * 0.38) * cellHeight * 0.3 * this.reactivity;
            ctx.strokeStyle = `hsla(${(baseHue + 40 + r * 5) % 360}, ${65 + saturation * 25}%, ${30 + intensity * 18}%, ${0.05 + intensity * 0.18})`;
            ctx.lineWidth = 0.6 + intensity;
            ctx.beginPath();
            for (let c = 0; c <= columns; c++) {
                const x = c * cellWidth + Math.cos(timeOffset + c * 0.5 + r * 0.25) * cellWidth * 0.25 * this.reactivity;
                const py = y + wave * Math.cos(timeOffset * 1.4 + c * 0.35);
                if (c === 0) ctx.moveTo(x, py);
                else ctx.lineTo(x, py);
            }
            ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Particle wells
        const nodeCount = Math.round(24 + this.params.gridDensity * 0.4);
        for (let i = 0; i < nodeCount; i++) {
            const angle = i * (Math.PI * 2 / nodeCount) + this.time * 0.6;
            const radius = maxRadius * (0.2 + (i % 7) * 0.08 + audio.bass * 0.25);
            const px = centerX + Math.cos(angle) * radius;
            const py = centerY + Math.sin(angle) * radius;
            const hue = (baseHue + 80 + i * 8) % 360;
            const alpha = 0.12 + intensity * 0.18;
            const size = 6 + Math.sin(this.time * 1.8 + i) * 3;

            ctx.fillStyle = `hsla(${hue}, ${70 + saturation * 25}%, ${55 + intensity * 15}%, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }

        // Quantum field swirls
        const swirlCount = 6;
        for (let i = 0; i < swirlCount; i++) {
            const phase = this.time * 0.8 + i * Math.PI * 0.66;
            const radius = maxRadius * (0.4 + i * 0.08 + audio.mid * 0.25);
            const hue = (baseHue + 140 + i * 25) % 360;
            ctx.strokeStyle = `hsla(${hue}, ${70 + saturation * 20}%, ${45 + intensity * 15}%, ${0.08 + intensity * 0.2})`;
            ctx.lineWidth = 1 + intensity * 1.4;
            ctx.beginPath();
            for (let t = 0; t <= 32; t++) {
                const angle = t / 32 * Math.PI * 2 + phase;
                const modulation = Math.sin(angle * 3 + this.time * 1.5) * 0.18 * this.reactivity;
                const px = centerX + Math.cos(angle) * radius * (1 + modulation);
                const py = centerY + Math.sin(angle) * radius * (1 - modulation);
                if (t === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.stroke();
        }

        this.drawTargets(ctx, width, height, targets, {
            baseHue,
            intensity,
            saturation,
            audio,
            glow: 1.3 * this.layerStrength
        });
    }
}
