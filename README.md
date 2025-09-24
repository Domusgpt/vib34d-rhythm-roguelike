# 🎮 VIB34D RHYTHM ROGUELIKE

A mathematically-driven rhythm game that generates infinite 4D geometric challenges from any audio input.

## 🌟 What Makes This Unique

- **Infinite Content**: Every song creates unique challenges through real-time audio analysis
- **4D Mathematics**: Navigate hypercubes, Klein bottles, and other impossible geometries
- **Multiple Input Sources**: Microphone, audio files, or streaming audio
- **Parameter-Driven Gameplay**: 11 mathematical parameters create endless variety
- **4 Visualization Systems**: From simple patterns to complex 4D polytopes

## 🎵 How It Works

1. **Audio Analysis**: Real-time FFT analysis breaks music into frequency bands
2. **Parameter Mapping**: Audio data drives 11 mathematical parameters
3. **Challenge Generation**: Geometric challenges emerge from parameter combinations
4. **Player Navigation**: Interact with 4D mathematical visualizations
5. **Infinite Scaling**: Difficulty scales through mathematical complexity

## 🎯 Gameplay

### **8 Geometric Challenge Types**
- **TETRAHEDRON**: Precision vertex targeting
- **HYPERCUBE**: 4D face navigation
- **SPHERE**: Orbital trajectory maintenance
- **TORUS**: Circular flow riding
- **KLEIN BOTTLE**: Impossible surface traversal
- **FRACTAL**: Multi-scale recursive patterns
- **WAVE**: Sinusoidal crest surfing
- **CRYSTAL**: Angular facet alignment

### **4 Visualization Systems**
- **🔷 FACETED**: Simple 2D patterns (best for learning)
- **🌌 QUANTUM**: Complex 3D lattice effects
- **✨ HOLOGRAPHIC**: Audio-reactive shimmer effects
- **🔮 POLYCHORA**: True 4D polytope mathematics

## 🚀 Quick Start

```bash
# Clone the repository
git clone [repository-url]
cd vib34d-rhythm-roguelike

# Serve locally (requires web server due to ES6 modules)
python3 -m http.server 8000
# or
npx serve -p 8000

# Open in browser
open http://localhost:8000
```

### **Requirements**
- Modern browser with WebGL 2.0 support
- Audio input permission for microphone mode
- ES6 module support

## 🎮 Controls

- **Space**: Pause/Resume
- **Mouse/Touch**: Navigate geometric challenges
- **Audio Input**: Drives all challenge generation

## 🏗️ Architecture

### **Core Systems**
```
src/
├── main.js                 # Game coordinator
├── core/
│   ├── VisualizerEngine.js  # 4-system visualization manager
│   ├── Parameters.js        # 11-parameter system
│   └── [4 visualization engines]
├── game/
│   ├── LatticePulseGame.js # Game logic
│   └── [modular game systems]
└── ui/
    └── GameUI.js           # HUD and feedback
```

### **Key Technologies**
- **WebGL 2.0**: Hardware-accelerated 4D mathematics
- **Web Audio API**: Real-time frequency analysis
- **ES6 Modules**: Modern JavaScript architecture
- **Mathematical Visualization**: Complex geometry rendering

## 🔧 Development

### **Adding New Challenges**
```javascript
// Define in challenge system
spawnChallenge({
    type: 'your_challenge_type',
    geometry: geometryIndex,
    parameters: { /* mathematical parameters */ },
    playerAction: 'required_interaction',
    successCondition: 'win_condition'
});
```

### **Parameter System**
All gameplay emerges from 11 mathematical parameters:
```javascript
{
    geometry: 0-7,           // Shape type
    rot4dXW/YW/ZW: -2 to 2,  // 4D rotations
    dimension: 3.0-4.5,      // Dimensional complexity
    gridDensity: 4-100,      // Detail level
    morphFactor: 0-2,        // Shape transformation
    chaos: 0-1,              // Randomization
    speed: 0.1-3,            // Animation speed
    hue: 0-360,              // Color
    intensity: 0-1,          // Brightness
    saturation: 0-1          // Color purity
}
```

