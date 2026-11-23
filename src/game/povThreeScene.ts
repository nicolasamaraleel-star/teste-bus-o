import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { audio } from './audio';

export type PovCutsceneMode = 'intro' | 'mid_bus_stop' | 'final_office';

export interface PovStageOptions {
  mode: PovCutsceneMode;
  nextLineCode?: string;
  fiscalChasing?: boolean;
  onPhaseText?: (caption: string) => void;
  onComplete?: () => void;
}

const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _camCurrentLook = new THREE.Vector3();

function makeLabelTexture(
  width: number,
  height: number,
  bg: string,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);
    draw(ctx, width, height);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function makeRadialShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    g.addColorStop(0, 'rgba(2, 6, 23, 0.65)');
    g.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildPovArm(): THREE.Group {
  const arm = new THREE.Group();

  const sleeveMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.65,
    metalness: 0.04,
  });
  const cuffMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    roughness: 0.5,
    metalness: 0.05,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xf5c29b,
    roughness: 0.58,
    metalness: 0.02,
  });
  const watchMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.35,
    metalness: 0.65,
  });

  // Casual dress shirt sleeve
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.098, 0.55, 12), sleeveMat);
  sleeve.rotation.x = Math.PI / 2;
  sleeve.position.set(0, 0, 0.38);
  arm.add(sleeve);

  // Crisp white buttoned shirt cuff + dark wristwatch
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.082, 0.07, 12), cuffMat);
  cuff.rotation.x = Math.PI / 2;
  cuff.position.set(0, 0, 0.08);
  arm.add(cuff);

  const wristBand = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.07, 0.036, 12), watchMat);
  wristBand.rotation.x = Math.PI / 2;
  wristBand.position.set(0, 0, 0.025);
  arm.add(wristBand);

  // Forearm & palm
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.055, 0.14), skinMat);
  palm.position.set(0, 0, -0.07);
  arm.add(palm);

  // Thumb
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.055, 4, 8), skinMat);
  thumb.rotation.z = Math.PI / 3;
  thumb.rotation.x = Math.PI / 4;
  thumb.position.set(-0.072, 0.02, -0.07);
  arm.add(thumb);

  // 4 fingers
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.065, 4, 8), skinMat);
    f.rotation.x = Math.PI / 2;
    f.position.set(-0.042 + i * 0.028, 0.004, -0.17);
    arm.add(f);
  }

  return arm;
}

