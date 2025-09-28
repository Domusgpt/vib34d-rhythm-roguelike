/**
 * HYPERCUBE GAME SYSTEM - HYPER BOMBASTIC 4D VISUALIZATION
 * Most exciting geometric experience ever created!
 * Every interaction gives RICH TACTILE SATISFYING INFORMATIVE FEEDBACK
 */

export class HypercubeGameSystem {
    constructor(options = {}) {
        const {
            canvas,
            canvasResources = null,
            resourceManager = null,
            systemName = 'hypercube',
        } = typeof options === 'object' ? options : { canvas: options };

        this.canvasResources = canvasResources;
        this.resourceManager = resourceManager;
        this.systemName = systemName;

        const pooledCanvas = canvasResources?.canvas ?? null;
        this.canvas = pooledCanvas || canvas;

        if (!this.canvas) {
            throw new Error('HypercubeGameSystem requires a canvas element');
        }

        const pooledContext = canvasResources?.context ?? null;
        this.gl = pooledContext
            || this.canvas.getContext('webgl2')
            || this.canvas.getContext('webgl')
            || this.canvas.getContext('experimental-webgl');

        if (!this.gl) {
            throw new Error('WebGL not supported - cannot create BOMBASTIC experience');
        }

        this.contextId = canvasResources?.contextId ?? null;

        // HYPER BOMBASTIC GAME STATE - NOT BORING PARAMETERS!
        this.explosiveState = {
            // Visual intensity systems for MAXIMUM IMPACT
            hyperGeometryMode: 'hypertetrahedron', // START WITH ULTIMATE PRECISION GEOMETRY!
            dimensionalIntensity: 4.2, // Higher baseline for maximum impact
            morphExplosion: 0.1, // Subtle base morphing
            rotationChaos: 0.3, // More dynamic rotation
            gridViolence: 10.0, // INTENSE baseline grid density

            // BOMBASTIC effect triggers
            beatExplosion: 0.0,
            comboFireworks: 0.0,
            damageShockwave: 0.0,
            powerUpNova: 0.0,
            enemyGlitchStorm: 0.0,
            bossRealityRift: 0.0,

            // Tactical feedback systems
            healthPulsing: 1.0,
            scoreEuphoria: 0.0,
            levelTranscendence: 0.0,

            // Audio EXPLOSIVE reactivity
            bassThunder: 0.0,
            midLightning: 0.0,
            highStarburst: 0.0,

            // Visual effects arsenal - ENHANCED FOR GAME STATE COMMUNICATION!
            glitchIntensity: 0.15, // Base glitch for digital aesthetic
            moireDistortion: 0.25, // Base moire for tactical information layer
            colorShiftChaos: 0.1, // Subtle color shifting for state awareness
            universeModifier: 1.2, // Enhanced base reality distortion
            patternIntensity: 1.3, // Increased pattern definition

            // HYPER colors for different states
            primaryColor: [1.0, 0.2, 0.8],    // Explosive magenta
            secondaryColor: [0.2, 1.0, 1.0], // Electric cyan
            backgroundColor: [0.05, 0.0, 0.2] // Deep space
        };

        // Color palettes for MAXIMUM VISUAL IMPACT
        this.explosiveColorPalettes = {
            normal: {
                primary: [0.4, 1.0, 1.0],    // Hyper cyan
                secondary: [1.0, 0.2, 0.8],  // Explosive magenta
                background: [0.02, 0.05, 0.2] // Space
            },
            combat: {
                primary: [1.0, 0.1, 0.0],    // VIOLENCE RED
                secondary: [1.0, 0.8, 0.0],  // LIGHTNING YELLOW
                background: [0.2, 0.0, 0.0]   // BLOOD RED
            },
            powerUp: {
                primary: [0.0, 1.0, 0.3],    // NUCLEAR GREEN
                secondary: [1.0, 1.0, 1.0],  // PURE ENERGY WHITE
                background: [0.1, 0.3, 0.1]   // ENERGY FIELD
            },
            boss: {
                primary: [1.0, 0.0, 1.0],    // REALITY MAGENTA
                secondary: [0.3, 0.0, 1.0],  // VOID PURPLE
                background: [0.15, 0.0, 0.15] // DIMENSIONAL RIFT
            },
            critical: {
                primary: [1.0, 0.0, 0.0],    // DEATH RED
                secondary: [1.0, 0.3, 0.0],  // WARNING ORANGE
                background: [0.3, 0.0, 0.0]   // CRITICAL ALERT
            },
            euphoria: {
                primary: [1.0, 1.0, 0.0],    // GOLDEN ECSTASY
                secondary: [1.0, 0.5, 1.0],  // RAINBOW BURST
                background: [0.2, 0.2, 0.0]   // GOLDEN GLOW
            }
        };

        this.initializeExplosiveSystem();
    }

    initializeExplosiveSystem() {
        this.createBombAsticShaders();
        this.createBuffers();
        this.setupExplosiveLoop();

        this.startTime = performance.now();
        this.isExploding = false;

        console.log('🔥💥 HYPERCUBE GAME SYSTEM INITIALIZED - PREPARE FOR BOMBASTIC EXPERIENCE! 💥🔥');
    }

