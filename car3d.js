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

    // ─── Tesla Model Y Juniper 2025 — proseduel gövde ─────────
    // L=4.79m W=1.98m H=1.62m WB=2.89m. 1 unit = 1m.
    const HALF_LEN = 2.395;
    const LB_HALF_W = 0.99;             // alt gövde (door section) yarı genişlik
    const GH_HALF_W = 0.825;            // greenhouse (cabin) yarı genişlik — daralan görünüm
    const FLOOR_Y  = 0.27;              // yer açıklığı
    const BELT_Y   = 1.04;              // belt line (cam alt kenarı)
    const ROOF_Y   = 1.62;
    const WHEEL_R  = 0.365;
    const WB_HALF  = 1.445;             // wheel base / 2

    const car = new THREE.Group();
    scene.add(car);

    // Gövde malzemesi — Tesla "Quicksilver" metalik gri
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: 0xb6bcc4,
      metalness: 0.9,
      roughness: 0.28,
      clearcoat: 0.9,
      clearcoatRoughness: 0.08,
    });

    // ── Alt gövde (floor + door section + bumpers) ──
    // Belt line greenhouse ile aynı X aralığını paylaşır.
    const GH_FRONT_X = HALF_LEN - 1.55;     // greenhouse ön köşe X (+0.845)
    const GH_REAR_X  = -HALF_LEN + 0.45;    // greenhouse arka köşe X (-1.945)
    const lower = new THREE.Shape();
    lower.moveTo( HALF_LEN,            FLOOR_Y);
    lower.lineTo( HALF_LEN,            0.50);
    lower.bezierCurveTo(HALF_LEN,      0.78,  HALF_LEN - 0.05, 0.84, HALF_LEN - 0.12, 0.88);
    lower.bezierCurveTo(HALF_LEN - 0.45, 0.95, HALF_LEN - 0.85, 1.00, HALF_LEN - 1.20, BELT_Y);
    lower.lineTo( GH_FRONT_X,          BELT_Y);
    lower.lineTo( GH_REAR_X,           BELT_Y);
    lower.bezierCurveTo(-HALF_LEN + 0.25, BELT_Y - 0.06, -HALF_LEN + 0.08, 0.92, -HALF_LEN + 0.02, 0.86);
    lower.bezierCurveTo(-HALF_LEN, 0.82, -HALF_LEN, 0.75, -HALF_LEN, 0.65);
    lower.lineTo(-HALF_LEN,            0.50);
    lower.lineTo(-HALF_LEN,            FLOOR_Y);
    lower.lineTo( HALF_LEN,            FLOOR_Y);

    const lowerGeo = new THREE.ExtrudeGeometry(lower, {
      depth: LB_HALF_W * 2,
      bevelEnabled: true,
      bevelSize: 0.07,
      bevelThickness: 0.08,
      bevelSegments: 5,
      curveSegments: 22,
    });
    lowerGeo.translate(0, 0, -LB_HALF_W);
    lowerGeo.computeVertexNormals();
    const lowerBody = new THREE.Mesh(lowerGeo, bodyMat);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    car.add(lowerBody);
    const body = lowerBody;   // dış API için referans

    // ── Greenhouse (cabin / üst gövde) — daralan, kavisli ──
    // Belt line lower body ile birebir hizalı (gap kalmaz)
    const cabin = new THREE.Shape();
    cabin.moveTo( GH_FRONT_X,          BELT_Y);
    cabin.bezierCurveTo(                                              // raked windshield
      HALF_LEN - 1.85, BELT_Y + 0.18,
      HALF_LEN - 2.05, 1.45,
      HALF_LEN - 2.20, ROOF_Y - 0.02
    );
    cabin.lineTo(-HALF_LEN + 1.10,     ROOF_Y);                       // tavan (hafif kemerli)
    cabin.bezierCurveTo(                                              // sloped rear glass
      -HALF_LEN + 0.85, ROOF_Y - 0.04,
      -HALF_LEN + 0.55, 1.34,
      GH_REAR_X,        BELT_Y                                        // belt line'a inişte hizala
    );
    cabin.lineTo( GH_FRONT_X,          BELT_Y);

    const cabinGeo = new THREE.ExtrudeGeometry(cabin, {
      depth: GH_HALF_W * 2,
      bevelEnabled: true,
      bevelSize: 0.05,
      bevelThickness: 0.06,
      bevelSegments: 5,
      curveSegments: 22,
    });
    cabinGeo.translate(0, 0, -GH_HALF_W);
    cabinGeo.computeVertexNormals();
    const cabinMesh = new THREE.Mesh(cabinGeo, bodyMat);
    cabinMesh.castShadow = true;
    cabinMesh.receiveShadow = true;
    car.add(cabinMesh);

    // ── Belirgin "shoulder" — alt gövde ile cabin arasında siyah trim
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x070809, roughness: 0.65, metalness: 0.3,
    });

    // ── Cam malzemesi (koyu tinted, çift taraflı) ──
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x05080c,
      metalness: 0.0,
      roughness: 0.05,
      transmission: 0.30,
      transparent: true,
      opacity: 0.92,
      ior: 1.45,
      thickness: 0.05,
      side: THREE.DoubleSide,
    });

    // Yan camlar (sol + sağ) — düz dikdörtgen, B-pillar ile bölünmüş
    function sideGlass(zSign) {
      const z = zSign * (GH_HALF_W + 0.002);
      // ön yan cam (driver)
      const fm = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.48), glassMat);
      fm.position.set(0.50, BELT_Y + 0.28, z);
      car.add(fm);
      // arka yan cam (passenger rear)
      const rm = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.40), glassMat);
      rm.position.set(-0.55, BELT_Y + 0.24, z);
      car.add(rm);
      // B-pillar
      const bp = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.52, 0.03), trimMat);
      bp.position.set(0.0, BELT_Y + 0.26, z + zSign * 0.004);
      car.add(bp);
    }
    sideGlass( 1);
    sideGlass(-1);

    // Panoramik tavan camı (Tesla'nın imzası)
    const roofGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(2.20, 1.45),
      new THREE.MeshPhysicalMaterial({
        color: 0x040608, metalness: 0.0, roughness: 0.05,
        transmission: 0.30, transparent: true, opacity: 0.92,
        side: THREE.DoubleSide,
      })
    );
    roofGlass.position.set(-0.20, ROOF_Y + 0.003, 0);
    roofGlass.rotation.x = -Math.PI / 2;
    car.add(roofGlass);

    // ── Kapı seam çizgileri (cosmetic black) ──
    function doorSeam(x, zSign) {
      const g = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.78, 0.025),
        trimMat
      );
      g.position.set(x, 0.66, zSign * (LB_HALF_W + 0.005));
      car.add(g);
    }
    for (const z of [1, -1]) {
      doorSeam( 1.00, z);   // ön kapı önü
      doorSeam( 0.00, z);   // ön - arka kapı arası
      doorSeam(-1.05, z);   // arka kapı arkası
    }

    // ── Kapı kolları (flush) ──
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0xc0c5cb, metalness: 0.7, roughness: 0.3,
    });
    function doorHandle(x, zSign) {
      const h = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.04, 0.025),
        handleMat
      );
      h.position.set(x, BELT_Y - 0.10, zSign * (LB_HALF_W + 0.012));
      car.add(h);
    }
    for (const z of [1, -1]) {
      doorHandle( 0.55, z);
      doorHandle(-0.50, z);
    }

    // ── Tekerlek arkı trim (siyah plastik flares) ──
    const archMat = new THREE.MeshStandardMaterial({
      color: 0x09090b, roughness: 0.85, metalness: 0.1,
      side: THREE.DoubleSide,
    });
    function wheelArch(x, zSign) {
      // dış kavis — half-torus, XY düzleminde (yandan üstü kapalı U gibi görünür)
      const torusGeo = new THREE.TorusGeometry(0.46, 0.06, 14, 28, Math.PI);
      const arch = new THREE.Mesh(torusGeo, archMat);
      arch.position.set(x, WHEEL_R + 0.04, zSign * (LB_HALF_W + 0.005));
      car.add(arch);
      // dolgu disk — tekerleğin etrafında siyah arka plan (recess illüzyonu)
      const disk = new THREE.Mesh(
        new THREE.CircleGeometry(0.44, 32),
        archMat
      );
      disk.position.set(x, WHEEL_R, zSign * (LB_HALF_W + 0.002));
      car.add(disk);
    }
    wheelArch( WB_HALF,  1); wheelArch( WB_HALF, -1);
    wheelArch(-WB_HALF,  1); wheelArch(-WB_HALF, -1);

    // ── Tekerler — Tesla aero stil 19" jant ──
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.95 });
    const rimSilver = new THREE.MeshStandardMaterial({ color: 0xb6bcc4, metalness: 0.9, roughness: 0.25 });
    const rimDark   = new THREE.MeshStandardMaterial({ color: 0x141518, metalness: 0.4, roughness: 0.6 });

    function makeWheel(x, zSign) {
      const g = new THREE.Group();
      // Lastik
      const tire = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_R, WHEEL_R, 0.24, 48),
        tireMat
      );
      tire.rotation.x = Math.PI / 2;
      tire.castShadow = true;
      g.add(tire);

      // Jant arka diski (siyah)
      const back = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_R - 0.04, WHEEL_R - 0.04, 0.04, 36),
        rimDark
      );
      back.rotation.x = Math.PI / 2;
      back.position.z = zSign * 0.06;
      g.add(back);

      // Jant ön diski (gümüş, hafif çukur)
      const face = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL_R - 0.05, WHEEL_R - 0.06, 0.04, 36),
        rimSilver
      );
      face.rotation.x = Math.PI / 2;
      face.position.z = zSign * 0.10;
      g.add(face);

      // 5 spoke (üçgen prizmalar)
      for (let i = 0; i < 5; i++) {
        const sp = new THREE.Mesh(
          new THREE.BoxGeometry(0.10, 0.04, WHEEL_R * 1.55),
          rimDark
        );
        sp.position.z = zSign * 0.11;
        sp.rotation.z = (i / 5) * Math.PI * 2;
        g.add(sp);
      }

      // Merkez logo cap
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.05, 28),
        rimSilver
      );
      cap.rotation.x = Math.PI / 2;
      cap.position.z = zSign * 0.13;
      g.add(cap);

      g.position.set(x, WHEEL_R, zSign * (LB_HALF_W - 0.085));
      car.add(g);
    }
    makeWheel( WB_HALF,  1); makeWheel( WB_HALF, -1);
    makeWheel(-WB_HALF,  1); makeWheel(-WB_HALF, -1);

    // ── Ön tampon alt detay (siyah trim + air intake) ──
    const lowerFascia = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.18, 1.40),
      trimMat
    );
    lowerFascia.position.set( HALF_LEN - 0.02, 0.40, 0);
    car.add(lowerFascia);

    const rearFascia = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.16, 1.50),
      trimMat
    );
    rearFascia.position.set(-HALF_LEN + 0.02, 0.40, 0);
    car.add(rearFascia);

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
    function addLight(ch, mesh, opts) {
      mesh.userData.ch = ch;
      if (opts && opts.hideWhenOff) {
        mesh.userData.hideWhenOff = true;
        mesh.visible = false;
      }
      if (!lightChannels.has(ch)) lightChannels.set(ch, []);
      lightChannels.get(ch).push(mesh);
      allLightMeshes.push(mesh);
      car.add(mesh);
    }

    const FX = HALF_LEN + 0.001;
    const RX = -HALF_LEN - 0.001;
    const ZW = LB_HALF_W;        // ışık dış kenarları

    // ── Juniper ön LED BAR (tüm genişlikte tek şerit, 2 kanal) ──
    // Hood'un hemen altına yerleşir, gerçek Juniper imzası.
    const FRONT_BAR_Y = 0.92;
    const fbW = 0.05, fbH = 0.05, fbL = ZW * 0.80;
    const lbFL = new THREE.Mesh(new THREE.BoxGeometry(fbW, fbH, fbL),
      lightMaterial(0x57f5ff));
    lbFL.position.set(FX, FRONT_BAR_Y, -fbL / 2 - 0.005);
    addLight(0, lbFL);
    const lbFR = new THREE.Mesh(new THREE.BoxGeometry(fbW, fbH, fbL),
      lightMaterial(0x57f5ff));
    lbFR.position.set(FX, FRONT_BAR_Y,  fbL / 2 + 0.005);
    addLight(1, lbFR);

    // ── Yan outline (alt body line, kapı altından geçer) ──
    const sideBarGeo = new THREE.BoxGeometry(2.10, 0.03, 0.04);
    const sbL = new THREE.Mesh(sideBarGeo, lightMaterial(0x57f5ff));
    sbL.position.set(0, 0.40, -ZW - 0.005);
    addLight(2, sbL);
    const sbR = new THREE.Mesh(sideBarGeo, lightMaterial(0x57f5ff));
    sbR.position.set(0, 0.40,  ZW + 0.005);
    addLight(3, sbR);

    // ── Arka tam-genişlik LED BAR (Juniper'ın diğer imzası) ──
    const REAR_BAR_Y = 1.00;
    const rbW = 0.04, rbH = 0.05, rbL = ZW * 0.80;
    const lbRL = new THREE.Mesh(new THREE.BoxGeometry(rbW, rbH, rbL),
      lightMaterial(0xff2d3e));
    lbRL.position.set(RX, REAR_BAR_Y, -rbL / 2 - 0.005);
    addLight(4, lbRL);
    const lbRR = new THREE.Mesh(new THREE.BoxGeometry(rbW, rbH, rbL),
      lightMaterial(0xff2d3e));
    lbRR.position.set(RX, REAR_BAR_Y,  rbL / 2 + 0.005);
    addLight(5, lbRR);

    // ── Far kümesi (LED bar'ın altında, Juniper'ın iki ana farı) ──
    const hlGeo = new THREE.BoxGeometry(0.05, 0.10, 0.22);
    function headlight(ch, z) {
      const m = new THREE.Mesh(hlGeo, lightMaterial(0xfff7d6));
      m.position.set(FX, 0.74, z);
      addLight(ch, m);
    }
    headlight(6, -0.32);
    headlight(7, -0.65);
    headlight(8,  0.32);
    headlight(9,  0.65);

    // Uzun far — bar'ın merkez kısmı (parlak beyaz)
    const hb = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.06, 0.55),
      lightMaterial(0xffffff)
    );
    hb.position.set(FX + 0.001, FRONT_BAR_Y, 0);
    addLight(10, hb);

    // Sis far (alt corner'larda)
    const fgGeo = new THREE.BoxGeometry(0.06, 0.06, 0.14);
    const fgL = new THREE.Mesh(fgGeo, lightMaterial(0xffd96a));
    fgL.position.set(FX, 0.46, -0.78);
    addLight(11, fgL);
    const fgR = new THREE.Mesh(fgGeo, lightMaterial(0xffd96a));
    fgR.position.set(FX, 0.46,  0.78);
    addLight(11, fgR);

    // Stop (ek lamba kümesi, LED bar'ın yanlarında)
    const tlGeo = new THREE.BoxGeometry(0.04, 0.12, 0.30);
    const tlL = new THREE.Mesh(tlGeo, lightMaterial(0xff2d3e));
    tlL.position.set(RX, 0.84, -0.62);
    addLight(12, tlL);
    const tlR = new THREE.Mesh(tlGeo, lightMaterial(0xff2d3e));
    tlR.position.set(RX, 0.84,  0.62);
    addLight(13, tlR);

    // Geri vites (alt orta beyaz)
    const rev = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.06, 0.32),
      lightMaterial(0xffffff)
    );
    rev.position.set(RX, 0.66, 0);
    addLight(14, rev);

    // Plaka aydınlatması
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.08, 0.32),
      lightMaterial(0xfff8e8)
    );
    plate.position.set(RX, 0.50, 0);
    addLight(15, plate);

    // Sinyaller ön — bar'ın uçlarında
    const tsGeo = new THREE.BoxGeometry(0.05, 0.06, 0.10);
    const tsL = new THREE.Mesh(tsGeo, lightMaterial(0xffb454));
    tsL.position.set(FX, FRONT_BAR_Y, -fbL - 0.04);
    addLight(16, tsL);
    const tsR = new THREE.Mesh(tsGeo, lightMaterial(0xffb454));
    tsR.position.set(FX, FRONT_BAR_Y,  fbL + 0.04);
    addLight(17, tsR);

    // Aynalar (caps) + yan sinyaller (entegre)
    const mirCapGeo = new THREE.BoxGeometry(0.18, 0.10, 0.13);
    const mirStemGeo = new THREE.BoxGeometry(0.08, 0.04, 0.05);
    function mirror(zSign, sigCh) {
      // Görsel ayna kapağı (gövde rengi, her zaman görünür)
      const visualCap = new THREE.Mesh(mirCapGeo, bodyMat);
      visualCap.position.set(0.80, BELT_Y + 0.20, zSign * (LB_HALF_W + 0.21));
      car.add(visualCap);
      const stem = new THREE.Mesh(mirStemGeo, trimMat);
      stem.position.set(0.80, BELT_Y + 0.20, zSign * (LB_HALF_W + 0.10));
      car.add(stem);
      // Glow overlay — mirror channel 29
      const glow = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.10, 0.02),
        lightMaterial(0xc084fc)
      );
      glow.position.set(0.80, BELT_Y + 0.20, zSign * (LB_HALF_W + 0.27));
      addLight(29, glow, { hideWhenOff: true });
      // Yan sinyal
      const sig = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.025, 0.03),
        lightMaterial(0xffb454)
      );
      sig.position.set(0.80, BELT_Y + 0.17, zSign * (LB_HALF_W + 0.27));
      addLight(sigCh, sig);
    }
    mirror( 1, 19);
    mirror(-1, 18);

    // Kapılar (ışık olarak — gerçek panel zaten gövdenin parçası,
    // glow için ince emissive overlay)
    const doorGeo = new THREE.BoxGeometry(0.78, 0.45, 0.025);
    function doorPanel(ch, x, zSign) {
      const m = new THREE.Mesh(doorGeo, lightMaterial(0xc084fc));
      m.position.set(x, 0.66, zSign * (LB_HALF_W + 0.018));
      addLight(ch, m, { hideWhenOff: true });
    }
    doorPanel(20,  0.55, -1);
    doorPanel(21,  0.55,  1);
    doorPanel(22, -0.50, -1);
    doorPanel(23, -0.50,  1);

    // Pencereler (ön sol/sağ)
    const winGeo = new THREE.BoxGeometry(0.85, 0.35, 0.02);
    function winPanel(ch, zSign) {
      const m = new THREE.Mesh(winGeo, lightMaterial(0xc084fc));
      m.position.set(0.50, BELT_Y + 0.28, zSign * (GH_HALF_W + 0.012));
      addLight(ch, m, { hideWhenOff: true });
    }
    winPanel(24, -1);
    winPanel(25,  1);

    // Bagaj
    const trunk = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.28, 1.20),
      lightMaterial(0xc084fc)
    );
    trunk.position.set(RX, 1.18, 0);
    addLight(26, trunk, { hideWhenOff: true });

    // Frunk
    const frunk = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.04, 1.10),
      lightMaterial(0xc084fc)
    );
    frunk.position.set(HALF_LEN - 0.62, BELT_Y + 0.005, 0);
    addLight(27, frunk, { hideWhenOff: true });

    // Şarj portu
    const cp = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.10, 0.04),
      lightMaterial(0xc084fc)
    );
    cp.position.set(-WB_HALF - 0.30, 0.95, -LB_HALF_W - 0.005);
    addLight(28, cp, { hideWhenOff: true });

    // ─── API ──────────────────────────────────────────────────
    function syncChannels(row) {
      for (const [ch, meshes] of lightChannels) {
        const on = !!(row && row[ch]);
        for (const m of meshes) {
          m.material.emissiveIntensity = on ? 2.6 : 0;
          if (m.userData.hideWhenOff) m.visible = on;
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
