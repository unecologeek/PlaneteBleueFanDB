import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  ChevronDown,
  ChevronUp,
  Cloud,
  Compass,
  ExternalLink,
  Loader2,
  Network,
  Pause,
  Play,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import {
  buildAllCountryGeometries,
  buildAstrolabeRingGeometry,
  buildGraticuleGeometry,
  buildGreatCircleNetworkTubeGeometry,
  latLngToVec3,
} from '../three/globeGeometry';
import { createMoebiusTextures, sampleTopographicHeight } from '../three/moebiusTextures';
import { formatDuration, formatNumberFR } from '../types';
import type { GlobeArc, GlobeCountryBucket, GlobeResponse } from '../types';

interface GlobeViewProps {
  years: Array<{ year: number; count: number }>;
  onSelectEmission: (slug: string) => void;
  onInspectCountryInTable: (countryName: string, query: string) => void;
}

interface CountryMeshEntry {
  isoId: string;
  englishName: string;
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  border: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  currentElev: number;
  targetElev: number;
  currentColor: THREE.Color;
  targetColor: THREE.Color;
  currentEmissive: THREE.Color;
  targetEmissive: THREE.Color;
  targetEmissiveIntensity: number;
  currentEmissiveIntensity: number;
  targetBorderColor: THREE.Color;
  currentBorderColor: THREE.Color;
  targetBorderOpacity: number;
  currentBorderOpacity: number;
}

interface ProjectedLabelSlot {
  isoId: string;
  nameFr: string;
  trackCount: number;
  lat: number;
  lng: number;
  isSelected: boolean;
  isTop: boolean;
}

const DEFAULT_CAM_POS = new THREE.Vector3(0.45, 1.32, 2.78);
const COLOR_BG = new THREE.Color('#071230');

// Moëbius Ligne Claire Mineral & Gouache Palette (High contrast against ocean & dark slate)
const COLOR_UNMATCHED = new THREE.Color('#474F63'); // Recessive cool slate-limestone
const COLOR_UNMATCHED_DIM = new THREE.Color('#252E42'); // Deep slate under active search
const COLOR_LOW_MATCH = new THREE.Color('#6ED6C3'); // Luminous celadon-mint (1+ tracks)
const COLOR_MID_MATCH = new THREE.Color('#A8DF9D'); // Sage-mineral glow
const COLOR_HIGH_MATCH = new THREE.Color('#F2C665'); // Sunlit Arzach saffron ochre
const COLOR_PEAK_MATCH = new THREE.Color('#EA6D4E'); // Terracotta vermilion
const COLOR_SELECTED = new THREE.Color('#FAF3DF'); // Luminous cream paper

const COLOR_EMISSIVE_NONE = new THREE.Color('#000000');
const COLOR_EMISSIVE_MATCH = new THREE.Color('#2A7A7B');
const COLOR_EMISSIVE_ACTIVE = new THREE.Color('#E8BD6C');

const COLOR_BORDER_BASE = new THREE.Color('#161E34');
const COLOR_BORDER_MATCH = new THREE.Color('#0B1122');
const COLOR_BORDER_SELECTED = new THREE.Color('#FAF8F5');

// Reusable scratch math objects (module-level, zero GC inside RAF loop)
const _tmpVecA = new THREE.Vector3();
const _tmpVecB = new THREE.Vector3();
const _tmpCamDir = new THREE.Vector3();
const _tmpNdc = new THREE.Vector3();
const _tmpColor = new THREE.Color();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _tmpNormalDir = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();

interface LabelBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const _placedBoxes: LabelBox[] = [];

function detectSoftwareGl(): boolean {
  try {
    const testCanvas = document.createElement('canvas');
    const gl = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl');
    if (!gl) return true;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '') : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
  } catch {
    return false;
  }
}

function computeTargetElevation(trackCount: number, maxCount: number, isSelected: boolean, isHovered: boolean): number {
  const logMax = Math.log1p(Math.max(1, maxCount));
  const raw = logMax > 0 ? Math.log1p(trackCount) / logMax : 0.4;
  const t = Math.pow(raw, 0.68);
  let elev = 0.024 + t * 0.064;
  if (isSelected) elev += 0.026;
  else if (isHovered) elev += 0.015;
  return elev;
}

function applyMoebiusInkShader(
  material: THREE.MeshStandardMaterial,
  cacheKey: string,
  hatchStrength: number,
  inkRimStrength: number
) {
  material.customProgramCacheKey = () => cacheKey;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uHatchStrength = { value: hatchStrength };
    shader.uniforms.uInkRimStrength = { value: inkRimStrength };

    shader.vertexShader =
      `varying vec3 vMoebiusViewNormal;\nvarying vec3 vMoebiusViewPos;\n` +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vMoebiusViewNormal = normalize( normalMatrix * normal );
        vec4 mMvPos = modelViewMatrix * vec4( transformed, 1.0 );
        vMoebiusViewPos = -mMvPos.xyz;`
      );

    shader.fragmentShader =
      `varying vec3 vMoebiusViewNormal;\nvarying vec3 vMoebiusViewPos;\nuniform float uHatchStrength;\nuniform float uInkRimStrength;\n` +
      shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `vec3 mViewDir = normalize( vMoebiusViewPos );
        vec3 mNorm = normalize( vMoebiusViewNormal );
        float mNdotV = clamp( abs( dot( mNorm, mViewDir ) ), 0.0, 1.0 );
        float mLuma = dot( gl_FragColor.rgb, vec3( 0.299, 0.587, 0.114 ) );

        // Soft Moëbius gouache plane quantization
        float mQuantLuma = floor( mLuma * 5.0 + 0.35 ) / 5.0;
        float mTargetScale = mix( 1.0, ( mQuantLuma + 0.06 ) / max( mLuma, 0.04 ), 0.30 );
        gl_FragColor.rgb *= clamp( mTargetScale, 0.74, 1.22 );

        // Pen-and-ink cross-hatching inside shadowed terminator
        float mShadowMask = 1.0 - smoothstep( 0.08, 0.30, mLuma );
        float mDiagA = sin( ( gl_FragCoord.x + gl_FragCoord.y ) * 0.90 );
        float mDiagB = sin( ( gl_FragCoord.x - gl_FragCoord.y ) * 0.90 );
        float mLineA = smoothstep( 0.74, 0.92, mDiagA );
        float mLineB = smoothstep( 0.78, 0.95, mDiagB ) * ( 1.0 - smoothstep( 0.04, 0.15, mLuma ) );
        float mHatch = clamp( mLineA * 0.65 + mLineB * 0.55, 0.0, 1.0 ) * mShadowMask * uHatchStrength;
        vec3 mInkColor = vec3( 0.055, 0.075, 0.165 );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, mInkColor, mHatch * 0.65 );

        // Ligne claire horizon silhouette ink rim
        float mRim = 1.0 - smoothstep( 0.10, 0.24, mNdotV );
        gl_FragColor.rgb = mix( gl_FragColor.rgb, mInkColor, mRim * uInkRimStrength );

        #include <dithering_fragment>`
      );
  };
}

function disposeObjectSubtree(root: THREE.Object3D, sharedGeos?: Set<THREE.BufferGeometry>) {
  root.traverse((obj) => {
    if ('geometry' in obj && obj.geometry instanceof THREE.BufferGeometry) {
      if (!sharedGeos || !sharedGeos.has(obj.geometry)) {
        obj.geometry.dispose();
      }
    }
    if ('material' in obj && obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (m && typeof m.dispose === 'function') m.dispose();
      }
    }
  });
}

