// Tesla Model Y Juniper (2025) — proseduel 3D model
// Three.js r160. Light show kanal sistemine bağlanır (window.Car3D).
// 1 unit = 1 metre.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const container = document.getElementById('car3d');
if (!container) {
  console.warn('[Car3D] #car3d not found');
} else {
  start();
}

function start() {
  // ─── Renderer / scene / camera ─────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07090f);
  scene.fog = new THREE.Fog(0x07090f, 14, 36);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(7.5, 3.4, 7.0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 4.5;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 0.85, 0);
  controls.update();

  // ─── Aydınlatma ────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));
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

  // Hafif radial vinyet halkası
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.6, 4.2, 64),
    new THREE.MeshBasicMaterial({ color: 0x57f5ff, transparent: true, opacity: 0.05 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.005;
  scene.add(ring);

  // ─── Model Y Juniper gövde profili (yandan) ─────────────────
  // X = boy (front=+, rear=-), Y = yükseklik. Tipik MY ölçüleri.
  const HALF_LEN = 2.375;          // 4.75m
  const HALF_W   = 0.93;           // gövde yarı genişlik (ekstrüzyon)
  const FLOOR_Y  = 0.30;           // taban (yer açıklığı + biraz)
  const HOOD_Y   = 0.96;
  const ROOF_Y   = 1.62;

  const profile = new THREE.Shape();
  profile.moveTo( HALF_LEN,           FLOOR_Y);
  profile.lineTo( HALF_LEN,           HOOD_Y);
  profile.lineTo( HALF_LEN - 0.30,    HOOD_Y + 0.02);
  profile.bezierCurveTo(
    HALF_LEN - 0.65, HOOD_Y + 0.05,    // hood eğrisi
    HALF_LEN - 1.00, HOOD_Y + 0.18,
    HALF_LEN - 1.30, 1.20             // ön cam dibi
  );
  profile.bezierCurveTo(
    HALF_LEN - 1.65, 1.42,             // ön cam ortası (dik raked)
    HALF_LEN - 2.00, ROOF_Y - 0.02,
    HALF_LEN - 2.40, ROOF_Y           // tavan ön kenarı
  );
  // Tavan (hafif outlined)
  profile.lineTo(-0.85, ROOF_Y);
  profile.bezierCurveTo(
    -1.50, ROOF_Y,
    -1.80, ROOF_Y - 0.12,
    -2.05, 1.34                       // arka cam üstü
  );
  profile.bezierCurveTo(
    -2.25, 1.18,
    -HALF_LEN + 0.05, 1.02,
    -HALF_LEN, 0.92                   // arka kapağın üstü
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

  // Tesla "Stealth Grey" / "Quicksilver" tonlu metalik
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

  // ─── Cam (greenhouse) — body'nin biraz içinde ───────────────
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
    depth: glassW,
    bevelEnabled: false,
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

  // Yan camlar (basit thin plane'ler)
  const sideGlassMat = glassMat.clone();
  function sideWindow(zSign) {
    const s = new THREE.Shape();
    s.moveTo( 1.05, 1.18);
    s.lineTo( 0.55, 1.55);
    s.lineTo(-1.20, 1.55);
    s.lineTo(-1.85, 1.18);
    s.lineTo( 1.05, 1.18);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
    g.translate(0, 0, -0.01);
    const m = new THREE.Mesh(g, sideGlassMat);
    m.position.z = zSign * (HALF_W - 0.005);
    car.add(m);
    return m;
  }
  sideWindow( 1);
  sideWindow(-1);

  // Kapı çizgisi (subtle seams) — cosmetic
  function seam(x1, x2, y, zSign) {
    const pts = [
      new THREE.Vector3(x1, y, zSign * (HALF_W + 0.001)),
      new THREE.Vector3(x2, y, zSign * (HALF_W + 0.001)),
    ];
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const m = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 });
    car.add(new THREE.Line(g, m));
  }
  for (const z of [1, -1]) {
    seam( 0.95, 0.95, FLOOR_Y + 0.05, z);  seam( 0.95, 0.95, 1.55, z);
    seam( 0.05, 0.05, FLOOR_Y + 0.05, z);  seam( 0.05, 0.05, 1.55, z);
    seam(-0.95,-0.95, FLOOR_Y + 0.05, z);  seam(-0.95,-0.95, 1.55, z);
  }

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

    // Aero jant disk
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.08, 36), rimDarkMat);
    disk.rotation.x = Math.PI / 2;
    disk.position.z = zSign * 0.1;
    g.add(disk);

    // 5 spoke
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.55), rimMat);
      sp.position.z = zSign * 0.11;
      sp.rotation.z = (i / 5) * Math.PI * 2;
      g.add(sp);
    }
    // Merkez Tesla logo
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 24), rimMat);
    cap.rotation.x = Math.PI / 2;
    cap.position.z = zSign * 0.13;
    g.add(cap);

    g.position.set(x, 0.385, zSign * (HALF_W - 0.06));
    car.add(g);
    return g;
  }
  makeWheel( 1.42,  1);
  makeWheel( 1.42, -1);
  makeWheel(-1.42,  1);
  makeWheel(-1.42, -1);

  // Çamurluk vurgusu (tekerlek arklarını "yutmak" için ufak siyah disk)
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

  // ─── IŞIKLAR (kanal eşleme) ────────────────────────────────
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

  // ── ÖN ── Juniper'ın imza özelliği: tüm genişlik boyunca ince LED bar
  const FX = HALF_LEN + 0.005;       // ön yüz
  const RX = -HALF_LEN - 0.005;       // arka yüz

  // Ön LED bar — 2 segment (sol/sağ outline) → ch 0, 1
  const barGeoF = new THREE.BoxGeometry(0.04, 0.045, HALF_W * 0.92);
  const lbFL = new THREE.Mesh(barGeoF, lightMaterial(0x57f5ff));
  lbFL.position.set(FX, 0.98, -HALF_W * 0.50);
  addLight(0, lbFL);
  const lbFR = new THREE.Mesh(barGeoF, lightMaterial(0x57f5ff));
  lbFR.position.set(FX, 0.98,  HALF_W * 0.50);
  addLight(1, lbFR);

  // Yan outline — alt body line (DRL şerit) → ch 2, 3
  const sideBarGeo = new THREE.BoxGeometry(2.0, 0.03, 0.04);
  const sbL = new THREE.Mesh(sideBarGeo, lightMaterial(0x57f5ff));
  sbL.position.set(0, 0.55, -HALF_W - 0.005);
  addLight(2, sbL);
  const sbR = new THREE.Mesh(sideBarGeo, lightMaterial(0x57f5ff));
  sbR.position.set(0, 0.55,  HALF_W + 0.005);
  addLight(3, sbR);

  // Arka LED bar wrap-around — 2 segment → ch 4, 5
  const barGeoR = new THREE.BoxGeometry(0.04, 0.06, HALF_W * 0.92);
  const lbRL = new THREE.Mesh(barGeoR, lightMaterial(0x57f5ff));
  lbRL.position.set(RX, 1.05, -HALF_W * 0.50);
  addLight(4, lbRL);
  const lbRR = new THREE.Mesh(barGeoR, lightMaterial(0x57f5ff));
  lbRR.position.set(RX, 1.05,  HALF_W * 0.50);
  addLight(5, lbRR);

  // Far iç/dış sol/sağ → ch 6,7,8,9 (Juniper farları LED bar'ın altında)
  const hlGeo = new THREE.BoxGeometry(0.05, 0.07, 0.16);
  function headlight(ch, z) {
    const m = new THREE.Mesh(hlGeo, lightMaterial(0xfff7d6));
    m.position.set(FX, 0.86, z);
    addLight(ch, m);
  }
  headlight(6, -0.30);   // far sol iç
  headlight(7, -0.62);   // far sol dış
  headlight(8,  0.30);   // far sağ iç
  headlight(9,  0.62);   // far sağ dış

  // Uzun far → ch 10
  const hb = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.05, 0.55),
    lightMaterial(0xffffff)
  );
  hb.position.set(FX, 0.92, 0);
  addLight(10, hb);

  // Sis far → ch 11 (alt corner'lar)
  const fgGeo = new THREE.BoxGeometry(0.06, 0.05, 0.10);
  const fgL = new THREE.Mesh(fgGeo, lightMaterial(0xffd96a));
  fgL.position.set(FX, 0.55, -0.78);
  addLight(11, fgL);
  const fgR = new THREE.Mesh(fgGeo, lightMaterial(0xffd96a));
  fgR.position.set(FX, 0.55,  0.78);
  addLight(11, fgR);

  // Stop sol/sağ → ch 12, 13 (LED bar dışında ek lamba kümesi)
  const tlGeo = new THREE.BoxGeometry(0.04, 0.10, 0.42);
  const tlL = new THREE.Mesh(tlGeo, lightMaterial(0xff2d3e));
  tlL.position.set(RX, 0.95, -HALF_W * 0.50);
  addLight(12, tlL);
  const tlR = new THREE.Mesh(tlGeo, lightMaterial(0xff2d3e));
  tlR.position.set(RX, 0.95,  HALF_W * 0.50);
  addLight(13, tlR);

  // Geri vites → ch 14
  const rev = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.06, 0.32),
    lightMaterial(0xffffff)
  );
  rev.position.set(RX, 0.78, 0);
  addLight(14, rev);

  // Plaka → ch 15
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.10, 0.30),
    lightMaterial(0xfff8e8)
  );
  plate.position.set(RX, 0.55, 0);
  addLight(15, plate);

  // Sinyaller ön → ch 16, 17
  const tsGeo = new THREE.BoxGeometry(0.06, 0.04, 0.08);
  const tsL = new THREE.Mesh(tsGeo, lightMaterial(0xffb454));
  tsL.position.set(FX, 0.98, -HALF_W + 0.05);
  addLight(16, tsL);
  const tsR = new THREE.Mesh(tsGeo, lightMaterial(0xffb454));
  tsR.position.set(FX, 0.98,  HALF_W - 0.05);
  addLight(17, tsR);

  // Yan sinyal (ayna kapağında) → ch 18, 19
  const sigSGeo = new THREE.BoxGeometry(0.06, 0.04, 0.04);

  // Aynalar (mirror) → ch 29 — mesh'i de oluşturup yan sinyali içine yerleştir
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

  // Kapılar → ch 20-23
  const doorGeo = new THREE.BoxGeometry(0.78, 0.55, 0.025);
  function doorPanel(ch, x, zSign) {
    const m = new THREE.Mesh(doorGeo, lightMaterial(0xc084fc));
    m.position.set(x, 0.95, zSign * (HALF_W + 0.01));
    addLight(ch, m);
  }
  doorPanel(20,  0.5,  -1);   // ön sol
  doorPanel(21,  0.5,   1);   // ön sağ
  doorPanel(22, -0.5,  -1);   // arka sol
  doorPanel(23, -0.5,   1);   // arka sağ

  // Pencere ön sol/sağ → ch 24, 25 (yan camın bir kısmı)
  const winGeo = new THREE.BoxGeometry(0.65, 0.32, 0.02);
  function winPanel(ch, zSign) {
    const m = new THREE.Mesh(winGeo, lightMaterial(0xc084fc));
    m.position.set(0.55, 1.40, zSign * (HALF_W + 0.018));
    addLight(ch, m);
  }
  winPanel(24, -1);
  winPanel(25,  1);

  // Bagaj → ch 26
  const trunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.30, 1.10),
    lightMaterial(0xc084fc)
  );
  trunk.position.set(RX, 1.18, 0);
  addLight(26, trunk);

  // Frunk → ch 27
  const frunk = new THREE.Mesh(
    new THREE.BoxGeometry(0.90, 0.04, 1.10),
    lightMaterial(0xc084fc)
  );
  frunk.position.set(HALF_LEN - 0.55, HOOD_Y + 0.04, 0);
  addLight(27, frunk);

  // Şarj portu → ch 28 (sol arka)
  const cp = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.10, 0.10),
    lightMaterial(0xc084fc)
  );
  cp.position.set(-1.65, 0.95, -HALF_W - 0.005);
  addLight(28, cp);

  // ─── API ──────────────────────────────────────────────────
  const baseColors = new Map();
  for (const m of allLightMeshes) baseColors.set(m, m.material.emissive.clone());

  function syncChannels(row) {
    for (const [ch, meshes] of lightChannels) {
      const on = row && row[ch];
      for (const m of meshes) {
        m.material.emissiveIntensity = on ? 2.4 : 0;
      }
    }
  }

  // Tıklama → kanal toggle (drag değilse)
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
    if (dx * dx + dy * dy > 16) return;     // sürükleme
    if (!onLightClick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(allLightMeshes, false);
    if (hits[0]) onLightClick(hits[0].object.userData.ch);
  });

  // Resize
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

  // Render döngüsü
  function loop() {
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  loop();

  // Hafif idle döndürme yok — kullanıcı manuel kontrol etsin

  // Global API
  window.Car3D = {
    syncChannels,
    onLightClick: (cb) => { onLightClick = cb; },
    setBodyColor: (hex) => { body.material.color.setHex(hex); },
    resetCamera: () => {
      camera.position.set(7.5, 3.4, 7.0);
      controls.target.set(0, 0.85, 0);
      controls.update();
    },
  };

  window.dispatchEvent(new CustomEvent('car3d-ready'));
}
