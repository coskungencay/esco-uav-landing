/* ==========================================================================
   ESCO-UAV — Platform B sinematik 3D görüntüleyici
   İçerik : gövde (candidate_003) + V4/V5 baskı parçaları + gerçek donanım
   Etkileşim: serbest 360/zoom yerine SINIRLI yörünge — kadraj hep korunur.
              Bırakıldığında uçak çok hafif süzülür, fareyle hafif paralaks.
   ========================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/GLTFLoader';
import { OrbitControls } from 'three/OrbitControls';
import { RoomEnvironment } from 'three/RoomEnvironment';
import { mergeGeometries } from 'three/BufferGeometryUtils';

const EXTERIOR = new Set(['wing_starboard','wing_port','htail_starboard','htail_port',
  'vtail_port','vtail_starboard','pod','boom_port','boom_starboard','motor_mount_plate',
  'aileron_port','aileron_starboard','elevator','rudder_port','rudder_starboard',
  'hatch_frame','hatch_cover','camera_bracket','camera_aperture_ring']);

const STRUCTURE = new Set(['main_spar','aft_spar','wing_joiner','boom_clamp_port',
  'boom_clamp_starboard','pod_hardpoint_plate_fwd','pod_hardpoint_plate_aft',
  'battery_tray','battery_rail_port','battery_rail_starboard','servo_bay_port',
  'servo_bay_starboard','breaker_fuse_panel','cable_corridor']);

const AVIONICS = new Set(['PB-P01_PIXHAWK6C_MOUNT','PB-P02_RPI5_COOLER_MOUNT',
  'PB-P03A_M8N_HOLDER','PB-P03B_MAST_INTERFACE','PB-AF01_AVIONICS_DECK',
  'REF_PIXHAWK_6C','REF_M8N_GPS','REF_ACTIVE_COOLER','REF_RASPBERRY_PI_5']);

const ZONES = new Set(['motor_zone','prop_disk_zone','camera_zone','pm_ubec_zone',
  'rc_telemetry_zone','cg_placeholder']);

const CONTROL = new Set(['aileron_port','aileron_starboard','elevator','rudder_port','rudder_starboard']);
const CARBON  = new Set(['boom_port','boom_starboard','main_spar','aft_spar','wing_joiner',
                         'boom_clamp_port','boom_clamp_starboard']);
const PRINTED = new Set(['PB-P01_PIXHAWK6C_MOUNT','PB-P02_RPI5_COOLER_MOUNT',
  'PB-P03A_M8N_HOLDER','PB-P03B_MAST_INTERFACE','PB-AF01_AVIONICS_DECK']);

const D = THREE.MathUtils.degToRad;

const ENV = 0.34;                     /* ortam haritasi siddeti: yikanmayi onler */
function material(name){
  const M = o => new THREE.MeshStandardMaterial({envMapIntensity:ENV, ...o});
  if(name === 'REF_PIXHAWK_6C')     return M({color:0x15181e, metalness:.35, roughness:.55});
  if(name === 'REF_RASPBERRY_PI_5') return M({color:0x0e6b2c, metalness:.25, roughness:.60});
  if(name === 'REF_ACTIVE_COOLER')  return M({color:0xaeb6c0, metalness:.85, roughness:.26, envMapIntensity:.8});
  if(name === 'REF_M8N_GPS')        return M({color:0x27406e, metalness:.40, roughness:.45});
  if(PRINTED.has(name))             return M({color:0x27a9bd, metalness:.10, roughness:.55});
  if(CONTROL.has(name))             return M({color:0xe8952a, metalness:.22, roughness:.46});
  if(CARBON.has(name))              return M({color:0x141a23, metalness:.68, roughness:.30});
  if(STRUCTURE.has(name))           return M({color:0x9db2d0, metalness:.40, roughness:.42,
                                      emissive:0x16233d, emissiveIntensity:.75});
  if(ZONES.has(name))               return M({color:0x4fd1e0, transparent:true, opacity:.14,
                                       side:THREE.DoubleSide, depthWrite:false, roughness:1});
  return M({color:0xb4bfd0, metalness:.22, roughness:.44});          /* dış kaplama */
}

