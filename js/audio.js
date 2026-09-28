/**
 * Caro Web Audio Synthesizer
 * Uses HTML5 Web Audio API to create authentic tactile sound effects
 * without needing external MP3/WAV files.
 */
class SoundEngine {
    constructor() {
        this.ctx = null;
        this.muted = localStorage.getItem('caro_muted') === 'true';
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('caro_muted', this.muted);
        return this.muted;
    }

    isMuted() {
        return this.muted;
    }

    /**
     * Tactile stone placement sound (Acoustic wood & slate snap)
     */
    playStoneSnap(player = 'X') {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;

        // Base resonant frequency based on piece
        const baseFreq = player === 'X' ? 440 : 520;

        // Primary snap (high-frequency initial impact)
        const snapOsc = this.ctx.createOscillator();
        const snapGain = this.ctx.createGain();

        snapOsc.type = 'triangle';
        snapOsc.frequency.setValueAtTime(baseFreq * 2.2, now);
        snapOsc.frequency.exponentialRampToValueAtTime(120, now + 0.04);

        snapGain.gain.setValueAtTime(0.5, now);
        snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        snapOsc.connect(snapGain);
        snapGain.connect(this.ctx.destination);

        snapOsc.start(now);
        snapOsc.stop(now + 0.05);

        // Body resonance (wooden board hollow reverb)
        const bodyOsc = this.ctx.createOscillator();
        const bodyGain = this.ctx.createGain();

        bodyOsc.type = 'sine';
        bodyOsc.frequency.setValueAtTime(baseFreq * 0.75, now);
        bodyOsc.frequency.exponentialRampToValueAtTime(80, now + 0.12);

        bodyGain.gain.setValueAtTime(0.35, now);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        bodyOsc.connect(bodyGain);
        bodyGain.connect(this.ctx.destination);

        bodyOsc.start(now);
        bodyOsc.stop(now + 0.12);
    }

    /**
     * Warning sound for double-block rule or invalid move
     */
    playWarning() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(180, now + 0.08);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.25);
    }

    /**
     * Victory celebration fanfare (harmonic chime gong)
     */
    playVictory() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const chords = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

        chords.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + idx * 0.09);

            gain.gain.setValueAtTime(0, now + idx * 0.09);
            gain.gain.linearRampToValueAtTime(0.3, now + idx * 0.09 + 0.04);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 1.2);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start(now + idx * 0.09);
            osc.stop(now + idx * 0.09 + 1.2);
        });
    }

    /**
     * Playful bubble pop for chat / emotes
     */
    playPop() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(900, now + 0.08);

        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.09);
    }

    /**
     * Timer countdown tick
     */
    playTick() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;

        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.03);
    }
}

// Global audio engine singleton
window.soundEngine = new SoundEngine();
