import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;

// Deterministic 3D value noise on unit sphere (zero seam at ±180° and poles)
function hash3(ix: number, iy: number, iz: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7 + iz * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function noise3D(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);

  const fx = smoothstep(x - ix);
  const fy = smoothstep(y - iy);
  const fz = smoothstep(z - iz);

  const c000 = hash3(ix, iy, iz);
  const c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz);
  const c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1);
  const c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1);
  const c111 = hash3(ix + 1, iy + 1, iz + 1);

  const x00 = lerp(c000, c100, fx);
  const x10 = lerp(c010, c110, fx);
  const x01 = lerp(c001, c101, fx);
  const x11 = lerp(c011, c111, fx);

  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

export function fbm3D(x: number, y: number, z: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    value += amp * noise3D(x * freq, y * freq, z * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.05;
  }
  return value / norm;
}

export function ridgedFbm3D(x: number, y: number, z: number, octaves = 4): number {
  let value = 0;
  let amp = 0.55;
  let freq = 1.0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = noise3D(x * freq, y * freq, z * freq);
    const ridge = 1.0 - Math.abs(n * 2.0 - 1.0);
    value += amp * (ridge * ridge);
    norm += amp;
    amp *= 0.5;
    freq *= 2.12;
  }
  return value / norm;
}

/**
 * Deterministic topographic height at (lat, lng) in [0, 0.014]
 * Used identically across fill interior vertices, skirt tops, and border lines for 100% watertight seams.
 */
export function sampleTopographicHeight(lat: number, lng: number): number {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lng + 180) * DEG2RAD;
  const sinPhi = Math.sin(phi);
  const sx = -sinPhi * Math.cos(theta);
  const sy = Math.cos(phi);
  const sz = sinPhi * Math.sin(theta);

  const continentBasin = fbm3D(sx * 2.4 + 3.1, sy * 2.4 - 1.7, sz * 2.4 + 0.8, 3);
  const ridges = ridgedFbm3D(sx * 5.8 - 2.3, sy * 5.8 + 4.1, sz * 5.8 - 0.9, 4);
  const combined = continentBasin * 0.42 + Math.pow(ridges, 1.35) * 0.58;
  return Math.max(0, (combined - 0.24) * 0.017);
}

