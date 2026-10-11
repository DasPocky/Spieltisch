/**
 * Echte Würfelphysik (cannon-es): Schwerkraft, Abprallen an Bande und anderen Würfeln, Reibung, Ausrollen.
 * Der Wurf wird vorab durchgerechnet (60 Bilder/s) und dann abgespielt. Das Ergebnis selbst kommt immer
 * aus der fairen Spiellogik: Danach wird die Beschriftung des Würfels per echter Würfeldrehung so gelegt,
 * dass die gewürfelte Zahl auf der gelandeten Oberseite steht – gegenüberliegende Seiten ergeben weiter 7,
 * 1-2-3 bleiben gegen den Uhrzeigersinn um eine Ecke wie bei echten Würfeln.
 */
import { Body, Box, ContactMaterial, Material, Plane, Quaternion, Vec3, World } from "cannon-es";

/** x, y (hoch), z, Quaternion x, y, z, w – Einheit: Würfelkante = 1 */
export type Pose = [number, number, number, number, number, number, number];

/** Grundbelegung: Körperachse → Augenzahl (gegenüber 7, rechtsdrehend) */
export const FACES: [axis: [number, number, number], value: number][] = [
  [[0, 0, 1], 1], [[0, 0, -1], 6], [[1, 0, 0], 2], [[-1, 0, 0], 5], [[0, 1, 0], 3], [[0, -1, 0], 4],
];

const HALF = 0.5;

