// Tesla Model Y Juniper (2025) — proseduel 3D model
// Global THREE (UMD) kullanır — file:// üzerinden çift tıkla çalışır.
// Light show kanal sistemine bağlanır (window.Car3D).
// 1 unit = 1 metre.

(function () {
  'use strict';

  function fail(msg) {
    const c = document.getElementById('car3d');
    if (c) {
      c.innerHTML = `<div style="display:grid;place-items:center;height:100%;
        color:#ff7385;font-size:12px;text-align:center;padding:18px;">
        ⚠ 3D yüklenemedi: ${msg}<br><span style="color:#8b97a8">internet bağlantını kontrol et</span></div>`;
    }
    console.error('[Car3D]', msg);
  }

  function start() {
    const container = document.getElementById('car3d');
    if (!container) return;
    if (!window.THREE) return fail('THREE bulunamadı');
    const THREE = window.THREE;

    // ─── Renderer / scene / camera ─────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090f);
    scene.fog = new THREE.Fog(0x07090f, 14, 36);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if ('outputColorSpace' in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if (THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    const controls = createOrbitControls(camera, renderer.domElement, {
      target: new THREE.Vector3(0, 0.85, 0),
      radius: 10.5,
      theta: Math.PI * 0.25,        // ön-sağ açı
      phi: Math.PI * 0.36,          // yukarıdan bakış
      minRadius: 4.5,
      maxRadius: 22,
      minPhi: 0.08,
      maxPhi: Math.PI * 0.49,
    });
    controls.update();

    // ─── Aydınlatma ────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.20));
    const hemi = new THREE.HemisphereLight(0xb6cdff, 0x141820, 0.55);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(6, 9, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -8; key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;   key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.0002;
    scene.add(key);

    const rim = new THREE.DirectionalLight(0xff5060, 0.55);
    rim.position.set(-6, 3, -5);
    scene.add(rim);

    const fill = new THREE.DirectionalLight(0x57f5ff, 0.35);
    fill.position.set(-3, 4, 6);
    scene.add(fill);

    // ─── Stüdyo zemini ─────────────────────────────────────────
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0c1018, roughness: 0.55, metalness: 0.4,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 64), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.receiveShadow = true;
    scene.add(ground);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 4.2, 64),
      new THREE.MeshBasicMaterial({ color: 0x57f5ff, transparent: true, opacity: 0.05 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;
    scene.add(ring);

    // ─── Model Y Juniper gövde profili ─────────────────────────
    const HALF_LEN = 2.375;
    const HALF_W   = 0.93;
    const FLOOR_Y  = 0.30;
    const HOOD_Y   = 0.96;
    const ROOF_Y   = 1.62;

    const profile = new THREE.Shape();
    profile.moveTo( HALF_LEN,           FLOOR_Y);
    profile.lineTo( HALF_LEN,           HOOD_Y);
    profile.lineTo( HALF_LEN - 0.30,    HOOD_Y + 0.02);
    profile.bezierCurveTo(
      HALF_LEN - 0.65, HOOD_Y + 0.05,
      HALF_LEN - 1.00, HOOD_Y + 0.18,
      HALF_LEN - 1.30, 1.20
    );
    profile.bezierCurveTo(
      HALF_LEN - 1.65, 1.42,
      HALF_LEN - 2.00, ROOF_Y - 0.02,
      HALF_LEN - 2.40, ROOF_Y
    );
    profile.lineTo(-0.85, ROOF_Y);
    profile.bezierCurveTo(
      -1.50, ROOF_Y,
      -1.80, ROOF_Y - 0.12,
      -2.05, 1.34
    );
    profile.bezierCurveTo(
      -2.25, 1.18,
      -HALF_LEN + 0.05, 1.02,
      -HALF_LEN, 0.92
    );
    profile.lineTo(-HALF_LEN, FLOOR_Y);
    profile.lineTo( HALF_LEN, FLOOR_Y);

    const bodyGeo = new THREE.ExtrudeGeometry(profile, {
      depth: HALF_W * 2,
      bevelEnabled: true,
      bevelSize: 0.06,
      bevelThickness: 0.08,
      bevelSegments: 4,
      curveSegments: 24,
    });
    bodyGeo.translate(0, 0, -HALF_W);
    bodyGeo.computeVertexNormals();

    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xa9afb6,
      metalness: 0.95,
      roughness: 0.32,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.0,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;

    const car = new THREE.Group();
    car.add(body);
    scene.add(car);

    // ─── Cam (greenhouse) ──────────────────────────────────────
    const glassProfile = new THREE.Shape();
    glassProfile.moveTo( HALF_LEN - 1.32, 1.21);
    glassProfile.bezierCurveTo(
      HALF_LEN - 1.65, 1.43,
      HALF_LEN - 2.00, ROOF_Y - 0.02,
      HALF_LEN - 2.40, ROOF_Y - 0.01
    );
    glassProfile.lineTo(-0.86, ROOF_Y - 0.01);
    glassProfile.bezierCurveTo(
      -1.50, ROOF_Y - 0.01,
      -1.80, ROOF_Y - 0.13,
      -2.04, 1.33
    );
    glassProfile.lineTo(HALF_LEN - 1.32, 1.21);
    const glassW = HALF_W * 1.92;
    const glassGeo = new THREE.ExtrudeGeometry(glassProfile, {
      depth: glassW, bevelEnabled: false,
    });
    glassGeo.translate(0, 0, -glassW / 2);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x0a0d12,
      metalness: 0.0,
      roughness: 0.05,
      transmission: 0.55,
      transparent: true,
      opacity: 0.85,
      ior: 1.45,
      thickness: 0.04,
    });
    const glass = new THREE.Mesh(glassGeo, glassMat);
    car.add(glass);

    function sideWindow(zSign) {
      const s = new THREE.Shape();
      s.moveTo( 1.05, 1.18);
      s.lineTo( 0.55, 1.55);
      s.lineTo(-1.20, 1.55);
      s.lineTo(-1.85, 1.18);
      s.lineTo( 1.05, 1.18);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
      g.translate(0, 0, -0.01);
      const m = new THREE.Mesh(g, glassMat.clone());
      m.position.z = zSign * (HALF_W - 0.005);
      car.add(m);
    }
    sideWindow( 1);
    sideWindow(-1);

    // ─── Tekerler ──────────────────────────────────────────────
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0e0e10, roughness: 0.95 });
    const rimMat  = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.85, roughness: 0.3 });
    const rimDarkMat = new THREE.MeshStandardMaterial({ color: 0x1a1c1f, metalness: 0.5, roughness: 0.55 });

    function makeWheel(x, zSign) {
      const g = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.26, 40), tireMat);
      tire.rotation.x = Math.PI / 2;
      tire.castShadow = true;
      g.add(tire);

      const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.08, 36), rimDarkMat);
      disk.rotation.x = Math.PI / 2;
      disk.position.z = zSign * 0.10;
      g.add(disk);

      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.55), rimMat);
        sp.position.z = zSign * 0.11;
        sp.rotation.z = (i / 5) * Math.PI * 2;
        g.add(sp);
      }
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 24), rimMat);
      cap.rotation.x = Math.PI / 2;
      cap.position.z = zSign * 0.13;
      g.add(cap);

      g.position.set(x, 0.385, zSign * (HALF_W - 0.06));
      car.add(g);
    }
    makeWheel( 1.42,  1);
    makeWheel( 1.42, -1);
    makeWheel(-1.42,  1);
    makeWheel(-1.42, -1);

    function archShade(x, zSign) {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(0.46, 24),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
      );
      m.position.set(x, 0.385, zSign * (HALF_W - 0.001));
      m.rotation.y = zSign > 0 ? -Math.PI / 2 : Math.PI / 2;
      car.add(m);
    }
    archShade( 1.42,  1); archShade( 1.42, -1);
    archShade(-1.42,  1); archShade(-1.42, -1);

    // ─── IŞIKLAR ──────────────────────────────────────────────
    const lightChannels = new Map();
    const allLightMeshes = [];

    function lightMaterial(color) {
      return new THREE.MeshStandardMaterial({
        color: 0x111418,
        emissive: color,
        emissiveIntensity: 0,
        roughness: 0.3,
        metalness: 0.2,
      });
    }
    function addLight(ch, mesh) {
      mesh.userData.ch = ch;
      if (!lightChannels.has(ch)) lightChannels.set(ch, []);
      lightChannels.get(ch).push(mesh);
      allLightMeshes.push(mesh);
      car.add(mesh);
    }

    const FX = HALF_LEN + 0.005;
    const RX = -HALF_LEN - 0.005;

    // Juniper imza: ön LED bar (sol/sağ)
    const barGeoF = new THREE.BoxGeometry(0.04, 0.045, HALF_W * 0.92);
    const lbFL = new THREE.Mesh(barGeoF, lightMaterial(0x57f5ff));
    lbFL.position.set(FX, 0.98, -HALF_W * 0.50);
    addLight(0, lbFL);
    const lbFR = new THREE.Mesh(barGeoF, lightMaterial(0x57f5ff));
    lbFR.position.set(FX, 0.98,  HALF_W * 0.50);
    addLight(1, lbFR);

    // Yan outline
    const sideBarGeo = new THREE.BoxGeometry(2.0, 0.03, 0.04);
    const sbL = new THREE.Mesh(sideBarGeo, lightMaterial(0x57f5ff));
    sbL.position.set(0, 0.55, -HALF_W - 0.005);
    addLight(2, sbL);
    const sbR = new THREE.Mesh(sideBarGeo, lightMaterial(0x57f5ff));
    sbR.position.set(0, 0.55,  HALF_W + 0.005);
    addLight(3, sbR);

    // Arka LED bar
    const barGeoR = new THREE.BoxGeometry(0.04, 0.06, HALF_W * 0.92);
    const lbRL = new THREE.Mesh(barGeoR, lightMaterial(0x57f5ff));
    lbRL.position.set(RX, 1.05, -HALF_W * 0.50);
    addLight(4, lbRL);
    const lbRR = new THREE.Mesh(barGeoR, lightMaterial(0x57f5ff));
    lbRR.position.set(RX, 1.05,  HALF_W * 0.50);
    addLight(5, lbRR);

    // Farlar
    const hlGeo = new THREE.BoxGeometry(0.05, 0.07, 0.16);
    function headlight(ch, z) {
      const m = new THREE.Mesh(hlGeo, lightMaterial(0xfff7d6));
      m.position.set(FX, 0.86, z);
      addLight(ch, m);
    }
    headlight(6, -0.30);
    headlight(7, -0.62);
    headlight(8,  0.30);
    headlight(9,  0.62);

    // Uzun far
    const hb = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.05, 0.55),
      lightMaterial(0xffffff)
    );
    hb.position.set(FX, 0.92, 0);
    addLight(10, hb);

    // Sis far
    const fgGeo = new THREE.BoxGeometry(0.06, 0.05, 0.10);
    const fgL = new THREE.Mesh(fgGeo, lightMaterial(0xffd96a));
    fgL.position.set(FX, 0.55, -0.78);
    addLight(11, fgL);
    const fgR = new THREE.Mesh(fgGeo, lightMaterial(0xffd96a));
    fgR.position.set(FX, 0.55,  0.78);
    addLight(11, fgR);

    // Stop
    const tlGeo = new THREE.BoxGeometry(0.04, 0.10, 0.42);
    const tlL = new THREE.Mesh(tlGeo, lightMaterial(0xff2d3e));
    tlL.position.set(RX, 0.95, -HALF_W * 0.50);
    addLight(12, tlL);
    const tlR = new THREE.Mesh(tlGeo, lightMaterial(0xff2d3e));
    tlR.position.set(RX, 0.95,  HALF_W * 0.50);
    addLight(13, tlR);

    // Geri vites
    const rev = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.06, 0.32),
      lightMaterial(0xffffff)
    );
    rev.position.set(RX, 0.78, 0);
    addLight(14, rev);

    // Plaka
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.10, 0.30),
      lightMaterial(0xfff8e8)
    );
    plate.position.set(RX, 0.55, 0);
    addLight(15, plate);

    // Sinyaller ön
    const tsGeo = new THREE.BoxGeometry(0.06, 0.04, 0.08);
    const tsL = new THREE.Mesh(tsGeo, lightMaterial(0xffb454));
    tsL.position.set(FX, 0.98, -HALF_W + 0.05);
    addLight(16, tsL);
    const tsR = new THREE.Mesh(tsGeo, lightMaterial(0xffb454));
    tsR.position.set(FX, 0.98,  HALF_W - 0.05);
    addLight(17, tsR);

    // Aynalar + yan sinyaller
    const sigSGeo = new THREE.BoxGeometry(0.06, 0.04, 0.04);
    const mirGeo = new THREE.BoxGeometry(0.16, 0.10, 0.20);
    function mirror(zSign, sigCh) {
      const m = new THREE.Mesh(mirGeo, lightMaterial(0xc084fc));
      m.position.set(0.78, 1.42, zSign * (HALF_W + 0.13));
      addLight(29, m);
      const sig = new THREE.Mesh(sigSGeo, lightMaterial(0xffb454));
      sig.position.set(0.78, 1.40, zSign * (HALF_W + 0.24));
      addLight(sigCh, sig);
    }
    mirror( 1, 19);
    mirror(-1, 18);

    // Kapılar
    const doorGeo = new THREE.BoxGeometry(0.78, 0.55, 0.025);
    function doorPanel(ch, x, zSign) {
      const m = new THREE.Mesh(doorGeo, lightMaterial(0xc084fc));
      m.position.set(x, 0.95, zSign * (HALF_W + 0.01));
      addLight(ch, m);
    }
    doorPanel(20,  0.5,  -1);
    doorPanel(21,  0.5,   1);
    doorPanel(22, -0.5,  -1);
    doorPanel(23, -0.5,   1);

    // Pencere ön sol/sağ
    const winGeo = new THREE.BoxGeometry(0.65, 0.32, 0.02);
    function winPanel(ch, zSign) {
      const m = new THREE.Mesh(winGeo, lightMaterial(0xc084fc));
      m.position.set(0.55, 1.40, zSign * (HALF_W + 0.018));
      addLight(ch, m);
    }
    winPanel(24, -1);
    winPanel(25,  1);

    // Bagaj
    const trunk = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.30, 1.10),
      lightMaterial(0xc084fc)
    );
    trunk.position.set(RX, 1.18, 0);
    addLight(26, trunk);

    // Frunk
    const frunk = new THREE.Mesh(
      new THREE.BoxGeometry(0.90, 0.04, 1.10),
      lightMaterial(0xc084fc)
    );
    frunk.position.set(HALF_LEN - 0.55, HOOD_Y + 0.04, 0);
    addLight(27, frunk);

    // Şarj portu
    const cp = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.10, 0.10),
      lightMaterial(0xc084fc)
    );
    cp.position.set(-1.65, 0.95, -HALF_W - 0.005);
    addLight(28, cp);

    // ─── API ──────────────────────────────────────────────────
    function syncChannels(row) {
      for (const [ch, meshes] of lightChannels) {
        const on = row && row[ch];
        for (const m of meshes) {
          m.material.emissiveIntensity = on ? 2.4 : 0;
        }
      }
    }

    let onLightClick = null;
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let dragStart = null;
    renderer.domElement.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragStart = { x: e.clientX, y: e.clientY };
    });
    renderer.domElement.addEventListener('pointerup', (e) => {
      if (!dragStart || e.button !== 0) return;
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      dragStart = null;
      if (dx * dx + dy * dy > 16) return;
      if (!onLightClick) return;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(allLightMeshes, false);
      if (hits[0]) onLightClick(hits[0].object.userData.ch);
    });

    function resize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    function loop() {
      controls.update();
      renderer.render(scene, camera);
      requestAnimationFrame(loop);
    }
    loop();

    window.Car3D = {
      syncChannels,
      onLightClick: (cb) => { onLightClick = cb; },
      setBodyColor: (hex) => { body.material.color.setHex(hex); },
      resetCamera: () => controls.reset(),
    };

    window.dispatchEvent(new CustomEvent('car3d-ready'));
  }

  // ─── Minimal orbit controls (kendi yazımımız, OrbitControls bağımlılığı yok)
  // Sol-tık + sürükle = döndür · sağ-tık + sürükle = pan · scroll = zoom
  function createOrbitControls(camera, dom, opts) {
    const THREE = window.THREE;
    const target  = opts.target.clone();
    const initial = {
      target: target.clone(),
      radius: opts.radius,
      theta:  opts.theta,
      phi:    opts.phi,
    };
    let radius = opts.radius;
    let theta  = opts.theta;
    let phi    = opts.phi;
    // damping hedefleri
    let tTheta = theta, tPhi = phi, tRadius = radius;
    const tTarget = target.clone();

    const minR = opts.minRadius ?? 3;
    const maxR = opts.maxRadius ?? 30;
    const minPhi = opts.minPhi ?? 0.05;
    const maxPhi = opts.maxPhi ?? Math.PI - 0.05;

    let mode = null;       // 'rotate' | 'pan' | null
    let lastX = 0, lastY = 0;
    let activePointerId = null;

    function update() {
      // damping (lerp)
      theta  += (tTheta  - theta)  * 0.18;
      phi    += (tPhi    - phi)    * 0.18;
      radius += (tRadius - radius) * 0.18;
      target.lerp(tTarget, 0.18);

      const sinPhi = Math.sin(phi);
      camera.position.x = target.x + radius * sinPhi * Math.cos(theta);
      camera.position.y = target.y + radius * Math.cos(phi);
      camera.position.z = target.z + radius * sinPhi * Math.sin(theta);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
    }

    dom.style.touchAction = 'none';
    dom.addEventListener('contextmenu', (e) => e.preventDefault());

    dom.addEventListener('pointerdown', (e) => {
      if (activePointerId !== null) return;
      mode = (e.button === 2 || e.shiftKey) ? 'pan' : 'rotate';
      lastX = e.clientX; lastY = e.clientY;
      activePointerId = e.pointerId;
      try { dom.setPointerCapture(e.pointerId); } catch (_) {}
    });
    dom.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activePointerId || !mode) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (mode === 'rotate') {
        tTheta -= dx * 0.0065;
        tPhi   -= dy * 0.0065;
        if (tPhi < minPhi) tPhi = minPhi;
        if (tPhi > maxPhi) tPhi = maxPhi;
      } else {
        // ekran düzlemine göre pan
        const panScale = radius * 0.0018;
        const right = new THREE.Vector3();
        const up    = new THREE.Vector3();
        right.setFromMatrixColumn(camera.matrix, 0);
        up.setFromMatrixColumn(camera.matrix, 1);
        right.multiplyScalar(-dx * panScale);
        up.multiplyScalar(   dy * panScale);
        tTarget.add(right).add(up);
      }
    });
    function endDrag(e) {
      if (e.pointerId !== activePointerId) return;
      activePointerId = null;
      mode = null;
      try { dom.releasePointerCapture(e.pointerId); } catch (_) {}
    }
    dom.addEventListener('pointerup', endDrag);
    dom.addEventListener('pointercancel', endDrag);

    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = Math.exp(e.deltaY * 0.0012);
      tRadius = Math.max(minR, Math.min(maxR, tRadius * factor));
    }, { passive: false });

    return {
      update,
      reset() {
        tTarget.copy(initial.target);
        tTheta = initial.theta;
        tPhi   = initial.phi;
        tRadius = initial.radius;
      },
    };
  }

  // defer scriptleri DOM hazır olunca çalışır
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