    createBombAsticShaders() {
        const vertexShaderSource = `
            attribute vec2 a_position;
            varying vec2 v_uv;
            void main() {
                v_uv = a_position * 0.5 + 0.5;
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            precision highp float;

            uniform vec2 u_resolution;
            uniform float u_time;

            // BOMBASTIC GAME STATE UNIFORMS
            uniform float u_dimensionalIntensity;
            uniform float u_morphExplosion;
            uniform float u_rotationChaos;
            uniform float u_gridViolence;
            uniform int u_hyperGeometryMode;

            // EXPLOSIVE EVENT TRIGGERS
            uniform float u_beatExplosion;
            uniform float u_comboFireworks;
            uniform float u_damageShockwave;
            uniform float u_powerUpNova;
            uniform float u_enemyGlitchStorm;
            uniform float u_bossRealityRift;

            // TACTICAL FEEDBACK
            uniform float u_healthPulsing;
            uniform float u_scoreEuphoria;
            uniform float u_levelTranscendence;

            // AUDIO EXPLOSIVE REACTIVITY
            uniform float u_bassThunder;
            uniform float u_midLightning;
            uniform float u_highStarburst;

            // VISUAL EFFECTS ARSENAL
            uniform float u_glitchIntensity;
            uniform float u_moireDistortion;
            uniform float u_colorShiftChaos;
            uniform float u_universeModifier;
            uniform float u_patternIntensity;

            // HYPER COLORS
            uniform vec3 u_primaryColor;
            uniform vec3 u_secondaryColor;
            uniform vec3 u_backgroundColor;

            varying vec2 v_uv;

            // 4D ROTATION MATRICES FOR DIMENSIONAL TRANSCENDENCE
            mat4 rotXW(float a){float c=cos(a),s=sin(a);return mat4(c,0,0,-s, 0,1,0,0, 0,0,1,0, s,0,0,c);}
            mat4 rotYW(float a){float c=cos(a),s=sin(a);return mat4(1,0,0,0, 0,c,0,-s, 0,0,1,0, 0,s,0,c);}
            mat4 rotZW(float a){float c=cos(a),s=sin(a);return mat4(1,0,0,0, 0,1,0,0, 0,0,c,-s, 0,0,s,c);}
            mat4 rotXY(float a){float c=cos(a),s=sin(a);return mat4(c,-s,0,0, s,c,0,0, 0,0,1,0, 0,0,0,1);}
            mat4 rotYZ(float a){float c=cos(a),s=sin(a);return mat4(1,0,0,0, 0,c,-s,0, 0,s,c,0, 0,0,0,1);}
            mat4 rotXZ(float a){float c=cos(a),s=sin(a);return mat4(c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1);}

            // COLOR TRANSFORMATION FOR MAXIMUM VISUAL IMPACT
            vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);float e=1e-10;return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);}
            vec3 hsv2rgb(vec3 c){vec4 K=vec4(1.,2./3.,1./3.,3.);vec3 p=abs(fract(c.xxx+K.xyz)*6.-K.www);return c.z*mix(K.xxx,clamp(p-K.xxx,0.,1.),c.y);}

            // 4D TO 3D PROJECTION WITH BOMBASTIC DEPTH
            vec3 project4Dto3D(vec4 p) {
                float baseDistance = 2.50;
                float explosiveDistance = baseDistance + u_bossRealityRift * 3.0 + u_powerUpNova * 2.0;
                float dynamicDistance = max(0.2, explosiveDistance * (1.0 + u_morphExplosion * 0.4 - u_midLightning * 0.35));
                float denominator = dynamicDistance + p.w;
                float w_factor = dynamicDistance / max(0.1, denominator);
                return p.xyz * w_factor;
            }

            // HYPERCUBE GEOMETRY - BOMBASTIC SPATIAL NAVIGATION
            float calculateHypercubeLattice(vec3 p) {
                float explosiveGridDensity = max(0.1, u_gridViolence * (1.0 + u_bassThunder * 2.0 + u_beatExplosion * 1.5));
                float bombAsticLineThickness = max(0.002, 0.03 * (1.0 - u_midLightning * 0.8 + u_damageShockwave * 0.5));

                vec3 p_grid3D = fract(p * explosiveGridDensity * 0.5 + u_time * (0.01 + u_rotationChaos * 0.05));
                vec3 dist3D = abs(p_grid3D - 0.5);
                float box3D = max(dist3D.x, max(dist3D.y, dist3D.z));
                float lattice3D = smoothstep(0.5, 0.5 - bombAsticLineThickness, box3D);

                float finalLattice = lattice3D;
                float dim_factor = smoothstep(3.0, 4.5, u_dimensionalIntensity);

                if (dim_factor > 0.01) {
                    // 4D HYPERCUBE WITH EXPLOSIVE MORPHING
                    float w_coord = sin(p.x*1.4 - p.y*0.7 + p.z*1.5 + u_time * (0.25 + u_comboFireworks * 0.3))
                                  * cos(length(p) * 1.1 - u_time * (0.35 + u_levelTranscendence * 0.2) + u_midLightning * 2.5)
                                  * dim_factor * (0.4 + u_morphExplosion * 0.6 + u_highStarburst * 0.6);

                    vec4 p4d = vec4(p, w_coord);

                    // BOMBASTIC 4D ROTATION WITH EXPLOSIVE SPEED
                    float explosiveSpeed = u_rotationChaos * (1.0 + u_beatExplosion * 2.0 + u_comboFireworks * 1.5);
                    float time_rot1 = u_time * 0.33 * explosiveSpeed + u_highStarburst * 0.25 + u_morphExplosion * 0.45;
                    float time_rot2 = u_time * 0.28 * explosiveSpeed - u_midLightning * 0.28 + u_damageShockwave * 0.4;
                    float time_rot3 = u_time * 0.25 * explosiveSpeed + u_bassThunder * 0.35 + u_powerUpNova * 0.3;

                    p4d = rotXW(time_rot1) * rotYZ(time_rot2 * 1.1) * rotZW(time_rot3 * 0.9) * p4d;
                    p4d = rotYW(u_time * -0.22 * explosiveSpeed + u_morphExplosion * 0.3 + u_bossRealityRift * 0.5) * p4d;

                    vec3 projectedP = project4Dto3D(p4d);
                    vec3 p_grid4D_proj = fract(projectedP * explosiveGridDensity * 0.5 + u_time * (0.015 + u_scoreEuphoria * 0.01));
                    vec3 dist4D_proj = abs(p_grid4D_proj - 0.5);
                    float box4D_proj = max(dist4D_proj.x, max(dist4D_proj.y, dist4D_proj.z));
                    float lattice4D_proj = smoothstep(0.5, 0.5 - bombAsticLineThickness, box4D_proj);
                    finalLattice = mix(lattice3D, lattice4D_proj, smoothstep(0.0, 1.0, u_morphExplosion));
                }

                return pow(finalLattice, 1.0 / max(0.1, u_universeModifier + u_levelTranscendence * 0.5));
            }

            // HYPERSPHERE GEOMETRY - EXPLOSIVE ORBITAL DYNAMICS
            float calculateHypersphereLattice(vec3 p) {
                float radius3D = length(p);
                float explosiveDensityFactor = max(0.1, u_gridViolence * 0.7 * (1.0 + u_bassThunder * 1.5 + u_beatExplosion));
                float bombAsticShellWidth = max(0.005, 0.025 * (1.0 + u_midLightning * 2.5 + u_comboFireworks));
                float phase = radius3D * explosiveDensityFactor * 6.28318 - u_time * u_rotationChaos * (0.8 + u_scoreEuphoria) + u_highStarburst * 3.0;
                float shells3D = 0.5 + 0.5 * sin(phase);
                shells3D = smoothstep(1.0 - bombAsticShellWidth, 1.0, shells3D);

                float finalLattice = shells3D;
                float dim_factor = smoothstep(3.0, 4.5, u_dimensionalIntensity);

                if (dim_factor > 0.01) {
                    // 4D HYPERSPHERE WITH EXPLOSIVE MORPHING
                    float w_coord = cos(radius3D * (2.5 + u_powerUpNova) - u_time * (0.55 + u_bossRealityRift * 0.3))
                                  * sin(p.x*1.0 + p.y*1.3 - p.z*0.7 + u_time*(0.2 + u_damageShockwave * 0.2))
                                  * dim_factor * (0.5 + u_morphExplosion * 0.5 + u_midLightning * 0.5);

                    vec4 p4d = vec4(p, w_coord);

                    // EXPLOSIVE 4D ROTATION
                    float explosiveSpeed = u_rotationChaos * (0.85 + u_comboFireworks + u_levelTranscendence);
                    float time_rot1 = u_time * 0.38 * explosiveSpeed + u_highStarburst * 0.2;
                    float time_rot2 = u_time * 0.31 * explosiveSpeed + u_morphExplosion * 0.6;
                    float time_rot3 = u_time * -0.24 * explosiveSpeed + u_bassThunder * 0.25;

                    p4d = rotXW(time_rot1 * 1.05) * rotYZ(time_rot2) * rotYW(time_rot3 * 0.95) * p4d;

                    vec3 projectedP = project4Dto3D(p4d);
                    float radius4D_proj = length(projectedP);
                    float phase4D = radius4D_proj * explosiveDensityFactor * 6.28318 - u_time * u_rotationChaos * 0.8 + u_highStarburst * 3.0;
                    float shells4D_proj = 0.5 + 0.5 * sin(phase4D);
                    shells4D_proj = smoothstep(1.0 - bombAsticShellWidth, 1.0, shells4D_proj);
                    finalLattice = mix(shells3D, shells4D_proj, smoothstep(0.0, 1.0, u_morphExplosion));
                }

                return pow(max(0.0, finalLattice), max(0.1, u_universeModifier + u_powerUpNova * 0.3));
            }

            // HYPERTETRAHEDRON GEOMETRY - ULTIMATE PRECISION TARGETING
            float calculateHypertetrahedronLattice(vec3 p) {
                float explosiveDensity = max(0.1, u_gridViolence * 0.65 * (1.0 + u_bassThunder * 1.2 + u_beatExplosion * 0.8));
                float bombAsticThickness = max(0.003, 0.035 * (1.0 - u_midLightning * 0.7 + u_damageShockwave * 0.4));

                vec3 c1=normalize(vec3(1,1,1)), c2=normalize(vec3(-1,-1,1)), c3=normalize(vec3(-1,1,-1)), c4=normalize(vec3(1,-1,-1));
                vec3 p_mod3D = fract(p * explosiveDensity * 0.5 + 0.5 + u_time * (0.005 + u_comboFireworks * 0.01)) - 0.5;
                float d1=dot(p_mod3D, c1), d2=dot(p_mod3D, c2), d3=dot(p_mod3D, c3), d4=dot(p_mod3D, c4);
                float minDistToPlane3D = min(min(abs(d1), abs(d2)), min(abs(d3), abs(d4)));
                float lattice3D = 1.0 - smoothstep(0.0, bombAsticThickness, minDistToPlane3D);

                float finalLattice = lattice3D;
                float dim_factor = smoothstep(3.0, 4.5, u_dimensionalIntensity);

                if (dim_factor > 0.01) {
                    // 4D HYPERTETRAHEDRON WITH EXPLOSIVE PRECISION
                    float w_coord = cos(p.x*1.8 - p.y*1.5 + p.z*1.2 + u_time*(0.24 + u_levelTranscendence * 0.1))
                                  * sin(length(p)*1.4 + u_time*(0.18 + u_scoreEuphoria * 0.1) - u_midLightning*2.0 + u_powerUpNova*1.5)
                                  * dim_factor * (0.45 + u_morphExplosion*0.55 + u_highStarburst*0.4 + u_bossRealityRift*0.3);

                    vec4 p4d = vec4(p, w_coord);

                    // EXPLOSIVE 4D TETRAHEDRON ROTATION
                    float explosiveSpeed = u_rotationChaos * (1.15 + u_beatExplosion + u_comboFireworks * 0.8);
                    float time_rot1 = u_time*0.28*explosiveSpeed + u_highStarburst*0.25;
                    float time_rot2 = u_time*0.36*explosiveSpeed - u_bassThunder*0.2 + u_morphExplosion*0.4;
                    float time_rot3 = u_time*0.32*explosiveSpeed + u_midLightning*0.15 + u_damageShockwave*0.2;

                    p4d = rotXW(time_rot1*0.95) * rotYW(time_rot2*1.05) * rotZW(time_rot3) * p4d;
                    vec3 projectedP = project4Dto3D(p4d);

                    vec3 p_mod4D_proj = fract(projectedP * explosiveDensity * 0.5 + 0.5 + u_time * (0.008 + u_levelTranscendence * 0.005)) - 0.5;
                    float dp1=dot(p_mod4D_proj,c1), dp2=dot(p_mod4D_proj,c2), dp3=dot(p_mod4D_proj,c3), dp4=dot(p_mod4D_proj,c4);
                    float minDistToPlane4D = min(min(abs(dp1), abs(dp2)), min(abs(dp3), abs(dp4)));
                    float lattice4D_proj = 1.0 - smoothstep(0.0, bombAsticThickness, minDistToPlane4D);
                    finalLattice = mix(lattice3D, lattice4D_proj, smoothstep(0.0, 1.0, u_morphExplosion));
                }

                return pow(max(0.0, finalLattice), max(0.1, u_universeModifier + u_bossRealityRift * 0.4));
            }

            void main() {
                vec2 aspect = vec2(u_resolution.x / u_resolution.y, 1.0);
                vec2 uv = (v_uv * 2.0 - 1.0) * aspect;

                // BOMBASTIC CAMERA SYSTEM
                vec3 rayOrigin = vec3(0.0, 0.0, -2.5 + u_bossRealityRift * 2.0);
                vec3 rayDirection = normalize(vec3(uv, 1.0));

                // EXPLOSIVE CAMERA MOVEMENT
                float bombAsticRotY = u_time * 0.05 * u_rotationChaos + u_midLightning * 0.1 + u_comboFireworks * 0.15;
                float bombAsticRotX = sin(u_time * 0.03 * u_rotationChaos) * 0.15 + u_highStarburst * 0.1 + u_beatExplosion * 0.2;

                mat4 camMat = rotXY(bombAsticRotX) * rotYZ(bombAsticRotY);
                rayDirection = (camMat * vec4(rayDirection, 0.0)).xyz;

                vec3 p = rayDirection * (1.5 + u_scoreEuphoria * 0.5 + u_powerUpNova * 0.3);

                // CALCULATE GEOMETRY BASED ON MODE
                float latticeValue;
                if (u_hyperGeometryMode == 0) {
                    latticeValue = calculateHypercubeLattice(p);
                } else if (u_hyperGeometryMode == 1) {
                    latticeValue = calculateHypersphereLattice(p);
                } else {
                    latticeValue = calculateHypertetrahedronLattice(p);
                }

                // BOMBASTIC COLOR COMPOSITION
                vec3 baseColor = mix(u_backgroundColor, u_primaryColor, latticeValue);
                baseColor = mix(baseColor, u_secondaryColor, smoothstep(0.2, 0.7, u_midLightning + u_comboFireworks) * latticeValue * 0.6);

                // EXPLOSIVE COLOR EFFECTS
                if (abs(u_colorShiftChaos) > 0.01) {
                    vec3 hsv = rgb2hsv(baseColor);
                    hsv.x = fract(hsv.x + u_colorShiftChaos * 0.5 + u_highStarburst * 0.1 + u_scoreEuphoria * 0.15);
                    baseColor = hsv2rgb(hsv);
                }

                // PATTERN INTENSITY WITH EXPLOSIVE SCALING
                baseColor *= (0.8 + u_patternIntensity * 0.7 + u_levelTranscendence * 0.3);

                // BOMBASTIC GLITCH EFFECTS
                if (u_glitchIntensity > 0.001 || u_enemyGlitchStorm > 0.1 || u_damageShockwave > 0.1) {
                    float totalGlitch = u_glitchIntensity + u_enemyGlitchStorm + u_damageShockwave * 0.8;
                    float glitchPattern = totalGlitch * (0.5 + 0.5 * sin(u_time * 8.0 + p.y * 10.0));

                    // RGB CHANNEL SEPARATION FOR EXPLOSIVE EFFECT
                    vec2 offsetR = vec2(cos(u_time*25. + u_beatExplosion*10.), sin(u_time*18.+p.x*5. + u_comboFireworks*8.)) * glitchPattern * 0.2 * aspect;
                    vec2 offsetB = vec2(sin(u_time*19.+p.y*6. + u_powerUpNova*12.), cos(u_time*28. + u_bossRealityRift*15.)) * glitchPattern * 0.15 * aspect;

                    // CALCULATE GLITCHED GEOMETRY
                    vec3 pR = normalize(vec3(uv + offsetR/aspect, 1.0));
                    pR = (camMat*vec4(pR,0.0)).xyz * (1.5 + u_scoreEuphoria * 0.5);
                    vec3 pB = normalize(vec3(uv + offsetB/aspect, 1.0));
                    pB = (camMat*vec4(pB,0.0)).xyz * (1.5 + u_scoreEuphoria * 0.5);

                    float latticeR, latticeB;
                    if (u_hyperGeometryMode == 0) {
                        latticeR = calculateHypercubeLattice(pR);
                        latticeB = calculateHypercubeLattice(pB);
                    } else if (u_hyperGeometryMode == 1) {
                        latticeR = calculateHypersphereLattice(pR);
                        latticeB = calculateHypersphereLattice(pB);
                    } else {
                        latticeR = calculateHypertetrahedronLattice(pR);
                        latticeB = calculateHypertetrahedronLattice(pB);
                    }

                    vec3 colorR = mix(u_backgroundColor, u_primaryColor, latticeR);
                    colorR = mix(colorR, u_secondaryColor, smoothstep(0.2, 0.7, u_midLightning + u_comboFireworks) * latticeR * 0.6);
                    vec3 colorB = mix(u_backgroundColor, u_primaryColor, latticeB);
                    colorB = mix(colorB, u_secondaryColor, smoothstep(0.2, 0.7, u_midLightning + u_comboFireworks) * latticeB * 0.6);

                    // EXPLOSIVE RGB SEPARATION
                    baseColor = vec3(colorR.r * (1.0 + u_enemyGlitchStorm), baseColor.g, colorB.b * (1.0 + u_damageShockwave));
                    baseColor *= (0.8 + u_patternIntensity * 0.7 + u_levelTranscendence * 0.3);
                }

                // MOIRE DISTORTION FOR TACTICAL INFORMATION
                if (u_moireDistortion > 0.01) {
                    float moirePattern = sin(uv.x * (20.0 + u_moireDistortion * 30.0) + u_time * 2.0)
                                      * sin(uv.y * (22.0 + u_moireDistortion * 35.0) + u_time * 1.8);
                    baseColor += vec3(moirePattern * u_moireDistortion * 0.2 * latticeValue);
                }

                // HEALTH PULSING EFFECT
                if (u_healthPulsing < 0.5) {
                    float healthWarning = (1.0 - u_healthPulsing * 2.0) * (0.5 + 0.5 * sin(u_time * 12.0));
                    baseColor = mix(baseColor, vec3(1.0, 0.0, 0.0), healthWarning * 0.4);
                }

                // EUPHORIC COLOR EXPLOSION FOR HIGH SCORES
                if (u_scoreEuphoria > 0.1) {
                    vec3 euphoriaColor = vec3(1.0, 0.8, 0.0) * u_scoreEuphoria;
                    baseColor = mix(baseColor, euphoriaColor, u_scoreEuphoria * latticeValue * 0.3);
                }

                // FINAL INTENSITY AMPLIFICATION
                baseColor = pow(clamp(baseColor * (1.0 + u_beatExplosion * 0.5 + u_comboFireworks * 0.3), 0.0, 2.0), vec3(0.9));

                gl_FragColor = vec4(baseColor, 1.0);
            }
        `;

        // Create and link shader program
        this.program = this.createShaderProgram(vertexShaderSource, fragmentShaderSource);
        this.setupUniforms();
    }

