#!/usr/bin/env python3
"""Gera public/maps/mission-02/03/04.tmj (80×45).

Uso:
  python3 scripts/generate-mission-maps.py

Se existirem scripts/map-payloads/*.tmj.z64 (zlib+base64), usa-os;
senão regenera a partir dos seeds determinísticos.
"""
from __future__ import annotations
import base64, json, random, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "maps"
PAYLOADS = Path(__file__).resolve().parent / "map-payloads"

W, H = 80, 45
TILE = {
    "grass": 1, "asphalt": 2, "dirt": 3, "sidewalk": 4,
    "timber": 5, "concrete": 6, "scrub": 7, "rubble": 8,
    "grass2": 9, "coarse": 10, "dry": 11, "shaded": 12, "gravel": 16,
}

def idx(c, r):
    return r * W + c

def fill_rect(data, c0, r0, c1, r1, tid):
    for r in range(r0, r1):
        for c in range(c0, c1):
            if 0 <= c < W and 0 <= r < H:
                data[idx(c, r)] = tid

def stamp_building(ground, structures, cx, cy, bw, bh, courtyard=False):
    fill_rect(ground, cx - 1, cy - 1, cx + bw + 1, cy + bh + 1, TILE["sidewalk"])
    fill_rect(structures, cx, cy, cx + bw, cy + bh, TILE["timber"])
    fill_rect(structures, cx + 1, cy + 1, cx + bw - 1, cy + bh - 1, TILE["concrete"])
    if courtyard:
        fill_rect(structures, cx + 2, cy + 2, cx + bw - 2, cy + bh - 2, 0)
        fill_rect(ground, cx + 2, cy + 2, cx + bw - 2, cy + bh - 2, TILE["grass2"])

def road_h(ground, r, c0, c1):
    for c in range(c0, c1):
        if 0 <= c < W and 0 <= r < H:
            ground[idx(c, r)] = TILE["asphalt"]
            if r + 1 < H:
                ground[idx(c, r + 1)] = TILE["asphalt"]

def road_v(ground, c, r0, r1):
    for r in range(r0, r1):
        if 0 <= c < W and 0 <= r < H:
            ground[idx(c, r)] = TILE["asphalt"]
            if c + 1 < W:
                ground[idx(c + 1, r)] = TILE["asphalt"]

