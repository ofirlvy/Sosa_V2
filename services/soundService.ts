// Orbit Sonic UX Engine
// Pure, dependency-free audio management with embedded assets for zero-latency feedback.

type SoundKey = 'drop' | 'snap' | 'success' | 'toggle' | 'error';

class SoundService {
  private audioContext: AudioContext | null = null;
  private buffers: Map<SoundKey, AudioBuffer> = new Map();
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Base64 encoded short, premium UI sounds (WAV/MP3 fragments)
  // These are placeholders for high-quality "Orbit" sounds.
  private sources: Record<SoundKey, string> = {
    // A soft, low-frequency thud (like placing a card on felt)
    drop: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=', 
    // A crisp, mechanical click
    snap: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    // A warm, airy major chord sweep
    success: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    // A very subtle high-hat tick
    toggle: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    // A dull wooden thud
    error: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA='
  };

  // Real synthetic fallbacks if base64 is empty/invalid to ensure the demo works
  // We use the Web Audio API oscillators to generate the exact "Orbit" aesthetic procedurally
  // if actual files aren't provided. This guarantees the "Premium" feel without external assets.

  constructor() {
    // Load persisted mute state
    if (typeof window !== 'undefined') {
      const savedMute = localStorage.getItem('orbit_sound_muted');
      this.isMuted = savedMute === 'true';
    }
  }

  private initContext() {
    if (!this.audioContext && typeof window !== 'undefined') {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  public getMuteState(): boolean {
    return this.isMuted;
  }

  public toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('orbit_sound_muted', String(this.isMuted));
    
    // Play a test sound if unmuting
    if (!this.isMuted) {
      this.play('toggle');
    }
    return this.isMuted;
  }

  public play(key: SoundKey) {
    if (this.isMuted) return;
    
    this.initContext();
    if (!this.audioContext) return;

    // Resume context if suspended (browser policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    // Procedural Sound Generation (The "Orbit" Aesthetic)
    // This creates high-quality, lightweight sounds on the fly.
    this.synthesizeSound(key);
  }

  private synthesizeSound(key: SoundKey) {
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);

    switch (key) {
      case 'drop':
        // Soft thud: Sine wave, rapid pitch drop, quick decay
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);
        gain.gain.setValueAtTime(0.3, t); // Low volume
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        osc.start(t);
        osc.stop(t + 0.1);
        break;

      case 'snap':
        // Mechanical click: Square wave, very short
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
        break;

      case 'success': {
        // Ethereal chord: Multiple oscillators would be better, but we do a simple arpeggio effect here
        // We'll create two oscs for a major 3rd harmony
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc.type = 'sine';
        osc2.type = 'sine';

        // C5
        osc.frequency.setValueAtTime(523.25, t);
        // E5
        osc2.frequency.setValueAtTime(659.25, t);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        gain2.gain.setValueAtTime(0, t);
        gain2.gain.linearRampToValueAtTime(0.1, t + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

        osc.start(t);
        osc2.start(t);
        osc.stop(t + 0.4);
        osc2.stop(t + 0.4);
        break;
      }

      case 'toggle':
        // High tick
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, t);
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);
        osc.start(t);
        osc.stop(t + 0.05);
        break;

      case 'error':
        // Low woodblock
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(100, t + 0.1);
        gain.gain.setValueAtTime(0.2, t);
        gain.gain.linearRampToValueAtTime(0.01, t + 0.15);
        osc.start(t);
        osc.stop(t + 0.15);
        break;
    }
  }
}

export const soundService = new SoundService();