function buildCompositeBus(
  lineCode: string,
  maxAnisotropy: number
): { group: THREE.Group; wheels: THREE.Mesh[]; brakeMat: THREE.MeshStandardMaterial } {
  const bus = new THREE.Group();

  const silverMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.32,
    metalness: 0.65,
  });
  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.35,
    metalness: 0.35,
  });
  const darkTrimMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.6,
    metalness: 0.25,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.85,
  });
  const redBumperMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    roughness: 0.4,
    metalness: 0.2,
  });
  const brakeMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.3,
    roughness: 0.2,
  });

  // 1. Primary rear silver body + front blue cowl
  const rearHull = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.55, 2.35), silverMat);
  rearHull.position.set(-1.3, 1.25, 0);
  rearHull.castShadow = true;
  bus.add(rearHull);

  const frontHull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.55, 2.36), blueMat);
  frontHull.position.set(2.9, 1.25, 0);
  frontHull.castShadow = true;
  bus.add(frontHull);

  // 2. Upper window cabin + roof cap
  const cabinCore = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1.1, 2.26), darkTrimMat);
  cabinCore.position.set(0.2, 2.55, 0);
  cabinCore.castShadow = true;
  bus.add(cabinCore);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(8.7, 0.22, 2.32), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 }));
  roof.position.set(0.2, 3.18, 0);
  bus.add(roof);

  // 3. Side & Front Glass Windows
  const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.92, 2.31), glassMat);
  sideGlass.position.set(-0.2, 2.54, 0);
  bus.add(sideGlass);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.12, 2.08), glassMat);
  windshield.position.set(4.52, 2.48, 0);
  bus.add(windshield);

  // 4. Green LED Destination Display + 10.527 Front Bumper
  const ledTex = makeLabelTexture(
    256,
    96,
    '#052e16',
    (ctx, w, h) => {
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 42px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`LINHA ${lineCode}`, w / 2, h / 2);
    },
    maxAnisotropy
  );
  const ledPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.34),
    new THREE.MeshBasicMaterial({ map: ledTex })
  );
  ledPanel.rotation.y = Math.PI / 2;
  ledPanel.position.set(4.59, 2.86, 0);
  bus.add(ledPanel);

  const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 2.38), redBumperMat);
  bumper.position.set(4.46, 0.68, 0);
  bus.add(bumper);

  // Side livery diagonal red accent
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.45, 2.38), redBumperMat);
  stripe.position.set(1.15, 1.25, 0);
  stripe.rotation.z = 0.25;
  bus.add(stripe);

  // Headlights & Taillights
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 1.6,
  });
  for (const zOff of [-0.82, 0.82]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.24, 0.36), headMat);
    hl.position.set(4.53, 0.96, zOff);
    bus.add(hl);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.32, 0.28), brakeMat);
    tl.position.set(-4.11, 1.0, zOff);
    bus.add(tl);
  }

  // 5. Composite Wheels (tire + metallic rim)
  const wheels: THREE.Mesh[] = [];
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85, metalness: 0.1 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.8 });
  const wheelCoords: [number, number][] = [
    [-2.4, -1.14],
    [-2.4, 1.14],
    [2.7, -1.14],
    [2.7, 1.14],
  ];
  for (const [wx, wz] of wheelCoords) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 18), tireMat);
    wheel.rotation.x = Math.PI / 2;
    wheel.position.set(wx, 0.52, wz);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.36, 12), rimMat);
    wheel.add(rim);
    bus.add(wheel);
    wheels.push(wheel);
  }

  // Contact shadow grounding plane
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(10.2, 3.6),
    new THREE.MeshBasicMaterial({
      map: makeRadialShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.65,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.set(0.2, 0.02, 0);
  bus.add(shadowPlane);

  return { group: bus, wheels, brakeMat };
}

export function mountPovCutscene(
  container: HTMLElement,
  options: PovStageOptions
): () => void {
  // Software WebGL detection per Three.js skill directive
  const isSoftwareGl = (() => {
    const probe = document.createElement('canvas').getContext('webgl2');
    if (!probe) return true;
    const ext = probe.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
    const gpu = String(probe.getParameter(param));
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  })();

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const initW = Math.max(container.clientWidth, 320);
  const initH = Math.max(container.clientHeight, 200);
  renderer.setSize(initW, initH);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  container.appendChild(renderer.domElement);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmremGenerator.dispose();

  const camera = new THREE.PerspectiveCamera(62, initW / initH, 0.1, 120);

  // Warm key + cool hemisphere lighting rig
  const hemi = new THREE.HemisphereLight(0x9ec5ff, 0x1e293b, 1.05);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
  keyLight.position.set(5, 9, 6);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 35;
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.85);
  rimLight.position.set(-6, 4, -5);
  scene.add(rimLight);

  let updateSceneFn: (elapsed: number, dt: number) => void = () => {};

  if (options.mode === 'intro') {
    scene.background = new THREE.Color(0x0ea5e9);
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.018);

    // Bus interior shell (riveted metallic blue aesthetic + silver walkway floor)
    const floorMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.45, metalness: 0.3 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 14), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e3a6d, roughness: 0.35, metalness: 0.68 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.3, metalness: 0.72 });
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0x14233c, roughness: 0.5, metalness: 0.55 });

    const ceil = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.16, 12), ceilMat);
    ceil.position.set(0, 2.55, -2);
    scene.add(ceil);

    // Left lower wall below windows + window pillars
    const leftWallLow = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.05, 12), wallMat);
    leftWallLow.position.set(-1.55, 0.52, -2);
    scene.add(leftWallLow);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.55, 12), wallMat);
    rightWall.position.set(1.55, 1.28, -2);
    scene.add(rightWall);

    for (let z = -6.5; z <= 2.5; z += 2.25) {
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.22), trimMat);
      pillar.position.set(-1.55, 1.8, z);
      scene.add(pillar);
    }

    // Passing exterior buildings & "SEU PONTO" sign outside left windows
    const cityGroup = new THREE.Group();
    scene.add(cityGroup);
    const bColors = [0x1e3a8a, 0x334155, 0x0f766e, 0x475569];
    for (let i = 0; i < 12; i++) {
      const bh = 2.6 + (i % 4) * 0.9;
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, bh, 2.2),
        new THREE.MeshStandardMaterial({ color: bColors[i % bColors.length], roughness: 0.8 })
      );
      b.position.set(-6.5, bh / 2 - 0.5, -18 + i * 3.4);
      cityGroup.add(b);
    }

    const signPole = new THREE.Group();
    const sPost = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.4, 8), trimMat);
    sPost.position.y = 1.2;
    signPole.add(sPost);
    const stopSignTex = makeLabelTexture(
      256,
      128,
      '#facc15',
      (ctx, w, h) => {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 10;
        ctx.strokeRect(6, 6, w - 12, h - 12);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('SEU PONTO!', w / 2, h / 2);
      },
      maxAniso
    );
    const sBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.72, 1.4),
      new THREE.MeshStandardMaterial({ map: stopSignTex, roughness: 0.4 })
    );
    sBoard.position.y = 2.15;
    signPole.add(sBoard);
    signPole.position.set(-3.8, 0, -9);
    scene.add(signPole);

    // Bus seats
    const seatBlueMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.7 });
    const seatYellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.65 });
    for (let i = 0; i < 4; i++) {
      const seat = new THREE.Group();
      const mat = i === 0 ? seatYellowMat : seatBlueMat;
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.16, 0.65), mat);
      cushion.position.set(-0.95, 0.45, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.7, 0.14), mat);
      back.position.set(-0.95, 0.82, 0.28);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8), trimMat);
      leg.position.set(-0.95, 0.22, 0);
      seat.add(cushion, back, leg);
      seat.position.z = 0.6 - i * 1.45;
      scene.add(seat);
    }

    // Yellow Vertical Grab Pole + Red "PARAR" Stop Button Housing
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.28, metalness: 0.35 });
    const grabPole = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 2.55, 16), poleMat);
    grabPole.position.set(0.28, 1.27, -1.65);
    grabPole.castShadow = true;
    scene.add(grabPole);

    const boxGroup = new THREE.Group();
    boxGroup.position.set(0.28, 1.32, -1.65);
    const boxBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.28, 0.13),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.5 })
    );
    boxGroup.add(boxBody);

    const pararTex = makeLabelTexture(
      128,
      128,
      '#ef4444',
      (ctx, w, h) => {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PARAR', w / 2, h / 2);
      },
      maxAniso
    );
    const stopBtnMat = new THREE.MeshStandardMaterial({
      map: pararTex,
      emissive: 0x991b1b,
      emissiveIntensity: 0.4,
      roughness: 0.3,
    });
    const stopBtn = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.15, 0.06), stopBtnMat);
    stopBtn.position.set(0, 0.02, 0.075);
    boxGroup.add(stopBtn);
    scene.add(boxGroup);

    // Overhead "PARADA SOLICITADA" ceiling panel
    const ledOffTex = makeLabelTexture(
      512,
      128,
      '#27272a',
      (ctx, w, h) => {
        ctx.fillStyle = '#71717a';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PARADA SOLICITADA', w / 2, h / 2);
      },
      maxAniso
    );
    const ledOnTex = makeLabelTexture(
      512,
      128,
      '#dc2626',
      (ctx, w, h) => {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('PARADA SOLICITADA', w / 2, h / 2);
      },
      maxAniso
    );
    const overheadMat = new THREE.MeshStandardMaterial({
      map: ledOffTex,
      emissive: 0x000000,
      roughness: 0.25,
    });
    const overheadPanel = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.24, 0.14), overheadMat);
    overheadPanel.position.set(0.15, 2.22, -2.35);
    scene.add(overheadPanel);

    // POV Arm
    const povArm = buildPovArm();
    povArm.position.set(0.45, 0.85, 0.9);
    scene.add(povArm);

    camera.position.set(-0.75, 0.98, 0.85);
    _camCurrentLook.set(-1.8, 1.05, -0.9);
    camera.lookAt(_camCurrentLook);

    let bellPlayed = false;
    let doneSent = false;
    let lastPhase = '';

    updateSceneFn = (elapsed, dt) => {
      // Scroll city exterior smoothly
      cityGroup.position.z = ((elapsed * 9) % 3.4) - 1.7;
      signPole.position.z = -12 + elapsed * 7.2;

      if (elapsed < 1.35) {
        // Waking up slumped toward window
        const breathe = Math.sin(elapsed * 3.5) * 0.03;
        _camTargetPos.set(-0.75, 0.98 + breathe, 0.85);
        _camTargetLook.set(-1.9, 1.1 + breathe, -1.2);
        povArm.position.set(0.42, 0.55, 0.9);
        povArm.rotation.set(0.4, 0.2, 0);
        if (lastPhase !== 'sleep') {
          lastPhase = 'sleep';
          options.onPhaseText?.('Zzz... (Acordando no fundo do busão...)');
        }
      } else if (elapsed < 2.35) {
        // Snaps awake, spots "SEU PONTO!", leaps toward grab pole
        const t = Math.min(1, (elapsed - 1.35) / 0.85);
        _camTargetPos.set(
          THREE.MathUtils.lerp(-0.75, 0.05, t),
          THREE.MathUtils.lerp(0.98, 1.48, t) + Math.sin(t * Math.PI) * 0.12,
          THREE.MathUtils.lerp(0.85, -0.78, t)
        );
        _camTargetLook.set(0.28, 1.38, -1.75);
        povArm.position.set(0.32, 1.18, -0.95);
        povArm.rotation.set(-0.15, 0.12, 0);
        if (lastPhase !== 'wake') {
          lastPhase = 'wake';
          options.onPhaseText?.('PASSEI DO PONTO!! Aperte o botão!');
        }
      } else {
        // Slams the red PARAR button!
        const hitT = Math.min(1, (elapsed - 2.35) / 0.22);
        const recoil = elapsed > 2.65 ? Math.sin((elapsed - 2.65) * 28) * Math.exp(-(elapsed - 2.65) * 6) * 0.03 : 0;
        _camTargetPos.set(0.08 + recoil, 1.48 + recoil, -0.82);
        _camTargetLook.set(0.24, 1.56, -2.1);

        stopBtn.position.z = hitT < 1 ? 0.075 - hitT * 0.032 : 0.055;
        povArm.position.set(0.29, 1.34, THREE.MathUtils.lerp(-1.12, -1.42, hitT));
        povArm.rotation.set(0.05, 0.05, 0);

        if (!bellPlayed) {
          bellPlayed = true;
          audio.playStopBell();
          overheadMat.map = ledOnTex;
          overheadMat.emissive.setHex(0xef4444);
          overheadMat.emissiveIntensity = 0.85;
          overheadMat.needsUpdate = true;
          stopBtnMat.emissiveIntensity = 1.4;
          options.onPhaseText?.('DIIING!! PARADA SOLICITADA!');
        }
      }

      if (elapsed >= 4.5 && !doneSent) {
        doneSent = true;
        options.onComplete?.();
      }

      const k = 1 - Math.exp(-9 * dt);
      camera.position.lerp(_camTargetPos, k);
      _camCurrentLook.lerp(_camTargetLook, k);
      camera.lookAt(_camCurrentLook);
    };
  } else if (options.mode === 'mid_bus_stop') {
    const isNight = options.nextLineCode === '303';
    scene.background = new THREE.Color(isNight ? 0x0f172a : 0xf97316);
    scene.fog = new THREE.FogExp2(isNight ? 0x1e293b : 0xfdba74, 0.022);

    // Road + Sidewalk + Curb
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 14),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -4.5);
    road.receiveShadow = true;
    scene.add(road);

    for (let x = -20; x <= 20; x += 3.2) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.18),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 })
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.015, -4.2);
      scene.add(dash);
    }

    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(50, 0.22, 6),
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.8 })
    );
    sidewalk.position.set(0, 0.11, 2.5);
    sidewalk.receiveShadow = true;
    scene.add(sidewalk);

    // Distant skyline buildings
    for (let i = -5; i <= 5; i++) {
      const bh = 5 + ((i * 7 + 13) % 6);
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, bh, 3.2),
        new THREE.MeshStandardMaterial({
          color: isNight ? 0x172554 : 0x475569,
          roughness: 0.85,
        })
      );
      b.position.set(i * 4.4, bh / 2, -16);
      scene.add(b);
    }

    // Bus stop pole & yellow PONTO sign
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.7 });
    const stopPost = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 10), poleMat);
    stopPost.position.set(-1.35, 1.5, 0.35);
    scene.add(stopPost);

    const pontoTex = makeLabelTexture(
      256,
      128,
      '#facc15',
      (ctx, w, h) => {
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 8;
        ctx.strokeRect(5, 5, w - 10, h - 10);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`PONTO L.${options.nextLineCode ?? '202'}`, w / 2, h / 2);
      },
      maxAniso
    );
    const pontoBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.48, 0.08),
      new THREE.MeshStandardMaterial({ map: pontoTex, roughness: 0.4 })
    );
    pontoBoard.position.set(-1.35, 2.65, 0.35);
    scene.add(pontoBoard);

    // Composite Bus arriving!
    const { group: busGroup, wheels, brakeMat } = buildCompositeBus(
      options.nextLineCode ?? '202',
      maxAniso
    );
    busGroup.position.set(-16, 0, -2.5);
    scene.add(busGroup);

    // POV Hand waving ("dando sinal"!)
    const povArm = buildPovArm();
    scene.add(povArm);

    camera.position.set(0.2, 1.55, 1.45);
    _camCurrentLook.set(-1.2, 1.35, -2.4);
    camera.lookAt(_camCurrentLook);

    updateSceneFn = (elapsed, dt) => {
      const cycle = Math.min(1, (elapsed % 5.0) / 2.6);
      const eased = 1 - Math.pow(1 - cycle, 3);
      busGroup.position.x = -16 + eased * 15.2;

      if (cycle < 0.96) {
        for (const w of wheels) {
          w.rotation.y -= dt * 10 * (1 - cycle * 0.7);
        }
      }
      brakeMat.emissiveIntensity = cycle > 0.65 ? 2.1 : 0.3;

      // POV waving arm on bottom-right
      const wave = Math.sin(elapsed * 8.5) * 0.14;
      povArm.position.set(0.45, 1.18 + Math.sin(elapsed * 8.5) * 0.04, 0.62);
      povArm.rotation.set(0.45 + wave, -0.35, -0.35 + wave);

      _camTargetLook.set(THREE.MathUtils.clamp(busGroup.position.x * 0.38, -4.5, -0.4), 1.35, -2.5);
      _camCurrentLook.lerp(_camTargetLook, 1 - Math.exp(-6 * dt));
      camera.lookAt(_camCurrentLook);
    };
  } else {
    // final_office POV 3D: Walking into the office at 08:59 and tapping the tablet!
    scene.background = new THREE.Color(0xdbeafe);
    scene.fog = new THREE.FogExp2(0xe2e8f0, 0.025);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.15 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(12, 4.5, 0.2),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8 })
    );
    backWall.position.set(0, 2.25, -4.2);
    scene.add(backWall);

    // Wall Clock 08:59
    const clockTex = makeLabelTexture(
      256,
      128,
      '#020617',
      (ctx, w, h) => {
        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 64px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('08:59', w / 2, h / 2);
      },
      maxAniso
    );
    const clockBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.55, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.6 })
    );
    clockBox.position.set(-1.2, 2.55, -4.08);
    const clockFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.42),
      new THREE.MeshBasicMaterial({ map: clockTex })
    );
    clockFace.position.z = 0.055;
    clockBox.add(clockFace);
    scene.add(clockBox);

    // Desk + Monitor
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.65 });
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 1.1), woodMat);
    deskTop.position.set(-1.5, 0.85, -3.2);
    deskTop.castShadow = true;
    scene.add(deskTop);
    const monitor = new THREE.Mesh(
      new THREE.BoxGeometry(0.95, 0.58, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0284c7, emissiveIntensity: 0.45 })
    );
    monitor.position.set(-1.5, 1.25, -3.45);
    scene.add(monitor);

    // Pedestal Time-Clock Tablet
    const pedestalMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.75 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.08, 16), pedestalMat);
    base.position.set(0.35, 0.04, -1.85);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 1.18, 12), pedestalMat);
    col.position.set(0.35, 0.63, -1.85);
    scene.add(base, col);

    const tabWaitTex = makeLabelTexture(
      256,
      192,
      '#1d4ed8',
      (ctx, w, h) => {
        ctx.fillStyle = '#bae6fd';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('TOQUE PARA', w / 2, 74);
        ctx.fillText('BATER PONTO', w / 2, 124);
      },
      maxAniso
    );
    const tabOkTex = makeLabelTexture(
      256,
      192,
      '#059669',
      (ctx, w, h) => {
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 34px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PONTO BATIDO!', w / 2, 76);
        ctx.font = 'bold 44px monospace';
        ctx.fillText('08:59', w / 2, 134);
      },
      maxAniso
    );
    const tabFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.56, 0.06),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.6 })
    );
    tabFrame.position.set(0.35, 1.32, -1.85);
    tabFrame.rotation.x = -0.35;
    const screenMat = new THREE.MeshBasicMaterial({ map: tabWaitTex });
    const tabScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.46), screenMat);
    tabScreen.position.z = 0.035;
    tabFrame.add(tabScreen);
    scene.add(tabFrame);

    // 3D Confetti Particles
    const confettiGroup = new THREE.Group();
    const confettiColors = [0xfacc15, 0xef4444, 0x38bdf8, 0x34d399];
    const confettiBits: { mesh: THREE.Mesh; vx: number; vy: number; vz: number }[] = [];
    for (let i = 0; i < 24; i++) {
      const bit = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.015),
        new THREE.MeshBasicMaterial({ color: confettiColors[i % confettiColors.length] })
      );
      bit.position.set(0.35, 1.35, -1.8);
      bit.visible = false;
      confettiGroup.add(bit);
      const a = (i / 24) * Math.PI * 2;
      confettiBits.push({
        mesh: bit,
        vx: Math.cos(a) * (0.8 + (i % 3) * 0.35),
        vy: 1.2 + (i % 4) * 0.4,
        vz: Math.sin(a) * (0.8 + (i % 3) * 0.35),
      });
    }
    scene.add(confettiGroup);

    const povArm = buildPovArm();
    scene.add(povArm);

    camera.position.set(0.15, 1.52, 0.6);
    _camCurrentLook.set(0.35, 1.32, -1.85);
    camera.lookAt(_camCurrentLook);

    let punched = false;

    updateSceneFn = (elapsed, dt) => {
      const approach = Math.min(1, elapsed / 1.35);
      _camTargetPos.set(0.28, 1.54, THREE.MathUtils.lerp(0.6, -0.78, approach));
      _camTargetLook.set(0.35, 1.32, -1.85);

      const tapCycle = elapsed - 1.35;
      if (tapCycle < 0) {
        povArm.position.set(0.45, 1.15, THREE.MathUtils.lerp(0.1, -1.1, approach));
        povArm.rotation.set(0.1, -0.1, 0);
      } else {
        const thrust = Math.min(1, tapCycle / 0.25);
        povArm.position.set(0.38, 1.28, THREE.MathUtils.lerp(-1.1, -1.56, thrust));
        povArm.rotation.set(-0.08, 0, 0);
        if (!punched && thrust >= 0.85) {
          punched = true;
          screenMat.map = tabOkTex;
          screenMat.needsUpdate = true;
          for (const b of confettiBits) b.mesh.visible = true;
        }
      }

      if (punched) {
        for (const b of confettiBits) {
          b.mesh.position.x += b.vx * dt;
          b.mesh.position.y += b.vy * dt;
          b.mesh.position.z += b.vz * dt;
          b.vy -= 2.8 * dt;
          b.mesh.rotation.x += 5 * dt;
          b.mesh.rotation.y += 4 * dt;
        }
      }

      const k = 1 - Math.exp(-7 * dt);
      camera.position.lerp(_camTargetPos, k);
      _camCurrentLook.lerp(_camTargetLook, k);
      camera.lookAt(_camCurrentLook);
    };
  }

  if (!isSoftwareGl) {
    renderer.compile(scene, camera);
  }

  // Resize observer
  const ro = new ResizeObserver(() => {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  ro.observe(container);

  let frameId = 0;
  let disposed = false;
  const startTime = performance.now();
  let lastFrame = startTime;

  function afterDraw(cb: () => void) {
    const gl = renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  }

  function tick() {
    if (disposed) return;
    const now = performance.now();
    const elapsed = (now - startTime) / 1000;
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;

    updateSceneFn(elapsed, dt);
    renderer.render(scene, camera);

    if (isSoftwareGl) {
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }
  }

  tick();

  return () => {
    disposed = true;
    cancelAnimationFrame(frameId);
    clearTimeout(frameId);
    ro.disconnect();

    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const m of mats) {
          for (const val of Object.values(m)) {
            if (val && typeof val === 'object' && 'dispose' in val && typeof val.dispose === 'function') {
              (val as { dispose: () => void }).dispose();
            }
          }
          m.dispose();
        }
      }
    });
    envTex.dispose();
    renderer.dispose();
    if (renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  };
}
