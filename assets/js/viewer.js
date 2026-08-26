/* ==========================================================================
   ESCO-UAV — Platform B interaktif 3D görüntüleyici
   Model: candidate_003 baseline (CadQuery → GLB, mm, +X burun/+Y sancak/+Z yukarı)
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/GLTFLoader';
import { OrbitControls } from 'three/OrbitControls';
import { RoomEnvironment } from 'three/RoomEnvironment';
import { mergeGeometries } from 'three/BufferGeometryUtils';

/* --- bileşen grupları (Fusion/CAD düğüm adlarıyla birebir) --- */
const EXTERIOR = new Set(['wing_starboard','wing_port','htail_starboard','htail_port',
  'vtail_port','vtail_starboard','pod','boom_port','boom_starboard','motor_mount_plate',
  'aileron_port','aileron_starboard','elevator','rudder_port','rudder_starboard',
  'hatch_cover','camera_bracket','camera_aperture_ring','gps_mast']);

const INTERNAL = new Set(['main_spar','aft_spar','wing_joiner','boom_clamp_port',
  'boom_clamp_starboard','pod_hardpoint_plate_fwd','pod_hardpoint_plate_aft',
  'battery_tray','battery_rail_port','battery_rail_starboard','electronics_tray',
  'hatch_frame','servo_bay_port','servo_bay_starboard','breaker_fuse_panel','cable_corridor']);

const ZONES = new Set(['motor_zone','prop_disk_zone','camera_zone','pixhawk_zone',
  'companion_zone','pm_ubec_zone','rc_telemetry_zone','cg_placeholder']);

const CONTROL = new Set(['aileron_port','aileron_starboard','elevator','rudder_port','rudder_starboard']);
const CARBON  = new Set(['boom_port','boom_starboard','main_spar','aft_spar','wing_joiner']);
const HILITE  = new Set(['gps_mast','camera_bracket','camera_aperture_ring']);

const C = {
  skin:    0xc9d2df,
  control: 0xf2a63b,
  carbon:  0x2b3444,
  internal:0x4fd1e0,
  hilite:  0xa78bfa,
  zone:    0x4fd1e0,
};