    createShaderProgram(vertexSource, fragmentSource) {
        const vertexShader = this.compileShader(vertexSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);

        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);

        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            throw new Error('BOMBASTIC shader program linking failed: ' + this.gl.getProgramInfoLog(program));
        }

        return program;
    }

    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            throw new Error('EXPLOSIVE shader compilation failed: ' + this.gl.getShaderInfoLog(shader));
        }

        return shader;
    }

    createBuffers() {
        const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        this.quadBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
    }

    setupUniforms() {
        this.gl.useProgram(this.program);

        // Cache all uniform locations for MAXIMUM PERFORMANCE
        this.uniforms = {};
        const uniformNames = [
            'u_resolution', 'u_time',
            'u_dimensionalIntensity', 'u_morphExplosion', 'u_rotationChaos', 'u_gridViolence', 'u_hyperGeometryMode',
            'u_beatExplosion', 'u_comboFireworks', 'u_damageShockwave', 'u_powerUpNova', 'u_enemyGlitchStorm', 'u_bossRealityRift',
            'u_healthPulsing', 'u_scoreEuphoria', 'u_levelTranscendence',
            'u_bassThunder', 'u_midLightning', 'u_highStarburst',
            'u_glitchIntensity', 'u_moireDistortion', 'u_colorShiftChaos', 'u_universeModifier', 'u_patternIntensity',
            'u_primaryColor', 'u_secondaryColor', 'u_backgroundColor'
        ];

        uniformNames.forEach(name => {
            this.uniforms[name] = this.gl.getUniformLocation(this.program, name);
        });
    }

    setupExplosiveLoop() {
        this.startTime = performance.now();
        this.isExploding = false;

        // Setup WebGL for MAXIMUM VISUAL IMPACT
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.05, 0.0, 0.2, 1.0);
        this.gl.disable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    // 🎵 BOMBASTIC GAME EVENT METHODS 💥

    explodeBeat(intensity = 1.0) {
        this.explosiveState.beatExplosion = intensity;
        this.explosiveState.rotationChaos = Math.min(this.explosiveState.rotationChaos + intensity * 0.1, 2.0);
        console.log(`🎵💥 BEAT EXPLOSION! Intensity: ${intensity.toFixed(2)}`);
    }

    triggerComboFireworks(comboCount) {
        this.explosiveState.comboFireworks = Math.min(comboCount / 5.0, 2.0);
        this.explosiveState.morphExplosion = this.explosiveState.comboFireworks * 0.8;
        this.explosiveState.colorShiftChaos = this.explosiveState.comboFireworks * 0.6;
        console.log(`🔥✨ COMBO FIREWORKS! ${comboCount}x EXPLOSIVE!`);
    }

    damageShockwave(damageAmount) {
        this.explosiveState.damageShockwave = Math.min(damageAmount / 20.0, 1.5);
        this.explosiveState.glitchIntensity = this.explosiveState.damageShockwave * 0.8;
        this.explosiveState.healthPulsing = Math.max(0.0, this.explosiveState.healthPulsing - damageAmount / 100.0);
        console.log(`💥⚡ DAMAGE SHOCKWAVE! ${damageAmount} damage dealt!`);
    }

    powerUpNova(powerLevel) {
        this.explosiveState.powerUpNova = powerLevel;
        this.explosiveState.scoreEuphoria = Math.min(this.explosiveState.scoreEuphoria + powerLevel * 0.3, 1.0);
        this.explosiveState.dimensionalIntensity = Math.min(this.explosiveState.dimensionalIntensity + powerLevel * 0.2, 5.0);
        console.log(`⭐💫 POWER-UP NOVA! Power level: ${powerLevel}`);
    }

    enemyGlitchStorm(intensity) {
        this.explosiveState.enemyGlitchStorm = intensity;
        this.explosiveState.moireDistortion = intensity * 0.7;
        console.log(`👹🌪️ ENEMY GLITCH STORM! Chaos level: ${intensity.toFixed(2)}`);
    }

    enterBossRealityRift() {
        this.explosiveState.bossRealityRift = 1.0;
        this.explosiveState.dimensionalIntensity = 4.8;
        this.explosiveState.hyperGeometryMode = 'hypertetrahedron'; // Switch to most complex geometry
        this.explosiveState.universeModifier = 2.0;
        console.log(`🐲🌌 BOSS REALITY RIFT ACTIVATED! PREPARE FOR DIMENSIONAL WARFARE!`);
    }

    levelTranscendence(newLevel) {
        this.explosiveState.levelTranscendence = 1.0;
        this.explosiveState.scoreEuphoria = 1.0;
        this.explosiveState.morphExplosion = 0.8;

        // Change geometry based on level for visual variety
        const geometryModes = ['hypercube', 'hypersphere', 'hypertetrahedron'];
        this.explosiveState.hyperGeometryMode = geometryModes[newLevel % 3];

        console.log(`🚀🌟 LEVEL TRANSCENDENCE! Level ${newLevel} - Geometry: ${this.explosiveState.hyperGeometryMode}`);
    }

    // 🎮🔍 GAME STATE VISUAL COMMUNICATION SYSTEM 🔍🎮

    updateGameStateVisuals(gameState) {
        // 🔍💫 HYPERTETRAHEDRON PRECISION ADJUSTMENT BASED ON GAME STATE 💫🔍

        // Health-based glitch intensity - lower health = more digital chaos
        const healthFactor = 1.0 - (gameState.health || 100) / 100.0;
        this.explosiveState.glitchIntensity = 0.15 + healthFactor * 0.6; // Max glitch at low health

        // Combo-based moire distortion - high combos create tactical info layers
        const comboFactor = Math.min((gameState.comboMultiplier || 0) / 20.0, 1.0);
        this.explosiveState.moireDistortion = 0.25 + comboFactor * 0.5; // Enhanced moire for high combos

        // Chaos level affects color shifting and universe distortion
        const chaosLevel = (gameState.chaosLevel || 0) / 100.0;
        this.explosiveState.colorShiftChaos = 0.1 + chaosLevel * 0.4; // More chaos = more color shifting
        this.explosiveState.universeModifier = 1.2 + chaosLevel * 0.8; // Reality distortion increases with chaos

        // Level-based hypertetrahedron complexity
        const level = gameState.currentLevel || 1;
        this.explosiveState.gridViolence = 10.0 + (level % 10) * 2.0; // Geometric complexity grows with level

        // Boss mode activates maximum hypertetrahedron precision
        if (gameState.bossMode) {
            this.explosiveState.hyperGeometryMode = 'hypertetrahedron';
            this.explosiveState.dimensionalIntensity = 4.8; // MAXIMUM dimensional intensity
            this.explosiveState.glitchIntensity = Math.max(this.explosiveState.glitchIntensity, 0.8);
            this.explosiveState.moireDistortion = Math.max(this.explosiveState.moireDistortion, 0.7);
            console.log('🐲💫 BOSS MODE: HYPERTETRAHEDRON PRECISION MAXIMIZED! 💫🐲');
        }

        // Score-based pattern intensity and dimensional enhancement
        const scoreBonus = Math.min((gameState.score || 0) / 500000.0, 1.0);
        this.explosiveState.patternIntensity = 1.3 + scoreBonus * 0.7; // Pattern clarity increases with score
        this.explosiveState.dimensionalIntensity = Math.max(this.explosiveState.dimensionalIntensity, 4.2 + scoreBonus * 0.6);

        console.log(`🎮🔍 Game State Visual Update: Health=${healthFactor.toFixed(2)} Combo=${comboFactor.toFixed(2)} Chaos=${chaosLevel.toFixed(2)}`);
    }

    // 💫🔍 TACTICAL INFORMATION OVERLAY SYSTEM 🔍💫

    setTacticalInfoMode(infoType, intensity = 1.0) {
        // Configure visual effects to communicate specific tactical information
        switch (infoType) {
            case 'enemy_proximity':
                this.explosiveState.glitchIntensity = Math.max(this.explosiveState.glitchIntensity, intensity * 0.6);
                this.explosiveState.moireDistortion = Math.max(this.explosiveState.moireDistortion, intensity * 0.4);
                break;

            case 'precision_required':
                // Hypertetrahedron mode for maximum precision feedback
                this.explosiveState.hyperGeometryMode = 'hypertetrahedron';
                this.explosiveState.gridViolence = Math.max(this.explosiveState.gridViolence, 12.0 + intensity * 8.0);
                this.explosiveState.patternIntensity = Math.max(this.explosiveState.patternIntensity, 1.5 + intensity * 0.5);
                break;

            case 'chaos_surge':
                this.explosiveState.colorShiftChaos = Math.max(this.explosiveState.colorShiftChaos, intensity * 0.8);
                this.explosiveState.universeModifier = Math.max(this.explosiveState.universeModifier, 1.0 + intensity * 1.2);
                this.explosiveState.moireDistortion = Math.max(this.explosiveState.moireDistortion, intensity * 0.6);
                break;

            case 'perfect_moment':
                // Crystal clear hypertetrahedron for perfect timing
                this.explosiveState.hyperGeometryMode = 'hypertetrahedron';
                this.explosiveState.glitchIntensity *= 0.3; // Reduce glitch for clarity
                this.explosiveState.patternIntensity = Math.max(this.explosiveState.patternIntensity, 1.8);
                this.explosiveState.dimensionalIntensity = Math.max(this.explosiveState.dimensionalIntensity, 4.5);
                break;

            case 'dimensional_shift':
                this.explosiveState.morphExplosion = Math.max(this.explosiveState.morphExplosion, intensity * 0.7);
                this.explosiveState.dimensionalTear = Math.max(this.explosiveState.dimensionalTear, intensity * 0.8);
                break;

            default:
                console.log(`🔍 Unknown tactical info type: ${infoType}`);
                break;
        }

        console.log(`💫🔍 TACTICAL INFO MODE: ${infoType} (intensity: ${intensity.toFixed(2)}) 🔍💫`);
    }

    // Audio reactive methods for EXPLOSIVE visual feedback
    updateAudioExplosion(audioData) {
        this.explosiveState.bassThunder = audioData.bass || 0;
        this.explosiveState.midLightning = audioData.mid || 0;
        this.explosiveState.highStarburst = audioData.high || 0;

        // Trigger events based on audio intensity
        if (this.explosiveState.bassThunder > 0.8) {
            this.explodeBeat(this.explosiveState.bassThunder);
        }

        if (this.explosiveState.highStarburst > 0.9) {
            this.triggerComboFireworks(Math.floor(this.explosiveState.highStarburst * 10));
        }
    }

    getCurrentExplosivePalette(gameState) {
        if (gameState.bossMode) return this.explosiveColorPalettes.boss;
        if (gameState.health < 30) return this.explosiveColorPalettes.critical;
        if (gameState.powerUpActive) return this.explosiveColorPalettes.powerUp;
        if (gameState.score > 100000) return this.explosiveColorPalettes.euphoria;
        if (gameState.enemiesActive) return this.explosiveColorPalettes.combat;
        return this.explosiveColorPalettes.normal;
    }

    render(timestamp, gameState = {}) {
        if (!this.isExploding) return;

        const currentTime = (timestamp - this.startTime) * 0.001;

        // DECAY EXPLOSIVE EFFECTS FOR NATURAL FEEL
        this.explosiveState.beatExplosion *= 0.92;
        this.explosiveState.comboFireworks *= 0.88;
        this.explosiveState.damageShockwave *= 0.85;
        this.explosiveState.powerUpNova *= 0.90;
        this.explosiveState.enemyGlitchStorm *= 0.87;
        this.explosiveState.bossRealityRift *= 0.95;
        this.explosiveState.scoreEuphoria *= 0.98;
        this.explosiveState.levelTranscendence *= 0.94;

        // Get current explosive color palette
        const currentPalette = this.getCurrentExplosivePalette(gameState);
        this.explosiveState.primaryColor = currentPalette.primary;
        this.explosiveState.secondaryColor = currentPalette.secondary;
        this.explosiveState.backgroundColor = currentPalette.background;

        // Resize canvas if needed
        const canvas = this.canvas;
        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
            this.gl.viewport(0, 0, canvas.width, canvas.height);
        }

        this.gl.useProgram(this.program);

        // Set all uniforms for MAXIMUM BOMBASTIC EFFECT
        this.gl.uniform2f(this.uniforms.u_resolution, canvas.width, canvas.height);
        this.gl.uniform1f(this.uniforms.u_time, currentTime);

        // Geometry and intensity
        this.gl.uniform1f(this.uniforms.u_dimensionalIntensity, this.explosiveState.dimensionalIntensity);
        this.gl.uniform1f(this.uniforms.u_morphExplosion, this.explosiveState.morphExplosion);
        this.gl.uniform1f(this.uniforms.u_rotationChaos, this.explosiveState.rotationChaos);
        this.gl.uniform1f(this.uniforms.u_gridViolence, this.explosiveState.gridViolence);

        const modeMap = { 'hypercube': 0, 'hypersphere': 1, 'hypertetrahedron': 2 };
        this.gl.uniform1i(this.uniforms.u_hyperGeometryMode, modeMap[this.explosiveState.hyperGeometryMode] || 0);

        // EXPLOSIVE EVENT UNIFORMS
        this.gl.uniform1f(this.uniforms.u_beatExplosion, this.explosiveState.beatExplosion);
        this.gl.uniform1f(this.uniforms.u_comboFireworks, this.explosiveState.comboFireworks);
        this.gl.uniform1f(this.uniforms.u_damageShockwave, this.explosiveState.damageShockwave);
        this.gl.uniform1f(this.uniforms.u_powerUpNova, this.explosiveState.powerUpNova);
        this.gl.uniform1f(this.uniforms.u_enemyGlitchStorm, this.explosiveState.enemyGlitchStorm);
        this.gl.uniform1f(this.uniforms.u_bossRealityRift, this.explosiveState.bossRealityRift);

        // TACTICAL FEEDBACK UNIFORMS
        this.gl.uniform1f(this.uniforms.u_healthPulsing, this.explosiveState.healthPulsing);
        this.gl.uniform1f(this.uniforms.u_scoreEuphoria, this.explosiveState.scoreEuphoria);
        this.gl.uniform1f(this.uniforms.u_levelTranscendence, this.explosiveState.levelTranscendence);

        // AUDIO EXPLOSIVE REACTIVITY
        this.gl.uniform1f(this.uniforms.u_bassThunder, this.explosiveState.bassThunder);
        this.gl.uniform1f(this.uniforms.u_midLightning, this.explosiveState.midLightning);
        this.gl.uniform1f(this.uniforms.u_highStarburst, this.explosiveState.highStarburst);

        // VISUAL EFFECTS ARSENAL
        this.gl.uniform1f(this.uniforms.u_glitchIntensity, this.explosiveState.glitchIntensity);
        this.gl.uniform1f(this.uniforms.u_moireDistortion, this.explosiveState.moireDistortion);
        this.gl.uniform1f(this.uniforms.u_colorShiftChaos, this.explosiveState.colorShiftChaos);
        this.gl.uniform1f(this.uniforms.u_universeModifier, this.explosiveState.universeModifier);
        this.gl.uniform1f(this.uniforms.u_patternIntensity, this.explosiveState.patternIntensity);

        // EXPLOSIVE COLORS
        this.gl.uniform3fv(this.uniforms.u_primaryColor, this.explosiveState.primaryColor);
        this.gl.uniform3fv(this.uniforms.u_secondaryColor, this.explosiveState.secondaryColor);
        this.gl.uniform3fv(this.uniforms.u_backgroundColor, this.explosiveState.backgroundColor);

        // RENDER THE EXPLOSIVE EXPERIENCE
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        const aPositionLoc = this.gl.getAttribLocation(this.program, 'a_position');
        this.gl.enableVertexAttribArray(aPositionLoc);
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.quadBuffer);
        this.gl.vertexAttribPointer(aPositionLoc, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
    }

    handleResize(width, height) {
        if (!this.canvas || !this.gl) {
            return;
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pixelWidth = Math.max(1, Math.floor(width * dpr));
        const pixelHeight = Math.max(1, Math.floor(height * dpr));

        if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
            this.canvas.width = pixelWidth;
            this.canvas.height = pixelHeight;
        }

        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.gl.viewport(0, 0, pixelWidth, pixelHeight);
    }

    startExplosion() {
        this.isExploding = true;
        this.startTime = performance.now();
        console.log('🔥💥🚀 HYPERCUBE EXPLOSION INITIATED! PREPARE FOR THE MOST BOMBASTIC EXPERIENCE EVER! 💥🔥🚀');
    }

    stopExplosion() {
        this.isExploding = false;
        console.log('🛑 Bombastic explosion stopped (temporarily)');
    }
}