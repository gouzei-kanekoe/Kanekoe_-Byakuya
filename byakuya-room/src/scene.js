import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { Spring } from "./state.js";
import { LocalTouch, FaceMotion } from "./motion.js";

const warp = `uniform vec3 uTouch;uniform vec2 uPull;uniform vec3 uTouch2;uniform vec2 uPull2;uniform float uPressure;
vec3 deform(vec3 p){float w=exp(-dot(p.xy-uTouch.xy,p.xy-uTouch.xy)*5.8);float w2=exp(-dot(p.xy-uTouch2.xy,p.xy-uTouch2.xy)*5.8);p.xy+=uPull*w+uPull2*w2;vec2 inward=p.xy-uTouch.xy;p.xy-=inward*uPressure*w*.45;p.z-=uPressure*w*.25;return p;}`;
const lightVertex = `${warp} varying vec2 vLocal;void main(){vLocal=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(deform(position),1.0);}`;
const lightFragment = `uniform float uTime;uniform float uBrightness;uniform float uNight;uniform float uLayer;varying vec2 vLocal;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 p=vLocal;float angle=atan(p.y,p.x);float contour=1.0+.050*sin(angle*5.0+.8)+.036*sin(angle*9.0-1.1)+.022*sin(angle*13.0+uTime*.17);float r=length(p/vec2(1.02,.96))/contour;
float grain=hash(floor(p*310.0));float paper=sin(p.x*36.0)*sin(p.y*31.0)*.5+.5;
float alpha=(1.0-smoothstep(.60,1.30,r+(.5-grain)*.035));alpha=pow(alpha,1.15);
if(uLayer>.5)alpha=exp(-r*r*2.0)*(1.0-smoothstep(.70,1.95,r))*.16;
vec3 color=vec3(1.0)-vec3(.014,.013,.010)*(grain*.5+paper*.5)*(1.0-uNight*.5);
gl_FragColor=vec4(color,alpha*(.88+uBrightness*.1));}`;
function haloMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uStrength: { value: 0.5 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform float uStrength;uniform float uTime;varying vec2 vUv;void main(){vec2 p=(vUv-.5)*2.0;float r=length(p);float wobble=sin(atan(p.y,p.x)*7.0+uTime*.2)*.025;float a=exp(-pow(r+wobble,2.0)*5.0)*(1.0-smoothstep(.5,1.0,r));gl_FragColor=vec4(vec3(.98,.99,1.0),a*uStrength);}`,
    transparent: true,
    depthWrite: false,
  });
}

function makeAnimatedFace(uniforms) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 384;
  const context = canvas.getContext("2d"),
    texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uMap: { value: texture } },
    vertexShader: `${warp} varying vec2 vUv;void main(){vUv=uv;vec3 p=position+vec3(0.,.10,0.);gl_Position=projectionMatrix*modelViewMatrix*vec4(deform(p),1.0);}`,
    fragmentShader: `uniform sampler2D uMap;varying vec2 vUv;void main(){gl_FragColor=texture2D(uMap,vUv);
#include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(1.65, 1.65, 28, 28),
    material,
  );
  mesh.position.z = 0.2;
  mesh.renderOrder = 12;
  const motion = new FaceMotion();
  let lastPaint = 0;
  function draw(dt, mood, time) {
    const [open, bend, tilt, smile, mouth, blush] = motion.step(dt, mood);
    if (time - lastPaint < 1 / 30) return;
    lastPaint = time;
    const c = context;
    c.clearRect(0, 0, 384, 384);
    c.save();
    c.scale(0.75, 0.75);
    c.fillStyle = c.strokeStyle = "#5b5a72";
    c.lineWidth = 8;
    c.lineCap = "round";
    c.lineJoin = "round";
    // Filled narrow shapes turn into soft curved eyelids without a texture swap.
    for (const [x, sign] of [
      [174, 1],
      [338, -1],
    ]) {
      const y = 232,
        half = 9 + 9 * (1 - Math.min(open, 1)),
        height = 17 * open;
      c.beginPath();
      c.moveTo(x - half, y - tilt * sign * 12);
      c.bezierCurveTo(
        x - half * 0.5,
        y + bend * 23 - height,
        x + half * 0.5,
        y + bend * 23 - height,
        x + half,
        y + tilt * sign * 12,
      );
      c.bezierCurveTo(
        x + half * 0.5,
        y + bend * 23 + height,
        x - half * 0.5,
        y + bend * 23 + height,
        x - half,
        y - tilt * sign * 12,
      );
      c.fill();
      c.lineWidth = 4;
      c.stroke();
    }
    c.lineWidth = 8;
    const y = 294,
      depth = smile * 29;
    c.beginPath();
    c.moveTo(233, y);
    c.quadraticCurveTo(256, y + depth, 279, y);
    c.quadraticCurveTo(256, y + depth + mouth * 43, 233, y);
    c.fill();
    c.stroke();
    if (tilt) {
      c.globalAlpha = Math.abs(tilt);
      for (const [x, sign] of [
        [174, 1],
        [338, -1],
      ]) {
        c.beginPath();
        c.moveTo(x - 18, 205 - tilt * sign * 12);
        c.quadraticCurveTo(x, 202, x + 18, 205 + tilt * sign * 12);
        c.stroke();
      }
    }
    c.globalAlpha = blush;
    c.fillStyle = "#e5b3b6";
    for (const x of [143, 367]) {
      c.beginPath();
      c.ellipse(x, 279, 24, 12, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    texture.needsUpdate = true;
  }
  return { mesh, draw, motion };
}

function makeCushion() {
  const group = new THREE.Group();
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  c.fillStyle = "#a4a6ad";
  c.fillRect(0, 0, 256, 256);
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < 256; y += 2)
    for (let x = 0; x < 256; x += 2) {
      const v = 145 + random() * 40;
      c.fillStyle = `rgba(${v},${v},${v + 3},.35)`;
      c.fillRect(x, y, 1, 2);
    }
  c.strokeStyle = "rgba(255,255,255,.045)";
  c.lineWidth = 1;
  for (let i = 0; i < 256; i += 4) {
    c.beginPath();
    c.moveTo(i, 0);
    c.lineTo(i, 256);
    c.stroke();
  }
  const cloth = new THREE.CanvasTexture(canvas);
  cloth.colorSpace = THREE.SRGBColorSpace;
  cloth.wrapS = cloth.wrapT = THREE.RepeatWrapping;
  cloth.repeat.set(3, 3);
  const geometry = new RoundedBoxGeometry(2.15, 0.46, 1.8, 6, 0.18);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const dome = Math.exp(-x * x * 1.2 - z * z * 1.8) * 0.1;
    positions.setY(i, y + (y > 0 ? dome : -dome * 0.18));
  }
  geometry.computeVertexNormals();
  const pillow = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      map: cloth,
      bumpMap: cloth,
      bumpScale: 0.014,
      roughness: 1,
      color: "#dadbe0",
    }),
  );
  group.add(pillow);
  // Piping runs around the middle, giving the cloth cushion visible thickness.
  const points = [],
    width = 1.01,
    depth = 0.84,
    radius = 0.18;
  for (const [cx, cz, start] of [
    [width - radius, depth - radius, 0],
    [-width + radius, depth - radius, Math.PI / 2],
    [-width + radius, -depth + radius, Math.PI],
    [width - radius, -depth + radius, Math.PI * 1.5],
  ])
    for (let i = 0; i <= 12; i++) {
      const a = start + (i * Math.PI) / 24;
      points.push(
        new THREE.Vector3(
          cx + Math.cos(a) * radius,
          0,
          cz + Math.sin(a) * radius,
        ),
      );
    }
  const seam = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: "#797d87",
      transparent: true,
      opacity: 0.5,
    }),
  );
  group.add(seam);
  group.position.set(-1.45, 0.25, -0.8);
  group.rotation.y = -0.16;
  return group;
}

