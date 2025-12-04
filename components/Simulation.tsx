import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { DroneState } from '../types';

interface SimulationProps {
  onUpdate: (state: DroneState) => void;
}

// --- 1. Math Helpers ---

function rotateAlongAxisTo(u: THREE.Vector3, axis: THREE.Vector3, w: THREE.Vector3) {
    let angle = u.angleTo(w);
    let cc = u.clone();
    cc.cross(w);
    if (cc.dot(axis) > 0)
      return angle;
    else
      return -angle;
}

function getBodyPitch2(body: CANNON.Body) {
    const localX = body.vectorToWorldFrame(new CANNON.Vec3(1, 0, 0));
    const localY = body.vectorToWorldFrame(new CANNON.Vec3(0, 1, 0));
    const xL = new THREE.Vector3(localX.x, localX.y, localX.z);
    const yL = new THREE.Vector3(localY.x, localY.y, localY.z);
    const yW = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3().copy(yW).projectOnPlane(xL);
    if (v.lengthSq() < 0.0001) return 0;
    return rotateAlongAxisTo(v, xL, yL);
}

function getBodyRoll2(body: CANNON.Body) {
    const localY = body.vectorToWorldFrame(new CANNON.Vec3(0, 1, 0));
    const localZ = body.vectorToWorldFrame(new CANNON.Vec3(0, 0, 1));
    const yL = new THREE.Vector3(localY.x, localY.y, localY.z);
    const zL = new THREE.Vector3(localZ.x, localZ.y, localZ.z);
    const yW = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3().copy(yW).projectOnPlane(zL);
    if (v.lengthSq() < 0.0001) return 0;
    return rotateAlongAxisTo(v, zL, yL);
}

function getBodyYaw2(body: CANNON.Body) {
    const localY = body.vectorToWorldFrame(new CANNON.Vec3(0, 1, 0));
    const localZ = body.vectorToWorldFrame(new CANNON.Vec3(0, 0, 1));
    const yL = new THREE.Vector3(localY.x, localY.y, localY.z);
    const zL = new THREE.Vector3(localZ.x, localZ.y, localZ.z);
    const zW = new THREE.Vector3(0, 0, 1);
    const v = new THREE.Vector3().copy(zW).projectOnPlane(yL);
    if (v.lengthSq() < 0.0001) return 0;
    let yawAngle = rotateAlongAxisTo(v, yL, zL);
    if (yawAngle < 0) yawAngle += Math.PI * 2;
    if (yawAngle > Math.PI * 2) yawAngle %= Math.PI * 2;
    return yawAngle;
}

// --- 2. Simulation Component ---

