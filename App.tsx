import React, { useState, useCallback } from 'react';
import Simulation from './components/Simulation';
import ControlPanel from './components/ControlPanel';
import { DroneState } from './types';

const App: React.FC = () => {
  const [droneState, setDroneState] = useState<DroneState>({
    motorSpeeds: [0, 0, 0, 0],
    altitude: 0,
    targetAltitude: 0,
    velocity: 0,
    orientation: { pitch: 0, roll: 0, yaw: 0 },
    isArmed: false,
    gameState: {
      isActive: false,
      currentCheckpointIndex: 0,
      totalCheckpoints: 0,
      timeElapsed: 0,
      isFinished: false
    }
  });

  const handleUpdate = useCallback((state: DroneState) => {
    setDroneState(state);
  }, []);

  return (
    <div className="relative w-full h-screen bg-slate-900 overflow-hidden select-none">
      <Simulation onUpdate={handleUpdate} />
      <ControlPanel droneState={droneState} />
      
      <div className="absolute bottom-4 right-4 text-slate-400 text-xs font-light pointer-events-none opacity-50">
        AeroSim v2.1 - Time Trial Edition
      </div>
    </div>
  );
};

export default App;