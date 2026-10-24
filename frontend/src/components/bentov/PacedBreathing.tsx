"use client";
import { breathingAt } from '@/lib/bentov/protocol';
export default function PacedBreathing({activeMs,reducedMotion}:{activeMs:number;reducedMotion:boolean}){const breath=breathingAt(activeMs);const scale=breath.phase==='inhale'?0.72+breath.progress*.28:1-breath.progress*.28;return <div className="bentov-breath" aria-live="polite"><div className="bentov-breath__orb" style={{transform:reducedMotion?undefined:`scale(${scale})`}} aria-hidden="true"/><strong>{breath.label}</strong><span>5 segundos · sin retener</span></div>}

