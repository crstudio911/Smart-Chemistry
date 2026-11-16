import * as THREE from './vendor/three.module.min.js';
import { OrbitControls } from './vendor/OrbitControls.js';

const stage = document.querySelector('#atom-stage');
const panel = document.querySelector('#atom-panel');
const dialog = document.querySelector('#element-dialog');
let renderer, scene, camera, controls, atom, observer, frame = 0, last = 0;
let active = false, paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let angle = 0;
let outerRadius = 1.2;
const electrons = [];
const geometries = [];
const materials = [];
const color = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function material(token, roughness = .45) {
  const m = new THREE.MeshStandardMaterial({ color: color(token), roughness, metalness: .12 });
  materials.push(m);
  return m;
}
function sphere(radius, mat, position) {
  const geometry = new THREE.SphereGeometry(radius, 16, 12);
  geometries.push(geometry);
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.copy(position);
  return mesh;
}
function resize() {
  if (!renderer || !camera) return;
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height) return;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  draw();
}
function draw() {
  if (renderer && scene && camera) renderer.render(scene, camera);
}
function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0, 0);
  renderer.domElement.setAttribute('aria-label', 'نموذج ذري ثلاثي الأبعاد');
  renderer.domElement.setAttribute('role', 'img');
  stage.append(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
  scene.add(new THREE.HemisphereLight(color('--white'), color('--slate'), 2.3));
  const key = new THREE.DirectionalLight(color('--white'), 3);
  key.position.set(5, 8, 10);
  scene.add(key);
  const fill = new THREE.DirectionalLight(color('--cyan'), 1.5);
  fill.position.set(-7, 2, -4);
  scene.add(fill);
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 28;
  controls.addEventListener('change', draw);
  observer = new ResizeObserver(resize);
  observer.observe(stage);
}
function disposeAtom() {
  if (atom) scene.remove(atom);
  geometries.splice(0).forEach(g => g.dispose());
  materials.splice(0).forEach(m => m.dispose());
  electrons.length = 0;
}
function resetCamera() {
  const distance = Math.max(5, outerRadius / Math.tan(Math.PI / 9) / Math.min(1, camera.aspect) * 1.25);
  camera.position.set(1, 4, 17).normalize().multiplyScalar(distance);
  controls.target.set(0, 0, 0);
  controls.update();
  draw();
}
function build(element) {
  disposeAtom();
  atom = new THREE.Group();
  scene.add(atom);
  angle = 0;
  const counts = window.AtomRules.shellCounts(element, window.CHEM_ELEMENTS);
  outerRadius = 1.22 + (counts.length - 1) * .55;
  const proton = material('--violet'), nucleus = material('--accent'), electron = material('--white', .2);
  const nucleons = element.AtomicNumber === 1 ? 1 : Math.min(64, element.AtomicNumber * 2);
  for (let i = 0; i < nucleons; i++) {
    const y = 1 - 2 * (i + .5) / nucleons;
    const a = i * Math.PI * (3 - Math.sqrt(5));
    const r = .42 * Math.sqrt(1 - y * y);
    atom.add(sphere(.16, i % 2 ? proton : nucleus, new THREE.Vector3(Math.cos(a) * r, y * .42, Math.sin(a) * r)));
  }
  const shellColors = ['--cyan', '--violet', '--family-nonmetal', '--family-alkaline', '--family-lanthanide', '--family-transition', '--family-halogen'];
  counts.forEach((count, index) => {
    const shell = new THREE.Group();
    shell.rotation.set(index * .32 + .35, index * .56, index * .21);
    atom.add(shell);
    const radius = 1.12 + index * .55;
    const points = Array.from({ length: 129 }, (_, n) => new THREE.Vector3(Math.cos(n / 128 * Math.PI * 2) * radius, 0, Math.sin(n / 128 * Math.PI * 2) * radius));
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({ color: color(shellColors[index]), transparent: true, opacity: .65 });
    geometries.push(geometry); materials.push(mat);
    shell.add(new THREE.Line(geometry, mat));
    for (let n = 0; n < count; n++) {
      const phase = n / count * Math.PI * 2;
      const mesh = sphere(.085, electron, new THREE.Vector3(Math.cos(phase) * radius, 0, Math.sin(phase) * radius));
      shell.add(mesh);
      electrons.push({ mesh, radius, phase, speed: .38 / (index + 1) });
    }
  });
  stage.dataset.electronCount = String(electrons.length);
  document.querySelector('#atom-name').textContent = element.ArabicName;
  document.querySelector('#atom-symbol').textContent = element.Symbol;
  document.querySelector('#atom-shells').textContent = counts.join(' · ');
  document.querySelector('#atom-electrons').textContent = element.AtomicNumber;
  document.querySelector('#atom-predicted').hidden = !element.ElectronConfiguration.includes('predicted');
  resize();
  resetCamera();
  stage.dataset.sceneReady = '1';
}
function tick(time) {
  if (!active) return;
  const dt = last ? Math.min((time - last) / 1000, .05) : 0;
  last = time;
  if (!paused) {
    angle += dt;
    electrons.forEach(e => { const a = e.phase + angle * e.speed; e.mesh.position.set(Math.cos(a) * e.radius, 0, Math.sin(a) * e.radius); });
    draw();
    frame = requestAnimationFrame(tick);
  }
}
function updatePause() {
  const btn = document.querySelector('#atom-pause');
  btn.setAttribute('aria-label', paused ? 'تشغيل الحركة' : 'إيقاف الحركة');
  btn.title = paused ? 'تشغيل الحركة' : 'إيقاف الحركة';
  btn.setAttribute('aria-pressed', String(paused));
  btn.querySelector('use').setAttribute('href', paused ? '#play' : '#pause');
}
function close() {
  active = false;
  cancelAnimationFrame(frame);
  panel.hidden = true;
  dialog.classList.remove('viewer-open');
  document.querySelector('#atom-open').focus();
}
function open(element) {
  panel.hidden = false;
  dialog.classList.add('viewer-open');
  document.querySelector('#atom-error').hidden = true;
  try {
    if (!renderer) init();
    build(element);
    active = true;
    last = 0;
    updatePause();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  } catch {
    document.querySelector('#atom-error').hidden = false;
    stage.removeAttribute('data-scene-ready');
  }
  document.querySelector('#atom-back').focus();
}
document.querySelector('#atom-back').addEventListener('click', close);
document.querySelector('#atom-reset').addEventListener('click', () => { if (camera) resetCamera(); });
document.querySelector('#atom-pause').addEventListener('click', () => {
  paused = !paused;
  updatePause();
  cancelAnimationFrame(frame);
  last = 0;
  if (active && !paused) frame = requestAnimationFrame(tick);
});
for (const [id, factor] of [['atom-zoom-in', .82], ['atom-zoom-out', 1.22]]) document.getElementById(id).addEventListener('click', () => {
  if (!camera) return;
  camera.position.multiplyScalar(factor).clampLength(controls.minDistance, controls.maxDistance);
  controls.update(); draw();
});
dialog.addEventListener('close', close);
document.addEventListener('visibilitychange', () => {
  cancelAnimationFrame(frame); last = 0;
  if (!document.hidden && active && !paused) frame = requestAnimationFrame(tick);
});
new MutationObserver(() => { if (active) { materials.forEach(m => { if (m === materials[1]) m.color.set(color('--accent')); }); draw(); } }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
window.AtomViewer = Object.freeze({ open, close, update: element => { if (active) build(element); } });