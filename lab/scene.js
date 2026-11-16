import * as THREE from '../periodic/vendor/three.module.min.js';
const stage=document.querySelector('#lab-stage');
const css=name=>getComputedStyle(document.documentElement).getPropertyValue('--lab-'+name).trim();
let renderer,scene,camera,liquid,sediment,particles,beaker,bottle,stream,filterCake,filterGroup,stirRod,frame=0,last=0,clock=0,stirUntil=0,pourStart=0,pourResolve=null;
let state={volume:0,precipitate:0,status:'empty',filtered:false,gasMl:0,color:'clear',solutionColor:'clear',ph:null};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const mat=(name,extra={})=>new THREE.MeshStandardMaterial({color:css(name),roughness:.45,...extra});
function mesh(geometry,material,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);parent.add(m);return m;}
function cylinder(radius,height,material,parent,x=0,y=0,z=0){return mesh(new THREE.CylinderGeometry(radius,radius,height,40),material,parent,x,y,z);}
function label(text,width,height){
  const c=document.createElement('canvas');c.width=512;c.height=256;const ctx=c.getContext('2d');ctx.fillStyle=css('white');ctx.fillRect(0,0,512,256);ctx.fillStyle=css('ink');ctx.font='bold 60px sans-serif';ctx.textAlign='center';ctx.fillText(text,256,120);ctx.font='28px sans-serif';ctx.fillText('0.100 mol/L',256,185);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;return new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
}
function glassware(parent,radius,height,x,z){
  const g=new THREE.Group();g.position.set(x,0,z);parent.add(g);
  const glass=mat('glass',{transparent:true,opacity:.32,side:THREE.DoubleSide,roughness:.08,depthWrite:false});
  const points=[new THREE.Vector2(0,.03),new THREE.Vector2(radius,.03),new THREE.Vector2(radius,height),new THREE.Vector2(radius+.02,height+.02)];
  mesh(new THREE.LatheGeometry(points,48),glass,g);
  const rim=mesh(new THREE.TorusGeometry(radius,.025,8,48),mat('metal',{transparent:true,opacity:.72}),g,0,height,0);rim.rotation.x=Math.PI/2;
  for(let i=1;i<=4;i++){
    const line=mesh(new THREE.BoxGeometry(.18,.012,.01),mat('ink',{transparent:true,opacity:.45}),g,radius*.5,height*i/5,radius*.88);
    line.rotation.y=-.22;
  }
  return g;
}
function init(){
  renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setClearColor(css('wall'));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label','طاولة معمل ثلاثية الأبعاد بكأس ومحلول وأدوات ترشيح');stage.prepend(renderer.domElement);
  scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(38,1,.1,80);
  scene.add(new THREE.HemisphereLight(css('white'),css('bench'),2.7));const key=new THREE.DirectionalLight(css('white'),3);key.position.set(-4,7,6);scene.add(key);const fill=new THREE.DirectionalLight(css('glass'),1.6);fill.position.set(6,4,-3);scene.add(fill);
  const textureCanvas=document.createElement('canvas');textureCanvas.width=256;textureCanvas.height=256;const ctx=textureCanvas.getContext('2d');ctx.fillStyle=css('bench');ctx.fillRect(0,0,256,256);ctx.fillStyle=css('metal');for(let i=0;i<1800;i++){const x=(i*71)%256,y=(i*97)%256;ctx.globalAlpha=.11;ctx.fillRect(x,y,1,1);}ctx.globalAlpha=1;ctx.strokeStyle=css('white');ctx.lineWidth=2;ctx.strokeRect(0,0,256,256);const texture=new THREE.CanvasTexture(textureCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(8,5);
  mesh(new THREE.BoxGeometry(13,.22,9),new THREE.MeshStandardMaterial({map:texture,roughness:.7}),scene,0,-.13,0);
  mesh(new THREE.BoxGeometry(13,4,.1),mat('wall'),scene,0,1.8,-3.7);
  const shelf=mesh(new THREE.BoxGeometry(9,.12,.8),mat('metal'),scene,0,1.6,-3.2);
  ['NaOH','CuSO₄','HCl','AgNO₃','FeCl₃'].forEach((formula,i)=>{
    const g=new THREE.Group();g.position.set(-3.4+i*1.65,1.67,-3.2);scene.add(g);cylinder(.28,.62,mat(i===1?'blue':i===4?'yellow':'glass',{transparent:true,opacity:.68}),g,0,.32,0);cylinder(.15,.18,mat('black'),g,0,.72,0);const tag=label(formula,.46,.27);tag.position.set(0,.34,.285);g.add(tag);
  });
  beaker=glassware(scene,.8,1.9,0,.65);
  liquid=cylinder(.755,1,mat('clear',{transparent:true,opacity:.7,roughness:.1}),beaker,0,.2,0);liquid.visible=false;
  sediment=cylinder(.73,1,mat('white'),beaker,0,.1,0);sediment.visible=false;
  const shadow=mesh(new THREE.CircleGeometry(.99,48),new THREE.MeshBasicMaterial({color:css('ink'),transparent:true,opacity:.08,depthWrite:false}),scene,0,.007,.65);shadow.rotation.x=-Math.PI/2;
  particles=new THREE.InstancedMesh(new THREE.SphereGeometry(.025,8,6),mat('white'),140);particles.visible=false;beaker.add(particles);
  filterGroup=new THREE.Group();filterGroup.position.set(2.45,0,.2);scene.add(filterGroup);
  cylinder(.04,2.6,mat('metal'),filterGroup,.55,1.3,-.15);mesh(new THREE.BoxGeometry(1.5,.08,1.2),mat('black'),filterGroup,0,.04,0);
  const funnel=mesh(new THREE.ConeGeometry(.55,.65,40,1,true),mat('white',{side:THREE.DoubleSide,transparent:true,opacity:.83}),filterGroup,0,1.55,0);funnel.rotation.z=Math.PI;
  cylinder(.065,.55,mat('glass',{transparent:true,opacity:.5}),filterGroup,0,1.03,0);
  const receiver=glassware(filterGroup,.5,.7,0,0);
  filterCake=cylinder(.33,.04,mat('white'),filterGroup,0,1.63,0);filterCake.visible=false;
  const filterTag=label('FILTER',.7,.35);filterTag.position.set(0,.32,.52);filterGroup.add(filterTag);
  stirRod=cylinder(.025,2.8,mat('glass',{transparent:true,opacity:.8}),scene,-1.65,.12,1);stirRod.rotation.z=Math.PI/2;stirRod.rotation.x=.12;
  bottle=new THREE.Group();scene.add(bottle);bottle.visible=false;cylinder(.3,.95,mat('glass',{transparent:true,opacity:.7}),bottle,0,0,0);cylinder(.11,.28,mat('metal'),bottle,0,.6,0);const tag=label('REAGENT',.47,.3);tag.position.set(0,.02,.305);bottle.add(tag);
  stream=cylinder(.018,1.2,mat('clear',{transparent:true,opacity:.8}),scene,0,2.1,.65);stream.visible=false;
  resize();window.addEventListener('lab-state',e=>{state=e.detail;update();start();});new ResizeObserver(resize).observe(stage);
  renderer.render(scene,camera);stage.dataset.sceneReady='1';window.LabScene={pour,stir:()=>{stirUntil=clock+2;start();}};window.dispatchEvent(new Event('lab-scene-ready'));
}
function resize(){if(!renderer)return;const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;const distance=camera.aspect<1.3?10.8:9.1;camera.position.set(.4,5.3,distance);camera.lookAt(0,.85,-.1);camera.updateProjectionMatrix();renderer.render(scene,camera);}
function update(){
  const valid=['empty','single','known'].includes(state.status);const fill=Math.max(.08,state.volume/100*1.65);
  liquid.visible=state.volume>0&&valid;liquid.scale.y=fill;liquid.position.y=fill/2+.045;
  const liquidColor=state.indicator&&state.ph!==null&&state.ph>=8.2?'pink':state.solutionColor;
  liquid.material.color.set(css(liquidColor||'clear'));
  sediment.visible=valid&&state.precipitate>1e-9&&!state.filtered;sediment.scale.y=Math.max(.02,Math.min(.15,state.massMg/2500));sediment.position.y=.06+sediment.scale.y/2;sediment.material.color.set(css(state.color||'white'));
  filterCake.visible=!!state.filtered&&state.precipitate>0;filterCake.material.color.set(css(state.color||'white'));
  particles.visible=valid&&!state.filtered&&(state.precipitate>1e-9||state.gasMl>0);particles.material.color.set(css(state.gasMl>0?'white':state.color||'white'));
}
function start(){if(!frame){last=0;frame=requestAnimationFrame(tick);}}
function tick(time){
  frame=0;const dt=last?Math.min((time-last)/1000,.05):0;last=time;clock+=dt;
  const stirring=clock<stirUntil,pouring=!!pourResolve;
  if(stirring){stirRod.position.set(Math.cos(clock*6)*.33,1.3,.65+Math.sin(clock*6)*.33);stirRod.rotation.z=.13;stirRod.rotation.x=.1;}else{stirRod.position.set(-1.65,.12,1);stirRod.rotation.z=Math.PI/2;}
  const dummy=new THREE.Object3D();const fill=Math.max(.1,state.volume/100*1.6);
  for(let i=0;i<140;i++){
    const a=i*2.399+(stirring?clock*2:0),r=Math.sqrt((i+.5)/140)*.66;
    let y=state.gasMl>0?((clock*.38+i/140)%1)*fill:stirring?((i*37%140)/140)*fill:Math.max(.05,((i*37%140)/140)*fill-clock*.045);
    dummy.position.set(Math.cos(a)*r,y+.08,Math.sin(a)*r);dummy.scale.setScalar(state.gasMl>0?1:1.2);dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);
  }
  particles.instanceMatrix.needsUpdate=true;
  if(pouring){const progress=Math.min(1,(time-pourStart)/1400);bottle.position.set(-.48,2.7,.65);bottle.rotation.z=-Math.sin(progress*Math.PI)*1.1;stream.visible=progress>.25&&progress<.8;if(progress>=1){bottle.visible=false;stream.visible=false;const resolve=pourResolve;pourResolve=null;resolve();}}
  renderer.render(scene,camera);
  if(!document.hidden&&(pouring||stirring||(!reduced&&particles.visible)))frame=requestAnimationFrame(tick);
}
function pour(color){if(reduced)return Promise.resolve();bottle.visible=true;stream.material.color.set(css(color));pourStart=performance.now();return new Promise(resolve=>{pourResolve=resolve;start();});}
try{init();}catch{document.querySelector('#scene-error').hidden=false;stage.removeAttribute('data-scene-ready');}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;if(pourResolve){bottle.visible=false;stream.visible=false;const resolve=pourResolve;pourResolve=null;resolve();}}else start();});
