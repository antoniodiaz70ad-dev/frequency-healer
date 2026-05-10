"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "fh:hemi-sync-disclaimer-accepted-v1";

interface Props {
  onAccept: () => void;
  onCancel: () => void;
}

export default function SafetyDisclaimerModal({ onAccept, onCancel }: Props) {
  const [acknowledged, setAcknowledged] = useState({
    contraindications: false,
    activity: false,
    headphones: false,
    medical: false,
  });

  const allAcknowledged = Object.values(acknowledged).every(Boolean);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleAccept = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "1");
    }
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-[#0d1117] border border-[#1f2937] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#1f2937]">
          <h2 className="text-lg font-bold text-[#fbbf24] flex items-center gap-2">
            <span>⚠️</span>
            <span>Antes de iniciar la sesión</span>
          </h2>
          <p className="text-xs text-gray-400 mt-2">
            Las sesiones binaurales multicapa inducen estados alterados de
            consciencia. Lee y confirma cada punto antes de continuar.
          </p>
        </div>

        <div className="p-6 space-y-4 text-sm text-gray-300">
          <Checkbox
            checked={acknowledged.activity}
            onChange={(v) => setAcknowledged((s) => ({ ...s, activity: v }))}
            title="No operar maquinaria ni conducir"
            body="Durante la sesión es probable que entres en atonía motora parcial y pérdida del campo visual espacial. No conduzcas, no operes maquinaria, no manipules objetos peligrosos. Permanece sentado o acostado en un entorno seguro."
          />
          <Checkbox
            checked={acknowledged.headphones}
            onChange={(v) => setAcknowledged((s) => ({ ...s, headphones: v }))}
            title="Auriculares estéreo conectados"
            body="Los batidos binaurales requieren un tono distinto en cada oído. Confirma que tienes auriculares estéreo (no mono, no altavoces) conectados antes de iniciar."
          />
          <Checkbox
            checked={acknowledged.contraindications}
            onChange={(v) =>
              setAcknowledged((s) => ({ ...s, contraindications: v }))
            }
            title="Sin contraindicaciones neurológicas"
            body="No usar si tienes historial de epilepsia, susceptibilidad a convulsiones, marcapasos, o trastornos disociativos severos sin supervisión médica previa."
          />
          <Checkbox
            checked={acknowledged.medical}
            onChange={(v) => setAcknowledged((s) => ({ ...s, medical: v }))}
            title="No es asesoría médica"
            body="Esta plataforma no sustituye tratamiento médico ni psiquiátrico. Si estás bajo medicación prescrita, mantén la dosis recetada por tu médico. Si dudas, consulta antes con un profesional."
          />
        </div>

        <div className="p-6 border-t border-[#1f2937] flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleAccept}
            disabled={!allAcknowledged}
            className={`px-4 py-2 text-sm rounded-lg transition-all ${
              allAcknowledged
                ? "bg-[#60a5fa] text-white hover:bg-[#3b82f6]"
                : "bg-[#1f2937] text-gray-600 cursor-not-allowed"
            }`}
          >
            Acepto y comprendo
          </button>
        </div>
      </div>
    </div>
  );
}

function Checkbox({
  checked,
  onChange,
  title,
  body,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  body: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 accent-[#60a5fa] flex-shrink-0"
      />
      <div>
        <p className="text-sm font-medium text-white group-hover:text-[#60a5fa] transition-colors">
          {title}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{body}</p>
      </div>
    </label>
  );
}

export function hasAcceptedDisclaimer(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}
