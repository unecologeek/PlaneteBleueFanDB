import * as THREE from 'three';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import countriesTopo from 'world-atlas/countries-110m.json';
import { sampleTopographicHeight } from './moebiusTextures';

const DEG2RAD = Math.PI / 180;
const BASE_TOP_R = 1.0025;
const BASE_SKIRT_R = 0.925;
const BORDER_R = 1.0042;

export function latLngToVec3(lat: number, lng: number, radius = 1, out = new THREE.Vector3()): THREE.Vector3 {
  const phi = (90 - lat) * DEG2RAD;
  const theta = (lng + 180) * DEG2RAD;
  const sinPhi = Math.sin(phi);
  out.set(
    -radius * sinPhi * Math.cos(theta),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta)
  );
  return out;
}

function unwrapRing(ring: number[][]): number[][] {
  if (ring.length === 0) return ring;
  const out: number[][] = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let lng = ring[i][0];
    const prevLng = out[i - 1][0];
    while (lng - prevLng > 180) lng -= 360;
    while (lng - prevLng < -180) lng += 360;
    out.push([lng, ring[i][1]]);
  }
  return out;
}

function subdivideTriangle(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  depth: number,
  out: Array<[number, number]>
) {
  const maxSpan = Math.max(
    Math.abs(a[0] - b[0]),
    Math.abs(b[0] - c[0]),
    Math.abs(c[0] - a[0]),
    Math.abs(a[1] - b[1]),
    Math.abs(b[1] - c[1]),
    Math.abs(c[1] - a[1])
  );
  if (depth >= 3 || maxSpan <= 4.5) {
    out.push(a, b, c);
    return;
  }
  const ab: [number, number] = [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5];
  const bc: [number, number] = [(b[0] + c[0]) * 0.5, (b[1] + c[1]) * 0.5];
  const ca: [number, number] = [(c[0] + a[0]) * 0.5, (c[1] + a[1]) * 0.5];
  subdivideTriangle(a, ab, ca, depth + 1, out);
  subdivideTriangle(ab, b, bc, depth + 1, out);
  subdivideTriangle(ca, bc, c, depth + 1, out);
  subdivideTriangle(ab, bc, ca, depth + 1, out);
}

function appendBorderSegment(
  p1: [number, number],
  p2: [number, number],
  baseRadius: number,
  linePositions: number[]
) {
  const span = Math.max(Math.abs(p1[0] - p2[0]), Math.abs(p1[1] - p2[1]));
  const steps = Math.max(1, Math.min(10, Math.ceil(span / 3)));
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  for (let s = 0; s < steps; s++) {
    const t0 = s / steps;
    const t1 = (s + 1) / steps;
    const lng0 = p1[0] + (p2[0] - p1[0]) * t0;
    const lat0 = p1[1] + (p2[1] - p1[1]) * t0;
    const lng1 = p1[0] + (p2[0] - p1[0]) * t1;
    const lat1 = p1[1] + (p2[1] - p1[1]) * t1;
    const h0 = sampleTopographicHeight(lat0, lng0);
    const h1 = sampleTopographicHeight(lat1, lng1);
    latLngToVec3(lat0, lng0, baseRadius + h0, vA);
    latLngToVec3(lat1, lng1, baseRadius + h1, vB);
    linePositions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
  }
}

function pushTopVertex(
  lat: number,
  lng: number,
  vec: THREE.Vector3,
  h: number,
  positions: number[],
  uvs: number[],
  colors: number[]
) {
  positions.push(vec.x, vec.y, vec.z);
  uvs.push((lng + 180) / 360, (lat + 90) / 180);
  // Subtle elevation luminance boost on mountain peaks vs plains
  const shade = 0.90 + Math.min(0.22, h * 18.0);
  colors.push(shade, shade * 0.99, shade * 0.96);
}

export interface CountryFeatureMeshData {
  isoId: string;
  englishName: string;
  fillGeometry: THREE.BufferGeometry;
  borderGeometry: THREE.BufferGeometry;
}

