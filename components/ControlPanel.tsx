import React from 'react';
import { DroneState } from '../types';

interface ControlPanelProps {
  droneState: DroneState;
}

const MotorIndicator: React.FC<{ value: number; label: string; clockwise: boolean }> = ({ value, label, clockwise }) => {
  const normalized = Math.min(1, value / 80);
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - normalized * circumference;
  
  let strokeColor = "#cbd5e1"; // Slate-300
  if (value > 1 && value < 10) strokeColor = "#f59e0b";
  else if (value >= 10) strokeColor = clockwise ? "#10b981" : "#3b82f6";

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-12 h-12 flex items-center justify-center">
        <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90">
          <circle cx="24" cy="24" r={radius} fill="transparent" stroke="rgba(0,0,0,0.05)" strokeWidth="3" />
          <circle cx="24" cy="24" r={radius} fill="transparent" stroke={strokeColor} strokeWidth="3"
            strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
            className="transition-all duration-75" />
        </svg>
        <span className="text-[10px] font-mono text-slate-700 font-bold">{value.toFixed(0)}</span>
      </div>
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
};

const AttitudeGauge: React.FC<{ label: string; value: number; subValue?: string; unit: string }> = ({ label, value, subValue, unit }) => (
  <div className="bg-white/40 rounded-xl p-3 flex flex-col items-center justify-between backdrop-blur-sm border border-white/50 shadow-sm">
    <span className="text-[10px] text-slate-500 uppercase font-semibold">{label}</span>
    <span className="text-xl font-light text-slate-800 font-mono tracking-tighter">
      {value.toFixed(1)}
      <span className="text-xs text-slate-500 ml-1">{unit}</span>
    </span>
    {subValue && <span className="text-[10px] text-emerald-600 font-mono mt-1 font-bold">{subValue}</span>}
  </div>
);

const Compass: React.FC<{ heading: number }> = ({ heading }) => (
    <div className="relative w-16 h-16 rounded-full border border-slate-200 flex items-center justify-center bg-white/60 backdrop-blur-md shadow-md">
        <div className="absolute inset-0 rounded-full border border-white/40"></div>
        <div className="absolute top-0 text-[8px] font-bold text-slate-400">N</div>
        <div className="absolute bottom-0 text-[8px] font-bold text-slate-400">S</div>
        <div className="absolute left-1 text-[8px] font-bold text-slate-400">W</div>
        <div className="absolute right-1 text-[8px] font-bold text-slate-400">E</div>
        
        {/* Needle */}
        <div 
            className="w-full h-full flex justify-center items-center transition-transform duration-100 ease-linear"
            style={{ transform: `rotate(${-heading}deg)` }}
        >
            <div className="w-0.5 h-6 bg-red-500 rounded-full relative -top-2 shadow-sm"></div>
            <div className="w-0.5 h-6 bg-slate-300 rounded-full relative -bottom-2"></div>
        </div>
        <div className="absolute font-mono text-xs text-slate-800 font-bold">{Math.round(heading)}°</div>
    </div>
);

const MissionStatus: React.FC<{ state: DroneState['gameState'] }> = ({ state }) => {
    if (!state.isActive) {
        return (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-white/80 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/50 shadow-lg flex items-center gap-4 animate-bounce-slow">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></div>
                <span className="text-sm font-bold text-slate-700 tracking-wide">PRESS <kbd className="bg-slate-800 text-white px-1.5 rounded mx-1">G</kbd> TO START TIME TRIAL</span>
            </div>
        );
    }

    if (state.isFinished) {
        return (
             <div className="absolute top-32 left-1/2 -translate-x-1/2 bg-emerald-500/90 backdrop-blur-xl px-8 py-6 rounded-3xl border border-emerald-400 shadow-2xl flex flex-col items-center text-white">
                <span className="text-2xl font-black italic tracking-tighter mb-1">MISSION COMPLETE</span>
                <span className="text-4xl font-mono font-bold mb-2">{state.timeElapsed.toFixed(2)}s</span>
                <span className="text-xs uppercase font-bold text-emerald-100">Press R to Reset</span>
            </div>
        );
    }

    return (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex gap-4">
             {/* Progress */}
             <div className="bg-slate-900/80 backdrop-blur-xl px-5 py-2 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center min-w-[100px]">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">CHECKPOINT</span>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-mono font-bold text-cyan-400">{state.currentCheckpointIndex + 1}</span>
                    <span className="text-sm font-mono text-slate-500">/ {state.totalCheckpoints}</span>
                </div>
             </div>
             
             {/* Timer */}
             <div className="bg-slate-900/80 backdrop-blur-xl px-5 py-2 rounded-2xl border border-slate-700 shadow-lg flex flex-col items-center min-w-[100px]">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">TIME</span>
                <span className="text-2xl font-mono font-bold text-white">{state.timeElapsed.toFixed(1)}<span className="text-sm text-slate-500 ml-0.5">s</span></span>
             </div>
        </div>
    );
};

