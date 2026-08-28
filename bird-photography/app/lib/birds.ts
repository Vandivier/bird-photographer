export const SCENE_W = 800;
export const SCENE_H = 500;
export const LENS_W = 280;
export const LENS_H = 180;
export const BIRD_W = 88;
export const BIRD_H = 44;

export type Species = {
  id: string;
  name: string;
  bg: string;
  text: string;
};

export const SPECIES: Species[] = [
  { id: "bluebird", name: "bluebird", bg: "#0ea5e9", text: "#ffffff" },
  { id: "redbird", name: "redbird", bg: "#dc2626", text: "#ffffff" },
  { id: "crow", name: "crow", bg: "#1f2937", text: "#ffffff" },
  { id: "goldfinch", name: "goldfinch", bg: "#eab308", text: "#1f2937" },
  { id: "oriole", name: "oriole", bg: "#f97316", text: "#ffffff" },
  { id: "sparrow", name: "sparrow", bg: "#a16207", text: "#ffffff" },
  { id: "hummingbird", name: "hummingbird", bg: "#10b981", text: "#ffffff" },
  { id: "dove", name: "dove", bg: "#e5e7eb", text: "#374151" },
];

export type BirdState = {
  key: number;
  species: Species;
  x: number;
  y: number;
  vx: number;
  vy: number;
  bobPhase: number;
  bobAmp: number;
};

export type Cloud = { x: number; y: number; w: number; h: number; opacity: number };
export type Hill = { x: number; w: number; h: number; color: string };
export type Tree = { x: number; trunkH: number; crownR: number; crown: string };

export type Scene = {
  skyFrom: string;
  skyTo: string;
  orb: { x: number; y: number; r: number; color: string; glow: string };
  clouds: Cloud[];
  hills: Hill[];
  trees: Tree[];
  ground: string;
  label: string;
};

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

const PALETTES = [
  {
    label: "midday meadow",
    skyFrom: "#7dd3fc",
    skyTo: "#e0f2fe",
    orb: { color: "#fde047", glow: "rgba(253, 224, 71, 0.6)" },
    hillColors: ["#4d7c0f", "#65a30d", "#3f6212"],
    crowns: ["#166534", "#15803d", "#14532d"],
    ground: "#84cc16",
    cloudOpacity: 0.9,
  },
  {
    label: "golden sunset",
    skyFrom: "#c2410c",
    skyTo: "#fde68a",
    orb: { color: "#fb923c", glow: "rgba(251, 146, 60, 0.7)" },
    hillColors: ["#713f12", "#854d0e", "#57320d"],
    crowns: ["#3f6212", "#4d7c0f", "#365314"],
    ground: "#a16207",
    cloudOpacity: 0.55,
  },
  {
    label: "misty morning",
    skyFrom: "#94a3b8",
    skyTo: "#e2e8f0",
    orb: { color: "#f1f5f9", glow: "rgba(241, 245, 249, 0.5)" },
    hillColors: ["#475569", "#64748b", "#334155"],
    crowns: ["#3f6212", "#4d7c0f", "#166534"],
    ground: "#65a30d",
    cloudOpacity: 0.95,
  },
  {
    label: "moonlit night",
    skyFrom: "#0f172a",
    skyTo: "#334155",
    orb: { color: "#e2e8f0", glow: "rgba(226, 232, 240, 0.4)" },
    hillColors: ["#1e293b", "#334155", "#0f172a"],
    crowns: ["#14532d", "#166534", "#052e16"],
    ground: "#1a2e05",
    cloudOpacity: 0.25,
  },
];

export function generateScene(): Scene {
  const p = pick(PALETTES);

  const clouds: Cloud[] = Array.from({ length: Math.floor(rand(3, 7)) }, () => ({
    x: rand(-40, SCENE_W - 60),
    y: rand(10, SCENE_H * 0.35),
    w: rand(80, 180),
    h: rand(22, 44),
    opacity: p.cloudOpacity * rand(0.7, 1),
  }));

  const hills: Hill[] = Array.from({ length: Math.floor(rand(2, 4)) }, (_, i) => ({
    x: rand(-100, SCENE_W - 150),
    w: rand(300, 550),
    h: rand(90, 180),
    color: p.hillColors[i % p.hillColors.length],
  }));

  const trees: Tree[] = Array.from({ length: Math.floor(rand(3, 8)) }, () => ({
    x: rand(10, SCENE_W - 60),
    trunkH: rand(30, 60),
    crownR: rand(22, 42),
    crown: pick(p.crowns),
  }));

  return {
    skyFrom: p.skyFrom,
    skyTo: p.skyTo,
    orb: {
      x: rand(60, SCENE_W - 120),
      y: rand(30, 120),
      r: rand(28, 44),
      color: p.orb.color,
      glow: p.orb.glow,
    },
    clouds,
    hills,
    trees,
    ground: p.ground,
    label: p.label,
  };
}

export function spawnBirds(count: number): BirdState[] {
  const shuffled = [...SPECIES].sort(() => Math.random() - 0.5);
  return Array.from({ length: count }, (_, i) => {
    const dir = Math.random() < 0.5 ? -1 : 1;
    return {
      key: i,
      species: shuffled[i % shuffled.length],
      x: rand(0, SCENE_W - BIRD_W),
      y: rand(20, SCENE_H - 160),
      vx: dir * rand(40, 120),
      vy: rand(-15, 15),
      bobPhase: rand(0, Math.PI * 2),
      bobAmp: rand(6, 16),
    };
  });
}
