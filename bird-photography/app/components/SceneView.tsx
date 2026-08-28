import { useState } from "react";
import {
  BIRD_H,
  BIRD_W,
  SCENE_H,
  SCENE_W,
  type BirdState,
  type Scene,
} from "../lib/birds";

function BirdSprite({ bird, animateWings }: { bird: BirdState; animateWings: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const flip = bird.vx < 0;

  return (
    <div
      className={`absolute ${animateWings ? "animate-pulse" : ""}`}
      style={{ left: bird.x, top: bird.y, width: BIRD_W, height: BIRD_H }}
    >
      {imageFailed ? (
        <div
          className="flex h-full w-full items-center justify-center rounded-lg border-2 border-black/20 text-center text-sm font-semibold shadow-md"
          style={{ background: bird.species.bg, color: bird.species.text }}
        >
          {bird.species.name}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bird.species.imageUri}
          alt={bird.species.name}
          draggable={false}
          onError={() => setImageFailed(true)}
          className="h-full w-full object-contain drop-shadow-md"
          style={flip ? { transform: "scaleX(-1)" } : undefined}
        />
      )}
    </div>
  );
}

type Props = {
  scene: Scene;
  birds: BirdState[];
  animateWings?: boolean;
};

// Renders one full scene (background + birds) at natural SCENE_W x SCENE_H size.
// Used for the live animated view and, clipped, for snapped photos.
export default function SceneView({ scene, birds, animateWings = false }: Props) {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        width: SCENE_W,
        height: SCENE_H,
        background: `linear-gradient(to bottom, ${scene.skyFrom}, ${scene.skyTo})`,
      }}
    >
      <div
        className="absolute rounded-full"
        style={{
          left: scene.orb.x,
          top: scene.orb.y,
          width: scene.orb.r * 2,
          height: scene.orb.r * 2,
          background: scene.orb.color,
          boxShadow: `0 0 60px 20px ${scene.orb.glow}`,
        }}
      />

      {scene.clouds.map((c, i) => (
        <div
          key={`cloud-${i}`}
          className="absolute rounded-full bg-white"
          style={{ left: c.x, top: c.y, width: c.w, height: c.h, opacity: c.opacity }}
        />
      ))}

      {scene.hills.map((h, i) => (
        <div
          key={`hill-${i}`}
          className="absolute rounded-t-full"
          style={{
            left: h.x,
            bottom: 24,
            width: h.w,
            height: h.h,
            background: h.color,
          }}
        />
      ))}

      <div
        className="absolute inset-x-0 bottom-0"
        style={{ height: 28, background: scene.ground }}
      />

      {scene.trees.map((t, i) => (
        <div key={`tree-${i}`} className="absolute" style={{ left: t.x, bottom: 26 }}>
          <div
            className="absolute rounded-full"
            style={{
              left: 4 - t.crownR,
              bottom: t.trunkH - 8,
              width: t.crownR * 2,
              height: t.crownR * 2,
              background: t.crown,
            }}
          />
          <div
            className="absolute bottom-0"
            style={{ width: 8, height: t.trunkH, background: "#57320d" }}
          />
        </div>
      ))}

      {birds.map((b) => (
        <BirdSprite key={b.key} bird={b} animateWings={animateWings} />
      ))}
    </div>
  );
}
