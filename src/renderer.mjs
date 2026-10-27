import * as THREE from "three";
import * as G from "./cube.mjs";
import { clampPitch, viewTurn } from "./vendor/orbit-input.mjs";
const spacing = 0.52;
const v = (a) => new THREE.Vector3(...a);
const basis = (s) =>
  new THREE.Matrix4().makeBasis(v(G.cross(s.up, s.n)), v(s.up), v(s.n));
const segmentPaths = [
  "M64 40H192L176 56H80Z",
  "M200 48V120L184 112V64Z",
  "M200 136V208L184 192V144Z",
  "M192 216H64L80 200H176Z",
  "M56 208V136L72 144V192Z",
  "M56 120V48L72 64V112Z",
  "M68 120H188L176 136H80Z",
];
const active = [
  "abcdef",
  "bc",
  "abdeg",
  "abcdg",
  "bcfg",
  "acdfg",
  "acdefg",
  "abc",
  "abcdefg",
  "abcdfg",
];
export function digitSvg(digit) {
  const paths =
    digit === " "
      ? ""
      : segmentPaths
          .filter((_, i) => active[Number(digit)].includes("abcdefg"[i]))
          .map((d) => `<path d="${d}"/>`)
          .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" fill="#fffdf6"/><g fill="#1d4771">${paths}${digit === " " ? "" : '<rect x="112" y="232" width="32" height="4" rx="2"/>'}</g></svg>`;
}
function canvas() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  return c;
}
async function svgCanvas(svg) {
  const img = new Image(),
    url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    await new Promise((ok, no) => {
      img.onload = ok;
      img.onerror = no;
      img.src = url;
    });
    const c = canvas();
    c.getContext("2d").drawImage(img, 0, 0);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function makeImages(label) {
  await document.fonts.load("600 40px Counter Sans");
  const whole = document.createElement("canvas");
  whole.width = 512;
  whole.height = 256;
  const ctx = whole.getContext("2d");
  ctx.fillStyle = "#fffdf6";
  ctx.fillRect(0, 0, 512, 256);
  const lines = label.trim().split("\n").slice(0, 2);
  let size = lines.length === 1 ? 68 : 52;
  while (size > 10) {
    ctx.font = `600 ${size}px "Counter Sans", sans-serif`;
    if (lines.every((l) => ctx.measureText(l).width <= 464)) break;
    size--;
  }
  if (lines.some((line) => ctx.measureText(line).width > 464))
    throw Error(
      "This label is too wide for the fixed print. Please shorten it.",
    );
  ctx.fillStyle = "#202c36";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  lines.forEach((line, i) =>
    ctx.fillText(line, 256, 128 + (i - (lines.length - 1) / 2) * (size + 12)),
  );
  const images = {};
  for (let i = 0; i < 2; i++) {
    const c = canvas();
    c.getContext("2d").drawImage(whole, i * 256, 0, 256, 256, 0, 0, 256, 256);
    images[i ? "title-right" : "title-left"] = c;
  }
  for (const digit of "0123456789 ")
    images[digit] = await svgCanvas(digitSvg(digit));
  return images;
}
export class CubeView {
  constructor(host, onState) {
    this.host = host;
    this.onState = onState;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight(0xffffff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(3, 5, 6);
    this.scene.add(light);
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 5.3;
    this.meshes = [];
    this.materials = [];
    this.textures = [];
    this.busy = false;
    this.failed = false;
    this.drag = null;
    this.onState = onState;
    this.resize = new ResizeObserver(() => {
      const width = host.clientWidth,
        height = host.clientHeight;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    });
    this.resize.observe(host);
    const el = this.renderer.domElement;
    el.setAttribute(
      "aria-label",
      "Physical 2 by 2 counter cube. Drag to orbit the camera.",
    );
    el.setAttribute("role", "img");
    el.addEventListener("pointerdown", (e) => {
      this.drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        time: e.timeStamp,
      };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      const d = viewTurn(
        e.clientX - this.drag.x,
        e.clientY - this.drag.y,
        e.timeStamp - this.drag.time,
      );
      this.yaw -= d.yaw;
      this.pitch = clampPitch(this.pitch + d.pitch);
      this.drag = {
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        time: e.timeStamp,
      };
    });
    const release = () => (this.drag = null);
    el.addEventListener("pointerup", release);
    el.addEventListener("pointercancel", release);
    el.addEventListener("lostpointercapture", release);
    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.radius = Math.max(
          3.4,
          Math.min(9, this.radius + e.deltaY * 0.005),
        );
      },
      { passive: false },
    );
    this.renderer.setAnimationLoop(() => {
      this.camera.position.set(
        Math.sin(this.yaw) * Math.cos(this.pitch) * this.radius,
        Math.sin(this.pitch) * this.radius,
        Math.cos(this.yaw) * Math.cos(this.pitch) * this.radius,
      );
      this.camera.lookAt(0, 0, 0);
      this.renderer.render(this.scene, this.camera);
    });
  }
  resetCamera() {
    this.yaw = 0;
    this.pitch = 0;
    this.radius = 5.3;
  }
  async configure(proof, label, padded, value = 15) {
    if (this.busy)
      throw Error(
        "Wait for the current turn to finish before applying a new print.",
      );
    const images = await makeImages(label);
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    this.meshes = [];
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.materials = [];
    this.textures = [];
    this.proof = proof;
    this.padded = padded;
    this.printing = (padded ? proof.printing : proof.unpaddedPrinting).map(
      (s) => ({ ...s }),
    );
    this.words = proof.witnesses.map((w) => w.word);
    this.current = value;
    this.desired = value;
    this.state = G.apply(this.printing, this.words[value]);
    const maps = Object.fromEntries(
      Object.entries(images).map(([id, image]) => {
        const texture = new THREE.CanvasTexture(image);
        texture.colorSpace = THREE.SRGBColorSpace;
        this.textures.push(texture);
        return [id, texture];
      }),
    );
    const plastic = new THREE.MeshStandardMaterial({
      color: 0x202329,
      roughness: 0.45,
    });
    this.materials.push(plastic);
    for (let c = 0; c < 8; c++) {
      const group = new THREE.Group(),
        body = new THREE.Mesh(new THREE.BoxGeometry(0.99, 0.99, 0.99), plastic);
      group.add(body);
      for (const s of this.printing.filter((s) => s.cubie === c)) {
        const material = new THREE.MeshStandardMaterial({
          map: maps[s.image],
          roughness: 0.7,
        });
        this.materials.push(material);
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(0.87, 0.87),
          material,
        );
        plane.position.copy(v(s.n).multiplyScalar(0.501));
        plane.quaternion.setFromRotationMatrix(basis(s));
        group.add(plane);
      }
      this.scene.add(group);
      this.meshes.push(group);
    }
    this.syncMeshes();
    this.onState(this.current, false);
  }
  syncMeshes() {
    for (let c = 0; c < 8; c++) {
      const a = this.printing.find((s) => s.cubie === c),
        b = this.state.find((s) => s.id === a.id),
        matrix = basis(b).multiply(basis(a).transpose());
      this.meshes[c].position.copy(v(b.p).multiplyScalar(spacing));
      this.meshes[c].quaternion.setFromRotationMatrix(matrix);
    }
  }
  request(value) {
    this.desired = value;
    if (!this.busy) void this.drain();
  }
  async drain() {
    this.busy = true;
    this.onState(this.current, true);
    try {
      while (this.current !== this.desired) {
        const target = this.desired,
          word = G.inverse(this.words[this.current]) + " " + this.words[target];
        for (const move of word.trim().split(/\s+/))
          await this.animateMove(move);
        G.assertDisplay(this.state, target, this.padded);
        this.current = target;
        this.onState(target, true);
      }
    } catch (error) {
      this.failed = true;
      this.onState(this.current, false, error);
    } finally {
      this.busy = false;
      if (!this.failed) this.onState(this.current, false);
    }
  }
  async animateMove(notation) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      this.state = G.move(this.state, notation);
      this.syncMeshes();
      return;
    }
    const m = /^([RLUDFB])(2|')?$/.exec(notation),
      [axis, layer, dir] = G.FACES[m[1]],
      angle = ((m[2] === "2" ? 2 : m[2] === "'" ? -1 : 1) * dir * Math.PI) / 2;
    const selected = [
        ...new Set(
          this.state.filter((s) => s.p[axis] === layer).map((s) => s.cubie),
        ),
      ],
      pivot = new THREE.Group();
    this.scene.add(pivot);
    for (const c of selected) pivot.add(this.meshes[c]);
    const start = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const t = Math.min(1, (now - start) / 75);
        pivot.rotation[["x", "y", "z"][axis]] = angle * (t * t * (3 - 2 * t));
        if (t < 1) requestAnimationFrame(tick);
        else resolve();
      };
      requestAnimationFrame(tick);
    });
    this.state = G.move(this.state, notation);
    for (const c of selected) {
      this.scene.add(this.meshes[c]);
    }
    this.scene.remove(pivot);
    this.syncMeshes();
  }
}