export function buildAllCountryGeometries(): CountryFeatureMeshData[] {
  const topology = countriesTopo as unknown as Topology<{
    countries: GeometryCollection<{ name: string }>;
  }>;
  const geo = feature(topology, topology.objects.countries);
  const results: CountryFeatureMeshData[] = [];

  const v0 = new THREE.Vector3();
  const v1 = new THREE.Vector3();
  const v2 = new THREE.Vector3();
  const b0 = new THREE.Vector3();
  const b1 = new THREE.Vector3();
  const t0 = new THREE.Vector3();
  const t1 = new THREE.Vector3();
  const edgeA = new THREE.Vector3();
  const edgeB = new THREE.Vector3();
  const triNormal = new THREE.Vector3();
  const centroidDir = new THREE.Vector3();

  for (const feat of geo.features) {
    const isoId = feat.id ? String(feat.id).padStart(3, '0') : '';
    if (!isoId || isoId === '010') {
      // Skip Antarctica so southern ocean remains clean and polar navigation stays uncluttered
      continue;
    }
    const englishName = feat.properties?.name || isoId;
    const polygons =
      feat.geometry.type === 'Polygon'
        ? [feat.geometry.coordinates]
        : feat.geometry.type === 'MultiPolygon'
          ? feat.geometry.coordinates
          : [];

    const positions: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const borderPositions: number[] = [];

    for (const poly of polygons) {
      if (!poly || poly.length === 0) continue;
      const unwrappedOuter = unwrapRing(poly[0]);
      if (unwrappedOuter.length < 3) continue;

      const contour2D = unwrappedOuter.map(([lng, lat]) => new THREE.Vector2(lng, lat));
      const holes2D = poly.slice(1).map((hole) =>
        unwrapRing(hole).map(([lng, lat]) => new THREE.Vector2(lng, lat))
      );

      const allPts2D: Array<[number, number]> = [];
      for (const pt of unwrappedOuter) allPts2D.push([pt[0], pt[1]]);
      for (const h of holes2D) {
        for (const pt of h) allPts2D.push([pt.x, pt.y]);
      }

      const faces = THREE.ShapeUtils.triangulateShape(contour2D, holes2D);
      for (const [ia, ib, ic] of faces) {
        const pa = allPts2D[ia];
        const pb = allPts2D[ib];
        const pc = allPts2D[ic];
        if (!pa || !pb || !pc) continue;

        const subTris: Array<[number, number]> = [];
        subdivideTriangle(pa, pb, pc, 0, subTris);

        for (let k = 0; k < subTris.length; k += 3) {
          const sa = subTris[k];
          const sb = subTris[k + 1];
          const sc = subTris[k + 2];

          const ha = sampleTopographicHeight(sa[1], sa[0]);
          const hb = sampleTopographicHeight(sb[1], sb[0]);
          const hc = sampleTopographicHeight(sc[1], sc[0]);

          latLngToVec3(sa[1], sa[0], BASE_TOP_R + ha, v0);
          latLngToVec3(sb[1], sb[0], BASE_TOP_R + hb, v1);
          latLngToVec3(sc[1], sc[0], BASE_TOP_R + hc, v2);

          // Ensure outward winding relative to sphere center
          edgeA.subVectors(v1, v0);
          edgeB.subVectors(v2, v0);
          triNormal.crossVectors(edgeA, edgeB);
          centroidDir.copy(v0).add(v1).add(v2);

          if (triNormal.dot(centroidDir) >= 0) {
            pushTopVertex(sa[1], sa[0], v0, ha, positions, uvs, colors);
            pushTopVertex(sb[1], sb[0], v1, hb, positions, uvs, colors);
            pushTopVertex(sc[1], sc[0], v2, hc, positions, uvs, colors);
          } else {
            pushTopVertex(sa[1], sa[0], v0, ha, positions, uvs, colors);
            pushTopVertex(sc[1], sc[0], v2, hc, positions, uvs, colors);
            pushTopVertex(sb[1], sb[0], v1, hb, positions, uvs, colors);
          }
        }
      }

      // Build vertical radial mesa skirt walls + topographic border lines along outer ring
      for (let i = 0; i < unwrappedOuter.length - 1; i++) {
        const pA = unwrappedOuter[i] as [number, number];
        const pB = unwrappedOuter[i + 1] as [number, number];
        if (Math.abs(pA[0] - pB[0]) > 180) continue;

        appendBorderSegment(pA, pB, BORDER_R, borderPositions);

        const hA = sampleTopographicHeight(pA[1], pA[0]);
        const hB = sampleTopographicHeight(pB[1], pB[0]);

        latLngToVec3(pA[1], pA[0], BASE_TOP_R + hA, t0);
        latLngToVec3(pB[1], pB[0], BASE_TOP_R + hB, t1);
        latLngToVec3(pA[1], pA[0], BASE_SKIRT_R, b0);
        latLngToVec3(pB[1], pB[0], BASE_SKIRT_R, b1);

        const uA = (pA[0] + 180) / 360;
        const uB = (pB[0] + 180) / 360;
        const vTopA = (pA[1] + 90) / 180;
        const vTopB = (pB[1] + 90) / 180;

        // Mesa cliff shading: darker warm-shadow base -> crisp rim
        // Tri 1: t0, b0, t1
        positions.push(t0.x, t0.y, t0.z, b0.x, b0.y, b0.z, t1.x, t1.y, t1.z);
        uvs.push(uA, vTopA, uA, Math.max(0, vTopA - 0.04), uB, vTopB);
        colors.push(0.76, 0.72, 0.68, 0.44, 0.41, 0.44, 0.76, 0.72, 0.68);

        // Tri 2: t1, b0, b1
        positions.push(t1.x, t1.y, t1.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z);
        uvs.push(uB, vTopB, uA, Math.max(0, vTopA - 0.04), uB, Math.max(0, vTopB - 0.04));
        colors.push(0.76, 0.72, 0.68, 0.44, 0.41, 0.44, 0.44, 0.41, 0.44);
      }
    }

    if (positions.length === 0) continue;

    const fillGeometry = new THREE.BufferGeometry();
    fillGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    fillGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    fillGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    fillGeometry.computeVertexNormals();
    fillGeometry.computeBoundingSphere();

    const borderGeometry = new THREE.BufferGeometry();
    borderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
    borderGeometry.computeBoundingSphere();

    results.push({
      isoId,
      englishName,
      fillGeometry,
      borderGeometry,
    });
  }

  return results;
}