export function GlobeView({
  years,
  onSelectEmission,
  onInspectCountryInTable,
}: GlobeViewProps) {
  // Filter state
  const [q, setQ] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [multiOnly, setMultiOnly] = useState(false);

  // Globe visualization controls
  const [showNetwork, setShowNetwork] = useState(true);
  const [showClouds, setShowClouds] = useState(true);
  const [autoRotate, setAutoRotate] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);

  // API Data
  const [globeData, setGlobeData] = useState<GlobeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive selection & hover
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{
    isoId: string;
    nameFr: string;
    x: number;
    y: number;
    trackCount: number;
    playCount: number;
    topAuthors: string[];
  } | null>(null);
  const [hoveredNetworkInfo, setHoveredNetworkInfo] = useState<{
    fromName: string;
    toName: string;
    weight: number;
    emissions: Array<{ number: number | null; slug: string }>;
    x: number;
    y: number;
  } | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Audio preview inside country inspection panel
  const [playingPreviewTrackId, setPlayingPreviewTrackId] = useState<number | null>(null);
  const [loadingPreviewTrackId, setLoadingPreviewTrackId] = useState<number | null>(null);
  const [unavailablePreviewTrackId, setUnavailablePreviewTrackId] = useState<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // Refs for Three.js imperative engine
  const mountRef = useRef<HTMLDivElement | null>(null);
  const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const requestSeqRef = useRef(0);

  // Mutable shared refs read by the RAF loop
  const globeDataRef = useRef<GlobeResponse | null>(null);
  const bucketByIsoRef = useRef<Map<string, GlobeCountryBucket>>(new Map());
  const catalogByIsoRef = useRef<Map<string, { isoId: string; nameFr: string; lat: number; lng: number }>>(
    new Map()
  );
  const selectedIsoRef = useRef<string | null>(null);
  const hoveredIsoRef = useRef<string | null>(null);
  const showNetworkRef = useRef<boolean>(true);
  const showCloudsRef = useRef<boolean>(true);
  const autoRotateRef = useRef<boolean>(true);
  const hasSearchFilterRef = useRef<boolean>(false);
  const onSelectEmissionRef = useRef(onSelectEmission);
  onSelectEmissionRef.current = onSelectEmission;

  // Camera fly-to target (cancelled immediately on OrbitControls 'start')
  const flyTargetCamPosRef = useRef<THREE.Vector3 | null>(null);
  const requestRenderRef = useRef<(() => void) | null>(null);
  const rebuildNetworkRef = useRef<
    ((countries: GlobeCountryBucket[], arcs: GlobeArc[], activeIso: string | null) => void) | null
  >(null);
  const syncVisualTargetsRef = useRef<(() => void) | null>(null);
  const cloudMeshRef = useRef<THREE.Mesh | null>(null);
  const labelsDataRef = useRef<ProjectedLabelSlot[]>([]);

  // Fetch /api/globe whenever filters change
  useEffect(() => {
    const seq = ++requestSeqRef.current;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (yearFilter) params.set('year', yearFilter);
        if (multiOnly) params.set('multiOnly', 'true');

        const res = await fetch(`/api/globe?${params.toString()}`);
        if (!res.ok) throw new Error('Erreur lors du chargement des données géographiques.');
        const data = (await res.json()) as GlobeResponse;
        if (seq !== requestSeqRef.current) return;

        setGlobeData(data);
        globeDataRef.current = data;

        const bMap = new Map<string, GlobeCountryBucket>();
        for (const c of data.countries) bMap.set(c.isoId, c);
        bucketByIsoRef.current = bMap;

        const catMap = new Map<string, { isoId: string; nameFr: string; lat: number; lng: number }>();
        for (const item of data.catalog) catMap.set(item.isoId, item);
        catalogByIsoRef.current = catMap;

        hasSearchFilterRef.current = Boolean(q.trim() || yearFilter || multiOnly);

        if (selectedIsoRef.current && !catMap.has(selectedIsoRef.current)) {
          setSelectedIso(null);
          selectedIsoRef.current = null;
        }

        syncVisualTargetsRef.current?.();
        rebuildNetworkRef.current?.(data.countries, data.arcs, selectedIsoRef.current);
        requestRenderRef.current?.();
      } catch (err) {
        if (seq === requestSeqRef.current) {
          setError((err as Error).message);
        }
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [q, yearFilter, multiOnly]);

  // Compute floating label candidates (up to 48 prioritized slots, decluttered dynamically in 2D)
  const projectedLabelSlots = useMemo<ProjectedLabelSlot[]>(() => {
    if (!globeData) return [];
    const candidates = globeData.countries.slice(0, 48).map((c, idx) => ({
      isoId: c.isoId,
      nameFr: c.nameFr,
      trackCount: c.trackCount,
      lat: c.lat,
      lng: c.lng,
      isSelected: c.isoId === selectedIso,
      isTop: idx < 8,
    }));

    if (selectedIso && !candidates.some((s) => s.isoId === selectedIso)) {
      const cat = globeData.catalog.find((c) => c.isoId === selectedIso);
      const bucket = globeData.countries.find((c) => c.isoId === selectedIso);
      if (cat || bucket) {
        candidates.unshift({
          isoId: selectedIso,
          nameFr: bucket?.nameFr || cat?.nameFr || selectedIso,
          trackCount: bucket?.trackCount || 0,
          lat: bucket?.lat ?? cat?.lat ?? 0,
          lng: bucket?.lng ?? cat?.lng ?? 0,
          isSelected: true,
          isTop: true,
        });
      }
    }

    // Selected country always prioritized first for declutter placement
    candidates.sort((a, b) => Number(b.isSelected) - Number(a.isSelected) || b.trackCount - a.trackCount);
    return candidates;
  }, [globeData, selectedIso]);

  useEffect(() => {
    labelsDataRef.current = projectedLabelSlots;
    requestRenderRef.current?.();
  }, [projectedLabelSlots]);

  useEffect(() => {
    selectedIsoRef.current = selectedIso;
    syncVisualTargetsRef.current?.();
    if (globeDataRef.current) {
      rebuildNetworkRef.current?.(
        globeDataRef.current.countries,
        globeDataRef.current.arcs,
        selectedIso
      );
    }
    requestRenderRef.current?.();
  }, [selectedIso]);

  useEffect(() => {
    showNetworkRef.current = showNetwork;
    if (globeDataRef.current) {
      rebuildNetworkRef.current?.(
        globeDataRef.current.countries,
        globeDataRef.current.arcs,
        selectedIsoRef.current
      );
    }
    requestRenderRef.current?.();
  }, [showNetwork]);

  useEffect(() => {
    showCloudsRef.current = showClouds;
    if (cloudMeshRef.current) {
      cloudMeshRef.current.visible = showClouds;
    }
    requestRenderRef.current?.();
  }, [showClouds]);

  useEffect(() => {
    autoRotateRef.current = autoRotate;
    requestRenderRef.current?.();
  }, [autoRotate]);

  // Keyboard shortcut: 'H' toggles bottom dock, 'Escape' closes selected country
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA');
      if (e.key === 'Escape') {
        if (selectedIsoRef.current) {
          setSelectedIso(null);
        }
        return;
      }
      if (!isInput && (e.key === 'h' || e.key === 'H')) {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    return () => {
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
    };
  }, []);

  const togglePreview = useCallback(
    (trackId: number) => {
      if ((playingPreviewTrackId === trackId || loadingPreviewTrackId === trackId) && previewAudioRef.current) {
        previewAudioRef.current.pause();
        setPlayingPreviewTrackId(null);
        setLoadingPreviewTrackId(null);
        return;
      }
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      setUnavailablePreviewTrackId(null);
      setLoadingPreviewTrackId(trackId);
      setPlayingPreviewTrackId(null);

      const audio = new Audio(`/api/tracks/${trackId}/preview`);
      audio.onplaying = () => {
        setLoadingPreviewTrackId(null);
        setPlayingPreviewTrackId(trackId);
      };
      audio.onended = () => {
        setLoadingPreviewTrackId(null);
        setPlayingPreviewTrackId(null);
      };
      audio.onerror = () => {
        setLoadingPreviewTrackId(null);
        setPlayingPreviewTrackId(null);
        setUnavailablePreviewTrackId(trackId);
      };
      audio.play().catch(() => {
        setLoadingPreviewTrackId(null);
        setPlayingPreviewTrackId(null);
        setUnavailablePreviewTrackId(trackId);
      });
      previewAudioRef.current = audio;
    },
    [playingPreviewTrackId, loadingPreviewTrackId]
  );

  const focusCountry = useCallback((isoId: string, lat: number, lng: number) => {
    setSelectedIso(isoId);
    selectedIsoRef.current = isoId;
    const dir = latLngToVec3(lat, lng, 1, new THREE.Vector3()).normalize();
    dir.y = Math.min(0.85, dir.y + 0.14);
    dir.normalize();
    flyTargetCamPosRef.current = dir.multiplyScalar(2.42);
    requestRenderRef.current?.();
  }, []);

  const resetCamera = useCallback(() => {
    setSelectedIso(null);
    selectedIsoRef.current = null;
    flyTargetCamPosRef.current = DEFAULT_CAM_POS.clone();
    requestRenderRef.current?.();
  }, []);

  // Main Three.js Scene Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    if (isSoftwareGl) {
      setAutoRotate(false);
      autoRotateRef.current = false;
    }

    const scene = new THREE.Scene();
    scene.background = COLOR_BG;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight - 64;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.copy(DEFAULT_CAM_POS);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.06;

    container.appendChild(renderer.domElement);

    const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 1);
    const texBundle = createMoebiusTextures(maxAnisotropy);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const pmremTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = pmremTarget.texture;

    // Warm sunlit key light + cool twilight fill + saffron/celadon rim accents
    const hemiLight = new THREE.HemisphereLight('#A4D5CE', '#131D3D', 0.88);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#FFF3D9', 2.1);
    keyLight.position.set(4.8, 3.0, 4.4);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#7AC4BE', 0.95);
    rimLight.position.set(-4.6, -1.8, -3.5);
    scene.add(rimLight);

    const warmBounceLight = new THREE.DirectionalLight('#E8BD6C', 0.35);
    warmBounceLight.position.set(0.5, -4.5, 2.2);
    scene.add(warmBounceLight);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.065;
    controls.enablePan = false;
    controls.minDistance = 1.48;
    controls.maxDistance = 5.4;
    controls.rotateSpeed = 0.68;
    controls.zoomSpeed = 0.85;
    controls.autoRotateSpeed = 0.36;

    const onControlStart = () => {
      flyTargetCamPosRef.current = null;
    };
    controls.addEventListener('start', onControlStart);

    // Illustrated Moëbius Cosmic Sky Dome
    const skyGeo = new THREE.SphereGeometry(32, 32, 24);
    const skyMat = new THREE.MeshBasicMaterial({
      map: texBundle.skyMap,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    skyDome.raycast = () => {};
    scene.add(skyDome);

    // Subtle crisp star points
    const starCount = 650;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const u = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
      const v = ((Math.sin(i * 78.233) * 19341.123) % 1 + 1) % 1;
      const theta = u * Math.PI * 2;
      const phi = Math.acos(2 * v - 1);
      const r = 14 + ((i * 7) % 12);
      starPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = r * Math.cos(phi);
      starPositions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: '#F2E5C6',
      size: 0.055,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.62,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // Root Globe Group
    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // Ocean Sphere (R = 1.0)
    const oceanGeo = new THREE.SphereGeometry(1.0, 96, 64);
    const oceanMat = new THREE.MeshStandardMaterial({
      map: texBundle.oceanColorMap,
      bumpMap: texBundle.oceanBumpMap,
      bumpScale: 0.018,
      roughnessMap: texBundle.oceanRoughnessMap,
      roughness: 0.9,
      metalness: 0.08,
    });
    applyMoebiusInkShader(oceanMat, 'moebius-ocean-v1', 0.52, 0.36);
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.raycast = () => {};
    globeGroup.add(oceanMesh);

    // Ligne Claire Outer Ink Silhouette Rim (Inverted Hull)
    const inkHullGeo = new THREE.SphereGeometry(1.013, 64, 48);
    const inkHullMat = new THREE.MeshBasicMaterial({
      color: '#090F24',
      side: THREE.BackSide,
      depthWrite: false,
    });
    const inkHullMesh = new THREE.Mesh(inkHullGeo, inkHullMat);
    inkHullMesh.raycast = () => {};
    globeGroup.add(inkHullMesh);

    // Graticule Technical Ink Engraving Lines
    const graticuleGeo = buildGraticuleGeometry(1.0018);
    const graticuleMat = new THREE.LineBasicMaterial({
      color: '#19355E',
      transparent: true,
      opacity: 0.42,
    });
    const graticuleLines = new THREE.LineSegments(graticuleGeo, graticuleMat);
    globeGroup.add(graticuleLines);

    // Stylized Moëbius Drifting Cloud Veil
    const cloudGeo = new THREE.SphereGeometry(1.032, 64, 48);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: texBundle.cloudMap,
      transparent: true,
      opacity: 0.65,
      roughness: 0.95,
      metalness: 0.0,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMesh.raycast = () => {};
    cloudMesh.visible = showCloudsRef.current;
    cloudMeshRef.current = cloudMesh;
    globeGroup.add(cloudMesh);

    // Atmospheric Fresnel Rim Halo
    const atmosGeo = new THREE.SphereGeometry(1.135, 48, 32);
    const atmosMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      uniforms: {
        uColorInner: { value: new THREE.Color('#276C9C') },
        uColorRim: { value: new THREE.Color('#9ECAC2') },
      },
      vertexShader: `
        varying vec3 vNormalWorld;
        varying vec3 vViewDir;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vNormalWorld = normalize(mat3(modelMatrix) * normal);
          vViewDir = normalize(cameraPosition - worldPos.xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColorInner;
        uniform vec3 uColorRim;
        varying vec3 vNormalWorld;
        varying vec3 vViewDir;
        void main() {
          float fresnel = pow(clamp(0.66 - dot(vNormalWorld, -vViewDir), 0.0, 1.0), 3.0);
          vec3 col = mix(uColorInner, uColorRim, fresnel);
          gl_FragColor = vec4(col, fresnel * 0.44);
        }
      `,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    atmosMesh.raycast = () => {};
    globeGroup.add(atmosMesh);

    // Moëbius Celestial Astrolabe Rings + Twin Faceted Crystal Moons
    const astrolabeGroup = new THREE.Group();
    scene.add(astrolabeGroup);

    const ringGeoA = buildAstrolabeRingGeometry(1.26, 72);
    const ringMatA = new THREE.LineBasicMaterial({
      color: '#9ECAC2',
      transparent: true,
      opacity: 0.34,
    });
    const ringA = new THREE.LineSegments(ringGeoA, ringMatA);
    ringA.rotation.set(0.36, 0.2, -0.22);
    astrolabeGroup.add(ringA);

    const ringGeoB = buildAstrolabeRingGeometry(1.4, 48);
    const ringMatB = new THREE.LineBasicMaterial({
      color: '#E8BD6C',
      transparent: true,
      opacity: 0.22,
    });
    const ringB = new THREE.LineSegments(ringGeoB, ringMatB);
    ringB.rotation.set(-0.28, -0.4, 0.32);
    astrolabeGroup.add(ringB);

    const createFacetedMoon = (radius: number, colorHex: string, orbitR: number) => {
      const moonWrap = new THREE.Group();
      const moonGeo = new THREE.OctahedronGeometry(radius, 1);
      const moonMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.55,
        metalness: 0.15,
        flatShading: true,
      });
      const moonMesh = new THREE.Mesh(moonGeo, moonMat);
      moonMesh.position.set(orbitR, 0, 0);
      moonMesh.raycast = () => {};

      const moonOutlineGeo = new THREE.OctahedronGeometry(radius * 1.14, 1);
      const moonOutlineMat = new THREE.MeshBasicMaterial({
        color: '#090F24',
        side: THREE.BackSide,
      });
      const moonOutline = new THREE.Mesh(moonOutlineGeo, moonOutlineMat);
      moonOutline.position.copy(moonMesh.position);
      moonOutline.raycast = () => {};

      moonWrap.add(moonMesh);
      moonWrap.add(moonOutline);
      return moonWrap;
    };

    const moonAlpha = createFacetedMoon(0.025, '#E8BD6C', 1.26);
    moonAlpha.rotation.copy(ringA.rotation);
    astrolabeGroup.add(moonAlpha);

    const moonBeta = createFacetedMoon(0.018, '#9ECAC2', -1.4);
    moonBeta.rotation.copy(ringB.rotation);
    astrolabeGroup.add(moonBeta);

    // Country Extruded Meshes + Topographic Textures + Ligne Claire Ink Borders
    const countriesGroup = new THREE.Group();
    globeGroup.add(countriesGroup);

    const countryFeatures = buildAllCountryGeometries();
    const countryMap = new Map<string, CountryMeshEntry>();
    const pickableCountries: THREE.Mesh[] = [];
    let pickableBeacons: THREE.Mesh[] = [];
    let pickableNetworkTubes: THREE.Mesh[] = [];
    let hoveredTubeMesh: THREE.Mesh | null = null;

    for (const feat of countryFeatures) {
      const fillMat = new THREE.MeshStandardMaterial({
        color: COLOR_UNMATCHED.clone(),
        map: texBundle.landColorMap,
        bumpMap: texBundle.landBumpMap,
        bumpScale: 0.032,
        roughnessMap: texBundle.landRoughnessMap,
        roughness: 0.92,
        metalness: 0.05,
        vertexColors: true,
        emissive: COLOR_EMISSIVE_NONE.clone(),
        emissiveIntensity: 0,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      applyMoebiusInkShader(fillMat, 'moebius-land-v1', 0.45, 0.28);

      const mesh = new THREE.Mesh(feat.fillGeometry, fillMat);
      mesh.userData = { isoId: feat.isoId, englishName: feat.englishName };

      const borderMat = new THREE.LineBasicMaterial({
        color: COLOR_BORDER_BASE.clone(),
        transparent: true,
        opacity: 0.72,
      });
      const border = new THREE.LineSegments(feat.borderGeometry, borderMat);

      countriesGroup.add(mesh);
      countriesGroup.add(border);
      pickableCountries.push(mesh);

      countryMap.set(feat.isoId, {
        isoId: feat.isoId,
        englishName: feat.englishName,
        mesh,
        border,
        currentElev: 0,
        targetElev: 0,
        currentColor: COLOR_UNMATCHED.clone(),
        targetColor: COLOR_UNMATCHED.clone(),
        currentEmissive: COLOR_EMISSIVE_NONE.clone(),
        targetEmissive: COLOR_EMISSIVE_NONE.clone(),
        currentEmissiveIntensity: 0,
        targetEmissiveIntensity: 0,
        currentBorderColor: COLOR_BORDER_BASE.clone(),
        targetBorderColor: COLOR_BORDER_BASE.clone(),
        currentBorderOpacity: 0.72,
        targetBorderOpacity: 0.72,
      });
    }

    // Shared geometries for country beacon nodes (reused across all active countries)
    const sharedBeaconGemGeo = new THREE.OctahedronGeometry(0.015, 0);
    const sharedBeaconOutlineGeo = new THREE.OctahedronGeometry(0.0178, 0);
    const sharedBeaconRingGeo = new THREE.RingGeometry(0.012, 0.021, 16);
    sharedBeaconRingGeo.rotateX(-Math.PI / 2);
    const sharedBeaconGeos = new Set<THREE.BufferGeometry>([
      sharedBeaconGemGeo,
      sharedBeaconOutlineGeo,
      sharedBeaconRingGeo,
    ]);

    const beaconsGroup = new THREE.Group();
    globeGroup.add(beaconsGroup);

    const networkGroup = new THREE.Group();
    globeGroup.add(networkGroup);

    const restoreTubeStyle = (tube: THREE.Mesh | null) => {
      if (!tube) return;
      const mat = tube.material as THREE.MeshStandardMaterial;
      const ud = tube.userData;
      if (mat && ud && typeof ud.baseColor === 'string') {
        mat.color.set(ud.baseColor);
        mat.emissive.set(ud.baseEmissive);
        mat.emissiveIntensity = ud.baseEmissiveIntensity;
        mat.opacity = ud.baseOpacity;
      }
    };

    const rebuildNetworkAndBeacons = (
      countries: GlobeCountryBucket[],
      arcs: GlobeArc[],
      activeIso: string | null
    ) => {
      hoveredTubeMesh = null;
      disposeObjectSubtree(beaconsGroup, sharedBeaconGeos);
      beaconsGroup.clear();
      disposeObjectSubtree(networkGroup, sharedBeaconGeos);
      networkGroup.clear();
      pickableBeacons = [];
      pickableNetworkTubes = [];

      if (countries.length === 0) return;

      const maxCount = countries[0].trackCount || 1;
      const logMax = Math.log1p(maxCount);
      const elevByIso = new Map<string, number>();

      // Build 3D beacon crystal + ink halo on EVERY matched country (makes all active countries & microstates visible)
      for (const c of countries) {
        const raw = logMax > 0 ? Math.log1p(c.trackCount) / logMax : 0.4;
        const t = Math.pow(raw, 0.68);
        const isSelected = c.isoId === activeIso;
        const elev = computeTargetElevation(c.trackCount, maxCount, isSelected, false);
        const topoH = sampleTopographicHeight(c.lat, c.lng);
        const surfaceR = (1.003 + topoH) * (1 + elev);
        elevByIso.set(c.isoId, surfaceR);

        // Compute mineral color matching landmass
        const nodeCol = new THREE.Color();
        if (isSelected) {
          nodeCol.copy(COLOR_SELECTED);
        } else if (t < 0.35) {
          nodeCol.lerpColors(COLOR_LOW_MATCH, COLOR_MID_MATCH, t / 0.35);
        } else if (t < 0.72) {
          nodeCol.lerpColors(COLOR_MID_MATCH, COLOR_HIGH_MATCH, (t - 0.35) / 0.37);
        } else {
          nodeCol.lerpColors(COLOR_HIGH_MATCH, COLOR_PEAK_MATCH, (t - 0.72) / 0.28);
        }

        const scaleFactor = isSelected ? 1.55 : 0.75 + t * 0.75;
        latLngToVec3(c.lat, c.lng, surfaceR + 0.008 * scaleFactor, _tmpVecA);
        _tmpNormalDir.copy(_tmpVecA).normalize();
        _tmpQuat.setFromUnitVectors(_upAxis, _tmpNormalDir);

        const gemMat = new THREE.MeshStandardMaterial({
          color: nodeCol,
          emissive: nodeCol,
          emissiveIntensity: isSelected ? 0.85 : 0.48,
          roughness: 0.32,
          metalness: 0.15,
          flatShading: true,
        });
        const gem = new THREE.Mesh(sharedBeaconGemGeo, gemMat);
        gem.position.copy(_tmpVecA);
        gem.quaternion.copy(_tmpQuat);
        gem.scale.set(scaleFactor * 0.85, scaleFactor * 1.45, scaleFactor * 0.85);
        gem.userData = { isoId: c.isoId, englishName: c.nameFr };
        beaconsGroup.add(gem);
        pickableBeacons.push(gem);

        // Crisp dark ink outline around beacon crystal
        const outlineMat = new THREE.MeshBasicMaterial({
          color: '#090F24',
          side: THREE.BackSide,
        });
        const outline = new THREE.Mesh(sharedBeaconOutlineGeo, outlineMat);
        outline.position.copy(_tmpVecA);
        outline.quaternion.copy(_tmpQuat);
        outline.scale.copy(gem.scale);
        outline.raycast = () => {};
        beaconsGroup.add(outline);

        // Base ring sitting flush on the elevated plateau
        const ringMat = new THREE.MeshBasicMaterial({
          color: isSelected ? '#FAF3DF' : '#090F24',
          side: THREE.DoubleSide,
          transparent: true,
          opacity: isSelected ? 0.95 : 0.72,
        });
        const ring = new THREE.Mesh(sharedBeaconRingGeo, ringMat);
        latLngToVec3(c.lat, c.lng, surfaceR + 0.0025, ring.position);
        ring.quaternion.copy(_tmpQuat);
        ring.scale.setScalar(scaleFactor);
        ring.raycast = () => {};
        beaconsGroup.add(ring);
      }

      if (!showNetworkRef.current || arcs.length === 0) return;

      // Build thick, hoverable 3D network conduits connecting countries that shared the same emission
      const maxWeight = arcs.reduce((acc, a) => Math.max(acc, a.weight), 1);
      for (const arc of arcs) {
        const isConnected = activeIso !== null && (arc.fromIso === activeIso || arc.toIso === activeIso);
        if (activeIso !== null && !isConnected) {
          const weightRatio = Math.sqrt(arc.weight / maxWeight);
          const fromR = elevByIso.get(arc.fromIso) ?? 1.02;
          const toR = elevByIso.get(arc.toIso) ?? 1.02;
          const tubeGeo = buildGreatCircleNetworkTubeGeometry(
            arc.fromLat,
            arc.fromLng,
            fromR,
            arc.toLat,
            arc.toLng,
            toR,
            0.002,
            0.12 + weightRatio * 0.14
          );
          const tubeMat = new THREE.MeshBasicMaterial({
            color: '#467D8E',
            transparent: true,
            opacity: 0.14,
            depthWrite: false,
          });
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          tube.raycast = () => {};
          networkGroup.add(tube);
          continue;
        }

        const weightRatio = Math.sqrt(arc.weight / maxWeight);
        const fromR = elevByIso.get(arc.fromIso) ?? 1.025;
        const toR = elevByIso.get(arc.toIso) ?? 1.025;
        const tubeRadius = isConnected
          ? 0.0056 + weightRatio * 0.0024
          : 0.0036 + weightRatio * 0.0028;

        const tubeGeo = buildGreatCircleNetworkTubeGeometry(
          arc.fromLat,
          arc.fromLng,
          fromR,
          arc.toLat,
          arc.toLng,
          toR,
          tubeRadius,
          0.13 + weightRatio * 0.16
        );

        const baseColor = isConnected ? '#FAF3DF' : arc.weight >= 5 ? '#F5CE74' : '#73DCD0';
        const baseEmissive = isConnected ? '#E8BD6C' : arc.weight >= 5 ? '#DF8B4B' : '#3C9E98';
        const baseEmissiveIntensity = isConnected ? 0.85 : arc.weight >= 5 ? 0.62 : 0.5;
        const baseOpacity = isConnected ? 0.96 : 0.86;

        const tubeMat = new THREE.MeshStandardMaterial({
          color: baseColor,
          emissive: baseEmissive,
          emissiveIntensity: baseEmissiveIntensity,
          roughness: 0.35,
          metalness: 0.12,
          transparent: true,
          opacity: baseOpacity,
        });
        const tube = new THREE.Mesh(tubeGeo, tubeMat);
        const fromName =
          bucketByIsoRef.current.get(arc.fromIso)?.nameFr ||
          catalogByIsoRef.current.get(arc.fromIso)?.nameFr ||
          arc.fromIso;
        const toName =
          bucketByIsoRef.current.get(arc.toIso)?.nameFr ||
          catalogByIsoRef.current.get(arc.toIso)?.nameFr ||
          arc.toIso;
        tube.userData = {
          arc,
          fromName,
          toName,
          baseColor,
          baseEmissive,
          baseEmissiveIntensity,
          baseOpacity,
        };
        networkGroup.add(tube);
        pickableNetworkTubes.push(tube);
      }
    };
    rebuildNetworkRef.current = rebuildNetworkAndBeacons;

    // Synchronize visual targets (Moëbius mineral colors, mesa elevation, ink borders)
    const syncVisualTargets = () => {
      const bMap = bucketByIsoRef.current;
      const activeSelected = selectedIsoRef.current;
      const activeHovered = hoveredIsoRef.current;
      const filterActive = hasSearchFilterRef.current;

      let maxCount = 1;
      bMap.forEach((b) => {
        if (b.trackCount > maxCount) maxCount = b.trackCount;
      });
      const logMax = Math.log1p(maxCount);

      countryMap.forEach((entry, isoId) => {
        const bucket = bMap.get(isoId);
        const isSelected = isoId === activeSelected;
        const isHovered = isoId === activeHovered;

        if (bucket && bucket.trackCount > 0) {
          const raw = logMax > 0 ? Math.log1p(bucket.trackCount) / logMax : 0.4;
          const t = Math.pow(raw, 0.68);
          entry.targetElev = computeTargetElevation(bucket.trackCount, maxCount, isSelected, isHovered);

          if (isSelected) {
            entry.targetColor.copy(COLOR_SELECTED);
            entry.targetEmissive.copy(COLOR_EMISSIVE_ACTIVE);
            entry.targetEmissiveIntensity = 0.34;
            entry.targetBorderColor.copy(COLOR_BORDER_SELECTED);
            entry.targetBorderOpacity = 1.0;
          } else {
            if (t < 0.35) {
              _tmpColor.lerpColors(COLOR_LOW_MATCH, COLOR_MID_MATCH, t / 0.35);
            } else if (t < 0.72) {
              _tmpColor.lerpColors(COLOR_MID_MATCH, COLOR_HIGH_MATCH, (t - 0.35) / 0.37);
            } else {
              _tmpColor.lerpColors(COLOR_HIGH_MATCH, COLOR_PEAK_MATCH, (t - 0.72) / 0.28);
            }
            if (isHovered) {
              _tmpColor.lerp(COLOR_SELECTED, 0.34);
            }
            entry.targetColor.copy(_tmpColor);
            entry.targetEmissive.copy(isHovered ? COLOR_EMISSIVE_ACTIVE : COLOR_EMISSIVE_MATCH);
            entry.targetEmissiveIntensity = isHovered ? 0.32 : 0.16 + t * 0.2;
            entry.targetBorderColor.copy(COLOR_BORDER_MATCH);
            entry.targetBorderOpacity = isHovered ? 0.98 : 0.88;
          }
        } else {
          // Unmatched country (recessive slate-limestone so active countries & network stand out vividly)
          entry.targetElev = isSelected ? 0.024 : isHovered ? 0.012 : 0;
          if (isSelected) {
            entry.targetColor.copy(COLOR_SELECTED);
            entry.targetEmissive.copy(COLOR_EMISSIVE_ACTIVE);
            entry.targetEmissiveIntensity = 0.25;
            entry.targetBorderColor.copy(COLOR_BORDER_SELECTED);
            entry.targetBorderOpacity = 0.96;
          } else if (isHovered) {
            entry.targetColor.copy(COLOR_LOW_MATCH);
            entry.targetEmissive.copy(COLOR_EMISSIVE_MATCH);
            entry.targetEmissiveIntensity = 0.18;
            entry.targetBorderColor.copy(COLOR_BORDER_MATCH);
            entry.targetBorderOpacity = 0.9;
          } else {
            entry.targetColor.copy(filterActive ? COLOR_UNMATCHED_DIM : COLOR_UNMATCHED);
            entry.targetEmissive.copy(COLOR_EMISSIVE_NONE);
            entry.targetEmissiveIntensity = 0;
            entry.targetBorderColor.copy(COLOR_BORDER_BASE);
            entry.targetBorderOpacity = filterActive ? 0.42 : 0.68;
          }
        }
      });
    };
    syncVisualTargetsRef.current = syncVisualTargets;

    if (globeDataRef.current) {
      syncVisualTargets();
      rebuildNetworkAndBeacons(
        globeDataRef.current.countries,
        globeDataRef.current.arcs,
        selectedIsoRef.current
      );
    }

    // Raycaster & pointer interaction (checks beacon pins, then network tubes, then country meshes)
    const raycaster = new THREE.Raycaster();
    const pointerNdc = new THREE.Vector2();
    let pointerDownX = 0;
    let pointerDownY = 0;
    let lastMoveTime = 0;

    type PickHit =
      | { kind: 'country'; isoId: string; englishName: string }
      | {
          kind: 'network';
          tube: THREE.Mesh;
          arc: GlobeArc;
          fromName: string;
          toName: string;
        };

    const pickAtEvent = (e: PointerEvent): PickHit | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);

      if (pickableBeacons.length > 0) {
        const beaconHits = raycaster.intersectObjects(pickableBeacons, false);
        if (beaconHits.length > 0) {
          const obj = beaconHits[0].object;
          const isoId = obj.userData?.isoId as string | undefined;
          const englishName = obj.userData?.englishName as string | undefined;
          if (isoId) return { kind: 'country', isoId, englishName: englishName || isoId };
        }
      }

      if (pickableNetworkTubes.length > 0) {
        const tubeHits = raycaster.intersectObjects(pickableNetworkTubes, false);
        if (tubeHits.length > 0) {
          const tube = tubeHits[0].object as THREE.Mesh;
          const arc = tube.userData?.arc as GlobeArc | undefined;
          if (arc) {
            return {
              kind: 'network',
              tube,
              arc,
              fromName: (tube.userData?.fromName as string) || arc.fromIso,
              toName: (tube.userData?.toName as string) || arc.toIso,
            };
          }
        }
      }

      const hits = raycaster.intersectObjects(pickableCountries, false);
      if (hits.length === 0) return null;
      const first = hits[0].object;
      const isoId = first.userData?.isoId as string | undefined;
      const englishName = first.userData?.englishName as string | undefined;
      if (!isoId) return null;
      return { kind: 'country', isoId, englishName: englishName || isoId };
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownX = e.clientX;
      pointerDownY = e.clientY;
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownX, e.clientY - pointerDownY);
      if (dist >= 5) return;
      const hit = pickAtEvent(e);
      if (!hit) {
        if (selectedIsoRef.current !== null) {
          setSelectedIso(null);
        }
        return;
      }
      if (hit.kind === 'network') {
        const latestEm = hit.arc.emissions?.[0];
        if (latestEm?.slug) {
          onSelectEmissionRef.current(latestEm.slug);
        }
        return;
      }
      if (selectedIsoRef.current === hit.isoId) {
        setSelectedIso(null);
        return;
      }
      const bucket = bucketByIsoRef.current.get(hit.isoId);
      const cat = catalogByIsoRef.current.get(hit.isoId);
      if (bucket) {
        focusCountry(hit.isoId, bucket.lat, bucket.lng);
      } else if (cat) {
        focusCountry(hit.isoId, cat.lat, cat.lng);
      } else {
        setSelectedIso(hit.isoId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastMoveTime < 32) return;
      lastMoveTime = now;

      const hit = pickAtEvent(e);
      const nextIso = hit?.kind === 'country' ? hit.isoId : null;
      const nextTube = hit?.kind === 'network' ? hit.tube : null;

      if (hoveredTubeMesh && hoveredTubeMesh !== nextTube) {
        restoreTubeStyle(hoveredTubeMesh);
        hoveredTubeMesh = null;
        requestRender();
      }
      if (nextTube && nextTube !== hoveredTubeMesh) {
        hoveredTubeMesh = nextTube;
        const mat = nextTube.material as THREE.MeshStandardMaterial;
        mat.color.set('#FFFFFF');
        mat.emissive.set('#FAF3DF');
        mat.emissiveIntensity = 1.25;
        mat.opacity = 1.0;
        requestRender();
      }

      if (nextIso !== hoveredIsoRef.current) {
        hoveredIsoRef.current = nextIso;
        syncVisualTargets();
        requestRender();
      }

      const rect = renderer.domElement.getBoundingClientRect();
      if (hit?.kind === 'network') {
        renderer.domElement.style.cursor = 'pointer';
        setHoveredInfo(null);
        setHoveredNetworkInfo({
          fromName: hit.fromName,
          toName: hit.toName,
          weight: hit.arc.weight,
          emissions: hit.arc.emissions ?? [],
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else if (hit?.kind === 'country') {
        renderer.domElement.style.cursor = 'pointer';
        setHoveredNetworkInfo(null);
        const bucket = bucketByIsoRef.current.get(hit.isoId);
        const cat = catalogByIsoRef.current.get(hit.isoId);
        setHoveredInfo({
          isoId: hit.isoId,
          nameFr: bucket?.nameFr || cat?.nameFr || hit.englishName,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          trackCount: bucket?.trackCount ?? 0,
          playCount: bucket?.playCount ?? 0,
          topAuthors: bucket?.topAuthors ?? [],
        });
      } else {
        renderer.domElement.style.cursor = 'grab';
        setHoveredInfo(null);
        setHoveredNetworkInfo(null);
      }
    };

    const onPointerLeave = () => {
      if (hoveredTubeMesh) {
        restoreTubeStyle(hoveredTubeMesh);
        hoveredTubeMesh = null;
        requestRender();
      }
      if (hoveredIsoRef.current !== null) {
        hoveredIsoRef.current = null;
        syncVisualTargets();
        requestRender();
      }
      setHoveredInfo(null);
      setHoveredNetworkInfo(null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerleave', onPointerLeave);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
      requestRender();
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const updateProjectedLabels = () => {
      const cw = renderer.domElement.clientWidth;
      const ch = renderer.domElement.clientHeight;
      if (cw === 0 || ch === 0) return;

      _tmpCamDir.copy(camera.position).normalize();
      const slots = labelsDataRef.current;
      _placedBoxes.length = 0;

      for (const slot of slots) {
        const el = labelRefs.current[slot.isoId];
        if (!el) continue;

        const bucket = bucketByIsoRef.current.get(slot.isoId);
        const entry = countryMap.get(slot.isoId);
        const elev = entry ? entry.currentElev : 0.03;
        const radius = 1.028 + elev + sampleTopographicHeight(slot.lat, slot.lng);
        latLngToVec3(slot.lat, slot.lng, radius, _tmpVecA);
        _tmpVecB.copy(_tmpVecA).normalize();

        const dot = _tmpVecB.dot(_tmpCamDir);
        if (dot < 0.2) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }

        _tmpNdc.copy(_tmpVecA).project(camera);
        const sx = (_tmpNdc.x * 0.5 + 0.5) * cw;
        const sy = (-_tmpNdc.y * 0.5 + 0.5) * ch;

        if (sx < 48 || sx > cw - 48 || sy < 34 || sy > ch - 86) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }

        // Screen-space declutter check (never hide selected country)
        const halfW = 54;
        const boxH = 22;
        const x0 = sx - halfW;
        const x1 = sx + halfW;
        const y0 = sy - boxH;
        const y1 = sy + 2;

        let overlaps = false;
        if (!slot.isSelected) {
          for (let i = 0; i < _placedBoxes.length; i++) {
            const b = _placedBoxes[i];
            if (x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0) {
              overlaps = true;
              break;
            }
          }
        }

        if (overlaps || _placedBoxes.length >= 22) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          continue;
        }

        _placedBoxes.push({ x0, y0, x1, y1 });
        const fade = THREE.MathUtils.clamp((dot - 0.2) / 0.22, 0, 1);
        const visibleOpacity = slot.isSelected || bucket ? fade : fade * 0.8;
        el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -100%)`;
        el.style.opacity = visibleOpacity.toFixed(2);
        el.style.pointerEvents = visibleOpacity > 0.35 ? 'auto' : 'none';
      }
    };

    let rafId = 0;
    let isLoopActive = false;
    let lastTime = performance.now();

    const step = (now: number) => {
      rafId = 0;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;

      let needsMoreFrames = false;

      const flyTarget = flyTargetCamPosRef.current;
      if (flyTarget) {
        const lambda = 6.5;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, flyTarget.x, lambda, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, flyTarget.y, lambda, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, flyTarget.z, lambda, dt);
        if (camera.position.distanceTo(flyTarget) < 0.008) {
          camera.position.copy(flyTarget);
          flyTargetCamPosRef.current = null;
        } else {
          needsMoreFrames = true;
        }
      }

      const isSpinning =
        !isSoftwareGl && autoRotateRef.current && !selectedIsoRef.current && !hoveredIsoRef.current;
      controls.autoRotate = isSpinning;
      const controlsMoved = controls.update();
      if (controlsMoved || isSpinning) {
        needsMoreFrames = true;
      }

      if (isSpinning) {
        cloudMesh.rotation.y += dt * 0.018;
        moonAlpha.rotateY(dt * 0.24);
        moonBeta.rotateY(-dt * 0.16);
      }

      const dampSpeed = 9.0;
      countryMap.forEach((entry) => {
        const elevDiff = Math.abs(entry.currentElev - entry.targetElev);
        if (elevDiff > 0.00025) {
          entry.currentElev = THREE.MathUtils.damp(entry.currentElev, entry.targetElev, dampSpeed, dt);
          const s = 1 + entry.currentElev;
          entry.mesh.scale.setScalar(s);
          entry.border.scale.setScalar(s);
          needsMoreFrames = true;
        } else if (entry.currentElev !== entry.targetElev) {
          entry.currentElev = entry.targetElev;
          const s = 1 + entry.currentElev;
          entry.mesh.scale.setScalar(s);
          entry.border.scale.setScalar(s);
        }

        const colorDiff =
          Math.abs(entry.currentColor.r - entry.targetColor.r) +
          Math.abs(entry.currentColor.g - entry.targetColor.g) +
          Math.abs(entry.currentColor.b - entry.targetColor.b);
        if (colorDiff > 0.004) {
          const alpha = 1 - Math.exp(-dampSpeed * dt);
          entry.currentColor.lerp(entry.targetColor, alpha);
          entry.currentEmissive.lerp(entry.targetEmissive, alpha);
          entry.currentBorderColor.lerp(entry.targetBorderColor, alpha);
          entry.mesh.material.color.copy(entry.currentColor);
          entry.mesh.material.emissive.copy(entry.currentEmissive);
          entry.border.material.color.copy(entry.currentBorderColor);
          needsMoreFrames = true;
        } else {
          entry.currentColor.copy(entry.targetColor);
          entry.currentEmissive.copy(entry.targetEmissive);
          entry.currentBorderColor.copy(entry.targetBorderColor);
          entry.mesh.material.color.copy(entry.currentColor);
          entry.mesh.material.emissive.copy(entry.currentEmissive);
          entry.border.material.color.copy(entry.currentBorderColor);
        }

        if (Math.abs(entry.currentEmissiveIntensity - entry.targetEmissiveIntensity) > 0.004) {
          entry.currentEmissiveIntensity = THREE.MathUtils.damp(
            entry.currentEmissiveIntensity,
            entry.targetEmissiveIntensity,
            dampSpeed,
            dt
          );
          entry.mesh.material.emissiveIntensity = entry.currentEmissiveIntensity;
          needsMoreFrames = true;
        } else {
          entry.currentEmissiveIntensity = entry.targetEmissiveIntensity;
          entry.mesh.material.emissiveIntensity = entry.currentEmissiveIntensity;
        }

        if (Math.abs(entry.currentBorderOpacity - entry.targetBorderOpacity) > 0.005) {
          entry.currentBorderOpacity = THREE.MathUtils.damp(
            entry.currentBorderOpacity,
            entry.targetBorderOpacity,
            dampSpeed,
            dt
          );
          entry.border.material.opacity = entry.currentBorderOpacity;
          needsMoreFrames = true;
        } else {
          entry.currentBorderOpacity = entry.targetBorderOpacity;
          entry.border.material.opacity = entry.currentBorderOpacity;
        }
      });

      renderer.render(scene, camera);
      updateProjectedLabels();

      if (needsMoreFrames) {
        rafId = requestAnimationFrame(step);
      } else {
        isLoopActive = false;
      }
    };

    const requestRender = () => {
      if (!isLoopActive) {
        isLoopActive = true;
        lastTime = performance.now();
        rafId = requestAnimationFrame(step);
      }
    };
    requestRenderRef.current = requestRender;

    const onControlsChange = () => {
      requestRender();
    };
    controls.addEventListener('change', onControlsChange);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextW = Math.max(1, Math.floor(entry.contentRect.width));
      const nextH = Math.max(1, Math.floor(entry.contentRect.height));
      camera.aspect = nextW / nextH;
      camera.updateProjectionMatrix();
      renderer.setSize(nextW, nextH);
      requestRender();
    });
    resizeObserver.observe(container);

    requestRender();

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlsChange);
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      disposeObjectSubtree(scene);
      sharedBeaconGemGeo.dispose();
      sharedBeaconOutlineGeo.dispose();
      sharedBeaconRingGeo.dispose();
      texBundle.dispose();
      pmremTarget.dispose();
      roomEnv.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [focusCountry]);

  const selectedBucket = useMemo(() => {
    if (!selectedIso || !globeData) return null;
    return globeData.countries.find((c) => c.isoId === selectedIso) ?? null;
  }, [selectedIso, globeData]);

  const selectedCatalogMeta = useMemo(() => {
    if (!selectedIso || !globeData) return null;
    return globeData.catalog.find((c) => c.isoId === selectedIso) ?? null;
  }, [selectedIso, globeData]);

  const selectedConnections = useMemo(() => {
    if (!selectedIso || !globeData) return [];
    const byPartner = new Map<
      string,
      {
        isoId: string;
        nameFr: string;
        lat: number;
        lng: number;
        weight: number;
        emissions: Array<{ number: number | null; slug: string }>;
      }
    >();
    const metaByIso = new Map(globeData.catalog.map((c) => [c.isoId, c]));
    for (const arc of globeData.arcs) {
      if (arc.fromIso !== selectedIso && arc.toIso !== selectedIso) continue;
      const partnerIso = arc.fromIso === selectedIso ? arc.toIso : arc.fromIso;
      const meta = metaByIso.get(partnerIso);
      if (!meta) continue;
      const existing = byPartner.get(partnerIso);
      if (!existing || arc.weight > existing.weight) {
        byPartner.set(partnerIso, {
          isoId: partnerIso,
          nameFr: meta.nameFr,
          lat: meta.lat,
          lng: meta.lng,
          weight: arc.weight,
          emissions: arc.emissions ?? [],
        });
      }
    }
    return Array.from(byPartner.values()).sort((a, b) => b.weight - a.weight);
  }, [selectedIso, globeData]);

  const maxCountryTracks = useMemo(() => {
    if (!globeData || globeData.countries.length === 0) return 1;
    return globeData.countries[0].trackCount;
  }, [globeData]);

  return (
    <div className="relative w-full h-[calc(100vh-4rem)] min-h-[580px] bg-[#071230] overflow-hidden select-none">
      {/* Isolated WebGL Canvas Mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Projected 3D Country Labels Overlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
        {projectedLabelSlots.map((slot) => (
          <button
            key={slot.isoId}
            ref={(el) => {
              labelRefs.current[slot.isoId] = el;
            }}
            type="button"
            onClick={() => focusCountry(slot.isoId, slot.lat, slot.lng)}
            style={{ opacity: 0, willChange: 'transform, opacity' }}
            className={`absolute top-0 left-0 px-2 py-0.5 rounded border text-[11px] font-medium tracking-wide transition-colors whitespace-nowrap ${
              slot.isSelected
                ? 'bg-[#FAF3DF] text-[#09122B] border-[#09122B] font-bold shadow-lg'
                : slot.isTop
                  ? 'bg-[#09122B]/92 text-[#FAF3DF] border-[#E8BD6C]/70 hover:border-[#FAF3DF]'
                  : 'bg-[#09122B]/88 text-[#6ED6C3] border-[#276C9C]/80 hover:border-[#FAF3DF]'
            }`}
          >
            <span>{slot.nameFr}</span>
            {slot.trackCount > 0 && (
              <span
                className={`ml-1.5 font-mono tabular-nums ${
                  slot.isSelected ? 'text-[#EA6D4E]' : 'text-[#E8BD6C]'
                }`}
              >
                {formatNumberFR(slot.trackCount)}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Top-Left Compact Telemetry & Relief Legend (No backdrop-blur over WebGL) */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 pointer-events-none max-w-[calc(100vw-2rem)]">
        <div className="pointer-events-auto inline-flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2 rounded-lg bg-[#09122B]/94 border border-[#E8BD6C]/35 text-xs text-[#FAF3DF]">
          <div className="flex items-center gap-1.5 font-display font-bold tracking-wide text-[#E8BD6C]">
            <Compass className="w-3.5 h-3.5" />
            <span>Globe Sonore · Ligne Claire</span>
          </div>
          <span className="text-white/20" aria-hidden="true">
            |
          </span>
          {loading && !globeData ? (
            <span className="inline-flex items-center gap-1.5 text-[#ECE8E1]/75">
              <Loader2 className="w-3 h-3 animate-spin text-[#9ECAC2]" />
              Chargement…
            </span>
          ) : globeData ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono tabular-nums">
              <span>
                <strong className="text-white">{formatNumberFR(globeData.matchedTracksCount)}</strong>{' '}
                <span className="text-[#ECE8E1]/70">titres</span>
              </span>
              <span className="text-white/20">·</span>
              <span>
                <strong className="text-[#6ED6C3]">
                  {formatNumberFR(globeData.matchedCountriesCount)}
                </strong>{' '}
                <span className="text-[#ECE8E1]/70">pays activés</span>
              </span>
              {showNetwork && globeData.arcs.length > 0 && (
                <>
                  <span className="text-white/20">·</span>
                  <span>
                    <strong className="text-[#E8BD6C]">{globeData.arcs.length}</strong>{' '}
                    <span className="text-[#ECE8E1]/70">connexions réseau</span>
                  </span>
                </>
              )}
              {loading && <Loader2 className="w-3 h-3 animate-spin text-[#9ECAC2]" />}
            </div>
          ) : null}
        </div>

        {/* Relief & Network Scale Bar */}
        {globeData && (
          <div className="inline-flex flex-wrap items-center gap-3 px-3 py-1.5 rounded-md bg-[#09122B]/90 border border-white/15 text-[11px] text-[#ECE8E1]/85 w-fit">
            <div className="flex items-center gap-1.5">
              <span>Relief</span>
              <span className="font-mono text-[#6ED6C3]">1</span>
              <div
                className="w-20 h-2 rounded-sm border border-[#09122B]"
                style={{
                  background: 'linear-gradient(90deg, #6ED6C3 0%, #A8DF9D 36%, #F2C665 72%, #EA6D4E 100%)',
                }}
                aria-hidden="true"
              />
              <span className="font-mono text-[#EA6D4E]">{formatNumberFR(maxCountryTracks)}</span>
            </div>
            {showNetwork && (
              <>
                <span className="text-white/20" aria-hidden="true">
                  |
                </span>
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-1 rounded-full bg-[#73DCD0]" />
                    <span>Même émission</span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2.5 h-1 rounded-full bg-[#F5CE74]" />
                    <span>5+ émissions</span>
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Hover Tooltip (Country) */}
      {hoveredInfo && (
        <div
          className="pointer-events-none absolute z-30 px-3 py-2 rounded-lg bg-[#09122B]/96 border border-[#E8BD6C]/55 text-xs text-[#FAF3DF] shadow-xl max-w-[230px]"
          style={{
            left: Math.min(hoveredInfo.x + 16, (mountRef.current?.clientWidth || 800) - 245),
            top: Math.max(12, hoveredInfo.y - 12),
          }}
        >
          <div className="font-display font-bold text-[#FAF3DF]">{hoveredInfo.nameFr}</div>
          {hoveredInfo.trackCount > 0 ? (
            <>
              <div className="mt-1 font-mono tabular-nums text-[#E8BD6C]">
                {formatNumberFR(hoveredInfo.trackCount)} titre
                {hoveredInfo.trackCount > 1 ? 's' : ''} · {formatNumberFR(hoveredInfo.playCount)}{' '}
                diffusion{hoveredInfo.playCount > 1 ? 's' : ''}
              </div>
              {hoveredInfo.topAuthors.length > 0 && (
                <div className="mt-1 text-[11px] text-[#9ECAC2] line-clamp-2">
                  {hoveredInfo.topAuthors.join(', ')}
                </div>
              )}
              <div className="mt-1 text-[10px] text-[#ECE8E1]/55">Cliquer pour inspecter</div>
            </>
          ) : (
            <div className="mt-0.5 text-[11px] text-[#ECE8E1]/60">
              Aucun titre indexé pour cette sélection
            </div>
          )}
        </div>
      )}

      {/* Hover Tooltip (Shared-Emission Network Link) */}
      {hoveredNetworkInfo && (
        <div
          className="pointer-events-none absolute z-30 px-3 py-2.5 rounded-lg bg-[#09122B]/96 border border-[#73DCD0]/65 text-xs text-[#FAF3DF] shadow-xl max-w-[270px]"
          style={{
            left: Math.min(hoveredNetworkInfo.x + 16, (mountRef.current?.clientWidth || 800) - 285),
            top: Math.max(12, hoveredNetworkInfo.y - 14),
          }}
        >
          <div className="font-display font-bold text-[#FAF3DF]">
            {hoveredNetworkInfo.fromName} ↔ {hoveredNetworkInfo.toName}
          </div>
          <div className="mt-1 font-mono tabular-nums text-[#73DCD0]">
            {formatNumberFR(hoveredNetworkInfo.weight)} émission
            {hoveredNetworkInfo.weight > 1 ? 's' : ''} en commun
          </div>
          {hoveredNetworkInfo.emissions.length > 0 && (
            <div className="mt-1.5 text-[11px] text-[#E8BD6C] font-mono leading-snug">
              {hoveredNetworkInfo.emissions
                .slice(0, 6)
                .map((em) => `nº ${em.number ?? em.slug}`)
                .join(', ')}
              {hoveredNetworkInfo.weight > 6 && (
                <span className="text-[#ECE8E1]/65">
                  {' '}
                  (+{formatNumberFR(hoveredNetworkInfo.weight - 6)})
                </span>
              )}
            </div>
          )}
          {hoveredNetworkInfo.emissions[0] && (
            <div className="mt-1 text-[10px] text-[#ECE8E1]/60">
              Cliquer pour ouvrir l’émission nº{' '}
              {hoveredNetworkInfo.emissions[0].number ?? hoveredNetworkInfo.emissions[0].slug}
            </div>
          )}
        </div>
      )}

      {/* Selected Country Inspection Panel (Docked Top-Right, Never Occluding Center) */}
      {selectedIso && (
        <aside className="absolute top-4 right-4 z-20 w-[340px] max-w-[calc(100vw-2rem)] max-h-[calc(100%-9.5rem)] flex flex-col rounded-xl bg-[#09122B]/96 border border-[#E8BD6C]/50 text-[#FAF3DF] shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3 bg-[#0E1B3D]">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider font-display text-[#E8BD6C]">
                Pays sélectionné
              </div>
              <h2 className="font-display text-lg font-bold text-white truncate">
                {selectedBucket?.nameFr || selectedCatalogMeta?.nameFr || selectedIso}
              </h2>
              {selectedBucket ? (
                <div className="text-xs font-mono tabular-nums text-[#6ED6C3] mt-0.5">
                  {formatNumberFR(selectedBucket.trackCount)} titre
                  {selectedBucket.trackCount > 1 ? 's' : ''} ·{' '}
                  {formatNumberFR(selectedBucket.playCount)} passage
                  {selectedBucket.playCount > 1 ? 's' : ''}
                </div>
              ) : (
                <div className="text-xs text-[#ECE8E1]/65 mt-0.5">
                  Aucun titre correspondant aux filtres actifs
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSelectedIso(null)}
              className="p-1.5 rounded-md text-[#ECE8E1]/70 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              aria-label="Fermer la fiche pays"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {selectedBucket && (
            <>
              {selectedBucket.topAuthors.length > 0 && (
                <div className="px-4 py-2.5 border-b border-white/10 bg-[#0A1533]">
                  <div className="text-[11px] text-[#ECE8E1]/60 mb-1">Artistes principaux</div>
                  <div className="text-xs text-[#9ECAC2] font-medium leading-relaxed">
                    {selectedBucket.topAuthors.join(' · ')}
                  </div>
                </div>
              )}

              {selectedConnections.length > 0 && (
                <div className="px-4 py-2.5 border-b border-white/10 bg-[#0A1533]">
                  <div className="text-[11px] text-[#ECE8E1]/60 mb-1.5">
                    Pays reliés par les mêmes émissions ({selectedConnections.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedConnections.map((conn) => (
                      <button
                        key={conn.isoId}
                        type="button"
                        onClick={() => focusCountry(conn.isoId, conn.lat, conn.lng)}
                        title={
                          conn.emissions.length > 0
                            ? `Émissions : ${conn.emissions
                                .slice(0, 5)
                                .map((e) => `nº ${e.number ?? e.slug}`)
                                .join(', ')}`
                            : undefined
                        }
                        className={`px-2 py-0.5 rounded text-[11px] border transition-colors ${
                          conn.weight >= 5
                            ? 'border-[#E8BD6C]/60 bg-[#E8BD6C]/15 text-[#FAF3DF] hover:bg-[#E8BD6C]/30'
                            : 'border-[#73DCD0]/50 bg-[#73DCD0]/10 text-[#9ECAC2] hover:bg-[#73DCD0]/25'
                        }`}
                      >
                        <span>{conn.nameFr}</span>
                        {conn.emissions[0] && (
                          <span className="ml-1 font-mono text-[10px] text-[#E8BD6C]">
                            nº {conn.emissions[0].number ?? conn.emissions[0].slug}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto divide-y divide-white/10">
                {selectedBucket.sampleTracks.map((t) => {
                  const isPlaying = playingPreviewTrackId === t.id;
                  const isLoadingPreview = loadingPreviewTrackId === t.id;
                  const isUnavailable = unavailablePreviewTrackId === t.id;

                  return (
                    <div key={t.id} className="px-4 py-2.5 hover:bg-white/5 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => togglePreview(t.id)}
                            disabled={isLoadingPreview}
                            className={`mt-0.5 p-1.5 rounded-md border transition-colors shrink-0 ${
                              isPlaying
                                ? 'bg-[#E8BD6C] text-[#09122B] border-[#E8BD6C]'
                                : t.preview_url
                                  ? 'bg-[#0E1B3D] text-[#E8BD6C] border-[#E8BD6C]/50 hover:bg-[#E8BD6C]/20'
                                  : 'bg-[#0E1B3D] text-[#9ECAC2] border-white/15 hover:border-[#9ECAC2]'
                            }`}
                            title="Écouter un extrait musical (30s)"
                            aria-label={`Écouter un extrait de ${t.title}`}
                          >
                            {isLoadingPreview ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : isPlaying ? (
                              <Pause className="w-3 h-3" />
                            ) : (
                              <Play className="w-3 h-3" />
                            )}
                          </button>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white leading-snug truncate">
                              {t.title}
                            </div>
                            <div className="text-[11px] text-[#9ECAC2] truncate">{t.author}</div>
                            {isUnavailable && (
                              <div className="text-[10px] text-[#EA6D4E] mt-0.5">
                                Extrait audio indisponible
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] font-mono tabular-nums text-[#ECE8E1]/70 shrink-0 pt-0.5">
                          {formatDuration(t.duration_sec)}
                        </span>
                      </div>
                      <div className="mt-1.5 pl-8 flex items-center justify-between gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => onSelectEmission(t.emission_slug)}
                          className="font-mono tabular-nums text-[#E8BD6C] hover:underline"
                        >
                          Émission nº {t.emission_number ?? t.emission_slug}
                          {t.broadcast_date_label ? ` · ${t.broadcast_date_label}` : ''}
                        </button>
                        {t.appearance_count > 1 && (
                          <span className="font-mono text-[#9ECAC2]">{t.appearance_count}×</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 border-t border-white/10 bg-[#0E1B3D]">
                <button
                  type="button"
                  onClick={() => onInspectCountryInTable(selectedBucket.nameFr, q)}
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-md bg-[#E8BD6C] text-[#09122B] hover:bg-[#FAF3DF] transition-colors"
                >
                  <span>Ouvrir dans la table des titres</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </aside>
      )}

      {/* WebGL Context Lost Banner */}
      {contextLost && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#071230]/95 text-[#FAF3DF] p-6">
          <div className="max-w-md text-center space-y-2 border border-[#E8BD6C]/40 rounded-xl p-6 bg-[#0E1B3D]">
            <p className="font-display font-bold text-base">Contexte 3D interrompu</p>
            <p className="text-xs text-[#ECE8E1]/75">
              Le navigateur a libéré le contexte WebGL. Rechargez l’onglet pour restaurer le globe.
            </p>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="absolute top-16 left-4 z-30 px-3.5 py-2 rounded-lg bg-red-950/95 border border-red-400/50 text-xs text-red-100">
          {error}
        </div>
      )}

      {/* Collapsible Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[min(1020px,calc(100vw-2rem))]">
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#09122B]/94 border border-[#E8BD6C]/35 text-[11px] font-medium text-[#E8BD6C] hover:text-white hover:border-[#E8BD6C] transition-colors"
            title="Raccourci clavier : H"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Afficher les contrôles</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Masquer les contrôles</span>
              </>
            )}
          </button>
        </div>

        {!dockCollapsed && (
          <div className="rounded-xl bg-[#09122B]/95 border border-[#E8BD6C]/35 p-3 shadow-2xl space-y-2.5">
            {/* Search & Globe Toggles Row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-[#E8BD6C]/75 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Rechercher un artiste, titre, label ou pays sur le globe…"
                  className="w-full pl-8 pr-8 py-1.5 text-xs bg-[#0E1B3D] text-[#FAF3DF] placeholder:text-[#ECE8E1]/45 border border-white/15 rounded-md focus:outline-none focus:border-[#E8BD6C]"
                />
                {q && (
                  <button
                    type="button"
                    onClick={() => setQ('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[#ECE8E1]/55 hover:text-white"
                    aria-label="Effacer la recherche"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                aria-label="Filtrer par année"
                className="px-2.5 py-1.5 text-xs bg-[#0E1B3D] text-[#FAF3DF] border border-white/15 rounded-md focus:outline-none focus:border-[#E8BD6C]"
              >
                <option value="">Toutes années</option>
                {years.map((y) => (
                  <option key={y.year} value={String(y.year)}>
                    {y.year}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setMultiOnly((v) => !v)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  multiOnly
                    ? 'bg-[#276C9C] text-white border-[#9ECAC2]'
                    : 'bg-[#0E1B3D] text-[#ECE8E1]/80 border-white/15 hover:border-[#9ECAC2]/60'
                }`}
              >
                Multi-diffusions
              </button>

              <button
                type="button"
                onClick={() => setShowNetwork((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  showNetwork
                    ? 'bg-[#276C9C] text-white border-[#E8BD6C]'
                    : 'bg-[#0E1B3D] text-[#ECE8E1]/80 border-white/15 hover:border-[#E8BD6C]/60'
                }`}
              >
                <Network className="w-3 h-3 text-[#E8BD6C]" />
                <span>Réseau</span>
              </button>

              <button
                type="button"
                onClick={() => setShowClouds((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  showClouds
                    ? 'bg-[#276C9C] text-white border-[#9ECAC2]'
                    : 'bg-[#0E1B3D] text-[#ECE8E1]/80 border-white/15 hover:border-[#9ECAC2]/60'
                }`}
              >
                <Cloud className="w-3 h-3 text-[#9ECAC2]" />
                <span>Nuages</span>
              </button>

              <button
                type="button"
                onClick={() => setAutoRotate((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  autoRotate
                    ? 'bg-[#0E1B3D] text-[#9ECAC2] border-[#9ECAC2]/50'
                    : 'bg-[#0E1B3D] text-[#ECE8E1]/70 border-white/15'
                }`}
                title="Activer ou suspendre la rotation du globe"
              >
                {autoRotate ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>Rotation</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setQ('');
                  setYearFilter('');
                  setMultiOnly(false);
                  resetCamera();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#0E1B3D] text-[#ECE8E1]/85 border border-white/15 hover:border-[#E8BD6C] transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Réinitialiser</span>
              </button>
            </div>

            {/* Complete Active Countries Selector Strip */}
            {globeData && globeData.countries.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5">
                <span className="text-[11px] text-[#ECE8E1]/55 shrink-0 pr-1">
                  Pays actifs ({globeData.countries.length}) :
                </span>
                {globeData.countries.map((c) => {
                  const isActive = c.isoId === selectedIso;
                  return (
                    <button
                      key={c.isoId}
                      type="button"
                      onClick={() => focusCountry(c.isoId, c.lat, c.lng)}
                      className={`px-2 py-1 rounded text-[11px] whitespace-nowrap shrink-0 border transition-colors ${
                        isActive
                          ? 'bg-[#E8BD6C] text-[#09122B] border-[#E8BD6C] font-bold'
                          : 'bg-[#0E1B3D] text-[#ECE8E1]/90 border-white/12 hover:border-[#E8BD6C]/60'
                      }`}
                    >
                      <span>{c.nameFr}</span>
                      <span
                        className={`ml-1.5 font-mono tabular-nums ${
                          isActive ? 'text-[#09122B]/80' : 'text-[#6ED6C3]'
                        }`}
                      >
                        {formatNumberFR(c.trackCount)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