/** Kleiner Zufallsgenerator mit Startwert – derselbe Wurf sieht beim Neuladen gleich aus */
function rng(seed: number) {
  let s = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function seedOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

const quat = (p: Pose) => new Quaternion(p[3], p[4], p[5], p[6]);

/** Wie gerade liegt der Würfel? 1 = eine Seite genau oben */
export function flatness(p: Pose): number {
  const q = quat(p);
  return Math.max(...FACES.map(([a]) => q.vmult(new Vec3(...a)).y));
}

/**
 * Wurf berechnen. `rest[i]` = Würfel bleibt liegen (gehalten) an dieser Stelle; die anderen fliegen.
 * Tisch: halbe Breite `w` und halbe Tiefe `d` in Würfelkanten. Geworfen wird von vorn (z = +d).
 */
/** Wie geworfen wird: Kraft 0..1 (kurz tippen sanft, lange halten / schnell wischen kräftig), Richtung −1 (links) … 1 (rechts) */
export interface Throw { power: number; aim: number }
export const SOFT_THROW: Throw = { power: 0.35, aim: 0 };

export function simulate(n: number, rest: (Pose | null)[], seed: number, w: number, d: number, how: Throw = SOFT_THROW): Pose[][] {
  // Bleibt ein Würfel schräg liegen (angelehnt), gilt der Wurf wie am echten Tisch nicht – neu werfen
  let best: Pose[][] = [];
  for (let attempt = 0; attempt < 8; attempt++) {
    const frames = run(n, rest, seed + attempt * 7919, w, d, how);
    best = frames;
    // Gültig: alle flach und auf dem Tisch (nicht auf einem anderen Würfel gestapelt)
    if (frames.at(-1)!.every((p, i) => rest[i] || (flatness(p) > 0.995 && p[1] < 0.6))) break;
  }
  return best;
}

function run(n: number, rest: (Pose | null)[], seed: number, w: number, d: number, how: Throw): Pose[][] {
  const rnd = rng(seed);
  const p = Math.min(1, Math.max(0, how.power)), aim = Math.min(1, Math.max(-1, how.aim));
  const world = new World({ gravity: new Vec3(0, -9.82 * 7, 0), allowSleep: true });
  const mDie = new Material(), mFloor = new Material(), mWall = new Material();
  world.addContactMaterial(new ContactMaterial(mDie, mFloor, { friction: 0.45, restitution: 0.3 }));
  world.addContactMaterial(new ContactMaterial(mDie, mWall, { friction: 0.1, restitution: 0.55 }));
  world.addContactMaterial(new ContactMaterial(mDie, mDie, { friction: 0.12, restitution: 0.45 }));
  const plane = (x: number, y: number, z: number, axis: [number, number, number], ang: number, mat: Material) => {
    const b = new Body({ mass: 0, material: mat, shape: new Plane() });
    b.position.set(x, y, z);
    b.quaternion.setFromAxisAngle(new Vec3(...axis), ang);
    world.addBody(b);
  };
  plane(0, 0, 0, [1, 0, 0], -Math.PI / 2, mFloor);
  plane(-w, 0, 0, [0, 1, 0], Math.PI / 2, mWall);
  plane(w, 0, 0, [0, 1, 0], -Math.PI / 2, mWall);
  plane(0, 0, -d, [0, 1, 0], 0, mWall);
  plane(0, 0, d, [0, 1, 0], Math.PI, mWall);

  const bodies: Body[] = [];
  let thrown = 0;
  for (let i = 0; i < n; i++) {
    const r = rest[i];
    const b = new Body({
      mass: r ? 0 : 1, material: mDie, shape: new Box(new Vec3(HALF, HALF, HALF)),
      linearDamping: 0.3, angularDamping: 0.45, sleepSpeedLimit: 0.5, sleepTimeLimit: 0.2,
    });
    if (r) {
      b.position.set(r[0], r[1], r[2]);
      b.quaternion.set(r[3], r[4], r[5], r[6]);
    } else {
      // Aus der Hand: vorn, über dem Tisch (kräftige Würfe höher – sie fliegen sichtbar aus dem Kasten heraus),
      // Richtung und Kraft aus der Geste, dazu etwas Streuung wie bei einer echten Hand
      const k = thrown++;
      b.position.set(-w * 0.6 + aim * w * 0.25 + (k % 3) * 1.15 + rnd() * 0.3, 1.2 + p * 2.2 + Math.floor(k / 3) * 1.1 + rnd() * 0.4, d - 0.65 - rnd() * 0.15);
      b.quaternion.setFromEuler(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28);
      const speed = 0.7 + p * 0.9;
      b.velocity.set(((rnd() - 0.2) * (2 + w * 0.8) + aim * (3 + 6 * p)) * 0.8, 0.5 + rnd() * 1.5 + p * 7, -(2.5 + rnd() * 2 + d * 2.2) * speed);
      const spin = 18 + p * 26;
      b.angularVelocity.set((rnd() - 0.5) * spin, (rnd() - 0.5) * spin, (rnd() - 0.5) * spin);
    }
    world.addBody(b);
    bodies.push(b);
  }
  const frames: Pose[][] = [];
  // Höchstens 2,5 s – was dann noch kippelt, fällt per settle() flach (siehe unten)
  for (let k = 0; k < 150; k++) {
    world.step(1 / 60);
    frames.push(bodies.map((b) => [b.position.x, b.position.y, b.position.z, b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w]));
    if (k > 20 && bodies.every((b) => b.mass === 0 || b.sleepState === Body.SLEEPING)) break;
  }
  return settle(frames, rest);
}

/**
 * Lehnt ein Würfel am Ende schräg (an der Bande oder einem anderen Würfel), kippt er wie am echten Tisch
 * auf die nächstliegende Seite: ein paar Bilder Drehung um die waagrechte Achse, bis er flach aufliegt.
 */
function settle(frames: Pose[][], rest: (Pose | null)[]): Pose[][] {
  const last = frames.at(-1)!;
  const fix = last.map((p, i) => {
    if (rest[i] || flatness(p) > 0.995) return null;
    const q = quat(p);
    let up = new Vec3(0, 1, 0), best = -2;
    for (const [a] of FACES) { const v = q.vmult(new Vec3(...a)); if (v.y > best) { best = v.y; up = v; } }
    const turn = new Quaternion().setFromVectors(up, new Vec3(0, 1, 0));
    return { from: p, to: turn.mult(q) };
  });
  if (fix.every((f) => !f)) return frames;
  const steps = 10;
  for (let k = 1; k <= steps; k++) {
    const t = k / steps, e = t * t;
    frames.push(last.map((p, i) => {
      const f = fix[i];
      if (!f) return p;
      const q = new Quaternion();
      quat(f.from).slerp(f.to, e, q);
      return [p[0], p[1] + (0.5 - p[1]) * e, p[2], q.x, q.y, q.z, q.w];
    }));
  }
  return frames;
}

/**
 * Drehung der Beschriftung, damit `value` nach der Landung oben steht.
 * Liefert für jede Seite (Index wie FACES) die Normale und die „Oben“-Richtung des Augenbilds in Körperkoordinaten.
 */
export function labelFaces(final: Pose, value: number): { n: [number, number, number]; t: [number, number, number]; value: number }[] {
  const q = quat(final);
  let up: [number, number, number] = [0, 1, 0], best = -2;
  for (const [a] of FACES) { const y = q.vmult(new Vec3(...a)).y; if (y > best) { best = y; up = a; } }
  const want = FACES.find(([, v]) => v === value)?.[0] ?? FACES[0][0];
  const from = new Vec3(...want), to = new Vec3(...up);
  const r = new Quaternion();
  if (from.dot(to) < -0.5) r.setFromAxisAngle(Math.abs(from.x) < 0.5 ? new Vec3(1, 0, 0) : new Vec3(0, 1, 0), Math.PI);
  else r.setFromVectors(from, to);
  const round = (v: Vec3): [number, number, number] => [Math.round(v.x), Math.round(v.y), Math.round(v.z)];
  return FACES.map(([a, v]) => {
    const t0: [number, number, number] = Math.abs(a[1]) > 0.5 ? [0, 0, 1] : [0, 1, 0];
    return { n: round(r.vmult(new Vec3(...a))), t: round(r.vmult(new Vec3(...t0))), value: v };
  });
}

/** Welche Seite (Wert) zeigt in dieser Lage nach oben – für Prüfungen */
export function topValue(p: Pose, faces: { n: [number, number, number]; value: number }[]): number {
  const q = quat(p);
  let best = -2, v = 0;
  for (const f of faces) { const y = q.vmult(new Vec3(...f.n)).y; if (y > best) { best = y; v = f.value; } }
  return v;
}

/** Normale einer Seite in Weltkoordinaten (für Licht) */
export function worldNormal(p: Pose, n: [number, number, number]): [number, number, number] {
  const v = quat(p).vmult(new Vec3(...n));
  return [v.x, v.y, v.z];
}

/** Drehmatrix der Lage (Spalten = Bilder der Körperachsen) */
export function axes(p: Pose): number[] {
  const q = quat(p);
  const X = q.vmult(new Vec3(1, 0, 0)), Y = q.vmult(new Vec3(0, 1, 0)), Z = q.vmult(new Vec3(0, 0, 1));
  return [X.x, X.y, X.z, Y.x, Y.y, Y.z, Z.x, Z.y, Z.z];
}