function makeBear() {
  const bear = new THREE.Group(),
    geo = new THREE.SphereGeometry(1, 24, 16);
  const fur = new THREE.MeshStandardMaterial({
      color: "#bb9670",
      roughness: 1,
    }),
    light = new THREE.MeshStandardMaterial({ color: "#dcc19c", roughness: 1 }),
    pink = new THREE.MeshStandardMaterial({ color: "#e4b3a6", roughness: 1 });
  const ball = (mat, x, y, z, sx, sy, sz) => {
    const p = new THREE.Mesh(geo, mat);
    p.position.set(x, y, z);
    p.scale.set(sx, sy, sz);
    bear.add(p);
    return p;
  };
  ball(fur, 0, 0.21, 0, 0.22, 0.26, 0.15);
  ball(fur, 0, 0.55, 0, 0.25, 0.22, 0.16);
  for (const sign of [-1, 1]) {
    ball(fur, sign * 0.205, 0.725, 0, 0.105, 0.105, 0.075);
    ball(pink, sign * 0.205, 0.725, 0.067, 0.052, 0.054, 0.012);
    const arm = ball(fur, sign * 0.22, 0.3, 0.005, 0.08, 0.17, 0.085);
    arm.rotation.z = sign * -0.42;
    ball(fur, sign * 0.125, 0.026, 0.042, 0.1, 0.095, 0.115);
    ball(pink, sign * 0.172, 0.51, 0.126, 0.052, 0.038, 0.015);
  }
  ball(light, 0, 0.535, 0.151, 0.096, 0.069, 0.025);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 256;
  const c = canvas.getContext("2d");
  c.fillStyle = c.strokeStyle = "#56443e";
  c.lineWidth = 7;
  c.lineCap = "round";
  for (const x of [68, 188]) {
    c.beginPath();
    c.ellipse(x, 109, 7, 9, 0, 0, Math.PI * 2);
    c.fill();
  }
  c.beginPath();
  c.ellipse(128, 139, 10, 7, 0, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(128, 140);
  c.lineTo(128, 149);
  c.moveTo(112, 151);
  c.quadraticCurveTo(128, 162, 143, 151);
  c.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.39),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
    }),
  );
  face.position.set(0, 0.56, 0.183);
  bear.add(face);
  return bear;
}
function rayStroke(angle, i) {
  const radius = 1.015 + (i % 3) * 0.035,
    len = 0.1 + (i % 4) * 0.023,
    width = 0.014 + (i % 2) * 0.004,
    c = Math.cos(angle),
    s = Math.sin(angle),
    vertices = [];
  for (const [r, w] of [
    [radius, width],
    [radius + len * 0.48, width * 0.82],
    [radius + len, width * 0.4],
  ]) {
    const wobble = Math.sin(i * 3.7 + r) * 0.018;
    vertices.push(
      c * r - s * (w + wobble),
      s * r + c * (w + wobble),
      0.045,
      c * r - s * (-w + wobble),
      s * r + c * (-w + wobble),
      0.045,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(vertices, 3),
  );
  geometry.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
}

export function createRoom(host) {
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute(
    "aria-label",
    "白夜。直接碰牠、輕拖局部。Enter 戳戳，方向鍵摸摸，按住空白鍵依偎。",
  );
  canvas.setAttribute("aria-describedby", "hint");
  host.appendChild(canvas);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#eef0f3");
  const camera = new THREE.PerspectiveCamera(
    36,
    host.clientWidth / host.clientHeight,
    0.1,
    80,
  );
  const ambient = new THREE.HemisphereLight(0xffffff, 0xd9dce5, 1.5);
  scene.add(ambient);
  const windowLight = new THREE.DirectionalLight(0xffffff, 1.3);
  windowLight.position.set(-3, 6, 5);
  scene.add(windowLight);
  const byakuyaLight = new THREE.PointLight(0xf8faff, 3, 9, 2);
  scene.add(byakuyaLight);
  const bearFill = new THREE.DirectionalLight(0xf8f6ef, 0.35);
  bearFill.position.set(0, 2, 5);
  scene.add(bearFill);
  const surfaces = [];
  function plane(w, h, x, y, z, rx = 0, ry = 0, color = 0xffffff) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 1 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0);
    scene.add(mesh);
    surfaces.push(mat);
    return mesh;
  }
  plane(22, 18, 0, 0, -3, -Math.PI / 2);
  plane(22, 12, 0, 6, -6, 0, 0, 0xf9fafc);
  plane(18, 12, -7, 6, -3, 0, Math.PI / 2, 0xf2f4f8);
  plane(18, 12, 7, 6, -3, 0, -Math.PI / 2, 0xf9fafc);
  const cushion = makeCushion();
  scene.add(cushion);
  const cushionShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 2.8),
    new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader: `varying vec2 vUv;void main(){float r=length((vUv-.5)*2.0);gl_FragColor=vec4(.30,.32,.38,exp(-r*r*5.0)*.14);}`,
      transparent: true,
      depthWrite: false,
    }),
  );
  cushionShadow.rotation.x = -Math.PI / 2;
  cushionShadow.position.set(cushion.position.x, 0.009, cushion.position.z);
  scene.add(cushionShadow);
  const groundUniforms = {
    uCenter: { value: new THREE.Vector2() },
    uPower: { value: 1 },
    uNight: { value: 0 },
  };
  const groundMat = new THREE.ShaderMaterial({
    uniforms: groundUniforms,
    vertexShader: `varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.0);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader: `uniform vec2 uCenter;uniform float uPower;uniform float uNight;varying vec3 vWorld;void main(){float d=length(vWorld.xz-uCenter);gl_FragColor=vec4(vec3(.96,.98,1.),exp(-d*d*.65)*(.10+uNight*.12)*uPower);}`,
    transparent: true,
    depthWrite: false,
  });
  const groundGlow = new THREE.Mesh(new THREE.PlaneGeometry(18, 15), groundMat);
  groundGlow.rotation.x = -Math.PI / 2;
  groundGlow.position.set(0, 0.006, -2);
  scene.add(groundGlow);
  const root = new THREE.Group();
  root.position.set(0.25, 1.98, 0);
  scene.add(root);
  const shape = new THREE.Group();
  root.add(shape);
  const uniforms = {
    uTime: { value: 0 },
    uTouch: { value: new THREE.Vector3(0, 0, 0) },
    uPull: { value: new THREE.Vector2() },
    uTouch2: { value: new THREE.Vector3() },
    uPull2: { value: new THREE.Vector2() },
    uPressure: { value: 0 },
    uBrightness: { value: 1 },
    uNight: { value: 0 },
    uLayer: { value: 0 },
  };
  const bodyMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: lightVertex,
    fragmentShader: lightFragment,
    transparent: true,
    depthWrite: false,
  });
  const body = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 3.1, 64, 64),
    bodyMat,
  );
  body.renderOrder = 3;
  shape.add(body);
  const mistMat = new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uLayer: { value: 1 } },
    vertexShader: lightVertex,
    fragmentShader: lightFragment,
    transparent: true,
    depthWrite: false,
  });
  const mist = new THREE.Mesh(
    new THREE.PlaneGeometry(4.3, 4.3, 48, 48),
    mistMat,
  );
  mist.position.z = -0.07;
  mist.renderOrder = 2;
  shape.add(mist);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(4.8, 4.8),
    haloMaterial(),
  );
  halo.position.z = -0.12;
  halo.renderOrder = 1;
  shape.add(halo);
  const face = makeAnimatedFace(uniforms);
  shape.add(face.mesh);
  const rays = new THREE.Group();
  for (let i = 0; i < 19; i++) {
    const ray = rayStroke(
      ((i + 0.12 * Math.sin(i * 2.3)) * Math.PI * 2) / 19,
      i,
    );
    ray.material = new THREE.ShaderMaterial({
      uniforms: {
        ...uniforms,
        uRayOpacity: { value: 0.6 },
        uRayColor: { value: new THREE.Color(0xffffff) },
      },
      vertexShader: `${warp} varying vec2 vUv;void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(deform(position),1.0);}`,
      fragmentShader: `uniform float uRayOpacity;uniform vec3 uRayColor;void main(){gl_FragColor=vec4(uRayColor,uRayOpacity);}`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    ray.renderOrder = 4;
    rays.add(ray);
  }
  shape.add(rays);
  const bear = makeBear();
  bear.position.set(-1.45, 0.52, -0.3);
  scene.add(bear);
  const bearGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    haloMaterial(),
  );
  bearGlow.material.uniforms.uStrength.value = 0;
  bearGlow.renderOrder = 2;
  scene.add(bearGlow);
  const touchMotion = new LocalTouch(),
    touchMotion2 = new LocalTouch(),
    hugSpring = new Spring(0, 22, 10),
    restSpring = new Spring(0, 14, 8);
  const target = {
    pressure: 0,
    hug: 0,
    touch: new THREE.Vector3(),
    pull: new THREE.Vector2(),
    touch2: new THREE.Vector3(),
    pull2: new THREE.Vector2(),
    contact: false,
  };
  const actualPull = new THREE.Vector2(),
    restPosition = new THREE.Vector3(),
    motion = new THREE.Vector3();
  let lightLevel = 1,
    brightnessLevel = 0.85,
    lastTime = performance.now(),
    accumulated = 0,
    mobile = false;
  const raycaster = new THREE.Raycaster(),
    planeHit = new THREE.Plane(),
    camDirection = new THREE.Vector3(),
    projected = new THREE.Vector3();
  function resize() {
    const w = host.clientWidth,
      h = host.clientHeight;
    camera.aspect = w / h;
    mobile = camera.aspect < 0.8;
    camera.position.set(0, 3.45, mobile ? 10.9 : 8.8);
    camera.lookAt(0, 1.75, 0);
    camera.updateProjectionMatrix();
    cushion.position.x = mobile ? -0.65 : -1.45;
    cushion.position.z = mobile ? -0.8 : -0.8;
    cushion.scale.setScalar(mobile ? 0.85 : 1);
    cushionShadow.position.x = cushion.position.x;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  }
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  function pointerWorld(x, y) {
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    camera.getWorldDirection(camDirection);
    planeHit.setFromNormalAndCoplanarPoint(camDirection, root.position);
    return raycaster.ray.intersectPlane(planeHit, new THREE.Vector3());
  }
  function localTouch(x, y) {
    const p = pointerWorld(x, y);
    return p
      ? p.sub(root.position).applyQuaternion(root.quaternion.clone().invert())
      : new THREE.Vector3();
  }
  function hitBody(x, y) {
    const p = localTouch(x, y);
    return p.length() < 1.15;
  }
  function dragOffset(startX, startY, x, y) {
    const a = pointerWorld(startX, startY),
      b = pointerWorld(x, y);
    return a && b
      ? b.sub(a).applyQuaternion(root.quaternion.clone().invert())
      : new THREE.Vector3();
  }
  function screenPoint(p) {
    projected.copy(p).project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * host.clientWidth,
      y: (-0.5 * projected.y + 0.5) * host.clientHeight,
    };
  }
  function hitBear(x, y) {
    const p = screenPoint(
      bear.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
    );
    return Math.hypot(x - p.x, y - p.y) < (mobile ? 30 : 40);
  }
  function getScreenAnchor() {
    return screenPoint(
      root.position.clone().add(new THREE.Vector3(0.75, 0.9, 0)),
    );
  }
  function render(state, time, dt) {
    lightLevel +=
      ((state.lampOn ? 1 : 0) - lightLevel) * (1 - Math.exp(-dt * 3.5));
    scene.background.setRGB(
      THREE.MathUtils.lerp(0.025, 0.9, lightLevel),
      THREE.MathUtils.lerp(0.03, 0.92, lightLevel),
      THREE.MathUtils.lerp(0.046, 0.95, lightLevel),
    );
    ambient.intensity = 0.045 + lightLevel * 1.455;
    windowLight.intensity = lightLevel * 1.3;
    for (const mat of surfaces)
      mat.emissive.setRGB(
        0.004 + lightLevel * 0.018,
        0.005 + lightLevel * 0.018,
        0.008 + lightLevel * 0.018,
      );
    const hug = hugSpring.step(dt, target.hug),
      rest = restSpring.step(dt, state.resting && !target.contact ? 1 : 0);
    const calm = reducedMotion.matches ? 0.18 : 1,
      activity = 0.35 + state.energy * 0.65;
    motion.set(
      Math.sin(time * 0.4) * 0.08 * calm,
      Math.sin(time * 0.95 * activity) * 0.075 * calm,
      Math.sin(time * 0.3) * 0.045 * calm,
    );
    restPosition.set(
      cushion.position.x,
      1.45 + (mobile ? -0.09 : 0),
      cushion.position.z + 0.15,
    );
    const home = new THREE.Vector3(mobile ? 0.25 : 0.32, 1.98, 0);
    root.position
      .copy(home)
      .lerp(restPosition, rest)
      .addScaledVector(motion, 1 - rest * 0.85);
    root.position.z += hug * 0.78 - state.upset * 0.1;
    root.position.y += hug * 0.045;
    root.quaternion.copy(camera.quaternion);
    const deformation = touchMotion.step(dt, {
      x: target.pull.x,
      y: target.pull.y,
      pressure: target.pressure,
    });
    const second = touchMotion2.step(dt, {
      x: target.pull2.x,
      y: target.pull2.y,
      pressure: 0,
    });
    uniforms.uPull2.value.set(second.x, second.y);
    uniforms.uTouch2.value.copy(target.touch2);
    actualPull.set(deformation.x, deformation.y);
    uniforms.uPull.value.copy(actualPull);
    uniforms.uPressure.value = deformation.pressure;
    uniforms.uTouch.value.copy(target.touch);
    uniforms.uTime.value = time;
    uniforms.uNight.value = 1 - lightLevel;
    brightnessLevel +=
      (state.brightness - brightnessLevel) * (1 - Math.exp(-dt * 2.4));
    const brightness =
      brightnessLevel *
      (reducedMotion.matches ? 1 : 1 + Math.sin(time * 1.4) * 0.015);
    uniforms.uBrightness.value = brightness;
    halo.material.uniforms.uStrength.value =
      (0.1 + (1 - lightLevel) * 0.55) * brightness + hug * 0.06;
    halo.material.uniforms.uTime.value = time;
    face.draw(dt, state.resting && state.upset < 0.25 ? "tired" : state.mood, time);
    for (let i = 0; i < rays.children.length; i++) {
      const u = rays.children[i].material.uniforms;
      u.uRayOpacity.value =
        (0.17 + brightness * 0.3 + (1 - lightLevel) * 0.18) *
        (0.8 + Math.sin(time * 0.55 + i) * 0.08);
      u.uRayColor.value.setRGB(
        0.86 + 0.13 * (1 - lightLevel),
        0.88 + 0.11 * (1 - lightLevel),
        0.92 + 0.075 * (1 - lightLevel),
      );
    }
    byakuyaLight.position.copy(root.position);
    byakuyaLight.intensity = (1.3 + brightness * 2.2) * (1 - lightLevel * 0.85);
    bearFill.intensity = 0.28 - lightLevel * 0.08;
    groundUniforms.uCenter.value.set(root.position.x, root.position.z);
    groundUniforms.uPower.value = brightness;
    groundUniforms.uNight.value = 1 - lightLevel;
    const held = root.position.clone().add(new THREE.Vector3(0, -0.93, 0.35));
    const onCushion = new THREE.Vector3(
      cushion.position.x,
      0.48 * (mobile ? 0.85 : 1),
      cushion.position.z + 0.43,
    );
    bear.position.lerp(
      state.hasBear ? held : onCushion,
      1 - Math.exp(-dt * 2.6),
    );
    bear.quaternion.slerp(
      state.hasBear ? root.quaternion : new THREE.Quaternion(),
      1 - Math.exp(-dt * 3),
    );
    bearGlow.position.copy(bear.position).add(new THREE.Vector3(0, 0.35, -0.1));
    bearGlow.quaternion.copy(camera.quaternion);
    bearGlow.material.uniforms.uStrength.value = state.hasBear
      ? 0.14 * brightness
      : 0;
    // Visible state also supports accessible descriptions and local interaction QA.
    host.dataset.cuddle = hug.toFixed(3);
    host.dataset.deformation = Math.hypot(actualPull.x, actualPull.y).toFixed(
      3,
    );
    host.dataset.resting = String(state.resting);
    host.dataset.face = face.motion.features.map((v) => v.toFixed(3)).join(",");
    const center = screenPoint(root.position);
    host.dataset.centerX = center.x.toFixed(1);
    host.dataset.centerY = center.y.toFixed(1);
    renderer.render(scene, camera);
  }
  function animate(step) {
    let frame;
    function next(now) {
      const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
      lastTime = now;
      if (!document.hidden) {
        accumulated += dt;
        step(dt, accumulated);
      }
      frame = requestAnimationFrame(next);
    }
    frame = requestAnimationFrame(next);
    const visibility = () => {
      lastTime = performance.now();
    };
    document.addEventListener("visibilitychange", visibility);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m?.dispose();
      });
      canvas.remove();
      renderer.dispose();
    };
  }
  return {
    renderer,
    camera,
    target,
    root,
    hitBody,
    hitBear,
    localTouch,
    dragOffset,
    getScreenAnchor,
    render,
    animate,
    reducedMotion,
  };
}