export function initViewer(opts){
  const host = document.querySelector(opts.host);
  if(!host) return;
  const loadEl = document.querySelector(opts.loader);
  const barEl  = document.querySelector(opts.bar);
  const hintEl = document.querySelector(opts.hint);

  const renderer = new THREE.WebGLRenderer({ antialias:true, alpha:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.05).texture;

  const camera = new THREE.PerspectiveCamera(38, host.clientWidth/host.clientHeight, 0.1, 8000);

  /* ışıklandırma — enstrüman hissi: soğuk anahtar + sıcak dolgu */
  const key = new THREE.DirectionalLight(0xffffff, 2.1); key.position.set(600, 900, 700);
  const fill= new THREE.DirectionalLight(0x88b4ff, 0.9); fill.position.set(-800, 200, -500);
  const rim = new THREE.DirectionalLight(0x4fd1e0, 1.3); rim.position.set(0, -400, -900);
  scene.add(key, fill, rim, new THREE.AmbientLight(0xffffff, 0.25));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.enablePan = false;
  controls.minDistance = 700;
  controls.maxDistance = 4200;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.55;

  const root = new THREE.Group();
  /* CAD Z-up → three.js Y-up */
  root.rotation.x = -Math.PI/2;
  scene.add(root);

  const parts = new Map();          // isim -> { objs, mats }
  const home = { d: 2400 };         // varsayilan kamera mesafesi

  function mkMat(name){
    if(CONTROL.has(name)) return new THREE.MeshStandardMaterial({color:C.control,metalness:.25,roughness:.5});
    if(CARBON.has(name))  return new THREE.MeshStandardMaterial({color:C.carbon,metalness:.7,roughness:.38});
    if(HILITE.has(name))  return new THREE.MeshStandardMaterial({color:C.hilite,metalness:.35,roughness:.45});
    if(INTERNAL.has(name))return new THREE.MeshStandardMaterial({color:C.internal,metalness:.45,roughness:.42});
    if(ZONES.has(name))   return new THREE.MeshStandardMaterial({color:C.zone,transparent:true,opacity:.16,
                                   side:THREE.DoubleSide,depthWrite:false,metalness:0,roughness:1});
    return new THREE.MeshStandardMaterial({color:C.skin,metalness:.32,roughness:.46});
  }

  new GLTFLoader().load(opts.model, gltf=>{
    const src = gltf.scene;
    src.updateMatrixWorld(true);

    /* mesh'leri parçaya göre topla (düğüm adı mesh'te ya da ebeveynindedir) */
    const bucket = new Map();
    src.traverse(o=>{
      if(!o.isMesh) return;
      let n = o.name, p = o.parent;
      while(p && !EXTERIOR.has(n) && !INTERNAL.has(n) && !ZONES.has(n)){ n = p.name; p = p.parent; }
      if(!bucket.has(n)) bucket.set(n, []);
      bucket.get(n).push(o);
    });

    /* parça başına tek geometri: 926 çizim çağrısı -> ~43 */
    const merged = new THREE.Group();
    bucket.forEach((meshes, name)=>{
      const geos = meshes.map(m=>{
        let g = m.geometry.clone();
        for(const k of Object.keys(g.attributes)) if(k!=='position' && k!=='normal') g.deleteAttribute(k);
        if(g.index) g = g.toNonIndexed();     /* tek tip: birleştirme güvenli olsun */
        g.applyMatrix4(m.matrixWorld);
        return g;
      });
      let geo = null;
      try { geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false); } catch(e){ geo = null; }
      if(!geo){ geo = geos[0]; }                       /* birleşme olmazsa ilkine düş */
      const mat = mkMat(name);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = name;
      merged.add(mesh);
      parts.set(name, { objs:[mesh], mats:[mat] });
    });
    src.clear();
    src.add(merged);
    /* modeli kendi yerel uzayinda merkezle, sonra donmus koke ekle */
    const box  = new THREE.Box3().setFromObject(src);
    const size = box.getSize(new THREE.Vector3());
    src.position.sub(box.getCenter(new THREE.Vector3()));
    root.add(src);

    /* kamerayi kanat acikligina gore sigdir */
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    const dist = radius / Math.sin((camera.fov*Math.PI/180)/2) * 0.95;
    home.d = dist;
    controls.minDistance = dist * 0.42;
    controls.maxDistance = dist * 2.6;
    camera.position.set(dist*0.62, dist*0.36, dist*0.70);
    controls.target.set(0,0,0);
    controls.update();

    setMode('exterior');
    loadEl && loadEl.classList.add('gone');
    if(barEl) barEl.style.width = '100%';
    window.dispatchEvent(new CustomEvent('viewer:ready'));
  }, ev=>{
    if(barEl && ev.total) barEl.style.width = Math.round(ev.loaded/ev.total*100)+'%';
  }, err=>{
    console.error('Model yüklenemedi', err);
    if(loadEl) loadEl.innerHTML = '<span style="color:#f2555a">MODEL YÜKLENEMEDİ</span>';
  });

  /* --- görünüm modları --- */
  let mode = 'exterior';
  function apply(name, {visible, opacity}){
    const p = parts.get(name); if(!p) return;
    p.objs.forEach(o=>{ o.visible = visible; });
    p.mats.forEach(m=>{
      if(opacity < 1){ m.transparent = true; m.opacity = opacity; m.depthWrite = false; }
      else if(!ZONES.has(name)){ m.transparent = false; m.opacity = 1; m.depthWrite = true; }
    });
  }
  function setMode(m){
    mode = m;
    parts.forEach((_,name)=>{
      if(EXTERIOR.has(name)){
        if(m==='exterior') apply(name,{visible:true,opacity:1});
        else apply(name,{visible:true,opacity:0.10});
      } else if(INTERNAL.has(name)){
        apply(name,{visible:m==='internal',opacity:1});
      } else if(ZONES.has(name)){
        apply(name,{visible:m==='zones',opacity:0.16});
      } else {
        apply(name,{visible:m==='exterior',opacity:1});
      }
    });
  }

  /* --- kontroller --- */
  document.querySelectorAll('[data-mode]').forEach(b=>{
    b.addEventListener('click',()=>{
      document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('on'));
      b.classList.add('on'); setMode(b.dataset.mode);
    });
  });
  const spinBtn = document.querySelector('[data-act="spin"]');
  spinBtn && spinBtn.addEventListener('click',()=>{
    controls.autoRotate = !controls.autoRotate;
    spinBtn.classList.toggle('on', controls.autoRotate);
  });
  const resetBtn = document.querySelector('[data-act="reset"]');
  resetBtn && resetBtn.addEventListener('click',()=>{
    camera.position.set(home.d*0.62, home.d*0.36, home.d*0.70);
    controls.target.set(0,0,0); controls.update();
  });
  document.querySelectorAll('[data-view]').forEach(b=>{
    b.addEventListener('click',()=>{
      const d = home.d;
      const v = { top:[0.001,d,0.001], front:[d,0,0.001], side:[0.001,0,d],
                  iso:[d*0.62,d*0.36,d*0.70] }[b.dataset.view];
      camera.position.set(v[0],v[1],v[2]);
      controls.target.set(0,0,0); controls.update();
    });
  });

  let touched = false;
  const stop = ()=>{ if(touched) return; touched = true;
    controls.autoRotate = false; spinBtn && spinBtn.classList.remove('on');
    hintEl && hintEl.classList.add('gone'); };
  renderer.domElement.addEventListener('pointerdown', stop);
  renderer.domElement.addEventListener('wheel', stop, {passive:true});

  /* --- döngü (görünür değilken çizmez) --- */
  let visible = true, running = true;
  new IntersectionObserver(e=>{ visible = e[0].isIntersecting; },{threshold:0}).observe(host);
  (function loop(){
    if(!running) return;
    requestAnimationFrame(loop);
    if(!visible) return;
    controls.update(); renderer.render(scene,camera);
  })();
  /* test/hata ayıklama kancası: döngüyü durdurup tek kare bırakır */
  window.__escoStop = ()=>{ running=false; controls.update(); renderer.render(scene,camera); };

  addEventListener('resize', ()=>{
    const w = host.clientWidth, h = host.clientHeight;
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
  });
}
