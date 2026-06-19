        let scene, camera, renderer;
        let starParticles = [];
        let activeRings = []; // { ring, opacity } — rings currently fading out
        let galaxyCore = null;
        let time = 0;
        let audioContext;

        const soundIcons = { beep: '🔔', bloop: '💧', buzz: '⚡'};

        function initAudio() {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        function playSound(type) {
            if (!audioContext) initAudio();
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            gain.connect(audioContext.destination);
            switch (type) {
                case 'beep':
                    osc.frequency.value = 880;
                    osc.type = 'sine';
                    gain.gain.setValueAtTime(0.25, audioContext.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);
                    osc.start(); osc.stop(audioContext.currentTime + 0.35);
                    break;
                case 'bloop':
                    osc.frequency.setValueAtTime(500, audioContext.currentTime);
                    osc.frequency.exponentialRampToValueAtTime(180, audioContext.currentTime + 0.25);
                    osc.type = 'sine';
                    gain.gain.setValueAtTime(0.28, audioContext.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.45);
                    osc.start(); osc.stop(audioContext.currentTime + 0.45);
                    break;
                case 'buzz':
                    osc.frequency.value = 130;
                    osc.type = 'sawtooth';
                    gain.gain.setValueAtTime(0.18, audioContext.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.55);
                    osc.start(); osc.stop(audioContext.currentTime + 0.55);
                    break;
            }
        }

        function showSpeechBubble(x, y, soundType) {
            const bubble = document.getElementById('speech-bubble');
            bubble.querySelector('.sound-icon').textContent = soundIcons[soundType];
            bubble.style.left = x + 'px';
            bubble.style.top = (y - 75) + 'px';
            bubble.classList.add('show');
            setTimeout(() => bubble.classList.remove('show'), 1100);
        }

        function makeStarTexture(color) {
            const size = 256;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2, cy = size / 2;

            // Outer glow
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
            glow.addColorStop(0, color + 'ff');
            glow.addColorStop(0.15, color + 'cc');
            glow.addColorStop(0.4, color + '44');
            glow.addColorStop(1, color + '00');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, size, size);

            // Sharp spike cross
            ctx.strokeStyle = color + 'ee';
            ctx.lineWidth = 1;
            for (let angle = 0; angle < Math.PI; angle += Math.PI / 4) {
                ctx.beginPath();
                const len = 28;
                ctx.moveTo(cx + Math.cos(angle) * 3, cy + Math.sin(angle) * 3);
                ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
                ctx.moveTo(cx - Math.cos(angle) * 3, cy - Math.sin(angle) * 3);
                ctx.lineTo(cx - Math.cos(angle) * len, cy - Math.sin(angle) * len);
                ctx.stroke();
            }
            return new THREE.CanvasTexture(c);
        }

        function makeBgObject(color) {
            const size = 128;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2, cy = size / 2;

            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
            glow.addColorStop(0,    '#f6f6f6f6');
            glow.addColorStop(0.08, color + 'ff');
            glow.addColorStop(0.25, color + 'aa');
            glow.addColorStop(0.55, color + '33');
            glow.addColorStop(1,    color + '00');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, size, size);

            return new THREE.CanvasTexture(c);
        }

        function makeCoreTexture(color) {
            const size = 4096;
            const c = document.createElement('canvas');
            c.width = c.height = size;
            const ctx = c.getContext('2d');
            const cx = size / 2, cy = size / 2;

            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
            glow.addColorStop(0,    '#f6f6f6f6');
            glow.addColorStop(0.08, color + 'ff');
            glow.addColorStop(0.25, color + 'aa');
            glow.addColorStop(0.55, color + '33');
            glow.addColorStop(1,    color + '00');
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, size, size);

            return new THREE.CanvasTexture(c);
        }


        function hexToCSS(hex) {
            return '#' + hex.toString(16).padStart(6, '0');
        }

        function initThreeJS() {
            const container = document.getElementById('canvas-container');
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x03020f);

            scene.fog = new THREE.FogExp2(0x03020f, 0.018);

	    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 300);

            camera.position.set(0, 6, 11);
            camera.lookAt(0, 0, 0);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.setSize(container.clientWidth, container.clientHeight);
            container.appendChild(renderer.domElement);

            scene.add(new THREE.AmbientLight(0xffffff, 0.8));
            const pLight = new THREE.PointLight(0x8899ff, 2, 30);
            pLight.position.set(0, 5, 0);
            scene.add(pLight);

	    const bgTexture = makeBgObject('#ffffff');
            const bgMat = new THREE.SpriteMaterial({
                        map: bgTexture,
                        transparent: true,
                        blending: THREE.AdditiveBlending,
                        depthWrite: false
                });

            const bgCount = 3500;

            for (let i = 0; i < bgCount; i++) {

                const star = new THREE.Sprite(bgMat.clone());

                star.position.set(
                                (Math.random() - 0.5) * 80,

                                (Math.random() < 0.5 ? 1 : -1)
                                * (2 + Math.random() * 18),

                                (Math.random() - 0.5) * 60 - 10
                );
                const s = 0.05 + Math.random() * 0.08;

                star.scale.set(s, s, 1);

                scene.add(star);
                }

            // Galactic core: a soft warm-white glow at the center, plus a small hot point
            // for a bright nucleus. Stored in galaxyCore so animate() can pulse it.
            const coreTexture = makeCoreTexture('#f7eac6');
            const coreMat = new THREE.SpriteMaterial({
                map: coreTexture,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const core = new THREE.Sprite(coreMat);
            core.scale.set(6.2, 6.2, 1);
            scene.add(core);

            const nucleusTexture = makeCoreTexture('#e2dcc8');
            const nucleusMat = new THREE.SpriteMaterial({
                map: nucleusTexture,
                transparent: true,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            const nucleus = new THREE.Sprite(nucleusMat);
            nucleus.scale.set(0.05, 0.05, 0.1);
            scene.add(nucleus);

            galaxyCore = { core, nucleus };

            // shapeIndex selects which orbit family a color uses (0: tilted ellipse like red,
            // 1: flat ellipse like green, 2: circle like blue). colorIndex just identifies the
            // color/sound group and no longer needs to match shapeIndex 1:1.
            const colorGroups = [
                { hex: 0xff4466, cssHex: '#ff4466', name: 'red',    sound: 'buzz', colorIndex: 0, shapeIndex: 0 },
                { hex: 0x00ffaa, cssHex: '#00ffaa', name: 'green',  sound: null,   colorIndex: 1, shapeIndex: 1 },
                { hex: 0x44aaff, cssHex: '#44aaff', name: 'blue',   sound: null,   colorIndex: 2, shapeIndex: 2 },
                { hex: 0xffaa33, cssHex: '#ffaa33', name: 'orange', sound: null,   colorIndex: 3, shapeIndex: 2 },
                { hex: 0xbb66ff, cssHex: '#bb66ff', name: 'violet', sound: null,   colorIndex: 4, shapeIndex: 0 },
                { hex: 0x33eeff, cssHex: '#33eeff', name: 'cyan',   sound: null,   colorIndex: 5, shapeIndex: 1 },
                { hex: 0xff44cc, cssHex: '#ff44cc', name: 'pink',   sound: null,   colorIndex: 6, shapeIndex: 2 }
            ];

            const textures = {};
            colorGroups.forEach(g => { textures[g.name] = makeStarTexture(g.cssHex); });

            // Orbit shape parameters — defined once, shared by both stars and trail rings
            // Flat plane is X-Z. tilt rotates orbits up into Y around the X-axis.
            // Indexed by shapeIndex (0/1/2), shared by multiple colors now.
            // Shape 0: steeply tilted ellipse (out of X-Z plane) — like red
            // Shape 1: flat ellipse in X-Z plane + small per-star Y offset — like green
            // Shape 2: circle in X-Z plane (y = 0) — like blue
            const TILT = Math.PI / 2.2; // ~82° — very clearly out-of-plane
            const orbitDefs = [
                { rx: (r) => r * 1.5,  ry: (r) => r * 0.65, tilt: TILT }, // shape 0: tilted ellipse
                { rx: (r) => r * 1.7,  ry: (r) => r * 0.55, tilt: 0    }, // shape 1: flat ellipse
                { rx: (r) => r,        ry: (r) => r,         tilt: 0    }, // shape 2: circle
            ];

            // Radius levels used for BOTH stars and trail rings (evenly spaced)
            const RADIUS_MIN = 1.5, RADIUS_MAX = 6.8;
            // Colors on shape 1 (flat-ellipse family) use a closer, tighter radius range,
            // matching green's original "inner disc" feel
            const INNER_RADIUS_MIN = 0.75, INNER_RADIUS_MAX = 3.6;

            const counts = { red: 35, green: 50, blue: 120, orange: 40, violet: 45, cyan: 100, pink: 35 };

            colorGroups.forEach((grp) => {
                const mat = new THREE.SpriteMaterial({
                    map: textures[grp.name],
                    transparent: true,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                });

                const COUNT = counts[grp.name];

                for (let i = 0; i < COUNT; i++) {
                    const sprite = new THREE.Sprite(mat.clone());
                    const spriteScale = 0.28 + Math.random() * 0.22;
                    sprite.scale.set(spriteScale, spriteScale, 1);

                    const isShape0 = grp.shapeIndex === 0; // tilted-ellipse family (like red)
                    const isShape1 = grp.shapeIndex === 1; // flat-ellipse family (like green)

                    // Shape-1 colors use a tighter radius range closer to centre; others use full range
                    const rMin = isShape1 ? INNER_RADIUS_MIN : RADIUS_MIN;
                    const rMax = isShape1 ? INNER_RADIUS_MAX : RADIUS_MAX;
                    const radiusBase = rMin + (i / (COUNT - 1)) * (rMax - rMin);
                    // const speedMult  = 0.25 + Math.random() * 0.35;
                    const speedMult =
                            isShape0 ? 0.53 + Math.random() * 0.35  :  // shape 0 (tilted ellipse)
                            isShape1 ? 0.1 + Math.random() * 0.2    :  // shape 1 (flat ellipse)
                                       0.25 + Math.random() * 0.35;    // shape 2 (circle)
                    const phase      = Math.random() * Math.PI * 2;

                    // Shape-1 colors get a small fixed z-offset so they form a slightly puffed disc
                    const zWobble = isShape1 ? (Math.random() - 0.5) * 0.52 : 0;

                    // Shape-1 colors: per-star ellipse eccentricity and apogee direction in the disc plane
                    const greenEcc    = isShape1 ? 0.3 + Math.random() * 0.65 : null;
                    const greenApogee = isShape1 ? Math.random() * Math.PI * 2 : null;

                    // Shape-0 colors each get a fully random orbital plane orientation
                    const randomTiltX = isShape0 ? Math.random() * Math.PI * 2 : null;
                    const randomTiltZ = isShape0 ? Math.random() * Math.PI * 2 : null;

                    // Determine sound per star, following the same radius-threshold pattern
                    // used originally by blue/green: split each color's population by radius
                    // into two of the three sounds.
                    let starSound = grp.sound;
                    if (starSound === null) {
                        if (isShape1) {
                            // shape-1 colors (like green): biggest radii -> bloop, smaller -> buzz
                            const innerThreshold = (INNER_RADIUS_MIN + INNER_RADIUS_MAX) / 2;
                            starSound = radiusBase > innerThreshold ? 'bloop' : 'buzz';
                        } else {
                            // shape-0/2 colors (like blue): inner -> bloop, outer -> beep
                            const outerThreshold = (RADIUS_MIN + RADIUS_MAX) / 2;
                            starSound = radiusBase < outerThreshold ? 'bloop' : 'beep';
                        }
                    }

                    sprite.userData = {
                        color: grp.name,
                        sound: starSound,
                        colorIndex: grp.colorIndex,
                        shapeIndex: grp.shapeIndex,
                        index: i,
                        radiusBase,
                        speedMult,
                        phase,
                        zWobble,
                        randomTiltX,
                        randomTiltZ,
                        greenEcc,
                        greenApogee,
                        twinkleOffset: Math.random() * Math.PI * 2,
                        twinkleSpeed:  1.5 + Math.random() * 2.5
                    };

                    // Create a hidden orbit ring sized exactly for this star's radius
                    const def = orbitDefs[grp.shapeIndex];
                    const tiltXForRing = isShape0 ? randomTiltX : def.tilt;
                    const tiltZForRing = isShape0 ? randomTiltZ : 0;
                    // Shape-1 colors: derive rx/ry from per-star eccentricity; others use shared def
                    const ringRx = isShape1 ? radiusBase * (1 + greenEcc * 0.5) : def.rx(radiusBase);
                    const ringRy = isShape1 ? radiusBase * (1 - greenEcc)        : def.ry(radiusBase);
                    const ring = makeOrbitRing(ringRx, ringRy, tiltXForRing, tiltZForRing, zWobble, grp.hex, isShape1 ? greenApogee : 0);
                    ring.material.opacity = 0;
                    ring.visible = false;
                    scene.add(ring);
                    sprite.userData.orbitRing = ring;

                    scene.add(sprite);
                    starParticles.push(sprite);
                }

            });

            renderer.domElement.addEventListener('click', onCanvasClick);
            window.addEventListener('resize', onWindowResize);
            animate();
        }

	function makeOrbitRing(rx, ry, tiltX, tiltZ, zWobble, color, apogeeAngle = 0) {
            const pts = [];
            const N = 120;
            for (let i = 0; i <= N; i++) {
                const a = (i / N) * Math.PI * 2;
                // Start in X-Z plane; apogeeAngle rotates the ellipse long-axis within the plane
                const lx0 = Math.cos(a + apogeeAngle) * rx;
                const lz0 = Math.sin(a + apogeeAngle) * ry;
                // tiltX: rotate around X-axis (lifts into Y)
                const ly1 = lz0 * Math.sin(tiltX) + zWobble;
                const lz1 = lz0 * Math.cos(tiltX);
                // tiltZ: rotate around Z-axis (spins in X-Y)
                const lx2 = lx0 * Math.cos(tiltZ) - ly1 * Math.sin(tiltZ);
                const ly2 = lx0 * Math.sin(tiltZ) + ly1 * Math.cos(tiltZ);
                pts.push(new THREE.Vector3(lx2, ly2, lz1));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0 });
            return new THREE.Line(geo, mat);
        }


        // Mirror the orbit definitions from init (must match exactly)
        const TILT_ANIM = Math.PI / 2.2; // ~82° — steeply out of X-Z plane
        const orbitDefsAnim = [
            { rx: (r) => r * 1.5,  ry: (r) => r * 0.65, tilt: TILT_ANIM }, // shape 0: tilted ellipse (like red)
            { rx: (r) => r * 1.7,  ry: (r) => r * 0.55, tilt: 0          }, // shape 1: flat ellipse in X-Z + yWobble (like green)
            { rx: (r) => r,        ry: (r) => r,         tilt: 0          }, // shape 2: circle in X-Z plane (like blue)
        ];

        function animate() {
            requestAnimationFrame(animate);
            time += 0.007;
	    scene.rotation.y += 0.0008;

	    camera.position.x = Math.sin(time * 0.1) * 0.5;
            camera.lookAt(0, 0, 0);

            // Gentle pulse for the galactic core glow
            if (galaxyCore) {
                const pulse = 1 + 0.05 * Math.sin(time * 1.3);
                galaxyCore.core.scale.set(7.2 * pulse, 7.2 * pulse, 1);
                galaxyCore.nucleus.scale.set(1.1 * pulse, 1.1 * pulse, 1);
            }

            starParticles.forEach(star => {
                const { shapeIndex, radiusBase, speedMult, phase, zWobble, randomTiltX, randomTiltZ, greenEcc, greenApogee, twinkleOffset, twinkleSpeed } = star.userData;
                const t = time * speedMult + phase;
                const r = radiusBase;

                let px, py, pz;
                if (shapeIndex === 0) {
                    // Shape 0: each star has its own randomly oriented orbital plane (tiltX + tiltZ)
                    const def = orbitDefsAnim[shapeIndex];
                    const lx0 = Math.cos(t) * def.rx(r);
                    const lz0 = Math.sin(t) * def.ry(r);
                    const ly1 = lz0 * Math.sin(randomTiltX);
                    const lz1 = lz0 * Math.cos(randomTiltX);
                    px = lx0 * Math.cos(randomTiltZ) - ly1 * Math.sin(randomTiltZ);
                    py = lx0 * Math.sin(randomTiltZ) + ly1 * Math.cos(randomTiltZ);
                    pz = lz1;
                } else if (shapeIndex === 1) {
                    // Shape 1: per-star eccentricity and apogee direction; flat in X-Z plane + zWobble
                    const rx = r * (1 + greenEcc * 0.5);
                    const ry = r * (1 - greenEcc);
                    const lx0 = Math.cos(t + greenApogee) * rx;
                    const lz0 = Math.sin(t + greenApogee) * ry;
                    px = lx0;
                    py = zWobble || 0;
                    pz = lz0;
                } else {
                    // Shape 2: circle in X-Z plane
                    const def = orbitDefsAnim[shapeIndex];
                    const lx0 = Math.cos(t) * def.rx(r);
                    const lz0 = Math.sin(t) * def.ry(r);
                    px = lx0;
                    py = lz0 * Math.sin(def.tilt);
                    pz = lz0 * Math.cos(def.tilt);
                }

                star.position.set(px, py, pz);

                // Twinkle: scale pulsing
                const twinkle = 0.82 + 0.18 * Math.sin(time * twinkleSpeed + twinkleOffset);
                const base = 0.25 + (radiusBase / 5.8) * 0.25;
                star.scale.setScalar(base * twinkle);

                // Twinkle: opacity
                star.material.opacity = 0.7 + 0.3 * twinkle;
            });

            // Fade out active orbit rings
            for (let i = activeRings.length - 1; i >= 0; i--) {
                const entry = activeRings[i];
                entry.opacity -= 0.002; // if 0.004 then fade over ~2.5s at 60fps
                if (entry.opacity <= 0) {
                    entry.ring.visible = false;
                    entry.ring.material.opacity = 0;
                    activeRings.splice(i, 1);
                } else {
                    entry.ring.material.opacity = entry.opacity;
                }
            }

            renderer.render(scene, camera);
        }

        function onCanvasClick(event) {
            const container = document.getElementById('canvas-container');
            const rect = container.getBoundingClientRect();
            const mouse = new THREE.Vector2(
                ((event.clientX - rect.left) / rect.width) * 2 - 1,
                -((event.clientY - rect.top) / rect.height) * 2 + 1
            );

            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            raycaster.params.Sprite = { threshold: 0.3 };

            const hits = raycaster.intersectObjects(starParticles);
            if (hits.length > 0) {
                const star = hits[0].object;
                const soundType = star.userData.sound;
                playSound(soundType);
                showSpeechBubble(event.clientX - rect.left, event.clientY - rect.top, soundType);

                // Show this star's orbit ring and start fade
                const ring = star.userData.orbitRing;
                if (ring) {
                    ring.visible = true;
                    const startOpacity = 0.75;
                    ring.material.opacity = startOpacity;
                    // Remove any existing entry for this ring before re-adding
                    const existing = activeRings.findIndex(e => e.ring === ring);
                    if (existing !== -1) activeRings.splice(existing, 1);
                    activeRings.push({ ring, opacity: startOpacity });
                }

                // Flash effect
                const origOpacity = star.material.opacity;
                star.material.opacity = 1;
                star.scale.multiplyScalar(1.6);
                setTimeout(() => {
                    star.material.opacity = origOpacity;
                    star.scale.divideScalar(1.6);
                }, 180);
            }
        }

        function onWindowResize() {
            const container = document.getElementById('canvas-container');
            camera.aspect = container.clientWidth / container.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(container.clientWidth, container.clientHeight);
        }

        initThreeJS();
