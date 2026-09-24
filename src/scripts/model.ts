import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export async function initModel(){
 const host=document.querySelector<HTMLElement>('#model-canvas')!;
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));renderer.setClearColor(0x000000,0);
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.85;
 const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight(0xffffff,0x969d86,1.8));
 const key=new THREE.DirectionalLight(0xfff4df,2);key.position.set(-2,4,3);scene.add(key);
 const fill=new THREE.DirectionalLight(0xdbe6ff,.6);fill.position.set(3,2,-1);scene.add(fill);
 const camera=new THREE.OrthographicCamera(-1,1,.7,-.7,.01,30);const home=new THREE.Vector3(2.2,2.0,3.1);
 camera.position.copy(home);const controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.04,-.02);controls.enableDamping=true;controls.enablePan=false;controls.enableZoom=false;controls.minPolarAngle=.1;controls.maxPolarAngle=Math.PI*.67;
 let model:THREE.Group;
 try{const gltf=await new GLTFLoader().loadAsync('/models/est34-r13.glb');model=gltf.scene;}catch(e){renderer.dispose();controls.dispose();throw e;}
 const skin=new Set(['wing_starboard','wing_port','htail_starboard','htail_port','vtail_starboard','vtail_port','pod_shell_candidate','hatch_cover','elevator','rudder_port','rudder_starboard','aileron_port','aileron_starboard']);
 const isExterior=(name:string)=>skin.has(name)||name.startsWith('boom_')||['camera_aperture_ring','ventral_skid','motor_zone'].includes(name);
 model.traverse(obj=>{if(obj instanceof THREE.Mesh)obj.visible=isExterior(obj.name);});
 scene.add(model);host.replaceChildren(renderer.domElement);renderer.domElement.setAttribute('aria-label','R13 CAD modelini sürükleyerek döndürün. Görünüm düğmeleriyle iç yapıyı veya üst görünüşü seçebilirsiniz.');
 const center=new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());controls.target.copy(center);camera.position.copy(home).add(center);controls.update();
 const fit=()=>{camera.updateMatrixWorld();const bounds=new THREE.Box3();const point=new THREE.Vector3();model.traverse(obj=>{if(obj instanceof THREE.Mesh){const attr=obj.geometry.getAttribute('position');for(let i=0;i<attr.count;i++){point.fromBufferAttribute(attr,i).applyMatrix4(obj.matrixWorld).applyMatrix4(camera.matrixWorldInverse);bounds.expandByPoint(point);}}});const size=bounds.getSize(new THREE.Vector3());const aspect=host.clientWidth/host.clientHeight;const height=Math.max(size.y,size.x/aspect)*1.18;camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();};
 let active=true;const resize=()=>{renderer.setSize(host.clientWidth,host.clientHeight);fit();};resize();
 new ResizeObserver(resize).observe(host);
 const observer=new IntersectionObserver(entries=>{active=entries[0].isIntersecting;});observer.observe(host);
 renderer.setAnimationLoop(()=>{if(active&&!document.hidden){controls.update();renderer.render(scene,camera);}});
 document.querySelector<HTMLElement>('#model-poster')!.style.opacity='0';document.querySelector<HTMLElement>('#model-tools')!.hidden=false;
 document.querySelector('#model-status')!.textContent='R13 / SÜRÜKLEYEREK DÖNDÜRÜN · CAD GÖRSELLEŞTİRMESİ';

 document.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  const mode=button.dataset.view;
  model.traverse(obj=>{if(obj instanceof THREE.Mesh)obj.visible=mode==='structure'?!skin.has(obj.name):isExterior(obj.name);});
  if(mode==='top'){camera.position.copy(center).add(new THREE.Vector3(0,4.2,.001));controls.target.copy(center);}else if(mode==='reset'||mode==='outer'){camera.position.copy(home).add(center);controls.target.copy(center);}
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(mode==='reset'?(b as HTMLElement).dataset.view==='outer':b===button)));
  controls.update();fit();
 }));
}