export function initViewer(opts){
  const host = document.querySelector(opts.host);
  if(!host) return;
  const loadEl = document.querySelector(opts.loader);
  const barEl  = document.querySelector(opts.bar);
  const hintEl = document.querySelector(opts.hint);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:true, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const pmrem  = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(34, host.clientWidth/host.clientHeight, 1, 30000);

  scene.add(new THREE.AmbientLight(0x8fa4c4, 0.16));
  const key  = new THREE.DirectionalLight(0xfff4e6, 3.0); key.position.set( 900, 1400,  700);
  const fill = new THREE.DirectionalLight(0x6f9dff, 0.55); fill.position.set(-1100, 180, -350);
  const rim  = new THREE.DirectionalLight(0x4fd1e0, 2.2);  rim.position.set(-500, -260, -1100);
  const rim2 = new THREE.DirectionalLight(0xffffff, 0.9);  rim2.position.set( 300, -700,  500);
  scene.add(key, fill, rim, rim2);

  /* pivot: sadece süzülme/paralaks. NOT: CadQuery'nin GLTF çıktısı ZATEN Y-up
     gelir (bbox X=boy, Y=yükseklik, Z=kanat açıklığı) — ek eksen dönüşü YOK. */
  const pivot = new THREE.Group();
  const root  = new THREE.Group();
  pivot.add(root); scene.add(pivot);

  const parts = new Map();
  const home  = { d: 2600, az: D(42), pol: D(64) };
  let worldBox = null, ready = false, mode = 'exterior';
  const focus = {};
  const curTarget = new THREE.Vector3(), wantTarget = new THREE.Vector3();

  const AZ_RANGE = D(46), POL_MIN = D(52), POL_MAX = D(94);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan  = false;
  controls.enableZoom = false;          /* kadraj korunsun */
  controls.rotateSpeed = 0.40;
  controls.minPolarAngle = POL_MIN;
  controls.maxPolarAngle = POL_MAX;
  controls.minAzimuthAngle = home.az - AZ_RANGE;
  controls.maxAzimuthAngle = home.az + AZ_RANGE;

  /* Kadrajı gerçek izdüşüme göre hesapla. Uçak çok geniş ama ince olduğu için
     küresel sınır kullanmak onu çerçevede küçük bırakıyor. En/boy değişince
     (mobil dikey!) yeniden hesaplanır. */
  function distanceFor(box){
    if(!box || box.isEmpty()) return home.d;
    const dir = new THREE.Vector3().setFromSphericalCoords(1, home.pol, home.az).normalize();
    const rgt = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).normalize();
    const upv = new THREE.Vector3().crossVectors(rgt, dir).normalize();
    const c = box.getCenter(new THREE.Vector3());
    const mn = box.min, mx = box.max;
    let ex=0, ey=0, ez=0;
    for(const X of [mn.x,mx.x]) for(const Y of [mn.y,mx.y]) for(const Z of [mn.z,mx.z]){
      const v = new THREE.Vector3(X,Y,Z).sub(c);
      ex = Math.max(ex, Math.abs(v.dot(rgt)));
      ey = Math.max(ey, Math.abs(v.dot(upv)));
      ez = Math.max(ez, Math.abs(v.dot(dir)));
    }
    const vF = D(camera.fov), hF = 2*Math.atan(Math.tan(vF/2)*camera.aspect);
    const margin = camera.aspect < 1 ? 1.10 : 1.00;
    return (Math.max(ey/Math.tan(vF/2), ex/Math.tan(hF/2)) + ez*0.22) * margin;
  }
  function refit(){
    Object.keys(focus).forEach(k=>{ focus[k].d = distanceFor(focus[k].box); });
    const f = focus[mode] || focus.exterior;
    if(f){ home.d = f.d; wantTarget.copy(f.center); }
    controls.minDistance = controls.maxDistance = home.d;
  }
  function placeCamera(){
    controls.target.copy(curTarget);
    camera.position.copy(curTarget).add(
      new THREE.Vector3().setFromSphericalCoords(home.d, home.pol, home.az));
    camera.lookAt(curTarget);
    controls.update();
  }

  new GLTFLoader().load(opts.model, gltf=>{
    const src = gltf.scene;
    src.updateMatrixWorld(true);

    const known = x => EXTERIOR.has(x)||STRUCTURE.has(x)||AVIONICS.has(x)||ZONES.has(x);
    const bucket = new Map();
    src.traverse(o=>{
      if(!o.isMesh) return;
      let n = o.name, p = o.parent;
      while(p && !known(n)){ n = p.name; p = p.parent; }
      if(!bucket.has(n)) bucket.set(n, []);
      bucket.get(n).push(o);
    });

    const merged = new THREE.Group();
    bucket.forEach((meshes, name)=>{
      const geos = meshes.map(m=>{
        let g = m.geometry.clone();
        for(const k of Object.keys(g.attributes)) if(k!=='position' && k!=='normal') g.deleteAttribute(k);
        if(g.index) g = g.toNonIndexed();
        g.applyMatrix4(m.matrixWorld);
        return g;
      });
      let geo; try{ geo = geos.length===1 ? geos[0] : mergeGeometries(geos,false); }catch(e){ geo=null; }
      if(!geo) geo = geos[0];
      const mat  = material(name);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = name;
      merged.add(mesh);
      parts.set(name, { mesh, mat });
    });

    const b0 = new THREE.Box3().setFromObject(src);
    src.clear();
    merged.position.sub(b0.getCenter(new THREE.Vector3()));
    src.add(merged);
    root.add(src);
    worldBox = new THREE.Box3().setFromObject(root);

    buildFocus();
    setMode('exterior', false);
    placeCamera(); controls.saveState();

    loadEl && loadEl.classList.add('gone');
    if(barEl) barEl.style.width = '100%';
    ready = true;
    window.dispatchEvent(new CustomEvent('viewer:ready'));
  }, ev=>{
    if(barEl && ev.total) barEl.style.width = Math.round(ev.loaded/ev.total*100)+'%';
  }, ()=>{
    if(loadEl) loadEl.innerHTML = '<span style="color:#f2555a">MODEL YÜKLENEMEDİ</span>';
  });

  /* ---- katmanlar ---- */
  function show(name, visible, opacity){
    const p = parts.get(name); if(!p) return;
    p.mesh.visible = visible;
    const wantT = opacity < 1 || ZONES.has(name);
    if(p.mat.transparent !== wantT) p.mat.needsUpdate = true;   /* shader yeniden derlenmeli */
    p.mat.transparent = wantT;
    p.mat.opacity     = wantT ? opacity : 1;
    p.mat.depthWrite  = !wantT;
  }
  function setMode(m, animate){
    mode = m;
    parts.forEach((_,n)=>{
      if(EXTERIOR.has(n))       show(n, true, m==='exterior' ? 1 : 0.075);
      else if(AVIONICS.has(n))  show(n, m==='avionics' || m==='structure', 1);
      else if(STRUCTURE.has(n)) show(n, m==='structure', 1);
      else if(ZONES.has(n))     show(n, m==='zones', 0.14);
      else                      show(n, m==='exterior', 1);
    });
    const f = focus[m];
    if(f){ home.d = f.d; wantTarget.copy(f.center); if(!animate){ curTarget.copy(f.center); } }
    controls.minDistance = controls.maxDistance = home.d;
  }

  /* Her mod için odak kutusunu bir kez hesapla: aviyonik moddayken kamera
     gövde içine odaklanır, yoksa 2100 mm'lik uçakta 200 mm'lik bölge görünmez. */
  function buildFocus(){
    const prev = mode;
    for(const m of ['exterior','avionics','structure','zones']){
      parts.forEach((_,n)=>{
        if(EXTERIOR.has(n))       show(n, true, m==='exterior' ? 1 : 0.075);
        else if(AVIONICS.has(n))  show(n, m==='avionics'||m==='structure', 1);
        else if(STRUCTURE.has(n)) show(n, m==='structure', 1);
        else if(ZONES.has(n))     show(n, m==='zones', 0.14);
        else                      show(n, m==='exterior', 1);
      });
      const b = new THREE.Box3();
      parts.forEach((p,n)=>{
        if(!p.mesh.visible) return;
        if(m !== 'exterior' && EXTERIOR.has(n)) return;   /* hayalet kabuk odağa girmez */
        b.expandByObject(p.mesh);
      });
      if(b.isEmpty()) b.copy(worldBox);
      focus[m] = { box:b, center:b.getCenter(new THREE.Vector3()), d:distanceFor(b) };
    }
    mode = prev;
  }
  document.querySelectorAll('[data-mode]').forEach(b=>{
    b.addEventListener('click', ()=>{
      document.querySelectorAll('[data-mode]').forEach(x=>x.classList.remove('on'));
      b.classList.add('on'); setMode(b.dataset.mode, true);
    });
  });
  const resetBtn = document.querySelector('[data-act="reset"]');
  resetBtn && resetBtn.addEventListener('click', ()=>{
    drift = 0; yaw = 0; pitch = 0; tx = 0; ty = 0;
    pivot.rotation.set(0,0,0);
    curTarget.copy(wantTarget); placeCamera();
  });

  /* ---- süzülme + paralaks (kamerayı değil MODELİ oynatır) ---- */
  let drift = 0, idle = 0, dragging = false;
  let tx = 0, ty = 0, px = 0, py = 0, yaw = 0, pitch = 0;
  renderer.domElement.addEventListener('pointerdown', ()=>{
    dragging = true; idle = 0; hintEl && hintEl.classList.add('gone');
  });
  addEventListener('pointerup', ()=>{ dragging = false; });
  host.addEventListener('pointermove', e=>{
    const r = host.getBoundingClientRect();
    tx = ((e.clientX-r.left)/r.width  - .5) * 2;
    ty = ((e.clientY-r.top )/r.height - .5) * 2;
  });
  host.addEventListener('pointerleave', ()=>{ tx = 0; ty = 0; });

  let onScreen = true;
  new IntersectionObserver(e=>{ onScreen = e[0].isIntersecting; },{threshold:0}).observe(host);

  const clock = new THREE.Clock();
  let running = true;
  (function loop(){
    if(!running) return;
    requestAnimationFrame(loop);
    if(!onScreen || !ready) return;
    const dt = Math.min(clock.getDelta(), 0.05);

    if(!reduce){
      if(!dragging){ idle += dt; } else { idle = 0; }
      const gate = Math.min(1, Math.max(0, (idle-0.9)/1.2));    /* yumuşak devreye girme */
      drift += dt * 0.17 * gate;
      yaw   += ((Math.sin(drift) * D(8.5) * gate) - yaw) * 0.05;
      pitch += ((Math.cos(drift*0.66) * D(2.2) * gate) - pitch) * 0.05;
      px += (tx - px) * 0.04;
      py += (ty - py) * 0.04;
      pivot.rotation.y = yaw + px * 0.075;
      pivot.rotation.x = pitch - py * 0.035;
    }
    /* mod değişince kamera hedefine yumuşak geçiş */
    if(curTarget.distanceToSquared(wantTarget) > 1e-4){
      curTarget.lerp(wantTarget, 1 - Math.pow(0.001, dt));
      controls.target.copy(curTarget);
    }
    const want = home.d;
    const cur  = camera.position.distanceTo(controls.target);
    if(Math.abs(cur - want) > 0.5){
      const nd = cur + (want - cur) * (1 - Math.pow(0.001, dt));
      controls.minDistance = controls.maxDistance = nd;
    } else {
      controls.minDistance = controls.maxDistance = want;
    }
    controls.update();
    renderer.render(scene, camera);
  })();
  window.__escoStop = ()=>{ running = false; controls.update(); renderer.render(scene,camera); };

  addEventListener('resize', ()=>{
    const w = host.clientWidth, h = host.clientHeight;
    if(!w || !h) return;
    camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
    refit(); controls.update();
  });
}