const Simulation: React.FC<SimulationProps> = ({ onUpdate }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  
  // Simulation State Refs
  const droneBodyRef = useRef<CANNON.Body | null>(null);
  const isArmedRef = useRef(false);
  const targetAltRef = useRef(0); 
  const motorSpeedsRef = useRef<[number,number,number,number]>([0,0,0,0]);
  
  // Game State Refs
  const gameActiveRef = useRef(false);
  const gameStartTimeRef = useRef(0);
  const currentCheckpointRef = useRef(0);
  const gameFinishedRef = useRef(false);
  const checkpointsRef = useRef<{ pos: THREE.Vector3, radius: number, mesh: THREE.Group }[]>([]);

  // UI Smoothing Refs
  const uiMotorSpeeds = useRef<[number,number,number,number]>([0,0,0,0]);

  // Dynamic Scene Refs
  const sunLightRef = useRef<THREE.DirectionalLight>(null);

  // PID State
  const servoState = useRef({
      hover: { integral: 0, lastError: 0 },
      roll: { integral: 0, lastError: 0 },
      pitch: { integral: 0, lastError: 0 },
      yaw: { integral: 0, lastError: 0, ref: 0 }, 
      initialized: false
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // --- Scene Init (Pro Arena Theme) ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xdbeafe); // Slightly cooler blue
    scene.fog = new THREE.Fog(0xdbeafe, 20, 100);

    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 3, 6); 
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(20, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 4096;
    sun.shadow.mapSize.height = 4096;
    sun.shadow.bias = -0.0005;
    const shadowSize = 40;
    sun.shadow.camera.left = -shadowSize;
    sun.shadow.camera.right = shadowSize;
    sun.shadow.camera.top = shadowSize;
    sun.shadow.camera.bottom = -shadowSize;
    
    scene.add(sun);
    scene.add(sun.target);
    sunLightRef.current = sun;

    // Environment: Tech Grid Floor
    const planeGeom = new THREE.PlaneGeometry(300, 300);
    const planeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 }); 
    const plane = new THREE.Mesh(planeGeom, planeMat);
    plane.rotation.x = -Math.PI / 2;
    plane.receiveShadow = true;
    scene.add(plane);

    const gridHelper = new THREE.GridHelper(300, 150, 0x94a3b8, 0xcbd5e1);
    scene.add(gridHelper);

    // --- Cannon Init ---
    const world = new CANNON.World();
    world.gravity.set(0, -10, 0);
    (world.solver as CANNON.GSSolver).iterations = 20;
    
    const SIZE = 1; 
    const MASS = 5;
    const PROP_KK = 0.1; 
    const KT = 0.5;

    // --- Drone Physics Body ---
    const body = new CANNON.Body({ mass: MASS });
    // Fuselage
    body.addShape(new CANNON.Box(new CANNON.Vec3(SIZE * 0.25, SIZE * 0.075, SIZE * 0.6)), new CANNON.Vec3(0, 0, 0));
    // Battery (Rear)
    body.addShape(new CANNON.Box(new CANNON.Vec3(SIZE * 0.2, SIZE * 0.06, SIZE * 0.15)), new CANNON.Vec3(0, SIZE * 0.1, SIZE * 0.46));
    // Nose (Front)
    body.addShape(new CANNON.Box(new CANNON.Vec3(SIZE * 0.1, SIZE * 0.04, SIZE * 0.05)), new CANNON.Vec3(0, 0, -SIZE * 0.62));
    // Gimbal (Bottom)
    body.addShape(new CANNON.Sphere(SIZE * 0.12), new CANNON.Vec3(0, -SIZE * 0.1, -SIZE * 0.5));

    // Motors & Legs
    const motorShape = new CANNON.Cylinder(0.15, 0.15, 0.15, 8);
    const legShape = new CANNON.Cylinder(0.04, 0.03, 0.3, 8); 
    const addArmPhysics = (x: number, z: number) => {
       const qRot = new CANNON.Quaternion();
       qRot.setFromAxisAngle(new CANNON.Vec3(1,0,0), Math.PI/2);
       body.addShape(motorShape, new CANNON.Vec3(x, 0.1, z), qRot);
       body.addShape(legShape, new CANNON.Vec3(x, -0.15, z), qRot);
    };
    addArmPhysics(-SIZE, SIZE);
    addArmPhysics(-SIZE, -SIZE);
    addArmPhysics(SIZE, -SIZE);
    addArmPhysics(SIZE, SIZE);

    body.position.set(0, 0.6, 0); 
    
    // ADJUSTED PHYSICS: Increased damping to reduce "slippery" inertia
    body.linearDamping = 0.6; // Was 0.1
    body.angularDamping = 0.6; // Was 0.1
    
    world.addBody(body);
    droneBodyRef.current = body;

    const groundBody = new CANNON.Body({ mass: 0 });
    groundBody.addShape(new CANNON.Plane());
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(groundBody);

    // --- GAME LEVEL DESIGN ---
    
    // 1. Static Obstacles (Industrial blocks)
    const obstMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.6 });
    const addObstacle = (w: number, h: number, d: number, x: number, z: number) => {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), obstMat);
        mesh.position.set(x, h/2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);

        const ob = new CANNON.Body({ mass: 0 });
        ob.addShape(new CANNON.Box(new CANNON.Vec3(w/2, h/2, d/2)));
        ob.position.set(x, h/2, z);
        world.addBody(ob);
    };

    // Arena Walls
    addObstacle(4, 5, 2, 8, -10);
    addObstacle(4, 8, 2, -8, -10);
    addObstacle(2, 4, 10, 15, 0);
    addObstacle(2, 4, 10, -15, 0);
    
    // Container-like structures
    addObstacle(3, 3, 6, -10, 15);
    addObstacle(3, 3, 6, 10, 20);

    // 2. Racing Checkpoints (Torus Gates)
    // Points: Position(x,y,z), Rotation Y (deg)
    // ADJUSTED LEVEL DESIGN: Moved first gate further away
    const gateData = [
        { x: 0, y: 2.5, z: -15, ry: 0 },   // 1. Start straight (Moved further)
        { x: -8, y: 4, z: -25, ry: 30 },   // 2. Left high (Adjusted for flow)
        { x: 0, y: 3, z: -35, ry: 0 },     // 3. Back straight
        { x: 12, y: 2, z: -15, ry: -45 },  // 4. Right low
        { x: 8, y: 5, z: 0, ry: -90 },     // 5. Right high turn
        { x: 0, y: 2, z: 10, ry: 0 },      // 6. Home stretch
        { x: 0, y: 1.5, z: 0, ry: 0 }      // 7. Landing Target
    ];

    const gateGeo = new THREE.TorusGeometry(1.5, 0.15, 16, 32);
    const gateActiveMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, toneMapped: false }); // Cyan Neon
    const gateInactiveMat = new THREE.MeshBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.3 });
    const gateFinishedMat = new THREE.MeshBasicMaterial({ color: 0x22c55e, toneMapped: false }); // Green

    const checkpointMeshes: THREE.Group[] = [];

    gateData.forEach((g, i) => {
        const group = new THREE.Group();
        group.position.set(g.x, g.y, g.z);
        group.rotation.y = g.ry * Math.PI / 180;

        const mesh = new THREE.Mesh(gateGeo, gateInactiveMat.clone());
        group.add(mesh);

        // Gate number text (simplified as a small glowing sphere above)
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicMaterial({color: 0xffffff}));
        dot.position.y = 2.0;
        group.add(dot);

        scene.add(group);
        checkpointMeshes.push(group);

        checkpointsRef.current.push({
            pos: new THREE.Vector3(g.x, g.y, g.z),
            radius: 2.0, // Hit tolerance
            mesh: group
        });
    });

    // --- Enhanced Visual Model ---
    const droneMesh = new THREE.Group();
    scene.add(droneMesh);

    // ... (Retaining previous materials)
    const whitePlastic = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.1, clearcoat: 0.8 });
    const darkGrey = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
    const sensorBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 });
    const armMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4 });
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6 });
    const propMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.8, opacity: 0.3, transparent: true, roughness: 0.1 });
    const propBladeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd });

    // Rebuild visual drone mesh (same as previous optimized version)
    const fuselage = new THREE.Mesh(new THREE.BoxGeometry(SIZE*0.5, SIZE*0.15, SIZE*1.2), whitePlastic);
    fuselage.castShadow = true;
    fuselage.receiveShadow = true;
    droneMesh.add(fuselage);
    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(SIZE*0.35, SIZE*0.08, SIZE*0.6), whitePlastic);
    cockpit.position.set(0, SIZE*0.12, -SIZE*0.1);
    fuselage.add(cockpit);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(SIZE*0.2, SIZE*0.08, SIZE*0.1), sensorBlack);
    nose.position.set(0, 0, -SIZE*0.62);
    fuselage.add(nose);
    const gimbal = new THREE.Mesh(new THREE.SphereGeometry(SIZE*0.12, 16, 16), sensorBlack);
    gimbal.position.set(0, -SIZE*0.1, -SIZE*0.5);
    fuselage.add(gimbal);
    const battery = new THREE.Mesh(new THREE.BoxGeometry(SIZE*0.4, SIZE*0.12, SIZE*0.3), darkGrey);
    battery.position.set(0, SIZE*0.1, SIZE*0.46); 
    fuselage.add(battery);
    const pwrBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02), new THREE.MeshBasicMaterial({color: 0x00ff00}));
    pwrBtn.position.set(0, 0.07, 0);
    battery.add(pwrBtn);

    const armGeom = new THREE.CylinderGeometry(0.06, 0.04, SIZE*1.4, 8);
    armGeom.rotateX(Math.PI/2); 
    const createArm = (xDir: number, zDir: number) => {
        const armGroup = new THREE.Group();
        const armMesh = new THREE.Mesh(armGeom, armMat);
        armMesh.position.set(xDir * SIZE*0.25, 0, zDir * SIZE*0.25);
        armMesh.lookAt(xDir * SIZE, 0, zDir * SIZE);
        const dist = Math.sqrt(Math.pow(SIZE - SIZE*0.25, 2) + Math.pow(SIZE - SIZE*0.25, 2));
        armMesh.scale.z = dist / (SIZE*1.4);
        armMesh.translateZ(dist/2);
        armMesh.castShadow = true;
        armMesh.receiveShadow = true;
        armGroup.add(armMesh);
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.15, 16), motorMat);
        motor.position.set(xDir * SIZE, 0.1, zDir * SIZE);
        motor.castShadow = true;
        armGroup.add(motor);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03*SIZE, 0.02*SIZE, 0.3*SIZE), darkGrey);
        leg.position.set(xDir * SIZE, -0.15 * SIZE, zDir * SIZE);
        leg.castShadow = true;
        leg.receiveShadow = true;
        armGroup.add(leg);
        const isFront = zDir < 0;
        const ledColor = isFront ? 0xffffff : 0xff0000; 
        const ledGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.set(xDir * SIZE, -0.05, zDir * SIZE);
        armGroup.add(led);
        const light = new THREE.PointLight(ledColor, 1, 2);
        light.position.set(xDir * SIZE, -0.2, zDir * SIZE);
        armGroup.add(light);
        return { group: armGroup, motorPos: new THREE.Vector3(xDir * SIZE, 0.2, zDir * SIZE) };
    };

    const props: THREE.Object3D[] = [];
    const armConfigs = [{ x: -1, z: 1 }, { x: -1, z: -1 }, { x: 1, z: -1 }, { x: 1, z: 1 }];
    armConfigs.forEach((conf) => {
        const { group, motorPos } = createArm(conf.x, conf.z);
        droneMesh.add(group);
        const propGroup = new THREE.Group();
        propGroup.position.copy(motorPos);
        droneMesh.add(propGroup);
        const bladeGeom = new THREE.BoxGeometry(1.6, 0.02, 0.12);
        const blade = new THREE.Mesh(bladeGeom, propBladeMat);
        propGroup.add(blade);
        const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.01, 32), propMat);
        disk.position.y = 0.01;
        propGroup.add(disk);
        props.push(propGroup);
    });

    // --- Control Loop ---
    const clamp = (val:number, min:number, max:number) => Math.min(Math.max(val,min),max);

    const controlLoop = () => {
        const dt = 1/60;
        const body = droneBodyRef.current!;
        const keys = keysRef.current;
        const isArmed = isArmedRef.current;

        if (!isArmed) {
            servoState.current.hover.integral = 0;
            motorSpeedsRef.current = [0,0,0,0];
            return;
        }

        if (!servoState.current.initialized) {
             servoState.current.yaw.ref = getBodyYaw2(body);
             servoState.current.initialized = true;
        }

        const pitchAngle = getBodyPitch2(body);
        const rollAngle = getBodyRoll2(body);
        const yawAngle = getBodyYaw2(body);

        if (keys['arrowup']) targetAltRef.current += 0.05;
        if (keys['arrowdown']) targetAltRef.current -= 0.05;
        targetAltRef.current = Math.max(0, targetAltRef.current);

        const MAX_TILT = 0.6; // Increased agility for racing
        let rollRef = 0;
        if (keys['a']) rollRef = MAX_TILT; 
        if (keys['d']) rollRef = -MAX_TILT;
        
        let pitchRef = 0;
        if (keys['w']) pitchRef = -MAX_TILT; 
        if (keys['s']) pitchRef = MAX_TILT;

        const YAW_SPEED = 3.5; 
        if (keys['arrowleft']) {
            servoState.current.yaw.ref += YAW_SPEED * dt;
        }
        if (keys['arrowright']) {
            servoState.current.yaw.ref -= YAW_SPEED * dt;
        }
        
        // --- PID (Tuned) ---
        const yref = targetAltRef.current;
        const hSt = servoState.current.hover;
        let hError = yref - body.position.y;
        hSt.integral += hError * dt;
        hSt.integral = clamp(hSt.integral, -50, 50);
        let omega = 15 * hError + 4 * hSt.integral + 16 * (-body.velocity.y);
        omega = clamp(omega, 0, 100); 

        const pSt = servoState.current.pitch;
        let pError = pitchRef - pitchAngle;
        pSt.integral += pError * dt;
        const pDiff = (pError - pSt.lastError)/dt;
        pSt.lastError = pError;
        let rPitch = 12.0 * pError + 0 * pSt.integral + 18 * pDiff;
        rPitch = clamp(rPitch, -omega*0.25, omega*0.25);

        const rSt = servoState.current.roll;
        let rError = rollRef - rollAngle;
        rSt.integral += rError * dt;
        const rDiff = (rError - rSt.lastError)/dt;
        rSt.lastError = rError;
        let rRoll = 12.0 * rError + 0 * rSt.integral + 16 * rDiff;
        rRoll = clamp(rRoll, -omega*0.25, omega*0.25);

        const ySt = servoState.current.yaw;
        let yError = ySt.ref - yawAngle;
        while (yError > Math.PI) yError -= 2*Math.PI;
        while (yError < -Math.PI) yError += 2*Math.PI;
        ySt.integral += yError * dt;
        const yDiff = (yError - ySt.lastError)/dt;
        ySt.lastError = yError;
        let rYaw = 5.0 * yError + 0.5 * ySt.integral + 15 * yDiff;
        rYaw = clamp(rYaw, -omega, omega);

        const w0 = omega - rYaw - rRoll - rPitch;
        const w1 = omega + rYaw - rRoll + rPitch;
        const w2 = omega - rYaw + rRoll + rPitch;
        const w3 = omega + rYaw + rRoll - rPitch;

        motorSpeedsRef.current = [w0, w1, w2, w3];

        const applyMotor = (w: number, x:number, z:number, dir:number) => {
             const val = Math.max(0, w);
             const thrust = PROP_KK * val * val;
             body.applyLocalForce(new CANNON.Vec3(0, thrust, 0), new CANNON.Vec3(x, 0, z));
             const dragMagnitude = dir * KT * val * val;
             const localTorque = new CANNON.Vec3(0, dragMagnitude, 0);
             const worldTorque = body.quaternion.vmult(localTorque);
             body.torque.vadd(worldTorque, body.torque);
        };

        applyMotor(w0, -SIZE, SIZE, -1);
        applyMotor(w1, -SIZE, -SIZE, 1);
        applyMotor(w2, SIZE, -SIZE, -1);
        applyMotor(w3, SIZE, SIZE, 1);
    };

    world.addEventListener('postStep', controlLoop);

    // --- Animation Loop ---
    let frameId: number;
    let frameCount = 0;
    const sunOffset = new THREE.Vector3(20, 50, 20); 
    
    const animate = () => {
        frameCount++;
        frameId = requestAnimationFrame(animate);
        world.step(1/60);

        if (droneBodyRef.current) {
            // FIX: Explicitly Convert Cannon Vec3 to Three Vector3
            const bPos = droneBodyRef.current.position;
            const pos = new THREE.Vector3(bPos.x, bPos.y, bPos.z);
            
            droneMesh.position.copy(pos);
            droneMesh.quaternion.copy(droneBodyRef.current.quaternion as unknown as THREE.Quaternion);

            if (sunLightRef.current) {
                const s = sunLightRef.current;
                s.position.copy(droneMesh.position).add(sunOffset);
                s.target.position.copy(droneMesh.position);
                s.target.updateMatrixWorld();
            }

            // --- Game Logic Check ---
            if (gameActiveRef.current && !gameFinishedRef.current) {
                const targetIdx = currentCheckpointRef.current;
                if (targetIdx < checkpointsRef.current.length) {
                    const target = checkpointsRef.current[targetIdx];
                    // Using THREE.Vector3.distanceTo
                    const dist = pos.distanceTo(target.pos);
                    if (dist < target.radius) {
                        // Checkpoint Cleared!
                        currentCheckpointRef.current++;
                        if (currentCheckpointRef.current >= checkpointsRef.current.length) {
                            gameFinishedRef.current = true;
                        }
                    }
                }
            }

            // --- Chase Camera Logic (Yaw Follow) ---
            const dQuat = droneBodyRef.current.quaternion;
            const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(dQuat.x, dQuat.y, dQuat.z, dQuat.w), 'YXZ');
            const yaw = euler.y;
            
            // Calculate camera position: behind drone based on Yaw
            // Offset: 7m back, 3m up relative to drone orientation
            const offsetDist = 7;
            const offsetHeight = 3;
            
            const offsetX = Math.sin(yaw) * offsetDist;
            const offsetZ = Math.cos(yaw) * offsetDist;
            
            const targetCamPos = new THREE.Vector3(
                pos.x + offsetX,
                pos.y + offsetHeight,
                pos.z + offsetZ
            );
            
            camera.position.lerp(targetCamPos, 0.1);
            // Now safe to use clone() and add() on pos which is a THREE.Vector3
            camera.lookAt(pos.clone().add(new THREE.Vector3(0, 0.5, 0)));
        }

        // Visual Updates for Gates
        checkpointsRef.current.forEach((cp, i) => {
             const mesh = cp.mesh.children[0] as THREE.Mesh;
             const dot = cp.mesh.children[1] as THREE.Mesh;
             if (i < currentCheckpointRef.current) {
                 // Cleared
                 mesh.material = gateFinishedMat;
                 (dot.material as THREE.MeshBasicMaterial).color.setHex(0x22c55e);
             } else if (i === currentCheckpointRef.current && gameActiveRef.current && !gameFinishedRef.current) {
                 // Active Target
                 mesh.material = gateActiveMat;
                 (dot.material as THREE.MeshBasicMaterial).color.setHex(0x06b6d4);
                 // Spin active gate
                 cp.mesh.rotation.z += 0.02; 
             } else {
                 // Future
                 mesh.material = gateInactiveMat;
                 (dot.material as THREE.MeshBasicMaterial).color.setHex(0x334155);
             }
        });

        const speeds = motorSpeedsRef.current;
        props.forEach((mesh, i) => {
            const dir = (i === 0 || i === 2) ? -1 : 1;
            mesh.rotation.y += speeds[i] * 0.1 * dir;
            const blurDisk = mesh.children[1] as THREE.Mesh;
            if (blurDisk) {
                const material = blurDisk.material as THREE.MeshPhysicalMaterial;
                material.opacity = Math.min(0.8, speeds[i] / 50);
            }
        });

        renderer.render(scene, camera);

        // Telemetry Update
        const smoothing = 0.1;
        uiMotorSpeeds.current = uiMotorSpeeds.current.map((curr, i) => 
             curr + (speeds[i] - curr) * smoothing
        ) as [number,number,number,number];

        if (frameCount % 6 === 0) {
             const b = droneBodyRef.current!;
             const q = b.quaternion;
             const e = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w));
             
             let timeElapsed = 0;
             if (gameActiveRef.current && !gameFinishedRef.current) {
                 timeElapsed = (Date.now() - gameStartTimeRef.current) / 1000;
             } else if (gameFinishedRef.current) {
                // If finished, hold the last time (approx)
                // In a real app we would store the finish timestamp
             }

             onUpdate({
                 motorSpeeds: uiMotorSpeeds.current,
                 altitude: b.position.y,
                 targetAltitude: targetAltRef.current,
                 velocity: b.velocity.length(),
                 orientation: { pitch: e.x, roll: e.z, yaw: e.y },
                 heading: (e.y < 0 ? e.y + 2*Math.PI : e.y) * 180 / Math.PI,
                 isArmed: isArmedRef.current,
                 gameState: {
                     isActive: gameActiveRef.current,
                     currentCheckpointIndex: currentCheckpointRef.current,
                     totalCheckpoints: checkpointsRef.current.length,
                     timeElapsed: timeElapsed,
                     isFinished: gameFinishedRef.current
                 }
             });
        }
    };
    animate();

    const onKey = (e: KeyboardEvent, down: boolean) => {
        const k = e.key.toLowerCase();
        keysRef.current[k] = down;
        
        if (down) {
            if (k === 'm') {
                isArmedRef.current = !isArmedRef.current;
                if (isArmedRef.current) {
                    servoState.current.yaw.ref = getBodyYaw2(droneBodyRef.current!);
                    targetAltRef.current = Math.max(1, droneBodyRef.current!.position.y);
                }
            }
            if (k === 'r') {
                // Reset Drone
                const b = droneBodyRef.current!;
                b.position.set(0, 1.0, 0); 
                b.quaternion.set(0,0,0,1);
                b.velocity.set(0,0,0);
                b.angularVelocity.set(0,0,0);
                b.force.set(0,0,0);
                b.torque.set(0,0,0);
                targetAltRef.current = 0;
                isArmedRef.current = false;
                
                // Reset Game
                gameActiveRef.current = false;
                gameFinishedRef.current = false;
                currentCheckpointRef.current = 0;
            }
            if (k === 'g') {
                // Start Game
                if (!gameActiveRef.current) {
                    gameActiveRef.current = true;
                    gameStartTimeRef.current = Date.now();
                    gameFinishedRef.current = false;
                    currentCheckpointRef.current = 0;
                    
                    // Auto-Arm if not armed
                    if(!isArmedRef.current) {
                        isArmedRef.current = true;
                        targetAltRef.current = 1.5;
                    }
                }
            }
        }
    };
    window.addEventListener('keydown', (e) => onKey(e, true));
    window.addEventListener('keyup', (e) => onKey(e, false));
    const onResize = () => {
        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
        window.removeEventListener('resize', onResize);
        window.removeEventListener('keydown', (e) => onKey(e, true));
        window.removeEventListener('keyup', (e) => onKey(e, false));
        world.removeEventListener('postStep', controlLoop);
        cancelAnimationFrame(frameId);
        if(containerRef.current) containerRef.current.removeChild(renderer.domElement);
    };

  }, [onUpdate]);

  return <div ref={containerRef} className="absolute inset-0" />;
};

export default Simulation;