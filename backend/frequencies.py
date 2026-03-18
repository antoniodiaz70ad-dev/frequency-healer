"""
Base de datos de frecuencias para la API.
Espejo de frequencies.ts para consistencia frontend/backend.
"""

FREQUENCIES = [
    # Brainwaves
    {"id": "bw-epsilon", "hz": 0.5, "name": "Epsilon", "category": "brainwave", "domain": ["espiritu"], "evidence": "anecdotica", "waveform": "sine", "source": "Neuroestimulacion", "description": "Meditacion profunda extraordinaria."},
    {"id": "bw-delta-low", "hz": 1, "name": "Delta Profundo", "category": "brainwave", "domain": ["cuerpo"], "evidence": "verificada", "waveform": "sine", "source": "Neuroestimulacion", "description": "Sueno profundo. Regeneracion celular maxima."},
    {"id": "bw-delta", "hz": 2, "name": "Delta", "category": "brainwave", "domain": ["cuerpo"], "evidence": "verificada", "waveform": "sine", "source": "Neuroestimulacion", "description": "Sueno reparador. Hormona de crecimiento."},
    {"id": "bw-theta-low", "hz": 4, "name": "Theta Bajo", "category": "brainwave", "domain": ["alma", "espiritu"], "evidence": "verificada", "waveform": "sine", "source": "Neuroestimulacion", "description": "Frontera sueno-vigilia. Subconsciente."},
    {"id": "bw-theta", "hz": 6, "name": "Theta", "category": "brainwave", "domain": ["alma", "espiritu"], "evidence": "verificada", "waveform": "sine", "source": "Neuroestimulacion", "description": "Meditacion profunda. Creatividad."},
    {"id": "bw-schumann", "hz": 7.83, "name": "Resonancia Schumann", "category": "brainwave", "domain": ["cuerpo", "alma", "espiritu"], "evidence": "verificada", "waveform": "sine", "source": "Geofisica", "description": "Frecuencia natural de la Tierra."},
    {"id": "bw-alpha-low", "hz": 8, "name": "Alpha Bajo", "category": "brainwave", "domain": ["alma"], "evidence": "verificada", "waveform": "sine", "source": "Neuroestimulacion", "description": "Relajacion ligera."},
    {"id": "bw-alpha", "hz": 10, "name": "Alpha Central", "category": "brainwave", "domain": ["alma"], "evidence": "verificada", "waveform": "sine", "source": "Neuroestimulacion", "description": "Relajacion optima. Flujo creativo."},
    {"id": "bw-alpha-high", "hz": 12, "name": "Alpha Alto", "category": "brainwave", "domain": ["alma"], "evidence": "verificada", "waveform": "sine", "source": "Neuroestimulacion", "description": "Alerta relajada. Aprendizaje."},
    {"id": "bw-beta", "hz": 20, "name": "Beta", "category": "brainwave", "domain": ["alma"], "evidence": "verificada", "waveform": "sine", "source": "Neuroestimulacion", "description": "Concentracion activa."},
    {"id": "bw-gamma", "hz": 40, "name": "Gamma - Neuroproteccion", "category": "brainwave", "domain": ["cuerpo", "alma"], "evidence": "verificada", "waveform": "sine", "source": "MIT Research", "description": "Reduce placas amiloides. Alzheimer."},
    {"id": "bw-gamma-high", "hz": 100, "name": "Gamma Alto", "category": "brainwave", "domain": ["espiritu"], "evidence": "anecdotica", "waveform": "sine", "source": "Neuroestimulacion", "description": "Hiperconcentracion."},
    # Solfeggio
    {"id": "sol-174", "hz": 174, "name": "Fundacion", "category": "solfeggio", "domain": ["cuerpo"], "evidence": "anecdotica", "waveform": "sine", "source": "Solfeggio", "description": "Alivio del dolor."},
    {"id": "sol-285", "hz": 285, "name": "Sanacion Celular", "category": "solfeggio", "domain": ["cuerpo"], "evidence": "anecdotica", "waveform": "sine", "source": "Solfeggio", "description": "Restauracion celular."},
    {"id": "sol-396", "hz": 396, "name": "Liberacion", "category": "solfeggio", "domain": ["alma"], "evidence": "anecdotica", "waveform": "sine", "source": "Solfeggio", "description": "Liberar miedo y culpa."},
    {"id": "sol-417", "hz": 417, "name": "Cambio", "category": "solfeggio", "domain": ["alma"], "evidence": "anecdotica", "waveform": "sine", "source": "Solfeggio", "description": "Facilita cambio."},
    {"id": "sol-528", "hz": 528, "name": "Milagro", "category": "solfeggio", "domain": ["cuerpo", "alma", "espiritu"], "evidence": "anecdotica", "waveform": "sine", "source": "Solfeggio", "description": "Reparacion ADN. Frecuencia del amor."},
    {"id": "sol-639", "hz": 639, "name": "Conexion", "category": "solfeggio", "domain": ["alma"], "evidence": "anecdotica", "waveform": "sine", "source": "Solfeggio", "description": "Armonia en relaciones."},
    {"id": "sol-741", "hz": 741, "name": "Expresion", "category": "solfeggio", "domain": ["alma", "espiritu"], "evidence": "anecdotica", "waveform": "sine", "source": "Solfeggio", "description": "Claridad mental. Intuicion."},
    {"id": "sol-852", "hz": 852, "name": "Intuicion", "category": "solfeggio", "domain": ["espiritu"], "evidence": "anecdotica", "waveform": "sine", "source": "Solfeggio", "description": "Tercer ojo. Orden espiritual."},
    {"id": "sol-963", "hz": 963, "name": "Corona", "category": "solfeggio", "domain": ["espiritu"], "evidence": "anecdotica", "waveform": "sine", "source": "Solfeggio", "description": "Conexion divina. Glandula pineal."},
    # Musical
    {"id": "mus-432", "hz": 432, "name": "Afinacion Natural", "category": "musical", "domain": ["cuerpo", "alma"], "evidence": "anecdotica", "waveform": "sine", "source": "Afinacion Musical", "description": "432 Hz. Armonia natural."},
    # Rife / CAFL
    {"id": "rife-72", "hz": 72, "name": "Equilibrio Emocional", "category": "rife", "domain": ["alma"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Sanacion emocional."},
    {"id": "rife-306", "hz": 306, "name": "Lyme", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Enfermedad de Lyme."},
    {"id": "rife-727", "hz": 727, "name": "Antibacteriano", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Bacterias y heridas."},
    {"id": "rife-787", "hz": 787, "name": "Anti-infecciones", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Infecciones generales."},
    {"id": "rife-880", "hz": 880, "name": "Antiviral", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Antiviral. Sistema inmune."},
    {"id": "rife-1150", "hz": 1150, "name": "Desintoxicacion", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Desintoxicacion parasitaria."},
    {"id": "rife-1550", "hz": 1550, "name": "Inmunidad", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Inmunidad profunda."},
    {"id": "rife-2112", "hz": 2112, "name": "Antiparasitario", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Frecuencia antiparasitaria."},
    {"id": "rife-993", "hz": 993.98, "name": "Antiparasitario Comp.", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Complementaria antiparasitaria."},
    {"id": "rife-5000", "hz": 5000, "name": "Alergias/Senos", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Alergias y senos nasales."},
    {"id": "rife-10000", "hz": 10000, "name": "Alergias General", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Alergias generales."},
    {"id": "rife-20000", "hz": 20000, "name": "Terapeutico", "category": "rife", "domain": ["cuerpo"], "evidence": "especulativa", "waveform": "square", "source": "Rife/CAFL", "description": "Terapeutico general."},
    # Nogier
    {"id": "nog-292", "hz": 292, "name": "Nogier A", "category": "nogier", "domain": ["cuerpo"], "evidence": "anecdotica", "waveform": "sine", "source": "Dr. Paul Nogier", "description": "Piel y nervios (ectodermo)."},
    {"id": "nog-584", "hz": 584, "name": "Nogier B", "category": "nogier", "domain": ["cuerpo"], "evidence": "anecdotica", "waveform": "sine", "source": "Dr. Paul Nogier", "description": "Organos internos (endodermo)."},
    {"id": "nog-1168", "hz": 1168, "name": "Nogier C", "category": "nogier", "domain": ["cuerpo"], "evidence": "anecdotica", "waveform": "sine", "source": "Dr. Paul Nogier", "description": "Musculos y huesos (mesodermo)."},
]


def search_frequencies(query: str) -> list[dict]:
    """Busca frecuencias por nombre, descripcion o Hz."""
    q = query.lower()
    return [
        f for f in FREQUENCIES
        if q in f["name"].lower()
        or q in f["description"].lower()
        or q in str(f["hz"])
        or q in f["category"]
        or any(q in d for d in f["domain"])
    ]


def get_frequencies_by_category(category: str) -> list[dict]:
    return [f for f in FREQUENCIES if f["category"] == category]


def get_frequencies_by_domain(domain: str) -> list[dict]:
    return [f for f in FREQUENCIES if domain in f["domain"]]