export function buildGraticuleGeometry(radius = 1.0018): THREE.BufferGeometry {
  const positions: number[] = [];
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();

  // Parallels every 30 deg + Tropics/Polar subtle precision
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lng = -180; lng < 180; lng += 5) {
      latLngToVec3(lat, lng, radius, vA);
      latLngToVec3(lat, lng + 5, radius, vB);
      positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
    }
  }

  // Meridians every 30 deg
  for (let lng = -180; lng < 180; lng += 30) {
    for (let lat = -84; lat < 84; lat += 5) {
      latLngToVec3(lat, lng, radius, vA);
      latLngToVec3(lat + 5, lng, radius, vB);
      positions.push(vA.x, vA.y, vA.z, vB.x, vB.y, vB.z);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

export function buildAstrolabeRingGeometry(radius: number, tickCount = 72): THREE.BufferGeometry {
  const positions: number[] = [];
  const steps = 180;
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 2;
    const a1 = ((i + 1) / steps) * Math.PI * 2;
    positions.push(
      Math.cos(a0) * radius,
      0,
      Math.sin(a0) * radius,
      Math.cos(a1) * radius,
      0,
      Math.sin(a1) * radius
    );
  }
  for (let i = 0; i < tickCount; i++) {
    const a = (i / tickCount) * Math.PI * 2;
    const len = i % 6 === 0 ? 0.045 : 0.02;
    const rOut = radius + len;
    positions.push(
      Math.cos(a) * radius,
      0,
      Math.sin(a) * radius,
      Math.cos(a) * rOut,
      0,
      Math.sin(a) * rOut
    );
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

export function buildGreatCircleArcGeometry(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  baseRadius = 1.015,
  maxAltitude = 0.24
): THREE.BufferGeometry {
  const start = latLngToVec3(fromLat, fromLng, 1).normalize();
  const end = latLngToVec3(toLat, toLng, 1).normalize();
  const omega = Math.acos(THREE.MathUtils.clamp(start.dot(end), -1, 1));
  const sinOmega = Math.sin(omega);

  const points: THREE.Vector3[] = [];
  const segments = 36;
  const arcScale = Math.min(1, omega / Math.PI) * maxAltitude + 0.035;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const dir = new THREE.Vector3();
    if (sinOmega < 1e-4) {
      dir.copy(start);
    } else {
      const w1 = Math.sin((1 - t) * omega) / sinOmega;
      const w2 = Math.sin(t * omega) / sinOmega;
      dir.copy(start).multiplyScalar(w1).addScaledVector(end, w2).normalize();
    }
    const r = baseRadius + Math.sin(t * Math.PI) * arcScale;
    points.push(dir.multiplyScalar(r));
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const sampled = curve.getPoints(40);
  return new THREE.BufferGeometry().setFromPoints(sampled);
}

export function buildGreatCircleNetworkTubeGeometry(
  fromLat: number,
  fromLng: number,
  fromRadius: number,
  toLat: number,
  toLng: number,
  toRadius: number,
  tubeRadius: number,
  maxAltitude = 0.2
): THREE.TubeGeometry {
  const start = latLngToVec3(fromLat, fromLng, 1).normalize();
  const end = latLngToVec3(toLat, toLng, 1).normalize();
  const omega = Math.acos(THREE.MathUtils.clamp(start.dot(end), -1, 1));
  const sinOmega = Math.sin(omega);

  const points: THREE.Vector3[] = [];
  const segments = 24;
  const arcScale = Math.min(1, omega / Math.PI) * maxAltitude + 0.028;

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const dir = new THREE.Vector3();
    if (sinOmega < 1e-4) {
      dir.copy(start);
    } else {
      const w1 = Math.sin((1 - t) * omega) / sinOmega;
      const w2 = Math.sin(t * omega) / sinOmega;
      dir.copy(start).multiplyScalar(w1).addScaledVector(end, w2).normalize();
    }
    const baseR = fromRadius + (toRadius - fromRadius) * t;
    const r = baseR + Math.sin(t * Math.PI) * arcScale;
    points.push(dir.multiplyScalar(r));
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const tubularSegments = Math.max(20, Math.round((omega / Math.PI) * 44));
  return new THREE.TubeGeometry(curve, tubularSegments, tubeRadius, 6, false);
}

