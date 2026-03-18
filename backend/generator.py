"""
Generador de archivos WAV para frecuencias de sanacion.
Usa numpy para generar formas de onda y scipy para escribir WAV.
"""
import io
import numpy as np
from scipy.io import wavfile


def generate_waveform(
    frequency: float,
    duration: float,
    waveform: str = "sine",
    sample_rate: int = 44100,
    volume: float = 0.8,
) -> np.ndarray:
    """Genera una forma de onda como array numpy."""
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)

    if waveform == "sine":
        signal = np.sin(2 * np.pi * frequency * t)
    elif waveform == "square":
        signal = np.sign(np.sin(2 * np.pi * frequency * t))
    elif waveform == "triangle":
        signal = 2 * np.abs(2 * (frequency * t - np.floor(frequency * t + 0.5))) - 1
    elif waveform == "sawtooth":
        signal = 2 * (frequency * t - np.floor(frequency * t + 0.5))
    else:
        signal = np.sin(2 * np.pi * frequency * t)

    # Apply volume and fade in/out to avoid clicks
    signal *= volume
    fade_samples = min(int(sample_rate * 0.01), len(signal) // 4)
    if fade_samples > 0:
        fade_in = np.linspace(0, 1, fade_samples)
        fade_out = np.linspace(1, 0, fade_samples)
        signal[:fade_samples] *= fade_in
        signal[-fade_samples:] *= fade_out

    return signal


def generate_binaural(
    base_frequency: float,
    beat_frequency: float,
    duration: float,
    sample_rate: int = 44100,
    volume: float = 0.8,
) -> np.ndarray:
    """Genera binaural beats como audio estereo (2 canales)."""
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    freq_left = base_frequency
    freq_right = base_frequency + beat_frequency

    left = np.sin(2 * np.pi * freq_left * t) * volume
    right = np.sin(2 * np.pi * freq_right * t) * volume

    # Fade in/out
    fade_samples = min(int(sample_rate * 0.01), len(left) // 4)
    if fade_samples > 0:
        fade_in = np.linspace(0, 1, fade_samples)
        fade_out = np.linspace(1, 0, fade_samples)
        left[:fade_samples] *= fade_in
        left[-fade_samples:] *= fade_out
        right[:fade_samples] *= fade_in
        right[-fade_samples:] *= fade_out

    stereo = np.column_stack([left, right])
    return stereo


def generate_protocol_wav(
    steps: list[dict],
    sample_rate: int = 44100,
) -> np.ndarray:
    """Genera un WAV completo para un protocolo con multiples pasos."""
    segments = []
    for step in steps:
        freq = step["frequency_hz"]
        dur = step["duration_seconds"]
        wf = step.get("waveform", "sine")
        vol = step.get("volume", 0.8)
        binaural = step.get("binaural")

        if binaural and binaural.get("enabled"):
            segment = generate_binaural(freq, binaural["difference_hz"], dur, sample_rate, vol)
        else:
            segment = generate_waveform(freq, dur, wf, sample_rate, vol)

        segments.append(segment)

        # Add 0.5s crossfade silence between steps
        silence_duration = 0.5
        silence_samples = int(sample_rate * silence_duration)
        if binaural and binaural.get("enabled"):
            silence = np.zeros((silence_samples, 2))
        else:
            silence = np.zeros(silence_samples)
        segments.append(silence)

    # Ensure all segments have same shape (mono or stereo)
    is_stereo = any(s.ndim == 2 for s in segments)
    if is_stereo:
        processed = []
        for s in segments:
            if s.ndim == 1:
                processed.append(np.column_stack([s, s]))
            else:
                processed.append(s)
        return np.vstack(processed)
    else:
        return np.concatenate(segments)


def to_wav_bytes(signal: np.ndarray, sample_rate: int = 44100) -> bytes:
    """Convierte un array numpy a bytes WAV."""
    # Normalize to int16 range
    max_val = np.max(np.abs(signal))
    if max_val > 0:
        signal = signal / max_val

    signal_int16 = (signal * 32767).astype(np.int16)

    buf = io.BytesIO()
    wavfile.write(buf, sample_rate, signal_int16)
    buf.seek(0)
    return buf.read()
