/**
 * audio.js
 * Motor de Síntesis Acústica Táctica en Tiempo Real con Web Audio API (Cero Latencia).
 * Incluye disparos por calibre/categoría, recarga mecánica, corredera manual,
 * alerta de eliminación y rebote físico de casquillo retardado (+400 ms) según superficie.
 */

export class TacticalAudioEngine {
  constructor() {
    this.ctx = null;
    this.surface = localStorage.getItem('tactical_ground_surface_v1') || 'concrete'; // 'concrete' | 'dirt'
    this.muted = false;
  }

  /**
   * Inicializa o desbloquea el AudioContext en el primer toque del usuario.
   */
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ latencyHint: 'interactive' });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setSurface(surfaceType) {
    this.surface = surfaceType === 'dirt' ? 'dirt' : 'concrete';
    localStorage.setItem('tactical_ground_surface_v1', this.surface);
  }

  getSurface() {
    return this.surface;
  }

  /**
   * Genera un buffer de ruido blanco/rosa para explosiones de pólvora y fricción mecánica
   */
  _createNoiseBuffer(durationSec = 0.4) {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Reproduce el disparo sin latencia y agenda el sonido del casquillo cayendo 400ms después.
   */
  playGunshot(weapon = {}) {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const category = (weapon.category || '').toLowerCase();

    // Determinar perfil acústico según la categoría del arma
    let punchFreq = 155;
    let decayTime = 0.24;
    let filterCutoff = 2600;
    let gainBoost = 0.9;

    if (category.includes('francotirador') || category.includes('sniper') || category.includes('pesada')) {
      punchFreq = 85;
      decayTime = 0.52;
      filterCutoff = 3400;
      gainBoost = 1.0;
    } else if (category.includes('pistola') || category.includes('subfusil')) {
      punchFreq = 210;
      decayTime = 0.17;
      filterCutoff = 3100;
      gainBoost = 0.8;
    } else if (category.includes('escopeta')) {
      punchFreq = 95;
      decayTime = 0.42;
      filterCutoff = 1900;
      gainBoost = 1.0;
    }

    // 1. Transiente de onda expansiva (Ruido filtrado de alta presión)
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = this._createNoiseBuffer(decayTime);

    const bandpass = this.ctx.createBiquadFilter();
    bandpass.type = 'lowpass';
    bandpass.frequency.setValueAtTime(filterCutoff, now);
    bandpass.frequency.exponentialRampToValueAtTime(220, now + decayTime);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(gainBoost, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + decayTime);

    noiseSource.connect(bandpass);
    bandpass.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noiseSource.start(now);
    noiseSource.stop(now + decayTime);

    // 2. Golpe de recámara (Oscilador de baja frecuencia con caída rápida)
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(punchFreq, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.11);

    oscGain.gain.setValueAtTime(0.95, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);

    // 3. Chasquido metálico del cerrojo retrocediendo
    this._playMetallicClick(now + 0.025, 2900, 0.22);

    // 4. Sonido retardado exactamente 400 milisegundos después: Casquillo cayendo al suelo
    this.scheduleShellCasingBounce(400);
  }

  /**
   * Agenda el sonido del casquillo rebotando en el suelo 400 ms después del disparo o extracción.
   * Soporta "concrete" (Cemento / Piso duro) y "dirt" (Tierra / Pasto).
   */
  scheduleShellCasingBounce(delayMs = 400) {
    if (this.muted) return;
    this.init();

    setTimeout(() => {
      if (!this.ctx || this.muted) return;
      const start = this.ctx.currentTime;

      if (this.surface === 'concrete') {
        // CEMENTO / PISO DURO: Tintineo metálico de latón con múltiples micro-rebotes agudos
        const bounces = [
          { offset: 0.0, amp: 0.36, pitchMod: 1.0 },
          { offset: 0.085, amp: 0.22, pitchMod: 1.04 },
          { offset: 0.145, amp: 0.13, pitchMod: 0.98 },
          { offset: 0.19, amp: 0.07, pitchMod: 1.02 }
        ];

        bounces.forEach((b) => {
          const t = start + b.offset;
          const freqs = [3950 * b.pitchMod, 5420 * b.pitchMod, 7180 * b.pitchMod];
          freqs.forEach((f, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            osc.frequency.exponentialRampToValueAtTime(f * 0.96, t + 0.065);

            const partialAmp = b.amp / (idx + 1);
            gain.gain.setValueAtTime(partialAmp, t);
            gain.gain.exponentialRampToValueAtTime(0.0008, t + 0.07);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(t);
            osc.stop(t + 0.075);
          });
        });
      } else {
        // TIERRA / PASTO: Impacto amortiguado con leve roce metálico corto y golpe sordo
        const bounces = [
          { offset: 0.0, amp: 0.28 },
          { offset: 0.07, amp: 0.11 }
        ];

        bounces.forEach((b) => {
          const t = start + b.offset;
          // Golpe sordo en tierra/pasto
          const thudOsc = this.ctx.createOscillator();
          const thudGain = this.ctx.createGain();
          thudOsc.type = 'sine';
          thudOsc.frequency.setValueAtTime(195, t);
          thudOsc.frequency.exponentialRampToValueAtTime(65, t + 0.045);

          thudGain.gain.setValueAtTime(b.amp, t);
          thudGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

          thudOsc.connect(thudGain);
          thudGain.connect(this.ctx.destination);
          thudOsc.start(t);
          thudOsc.stop(t + 0.055);

          // Roce metálico apagado (latón contra tierra/hojas)
          const brassOsc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const brassGain = this.ctx.createGain();

          brassOsc.type = 'triangle';
          brassOsc.frequency.setValueAtTime(2450, t);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(1500, t);

          brassGain.gain.setValueAtTime(b.amp * 0.35, t);
          brassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

          brassOsc.connect(filter);
          filter.connect(brassGain);
          brassGain.connect(this.ctx.destination);
          brassOsc.start(t);
          brassOsc.stop(t + 0.035);
        });
      }
    }, delayMs);
  }

  /**
   * Sonido de accionar manualmente la corredera / cerrojo para extraer un casquillo
   * + rebote del casquillo 400ms después.
   */
  playSlideRack() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;

    // Tirón hacia atrás de la corredera
    this._playMetallicClick(now, 1850, 0.32);
    this._playFrictionSlide(now, 0.075, 1400, 2600);

    // Retorno de la corredera por resorte recuperador
    this._playMetallicClick(now + 0.11, 2450, 0.38);
    this._playFrictionSlide(now + 0.11, 0.065, 2600, 1200);

    // El casquillo extraído cae al suelo 400ms después
    this.scheduleShellCasingBounce(400);
  }

  /**
   * Secuencia acústica mecánica de cambio de cargador
   */
  playReloadSound(reloadDurationMs = 2000) {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    const totalSec = Math.max(0.6, reloadDurationMs / 1000);

    // 1. Botón retenedor y extracción del cargador vacío
    this._playMetallicClick(now + 0.02, 1600, 0.3);
    this._playFrictionSlide(now + 0.06, 0.12, 900, 450);

    // 2. Inserción firme del nuevo cargador a mitad del ciclo
    const insertTime = now + totalSec * 0.55;
    this._playFrictionSlide(insertTime - 0.08, 0.09, 500, 1200);
    this._playMetallicClick(insertTime, 1150, 0.42);

    // 3. Liberación del cerrojo (Bolt Release) al finalizar la recarga
    const boltTime = now + totalSec * 0.88;
    this._playMetallicClick(boltTime, 2750, 0.38);
  }

  /**
   * Clic metálico cuando el cargador está sin munición
   */
  playDryFire() {
    if (this.muted) return;
    this.init();
    this._playMetallicClick(this.ctx.currentTime, 3200, 0.28);
  }

  /**
   * Confirmación acústica de impacto sobre objetivo enemigo (Hitmarker)
   */
  playHitConfirmation() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;
    this._playBeep(now, 1950, 0.045, 0.28);
    this._playBeep(now + 0.06, 2600, 0.065, 0.32);
  }

  /**
   * Pitido agudo de alerta de eliminación ("HAS SIDO ELIMINADO")
   */
  playEliminationAlert() {
    if (this.muted) return;
    this.init();
    const now = this.ctx.currentTime;

    // Secuencia de alarma táctica de alta prioridad
    const pulses = [
      { offset: 0.0, freq: 1380, dur: 0.18 },
      { offset: 0.22, freq: 1040, dur: 0.18 },
      { offset: 0.44, freq: 1380, dur: 0.18 },
      { offset: 0.66, freq: 880, dur: 0.48 }
    ];

    pulses.forEach((p) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(p.freq, now + p.offset);

      gain.gain.setValueAtTime(0.35, now + p.offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + p.offset + p.dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + p.offset);
      osc.stop(now + p.offset + p.dur + 0.02);
    });
  }

  _playMetallicClick(startTime, freq, amp) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, startTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.45, startTime + 0.032);

    gain.gain.setValueAtTime(amp, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.035);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.04);
  }

  _playFrictionSlide(startTime, duration, startFreq, endFreq) {
    const noise = this.ctx.createBufferSource();
    noise.buffer = this._createNoiseBuffer(duration);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3.5;
    filter.frequency.setValueAtTime(startFreq, startTime);
    filter.frequency.linearRampToValueAtTime(endFreq, startTime + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(startTime);
    noise.stop(startTime + duration);
  }

  _playBeep(startTime, freq, duration, amp) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(amp, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
  }
}
