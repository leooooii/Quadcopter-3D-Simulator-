# 🛸 Quadcopter Simulation

<div align="center">
<img width="1200" alt="Quadcopter Simulation" src="./components/quadcopter.gif"/>
</div>

A fully interactive **3D quadcopter simulation** built with **Three.js** and **Cannon.js**, featuring realistic physics, PID-based flight control, and immersive camera tracking.  
This project demonstrates the fundamentals of drone stabilization and browser-based physics simulation through a playable mini flight experience.

---
Explore more on my website:  
👉 **[Click to experience](https://leooooii.github.io/Quadcopter-3D-Simulator-/index.html)**

# 📘 Project Overview

This simulation models a quadcopter in a physically accurate environment using:

- **Three.js** → 3D rendering, lighting, camera movement, model visualization  
- **Cannon.js** → Physics engine for forces, torques, collisions, inertia, and rigid-body dynamics  
- **PID Controller** → Stabilizes roll, pitch, and yaw, simulating real drone flight behavior  

The result is a lightweight but realistic drone simulation that runs entirely in the browser, offering hands-on insight into **flight dynamics**, **control systems**, and **3D interaction**.

---


# 🎮 Controls

Use these keys to fly the quadcopter:

### 🔌 Power & System Control  
- **M** — Toggle motor power (start/stop)

### ✈ Movement  
- **Arrow Up / Down** — Ascend / Descend  
- **Arrow Left / Right** — Rotate (Yaw left / right)

### 🎚 Directional Flight  
- **W / S** — Move forward / backward (Pitch)  
- **A / D** — Roll left / right

The controls mirror real quadcopter inputs, making the simulation intuitive but challenging—just like flying an actual drone.

---

# 🌟 Key Features

### 🛠 Real-Time Physics Simulation  
- Built with **Cannon.js** rigid-body physics  
- Models forces, torque, gravity, inertia, and drag  
- Accurate behavior for roll, pitch, yaw, and thrust  

### 🎯 PID-Based Flight Controller  
A custom-designed PID controller stabilizes the drone by:

- Monitoring orientation errors  
- Applying corrective torque  
- Regulating motor output  
- Maintaining smooth & balanced flight  

This mimics real-world flight stabilization systems used in drones like DJI or Betaflight.

### 🎨 Immersive 3D Environment  
- Realistic quadcopter model  
- Dynamic lighting & shadows  
- Smooth camera tracking  
- Atmospheric environment effects  

### 🌐 Browser-Based Simulation  
Runs directly in the browser with no installation required.  
Perfect for educational demos, prototyping, and interactive visualization.

---

# 🧩 Technical Highlights

- Developed a **real-time quadcopter physics model** using Cannon.js  
- Implemented **PID flight-control logic** for stable hover and directional movement  
- Built the drone’s **3D model and scene environment** using Three.js  
- Integrated **camera follow systems**, dynamic lighting, and custom animation effects  
- Designed an interactive flight system using keyboard input and joystick-like control mapping  

---