def make_map(seed, theme):
    rng = random.Random(seed)
    ground = [TILE["grass"]] * (W * H)
    for r in range(H):
        for c in range(W):
            v = rng.random()
            if v < 0.18: ground[idx(c, r)] = TILE["grass2"]
            elif v < 0.32: ground[idx(c, r)] = TILE["coarse"]
            elif v < 0.42: ground[idx(c, r)] = TILE["dry"]
            elif v < 0.5: ground[idx(c, r)] = TILE["shaded"]
    terrain = [0] * (W * H)
    structures = [0] * (W * H)
    if theme == "suburb":
        road_h(ground, 20, 0, W); road_h(ground, 32, 0, W)
        road_v(ground, 24, 0, H); road_v(ground, 48, 0, H)
        for cx, cy in [(8, 6), (36, 6), (56, 6), (8, 24), (36, 24), (56, 24)]:
            stamp_building(ground, structures, cx, cy, 10, 8)
        for _ in range(12):
            terrain[idx(rng.randint(2, W - 4), rng.randint(2, H - 4))] = TILE["scrub"]
        for c in range(10, 40):
            ground[idx(c, 12)] = TILE["dirt"]
        collisions = [
            {"height": 256, "width": 320, "x": 256, "y": 192, "name": "house-nw", "id": 1, "rotation": 0, "type": "", "visible": True},
            {"height": 256, "width": 320, "x": 1152, "y": 192, "name": "house-ne", "id": 2, "rotation": 0, "type": "", "visible": True},
            {"height": 256, "width": 320, "x": 256, "y": 768, "name": "house-sw", "id": 3, "rotation": 0, "type": "", "visible": True},
        ]
        entrances = [
            {"height": 32, "width": 64, "x": 352, "y": 448, "name": "front-door", "type": "door", "id": 10, "rotation": 0, "visible": True},
            {"height": 32, "width": 48, "x": 256, "y": 288, "name": "west-window", "type": "window", "id": 11, "rotation": 0, "visible": True},
        ]
        title = "Subúrbio Residencial"
    elif theme == "industrial":
        for r in range(H):
            for c in range(W):
                if rng.random() < 0.55: ground[idx(c, r)] = TILE["asphalt"]
                elif rng.random() < 0.3: ground[idx(c, r)] = TILE["gravel"]
                else: ground[idx(c, r)] = TILE["dirt"]
        for cx, cy, bw, bh in [(6, 4, 18, 12), (32, 4, 20, 10), (56, 6, 16, 14), (10, 24, 22, 12), (40, 26, 18, 10)]:
            stamp_building(ground, structures, cx, cy, bw, bh)
            for _ in range(4):
                terrain[idx(min(W - 1, cx + rng.randint(0, bw)), min(H - 1, cy + bh + rng.randint(0, 3)))] = TILE["rubble"]
        road_h(ground, 18, 0, W); road_v(ground, 30, 0, H)
        collisions = [
            {"height": 384, "width": 576, "x": 192, "y": 128, "name": "warehouse-a", "id": 1, "rotation": 0, "type": "", "visible": True},
            {"height": 320, "width": 640, "x": 1024, "y": 128, "name": "warehouse-b", "id": 2, "rotation": 0, "type": "", "visible": True},
        ]
        entrances = [
            {"height": 32, "width": 96, "x": 400, "y": 512, "name": "loading-door", "type": "door", "id": 10, "rotation": 0, "visible": True},
            {"height": 32, "width": 48, "x": 192, "y": 256, "name": "side-window", "type": "window", "id": 11, "rotation": 0, "visible": True},
        ]
        title = "Zona Industrial"
    else:
        for r in range(H):
            for c in range(W):
                if c >= 62: ground[idx(c, r)] = TILE["shaded"]
                elif c >= 58: ground[idx(c, r)] = TILE["dirt"]
                else:
                    v = rng.random()
                    ground[idx(c, r)] = TILE["grass"] if v < 0.5 else TILE["grass2"] if v < 0.75 else TILE["coarse"]
        road_h(ground, 22, 0, 58); road_v(ground, 20, 0, H)
        stamp_building(ground, structures, 8, 8, 12, 10, courtyard=True)
        stamp_building(ground, structures, 30, 6, 10, 8)
        stamp_building(ground, structures, 8, 28, 14, 10)
        for _ in range(20):
            terrain[idx(rng.randint(40, 57), rng.randint(2, H - 3))] = TILE["scrub"]
        collisions = [
            {"height": 320, "width": 384, "x": 256, "y": 256, "name": "pavilion", "id": 1, "rotation": 0, "type": "", "visible": True},
            {"height": 256, "width": 320, "x": 960, "y": 192, "name": "house-park", "id": 2, "rotation": 0, "type": "", "visible": True},
        ]
        entrances = [
            {"height": 32, "width": 64, "x": 384, "y": 576, "name": "pavilion-door", "type": "door", "id": 10, "rotation": 0, "visible": True},
            {"height": 32, "width": 48, "x": 256, "y": 320, "name": "park-window", "type": "window", "id": 11, "rotation": 0, "visible": True},
        ]
        title = "Parque Ribeirinho"
    obstacles = [
        {"height": 48, "width": 48, "x": 480, "y": 640, "name": "rock-a", "id": 20, "rotation": 0, "type": "", "visible": True},
        {"height": 48, "width": 48, "x": 1400, "y": 700, "name": "rock-b", "id": 21, "rotation": 0, "type": "", "visible": True},
    ]
    def layer(name, lid, data):
        return {"data": data, "height": H, "width": W, "id": lid, "name": name, "opacity": 1, "type": "tilelayer", "visible": True, "x": 0, "y": 0}
    return {
        "compressionlevel": -1, "height": H, "infinite": False,
        "layers": [
            layer("Ground", 1, ground), layer("Terrain", 2, terrain), layer("Structures", 3, structures),
            {"draworder": "topdown", "id": 4, "name": "Collision", "objects": collisions, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
            {"draworder": "topdown", "id": 5, "name": "Entrances", "objects": entrances, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
            {"draworder": "topdown", "id": 6, "name": "Obstacles", "objects": obstacles, "opacity": 1, "type": "objectgroup", "visible": True, "x": 0, "y": 0},
        ],
        "nextlayerid": 7, "nextobjectid": 30, "orientation": "orthogonal", "renderorder": "right-down",
        "tiledversion": "1.10.2", "tileheight": 32, "tilewidth": 32, "type": "map", "version": "1.10", "width": W,
        "tilesets": [{"columns": 4, "firstgid": 1, "image": "../tiles/mission-tiles.svg", "imageheight": 128, "imagewidth": 128, "margin": 0, "name": "mission-tiles", "spacing": 0, "tilecount": 16, "tileheight": 32, "tilewidth": 32}],
        "properties": [{"name": "title", "type": "string", "value": title}, {"name": "theme", "type": "string", "value": theme}],
    }

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    specs = [(198, "suburb", "mission-02.tmj"), (297, "industrial", "mission-03.tmj"), (396, "riverside", "mission-04.tmj")]
    for seed, theme, name in specs:
        payload = PAYLOADS / f"{name}.z64"
        dest = OUT / name
        if payload.exists():
            dest.write_bytes(zlib.decompress(base64.b64decode(payload.read_text())))
            print(f"wrote from payload {dest}")
        else:
            dest.write_text(json.dumps(make_map(seed, theme), separators=(",", ":")))
            print(f"wrote generated {dest}")

if __name__ == "__main__":
    main()
