"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SceneView from "./components/SceneView";
import {
  BIRD_H,
  BIRD_W,
  LENS_H,
  LENS_W,
  SCENE_H,
  SCENE_W,
  generateScene,
  spawnBirds,
  type BirdState,
  type Scene,
} from "./lib/birds";

type Photo = {
  id: number;
  scene: Scene;
  birds: BirdState[];
  lensX: number;
  lensY: number;
  captured: string[];
  takenAt: string;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

function stepBirds(birds: BirdState[], dt: number, now: number): BirdState[] {
  return birds.map((b) => {
    let { x, y, vx, vy } = b;
    x += vx * dt;
    y += (vy + Math.sin(now / 400 + b.bobPhase) * b.bobAmp) * dt;

    if (x < 0 || x > SCENE_W - BIRD_W) {
      vx = -vx;
      x = clamp(x, 0, SCENE_W - BIRD_W);
    }
    if (y < 10 || y > SCENE_H - 140) {
      vy = -vy;
      y = clamp(y, 10, SCENE_H - 140);
    }
    // Occasional random drift change so flight paths don't look mechanical.
    if (Math.random() < dt * 0.4) {
      vy = clamp(vy + (Math.random() - 0.5) * 40, -30, 30);
    }
    return { ...b, x, y, vx, vy };
  });
}

export default function Home() {
  const [scene, setScene] = useState<Scene | null>(null);
  const [birds, setBirds] = useState<BirdState[]>([]);
  const [lens, setLens] = useState({
    x: (SCENE_W - LENS_W) / 2,
    y: (SCENE_H - LENS_H) / 2,
  });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [flash, setFlash] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const birdsRef = useRef<BirdState[]>([]);
  const lensRef = useRef(lens);
  const sceneRef = useRef<Scene | null>(null);
  const photoId = useRef(0);

  birdsRef.current = birds;
  lensRef.current = lens;
  sceneRef.current = scene;

  const newScene = useCallback(() => {
    setScene(generateScene());
    setBirds(spawnBirds(6));
  }, []);

  // Scene is random, so generate it after mount to avoid an SSR hydration mismatch.
  useEffect(() => {
    newScene();
  }, [newScene]);

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      setBirds((prev) => stepBirds(prev, dt, now));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const moveLens = (e: React.MouseEvent) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLens({
      x: clamp(e.clientX - rect.left - LENS_W / 2, 0, SCENE_W - LENS_W),
      y: clamp(e.clientY - rect.top - LENS_H / 2, 0, SCENE_H - LENS_H),
    });
  };

  const snapPhoto = useCallback(() => {
    const s = sceneRef.current;
    if (!s) return;
    const { x, y } = lensRef.current;
    const frozen = birdsRef.current.map((b) => ({ ...b }));
    const captured = frozen
      .filter(
        (b) => b.x + BIRD_W > x && b.x < x + LENS_W && b.y + BIRD_H > y && b.y < y + LENS_H
      )
      .map((b) => b.species.name);
    setPhotos((prev) => [
      {
        id: photoId.current++,
        scene: s,
        birds: frozen,
        lensX: x,
        lensY: y,
        captured,
        takenAt: new Date().toLocaleTimeString(),
      },
      ...prev,
    ]);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 p-6">
      <header className="flex w-full items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bird Photographer</h1>
          <p className="text-sm opacity-70">
            Move your mouse to aim the lens, then snap a photo.
            {scene ? ` Current scene: ${scene.label}.` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={newScene}
            className="rounded-lg border border-foreground/20 px-4 py-2 text-sm font-medium hover:bg-foreground/10"
          >
            New Scene
          </button>
          <button
            onClick={snapPhoto}
            className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-80"
          >
            📷 Snap Photo
          </button>
        </div>
      </header>

      <div
        ref={viewportRef}
        onMouseMove={moveLens}
        onClick={snapPhoto}
        className="relative cursor-crosshair select-none overflow-hidden rounded-xl border border-foreground/20 shadow-lg"
        style={{ width: SCENE_W, height: SCENE_H }}
      >
        {scene ? (
          <>
            <SceneView scene={scene} birds={birds} animateWings />
            {/* Camera lens: outline box + dimmed surroundings */}
            <div
              className="pointer-events-none absolute z-10 border-4 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
              style={{ left: lens.x, top: lens.y, width: LENS_W, height: LENS_H }}
            >
              <div className="absolute left-1 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-mono text-white">
                REC ●
              </div>
              <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-white/70" />
              <div className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-white/70" />
            </div>
            {flash && <div className="absolute inset-0 z-20 bg-white/80" />}
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm opacity-60">
            Loading scene…
          </div>
        )}
      </div>

      <section className="w-full">
        <h2 className="mb-3 text-lg font-semibold">
          Photo Gallery {photos.length > 0 && `(${photos.length})`}
        </h2>
        {photos.length === 0 ? (
          <p className="text-sm opacity-60">
            No photos yet — line up a bird in the lens and snap one!
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {photos.map((p) => (
              <figure key={p.id} className="flex flex-col gap-1">
                <div
                  className="relative overflow-hidden rounded-lg border-4 border-white shadow-md"
                  style={{ width: LENS_W, height: LENS_H }}
                >
                  <div
                    className="absolute"
                    style={{
                      left: -p.lensX,
                      top: -p.lensY,
                      width: SCENE_W,
                      height: SCENE_H,
                    }}
                  >
                    <SceneView scene={p.scene} birds={p.birds} />
                  </div>
                </div>
                <figcaption className="text-xs opacity-70" style={{ maxWidth: LENS_W }}>
                  {p.takenAt} —{" "}
                  {p.captured.length > 0
                    ? `captured: ${p.captured.join(", ")}`
                    : "just scenery, no birds"}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
