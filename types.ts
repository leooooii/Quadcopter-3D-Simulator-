
export interface DroneState {
  motorSpeeds: [number, number, number, number]; // FL, FR, RR, RL
  altitude: number;
  targetAltitude: number; // For Altitude Hold display
  velocity: number;
  orientation: {
    pitch: number;
    roll: number;
    yaw: number;
  };
  heading?: number; // 0-360
  isArmed: boolean;
  // Game/Mission State
  gameState: {
    isActive: boolean;
    currentCheckpointIndex: number;
    totalCheckpoints: number;
    timeElapsed: number;
    isFinished: boolean;
  };
}

export interface ControlInput {
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
}