export interface MoebiusTextureBundle {
  oceanColorMap: THREE.CanvasTexture;
  oceanBumpMap: THREE.CanvasTexture;
  oceanRoughnessMap: THREE.CanvasTexture;
  landColorMap: THREE.CanvasTexture;
  landBumpMap: THREE.CanvasTexture;
  landRoughnessMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
  skyMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createMoebiusTextures(maxAnisotropy: number): MoebiusTextureBundle {
  const width = 1024;
  const height = 512;

  // 1. Ocean Albedo + Bump + Roughness (spherical seamless bathymetry + ink contour lines)
  const oceanColorCanvas = document.createElement('canvas');
  oceanColorCanvas.width = width;
  oceanColorCanvas.height = height;
  const ocCtx = oceanColorCanvas.getContext('2d')!;
  const ocImg = ocCtx.createImageData(width, height);

  const oceanBumpCanvas = document.createElement('canvas');
  oceanBumpCanvas.width = width;
  oceanBumpCanvas.height = height;
  const obCtx = oceanBumpCanvas.getContext('2d')!;
  const obImg = obCtx.createImageData(width, height);

  const oceanRoughCanvas = document.createElement('canvas');
  oceanRoughCanvas.width = width;
  oceanRoughCanvas.height = height;
  const orCtx = oceanRoughCanvas.getContext('2d')!;
  const orImg = orCtx.createImageData(width, height);

  // 2. Land Albedo (neutral warm parchment strata) + Bump + Roughness
  const landColorCanvas = document.createElement('canvas');
  landColorCanvas.width = width;
  landColorCanvas.height = height;
  const lcCtx = landColorCanvas.getContext('2d')!;
  const lcImg = lcCtx.createImageData(width, height);

  const landBumpCanvas = document.createElement('canvas');
  landBumpCanvas.width = width;
  landBumpCanvas.height = height;
  const lbCtx = landBumpCanvas.getContext('2d')!;
  const lbImg = lbCtx.createImageData(width, height);

  const landRoughCanvas = document.createElement('canvas');
  landRoughCanvas.width = width;
  landRoughCanvas.height = height;
  const lrCtx = landRoughCanvas.getContext('2d')!;
  const lrImg = lrCtx.createImageData(width, height);

  // 3. Cloud Veil (stylized curled Moëbius cloud ribbons)
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = width;
  cloudCanvas.height = height;
  const clCtx = cloudCanvas.getContext('2d')!;
  const clImg = clCtx.createImageData(width, height);

  const oceanDepthGrid = new Float32Array(width * height);
  const landHeightGrid = new Float32Array(width * height);

  for (let y = 0; y < height; y++) {
    const v = 1 - (y + 0.5) / height; // 1 at North Pole, 0 at South Pole
    const phi = (1 - v) * Math.PI;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);

    for (let x = 0; x < width; x++) {
      const u = (x + 0.5) / width;
      const theta = u * Math.PI * 2;
      const sx = -sinPhi * Math.cos(theta);
      const sy = cosPhi;
      const sz = sinPhi * Math.sin(theta);

      const idx = y * width + x;

      // Spherical noise for ocean currents & bathymetry
      const oceanMacro = fbm3D(sx * 3.2 + 1.4, sy * 3.2 - 0.9, sz * 3.2 + 2.1, 4);
      const oceanCurrents = fbm3D(
        sx * 8.5 + oceanMacro * 1.8,
        sy * 8.5 - 1.2,
        sz * 8.5 + oceanMacro * 1.4,
        3
      );
      const waveRipples = Math.sin((sx * 24 + sz * 24 + oceanCurrents * 5.2) * Math.PI) * 0.5 + 0.5;
      const depthVal = oceanMacro * 0.68 + oceanCurrents * 0.25 + waveRipples * 0.07;
      oceanDepthGrid[idx] = depthVal;

      // Spherical noise for continental relief & plateau strata
      const landMacro = fbm3D(sx * 2.4 + 3.1, sy * 2.4 - 1.7, sz * 2.4 + 0.8, 3);
      const landRidges = ridgedFbm3D(sx * 5.8 - 2.3, sy * 5.8 + 4.1, sz * 5.8 - 0.9, 4);
      const landMicro = noise3D(sx * 34.0, sy * 34.0, sz * 34.0);
      const topoVal = landMacro * 0.42 + Math.pow(landRidges, 1.3) * 0.52 + landMicro * 0.06;
      landHeightGrid[idx] = topoVal;

      // Cloud wisps (domain-warped curled ribbons)
      const warpX = fbm3D(sx * 2.6 + 5.0, sy * 2.6, sz * 2.6 - 2.0, 2);
      const warpZ = fbm3D(sx * 2.6 - 3.0, sy * 2.6 + 2.0, sz * 2.6 + 4.0, 2);
      const cloudNoise = fbm3D(
        sx * 4.2 + warpX * 1.75,
        sy * 5.5 + warpZ * 0.8,
        sz * 4.2 - warpX * 1.35,
        3
      );
      const p4 = idx * 4;
      if (cloudNoise > 0.55) {
        const band = Math.min(1, (cloudNoise - 0.55) / 0.24);
        // Quantized cel edge on cloud wisps
        const cel = band > 0.22 ? 0.45 + 0.55 * Math.min(1, (band - 0.22) * 2.2) : band * 1.4;
        // Thin dark-celadon ink outline at outer cloud edge
        const isEdge = band < 0.16;
        clImg.data[p4] = isEdge ? 42 : 246;
        clImg.data[p4 + 1] = isEdge ? 82 : 242;
        clImg.data[p4 + 2] = isEdge ? 120 : 230;
        clImg.data[p4 + 3] = Math.round((isEdge ? 70 : cel * 128));
      } else {
        clImg.data[p4 + 3] = 0;
      }
    }
  }

