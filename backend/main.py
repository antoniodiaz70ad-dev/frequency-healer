"""
Frequency Healer - FastAPI Backend
Genera archivos WAV, sirve la base de datos de frecuencias.
"""
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from pydantic import BaseModel

from frequencies import FREQUENCIES, search_frequencies, get_frequencies_by_category, get_frequencies_by_domain
from generator import generate_waveform, generate_binaural, generate_protocol_wav, to_wav_bytes

app = FastAPI(
    title="Frequency Healer API",
    description="API para generar frecuencias de sanacion y archivos WAV",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Models ──────────────────────────────────────────────────────────

class ToneRequest(BaseModel):
    frequency: float = 528
    duration: float = 10  # seconds
    waveform: str = "sine"
    sample_rate: int = 44100
    volume: float = 0.8


class BinauralRequest(BaseModel):
    base_frequency: float = 200
    beat_frequency: float = 10
    duration: float = 10
    sample_rate: int = 44100
    volume: float = 0.8


class ProtocolStep(BaseModel):
    frequency_hz: float
    duration_seconds: float
    waveform: str = "sine"
    volume: float = 0.8
    binaural: dict | None = None


class ProtocolRequest(BaseModel):
    steps: list[ProtocolStep]
    sample_rate: int = 44100


# ─── Frequency Endpoints ─────────────────────────────────────────────

@app.get("/api/frequencies")
def list_frequencies(
    category: str | None = Query(None, description="Filter by category"),
    domain: str | None = Query(None, description="Filter by domain"),
    q: str | None = Query(None, description="Search query"),
):
    """Lista todas las frecuencias con filtros opcionales."""
    if q:
        return {"frequencies": search_frequencies(q)}
    if category:
        return {"frequencies": get_frequencies_by_category(category)}
    if domain:
        return {"frequencies": get_frequencies_by_domain(domain)}
    return {"frequencies": FREQUENCIES}


@app.get("/api/frequencies/{freq_id}")
def get_frequency(freq_id: str):
    """Obtiene detalle de una frecuencia por ID."""
    freq = next((f for f in FREQUENCIES if f["id"] == freq_id), None)
    if not freq:
        raise HTTPException(status_code=404, detail="Frecuencia no encontrada")
    return freq


@app.get("/api/search")
def search(q: str = Query(..., description="Search query")):
    """Busqueda de frecuencias por texto."""
    results = search_frequencies(q)
    return {"query": q, "count": len(results), "frequencies": results}


# ─── WAV Generation Endpoints ────────────────────────────────────────

@app.post("/api/generate-wav")
def generate_wav(req: ToneRequest):
    """Genera un archivo WAV de un tono simple."""
    if req.frequency < 0.1 or req.frequency > 22000:
        raise HTTPException(status_code=400, detail="Frecuencia fuera de rango (0.1-22000 Hz)")
    if req.duration < 0.1 or req.duration > 3600:
        raise HTTPException(status_code=400, detail="Duracion fuera de rango (0.1-3600 s)")

    signal = generate_waveform(
        frequency=req.frequency,
        duration=req.duration,
        waveform=req.waveform,
        sample_rate=req.sample_rate,
        volume=req.volume,
    )
    wav_bytes = to_wav_bytes(signal, req.sample_rate)

    filename = f"freq_{req.frequency}hz_{req.waveform}_{req.duration}s.wav"
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/generate-binaural-wav")
def generate_binaural_wav(req: BinauralRequest):
    """Genera un archivo WAV binaural estereo."""
    signal = generate_binaural(
        base_frequency=req.base_frequency,
        beat_frequency=req.beat_frequency,
        duration=req.duration,
        sample_rate=req.sample_rate,
        volume=req.volume,
    )
    wav_bytes = to_wav_bytes(signal, req.sample_rate)

    filename = f"binaural_{req.base_frequency}hz_{req.beat_frequency}hz_beat_{req.duration}s.wav"
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/generate-protocol-wav")
def generate_protocol_wav_endpoint(req: ProtocolRequest):
    """Genera un archivo WAV de un protocolo completo."""
    if len(req.steps) == 0:
        raise HTTPException(status_code=400, detail="El protocolo debe tener al menos un paso")

    steps_data = []
    for step in req.steps:
        step_dict = {
            "frequency_hz": step.frequency_hz,
            "duration_seconds": step.duration_seconds,
            "waveform": step.waveform,
            "volume": step.volume,
        }
        if step.binaural:
            step_dict["binaural"] = step.binaural
        steps_data.append(step_dict)

    signal = generate_protocol_wav(steps_data, req.sample_rate)
    wav_bytes = to_wav_bytes(signal, req.sample_rate)

    total_duration = sum(s.duration_seconds for s in req.steps)
    filename = f"protocol_{len(req.steps)}steps_{total_duration}s.wav"
    return Response(
        content=wav_bytes,
        media_type="audio/wav",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ─── Health ──────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "Frequency Healer API",
        "total_frequencies": len(FREQUENCIES),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
