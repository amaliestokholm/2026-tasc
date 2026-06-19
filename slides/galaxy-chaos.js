        let scene, camera, renderer;
        let starParticles = [];
        let activeRings = []; // { ring, opacity } — rings currently fading out
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

            const bgGeo = new THREE.BufferGeometry();
            const bgCount = 3500;
            const bgPos = new Float32Array(bgCount * 3);
            for (let i = 0; i < bgCount; i++) {
                bgPos[i * 3]     = (Math.random() - 0.5) * 80;
		bgPos[i * 3 + 1] = (Math.random() < 0.5 ? 1 : -1) * (2 + Math.random() * 18); // avoid y=0 centre
                bgPos[i * 3 + 2] = (Math.random() - 0.5) * 60 - 10;
            }
            bgGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
            const bgMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.5 });
            scene.add(new THREE.Points(bgGeo, bgMat));

            // CHAOS VERSION: every color shares the same orbit family — a circle of random
            // radius, tilted at a fully random orientation around a common center. Colors,
            // counts and sounds are unchanged from the structured version; only the orbit
            // shape/placement logic differs.
            const colorGroups = [
                { hex: 0xff4466, cssHex: '#ff4466', name: 'red',    sound: 'buzz', colorIndex: 0 },
                { hex: 0x00ffaa, cssHex: '#00ffaa', name: 'green',  sound: null,   colorIndex: 1 },
                { hex: 0x44aaff, cssHex: '#44aaff', name: 'blue',   sound: null,   colorIndex: 2 },
                { hex: 0xffaa33, cssHex: '#ffaa33', name: 'orange', sound: null,   colorIndex: 3 },
                { hex: 0xbb66ff, cssHex: '#bb66ff', name: 'violet', sound: null,   colorIndex: 4 },
                { hex: 0x33eeff, cssHex: '#33eeff', name: 'cyan',   sound: null,   colorIndex: 5 },
                { hex: 0xff44cc, cssHex: '#ff44cc', name: 'pink',   sound: null,   colorIndex: 6 }
            ];

            const textures = {};
            colorGroups.forEach(g => { textures[g.name] = makeStarTexture(g.cssHex); });

            // Shared radius range — every star, regardless of color, picks a random radius
            // somewhere in this band around the common center.
            const RADIUS_MIN = 0.9, RADIUS_MAX = 7.2;

            const counts = { red: 35, green: 50, blue: 120, orange: 40, violet: 45, cyan: 60, pink: 35 };

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

                    // CHAOS: fully random radius around the shared center (not evenly spaced,
                    // not tied to color) — this is what gives the scattered, chaotic look.
                    const radiusBase = RADIUS_MIN + Math.random() * (RADIUS_MAX - RADIUS_MIN);
                    const speedMult  = 0.18 + Math.random() * 0.45;
                    const phase      = Math.random() * Math.PI * 2;

                    // CHAOS: every star gets a fully random orbital-plane orientation, so
                    // orbits are circles of random radius tilted at random angles around
                    // one common center, rather than belonging to a color-specific family.
                    const randomTiltX = Math.random() * Math.PI * 2;
                    const randomTiltZ = Math.random() * Math.PI * 2;

                    // Determine sound per star, following the same radius-threshold pattern
                    // used originally by blue/green: split each color's population by radius
                    // into two of the three sounds.
                    let starSound = grp.sound;
                    if (starSound === null) {
                        const midThreshold = (RADIUS_MIN + RADIUS_MAX) / 2;
                        starSound = radiusBase < midThreshold ? 'bloop' : 'beep';
                    }

                    sprite.userData = {
                        color: grp.name,
                        sound: starSound,
                        colorIndex: grp.colorIndex,
                        index: i,
                        radiusBase,
                        speedMult,
                        phase,
                        randomTiltX,
                        randomTiltZ,
                        twinkleOffset: Math.random() * Math.PI * 2,
                        twinkleSpeed:  1.5 + Math.random() * 2.5
                    };

                    // Create a hidden orbit ring — a plain circle of this star's radius,
                    // tilted the same random way as the star's own orbit.
                    const ring = makeOrbitRing(radiusBase, radiusBase, randomTiltX, randomTiltZ, 0, grp.hex, 0);
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


        function animate() {
            requestAnimationFrame(animate);
            time += 0.007;
	    scene.rotation.y += 0.0008;

	    camera.position.x = Math.sin(time * 0.1) * 0.5;
            camera.lookAt(0, 0, 0);

            starParticles.forEach(star => {
                const { radiusBase, speedMult, phase, randomTiltX, randomTiltZ, twinkleOffset, twinkleSpeed } = star.userData;
                const t = time * speedMult + phase;
                const r = radiusBase;

                // CHAOS: every star is on a circle of its own radius, tilted at its own
                // fully random orientation (randomTiltX + randomTiltZ) around the shared center.
                const lx0 = Math.cos(t) * r;
                const lz0 = Math.sin(t) * r;
                const ly1 = lz0 * Math.sin(randomTiltX);
                const lz1 = lz0 * Math.cos(randomTiltX);
                const px = lx0 * Math.cos(randomTiltZ) - ly1 * Math.sin(randomTiltZ);
                const py = lx0 * Math.sin(randomTiltZ) + ly1 * Math.cos(randomTiltZ);
                const pz = lz1;

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