  // Second pass: compute contour lines (isobaths & topo contours) + ink cross-hatching
  for (let y = 0; y < height; y++) {
    const yPrev = Math.max(0, y - 1);
    const yNext = Math.min(height - 1, y + 1);
    for (let x = 0; x < width; x++) {
      const xPrev = (x - 1 + width) % width;
      const xNext = (x + 1) % width;
      const idx = y * width + x;
      const p4 = idx * 4;

      // --- OCEAN ---
      const od = oceanDepthGrid[idx];
      const odStep = Math.floor(od * 7.0);
      const odEdge =
        Math.floor(oceanDepthGrid[y * width + xNext] * 7.0) !== odStep ||
        Math.floor(oceanDepthGrid[yNext * width + x] * 7.0) !== odStep;

      // Subtle paper grain + diagonal Moëbius ink hatching in deep trenches
      const grain = ((Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 + 1) % 1;
      const diagHatch = (x + y) % 5 === 0 ? 1 : 0;
      const crossHatch = (x - y + 1024) % 7 === 0 ? 1 : 0;

      // Stepped Moëbius ocean palette: abyssal Prussian -> ceruleum -> turquoise -> celadon foam
      let rO = 16;
      let gO = 44;
      let bO = 86;
      if (od < 0.38) {
        rO = 13;
        gO = 36;
        bO = 76;
        if (diagHatch) {
          rO -= 4;
          gO -= 8;
          bO -= 12;
        }
      } else if (od < 0.5) {
        rO = 20;
        gO = 65;
        bO = 118;
      } else if (od < 0.62) {
        rO = 34;
        gO = 98;
        bO = 148;
      } else if (od < 0.72) {
        rO = 64;
        gO = 142;
        bO = 164;
      } else {
        rO = 122;
        gO = 186;
        bO = 184;
      }

      if (odEdge) {
        // Crisp dark-ink bathymetric contour line
        rO = Math.max(8, Math.round(rO * 0.58));
        gO = Math.max(20, Math.round(gO * 0.62));
        bO = Math.max(42, Math.round(bO * 0.7));
      } else {
        const gShift = (grain - 0.5) * 8;
        rO = Math.min(255, Math.max(0, Math.round(rO + gShift)));
        gO = Math.min(255, Math.max(0, Math.round(gO + gShift)));
        bO = Math.min(255, Math.max(0, Math.round(bO + gShift)));
      }

      ocImg.data[p4] = rO;
      ocImg.data[p4 + 1] = gO;
      ocImg.data[p4 + 2] = bO;
      ocImg.data[p4 + 3] = 255;

      const oBump = Math.min(
        255,
        Math.max(0, Math.round(od * 210 + (odEdge ? -32 : 0) + (diagHatch && od < 0.42 ? -18 : 0)))
      );
      obImg.data[p4] = oBump;
      obImg.data[p4 + 1] = oBump;
      obImg.data[p4 + 2] = oBump;
      obImg.data[p4 + 3] = 255;

      const oRough = Math.min(255, Math.max(45, Math.round(165 - od * 110 + (odEdge ? 40 : 0))));
      orImg.data[p4] = oRough;
      orImg.data[p4 + 1] = oRough;
      orImg.data[p4 + 2] = oRough;
      orImg.data[p4 + 3] = 255;

      // --- LAND (multiplied cleanly with per-country MeshStandardMaterial.color) ---
      const lh = landHeightGrid[idx];
      const lhStep = Math.floor(lh * 8.5);
      const lhEdge =
        Math.floor(landHeightGrid[y * width + xNext] * 8.5) !== lhStep ||
        Math.floor(landHeightGrid[yNext * width + x] * 8.5) !== lhStep;

      // Keep land albedo bright-neutral (0.76 - 1.0) so material.color remains vibrant and legible
      let tone = 0.84 + Math.min(0.16, lh * 0.22) + (grain - 0.5) * 0.05;
      if (lh < 0.38 && diagHatch) {
        tone -= 0.05;
      }
      if (lh < 0.3 && crossHatch) {
        tone -= 0.04;
      }
      if (lhEdge) {
        // Fine ink topographic contour line
        tone *= 0.72;
      }
      const rL = Math.min(255, Math.max(115, Math.round(tone * 252)));
      const gL = Math.min(255, Math.max(112, Math.round(tone * 248)));
      const bL = Math.min(255, Math.max(105, Math.round(tone * 238)));

      lcImg.data[p4] = rL;
      lcImg.data[p4 + 1] = gL;
      lcImg.data[p4 + 2] = bL;
      lcImg.data[p4 + 3] = 255;

      // Sharp slope contrast in land bump map for crisp mountain/mesa lighting
      const gradX = landHeightGrid[y * width + xNext] - landHeightGrid[y * width + xPrev];
      const gradY = landHeightGrid[yNext * width + x] - landHeightGrid[yPrev * width + x];
      const ridgeMicro = Math.abs(gradX) + Math.abs(gradY);
      const lBump = Math.min(
        255,
        Math.max(
          0,
          Math.round(lh * 215 + ridgeMicro * 140 + (lhEdge ? -26 : 0) + (diagHatch ? -10 : 0))
        )
      );
      lbImg.data[p4] = lBump;
      lbImg.data[p4 + 1] = lBump;
      lbImg.data[p4 + 2] = lBump;
      lbImg.data[p4 + 3] = 255;

      // Matte gouache paper roughness (high on plateaus, slightly smoother in highland ridges)
      const lRough = Math.min(255, Math.max(150, Math.round(232 - lh * 55 + (lhEdge ? 18 : 0))));
      lrImg.data[p4] = lRough;
      lrImg.data[p4 + 1] = lRough;
      lrImg.data[p4 + 2] = lRough;
      lrImg.data[p4 + 3] = 255;
    }
  }

  ocCtx.putImageData(ocImg, 0, 0);
  obCtx.putImageData(obImg, 0, 0);
  orCtx.putImageData(orImg, 0, 0);
  lcCtx.putImageData(lcImg, 0, 0);
  lbCtx.putImageData(lbImg, 0, 0);
  lrCtx.putImageData(lrImg, 0, 0);
  clCtx.putImageData(clImg, 0, 0);

  // 4. Moëbius Cosmic Twilight Sky Dome Texture (deep indigo -> ultramarine -> ink-stippled stars & subtle arcs)
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 1024;
  skyCanvas.height = 512;
  const sCtx = skyCanvas.getContext('2d')!;
  const grad = sCtx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0.0, '#040920');
  grad.addColorStop(0.32, '#0A1A42');
  grad.addColorStop(0.55, '#133463');
  grad.addColorStop(0.78, '#0D2148');
  grad.addColorStop(1.0, '#040920');
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, 1024, 512);

  // Subtle Moëbius watercolor dust bands & technical celestial arcs
  sCtx.strokeStyle = 'rgba(158, 202, 194, 0.08)';
  sCtx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    sCtx.beginPath();
    sCtx.ellipse(512, 256, 320 + i * 55, 85 + i * 28, (i * 0.22) - 0.3, 0, Math.PI * 2);
    sCtx.stroke();
  }
  // Fine ink-stippled stars in background
  for (let i = 0; i < 420; i++) {
    const sx = (((Math.sin(i * 45.123) * 19341.7) % 1 + 1) % 1) * 1024;
    const sy = (((Math.sin(i * 91.571) * 43758.5) % 1 + 1) % 1) * 512;
    const r = i % 11 === 0 ? 1.5 : 0.85;
    sCtx.fillStyle = i % 5 === 0 ? 'rgba(242, 229, 198, 0.72)' : 'rgba(158, 202, 194, 0.45)';
    sCtx.beginPath();
    sCtx.arc(sx, sy, r, 0, Math.PI * 2);
    sCtx.fill();
  }

  const configureTexture = (
    canvas: HTMLCanvasElement,
    isColor: boolean,
    wrapRepeat = true
  ): THREE.CanvasTexture => {
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    tex.wrapS = wrapRepeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  };

  const oceanColorMap = configureTexture(oceanColorCanvas, true);
  const oceanBumpMap = configureTexture(oceanBumpCanvas, false);
  const oceanRoughnessMap = configureTexture(oceanRoughCanvas, false);
  const landColorMap = configureTexture(landColorCanvas, true);
  const landBumpMap = configureTexture(landBumpCanvas, false);
  const landRoughnessMap = configureTexture(landRoughCanvas, false);
  const cloudMap = configureTexture(cloudCanvas, true);
  const skyMap = configureTexture(skyCanvas, true);

  return {
    oceanColorMap,
    oceanBumpMap,
    oceanRoughnessMap,
    landColorMap,
    landBumpMap,
    landRoughnessMap,
    cloudMap,
    skyMap,
    dispose: () => {
      oceanColorMap.dispose();
      oceanBumpMap.dispose();
      oceanRoughnessMap.dispose();
      landColorMap.dispose();
      landBumpMap.dispose();
      landRoughnessMap.dispose();
      cloudMap.dispose();
      skyMap.dispose();
    },
  };
}