### **Audio → Parameter Mapping**
```javascript
// Real-time audio analysis drives parameters
Bass (20-200Hz) → gridDensity → Mesh complexity
Mid (200-2000Hz) → 4D rotation → Spatial challenges
High (2000-20000Hz) → chaos → Unpredictability
Energy → visual feedback → Timing windows
```

## 🎨 Customization

### **Adding Geometries**
1. Add geometry name to `Parameters.js`
2. Implement in each visualization system
3. Define unique interaction patterns
4. Add challenge generation logic

### **Creating New Visualizers**
1. Implement `VisualizationSystem` interface
2. Register in `VisualizerEngine`
3. Add parameter mapping
4. Define system-specific challenges

## 📊 Performance

### **Optimization Levels**
- **Desktop**: 60fps, full effects, all systems
- **Mobile**: 30fps, optimized effects, faceted system
- **Low-end**: Reduced parameters, simplified rendering

### **Browser Support**
- Chrome 60+ (recommended)
- Firefox 60+
- Safari 12+
- Mobile browsers with WebGL support

## 📱 Mobile Experience

- **Adaptive Profiles**: Auto-detects device tiers (flagship, performance, battery) and tunes render scale, shader density, and audio analysis fidelity accordingly.
- **Touch Enhancements**: On-screen control center for graphics quality, haptics, and tilt steering toggles built for thumb-friendly access.
- **Performance Telemetry**: Live FPS and audio latency readouts help players monitor headroom while the engine auto-balances detail.
- **Orientation Awareness**: Smart overlay guides players to rotate into hyperwide landscape when needed.
- **Session Persistence**: Remembers last audio source, stream URL, and preferred mobile settings across launches.

## 🎆 Sensory Feedback Layer

- **Beat Ripples & Pulse Rings**: Every beat spawns layered ripples, glowing pulse rings, and floating sync markers that reuse shared shaders for consistent motion language.
- **HUD Micro-Animations**: Score bursts, combo surges, geometry sigils, and health shocks all draw from the same feedback director so every event gets 5–10 coordinated reactions without bespoke code per element.
- **Ambient Telemetry**: Background gradients, combo trails, audio bars, and mobile callouts reference unified audio energy metrics—giving music, UI, and touch toggles a single vocabulary of color, motion, and sound cues.

## 🎵 Audio Support

### **Input Sources**
- **Microphone**: Real-time audio analysis
- **File Upload**: MP3, WAV, OGG, M4A
- **Streaming**: Direct audio URL input

### **Audio Analysis**
- FFT size: 2048 samples
- Update rate: 60fps
- Frequency bands: Bass, Mid, High + Energy
- Beat detection: Adaptive threshold with history

## 🚀 Deployment

### **Static Hosting**
Deploy to any static hosting service:
- GitHub Pages
- Netlify
- Vercel
- CloudFlare Pages

### **Requirements**
- HTTPS for microphone access
- CORS headers for audio streaming
- Modern browser support

## 🔮 Future Development

### **Planned Features**
- **Level Progression**: Structured campaigns
- **Multiplayer**: Synchronized challenges
- **VR Support**: Immersive 4D interaction
- **Custom Visualizers**: User-created patterns

### **Mathematical Expansion**
- **Higher Dimensions**: 5D, 6D geometries
- **Non-Euclidean**: Hyperbolic, elliptic spaces
- **Topology**: Real-time surface changes
- **Quantum**: Probabilistic geometric states

## 📝 License

[License information]

## 🤝 Contributing

See [AGENTS.md](AGENTS.md) for detailed development documentation and contribution guidelines.

---

**Experience 4D mathematics through music. Every song becomes a unique geometric journey.**