const ControlPanel: React.FC<ControlPanelProps> = ({ droneState }) => {
  const { motorSpeeds, altitude, targetAltitude, velocity, orientation, isArmed, heading = 0, gameState } = droneState;
  const toDeg = (rad: number) => Math.round(rad * (180 / Math.PI));

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-6 flex flex-col justify-between font-sans">
      
      <MissionStatus state={gameState} />

      {/* Top Bar */}
      <div className="flex justify-between items-start w-full">
        {/* Left: System Status */}
        <div className="bg-white/70 backdrop-blur-xl p-4 rounded-3xl border border-white/50 shadow-lg pointer-events-auto w-80">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full animate-pulse shadow-sm ${isArmed ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
              <span className="text-sm font-bold text-slate-800 tracking-wide">
                {isArmed ? 'ACTIVE' : 'STANDBY'}
              </span>
            </div>
            <span className="text-xs font-mono text-slate-400 font-bold">GPS: LOCK</span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
             <div className="col-span-2 relative h-40 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center mb-2 overflow-hidden shadow-inner">
                <div className="absolute w-12 h-24 border-2 border-slate-200 rounded-2xl z-0"></div>
                <div className="absolute w-32 h-32 border border-slate-100 rotate-45 z-0"></div>
                
                <div className="absolute top-2 left-4"><MotorIndicator value={motorSpeeds[0]} label="M1" clockwise={true} /></div>
                <div className="absolute top-2 right-4"><MotorIndicator value={motorSpeeds[3]} label="M2" clockwise={false} /></div>
                <div className="absolute bottom-2 left-4"><MotorIndicator value={motorSpeeds[1]} label="M4" clockwise={false} /></div>
                <div className="absolute bottom-2 right-4"><MotorIndicator value={motorSpeeds[2]} label="M3" clockwise={true} /></div>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
             <AttitudeGauge label="ALT (AGL)" value={altitude} subValue={`TGT: ${targetAltitude.toFixed(1)}m`} unit="m" />
             <AttitudeGauge label="GND SPEED" value={velocity} unit="m/s" />
          </div>
        </div>

        {/* Right: Attitude & Compass */}
        <div className="bg-white/70 backdrop-blur-xl p-4 rounded-3xl border border-white/50 shadow-lg pointer-events-auto flex flex-col gap-4 items-center">
          <Compass heading={heading} />
          <div className="w-full h-px bg-slate-200"></div>
          <div className="flex flex-col gap-1 text-right w-full">
             <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">PITCH</span>
                <span className="font-mono text-slate-700 text-sm font-bold">{toDeg(orientation.pitch)}°</span>
             </div>
             <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-400 font-bold uppercase">ROLL</span>
                <span className="font-mono text-slate-700 text-sm font-bold">{toDeg(orientation.roll)}°</span>
             </div>
          </div>
        </div>
      </div>

      {/* Controls Hint */}
      <div className="self-center bg-white/70 backdrop-blur-xl px-8 py-4 rounded-2xl border border-white/50 text-slate-600 text-xs font-semibold tracking-wide flex gap-8 shadow-lg">
         <div className="flex flex-col items-center gap-1">
             <span className="text-[9px] uppercase tracking-wider text-slate-400">System</span>
             <span className="flex items-center gap-2 text-emerald-600"><kbd className="bg-white px-1.5 py-0.5 rounded text-slate-800 font-mono border border-slate-200 shadow-sm">M</kbd> ARM/DISARM</span>
             <span className="flex items-center gap-2 text-blue-600"><kbd className="bg-white px-1.5 py-0.5 rounded text-slate-800 font-mono border border-slate-200 shadow-sm">G</kbd> START MISSION</span>
         </div>
         <div className="w-px bg-slate-200 h-8 self-center"></div>
         <div className="flex flex-col items-center gap-1">
             <span className="text-[9px] uppercase tracking-wider text-slate-400">Throttle</span>
             <span className="flex items-center gap-2"><kbd className="bg-white px-1.5 py-0.5 rounded text-slate-800 font-mono border border-slate-200 shadow-sm">↑/↓</kbd> ALTITUDE</span>
         </div>
         <div className="w-px bg-slate-200 h-8 self-center"></div>
         <div className="flex flex-col items-center gap-1">
             <span className="text-[9px] uppercase tracking-wider text-slate-400">Cyclic</span>
             <span className="flex items-center gap-2"><kbd className="bg-white px-1.5 py-0.5 rounded text-slate-800 font-mono border border-slate-200 shadow-sm">WASD</kbd> MOVE</span>
         </div>
         <div className="w-px bg-slate-200 h-8 self-center"></div>
         <div className="flex flex-col items-center gap-1">
             <span className="text-[9px] uppercase tracking-wider text-slate-400">Rudder</span>
             <span className="flex items-center gap-2"><kbd className="bg-white px-1.5 py-0.5 rounded text-slate-800 font-mono border border-slate-200 shadow-sm">←/→</kbd> ROTATE</span>
         </div>
      </div>
    </div>
  );
};

export default ControlPanel;