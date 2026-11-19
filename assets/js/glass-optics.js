/* 硝子の展示体。丸い断面の屈折と反射をWebGLで描く。内容と操作はHTML側に残す。 */
(function () {
  "use strict";
  var canvas = document.querySelector("[data-glass-optic]");
  if (!canvas) return;
  var host = canvas.parentElement;
  var gl;
  try { gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: "low-power", preserveDrawingBuffer: true }); } catch (_) { canvas.dataset.opticState="unavailable"; return; }
  if (!gl) { canvas.dataset.opticState="unavailable"; return; }
  var vertex = "attribute vec2 a_position;varying vec2 v_uv;void main(){v_uv=a_position*.5+.5;gl_Position=vec4(a_position,0.,1.);}";
  var fragment = `
precision highp float;
varying vec2 v_uv;
uniform vec2 u_size;
uniform vec2 u_pointer;
uniform vec3 u_tint;
mat3 ry(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s,0.,1.,0.,s,0.,c);}
mat3 rx(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0.,0.,c,s,0.,-s,c);}
mat3 rz(float a){float c=cos(a),s=sin(a);return mat3(c,s,0.,-s,c,0.,0.,0.,1.);}
float shape(vec3 p){return length(max(abs(p)-vec3(.73,.79,.055),0.))-.17;}
vec3 normalAt(vec3 p){vec2 e=vec2(.001,0.);return normalize(vec3(shape(p+e.xyy)-shape(p-e.xyy),shape(p+e.yxy)-shape(p-e.yxy),shape(p+e.yyx)-shape(p-e.yyx)));}
vec3 scene(vec2 p){
 vec3 base=mix(vec3(.92,.96,.97),vec3(.84,.92,.94),smoothstep(-1.5,1.4,p.y));
 float aqua=exp(-dot((p-vec2(-.72,.28))*vec2(1.2,1.5),(p-vec2(-.72,.28))*vec2(1.2,1.5)));
 float peach=exp(-dot((p-vec2(.82,-.42))*vec2(1.5,1.2),(p-vec2(.82,-.42))*vec2(1.5,1.2)));
 base=mix(base,mix(vec3(.49,.81,.83),u_tint*.45+vec3(.49),.18),aqua*.67);
 base=mix(base,vec3(1.,.83,.72),peach*.65);
 // 背景の帯は硝子の外と内で連続し、縁を通して曲がって見える。
 float ribbon=1.-smoothstep(.12,.19,abs(p.x*.7+p.y-.12));
 base=mix(base,vec3(.67,.82,.86),ribbon*.35);
 float fine=1.-smoothstep(.009,.018,abs(p.x*.7+p.y-.32));
 base=mix(base,vec3(.49,.66,.7),fine*.26);
 return base;
}
vec3 environment(vec3 dir){
 vec3 col=mix(vec3(.16,.29,.34),vec3(.91,.97,1.),smoothstep(-.5,.6,dir.y));
 float strip=pow(max(0.,dot(normalize(vec3(-.65,1.,1.)),dir)),26.);
 float softbox=pow(max(0.,dot(normalize(vec3(.8,.2,1.)),dir)),36.);
 return col+vec3(1.)*(strip*1.8+softbox*1.2);
}
void main(){
 vec2 p=(v_uv-.5)*2.5;p.x*=u_size.x/u_size.y;
 mat3 rot=rz(-.1)*ry(u_pointer.x*.15)*rx(-.12+u_pointer.y*.12);
 mat3 inv=mat3(rot[0][0],rot[1][0],rot[2][0],rot[0][1],rot[1][1],rot[2][1],rot[0][2],rot[1][2],rot[2][2]);
 vec3 ro=inv*vec3(p,3.);vec3 rd=inv*vec3(0.,0.,-1.);
 vec3 col=scene(p);
 // 置かれた物体の接地影。背景だけに作用する。
 float shadow=exp(-pow(length((p-vec2(.04,-.10))/vec2(.9,.83)),5.))* .17;
 col*=1.-shadow;
 float travel=0.;bool hit=false;
 for(int i=0;i<48;i++){float d=shape(ro+rd*travel);if(d<.0015){hit=true;break;}travel+=max(d,.001);if(travel>5.)break;}
 if(hit){
  vec3 front=ro+rd*travel;vec3 n=normalAt(front);
  vec3 inside=refract(rd,n,1./1.47);
  vec3 exitPoint=front+inside*.014;
  for(int j=0;j<32;j++){float d=shape(exitPoint);if(d>0.)break;exitPoint+=inside*max(abs(d)*.72,.008);}
  vec3 outNormal=normalAt(exitPoint);
  vec3 outside=refract(inside,-outNormal,1.47);
  if(dot(outside,outside)<.01)outside=reflect(inside,-outNormal);
  vec3 worldExit=rot*exitPoint, worldRay=rot*outside;
  float plane=(-1.15-worldExit.z)/min(worldRay.z,-.09);
  vec2 through=(worldExit+worldRay*plane).xy;
  float edge=1.-max(0.,dot(-rd,n));
  vec2 dispersion=normalize(n.xy+vec2(.0001))*.012*edge;
  vec3 transmitted=vec3(scene(through+dispersion).r,scene(through).g,scene(through-dispersion).b);
  float thickness=length(exitPoint-front);
  transmitted*=exp(-vec3(.035,.009,.007)*thickness);
  vec3 reflection=environment(rot*reflect(rd,n));
  float fresnel=.04+.78*pow(edge,4.);
  col=mix(transmitted,reflection,fresnel);
  // 長いスタジオ照明を、磨かれた断面だけへ映し込む。
  float rim=pow(edge,2.)*.19;
  col+=vec3(.78,.91,1.)*rim;
  float gleam=pow(max(0.,dot(reflect(rd,n),normalize(inv*vec3(-.8,1.,2.)))),65.);
  col+=gleam*.65;
 }
 float alpha=hit?1.:(1.-smoothstep(.85,1.23,max(abs(p.x),abs(p.y))))*.84;
 gl_FragColor=vec4(clamp(col,0.,1.)*alpha,alpha);
}`;
  function shader(type, source) {
    var s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { gl.deleteShader(s); return null; }
    return s;
  }
  var vs = shader(gl.VERTEX_SHADER, vertex), fs = shader(gl.FRAGMENT_SHADER, fragment);
  if (!vs || !fs) return;
  var program = gl.createProgram();gl.attachShader(program, vs);gl.attachShader(program, fs);gl.linkProgram(program);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return; }
  gl.useProgram(program);
  var buffer = gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER, buffer);gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  var attribute = gl.getAttribLocation(program,"a_position");gl.enableVertexAttribArray(attribute);gl.vertexAttribPointer(attribute,2,gl.FLOAT,false,0,0);
  var size = gl.getUniformLocation(program,"u_size"), pointer = gl.getUniformLocation(program,"u_pointer"), tint = gl.getUniformLocation(program,"u_tint");
  var media = matchMedia("(prefers-reduced-motion: reduce)"), x=0,y=0,tx=0,ty=0,frame=0,visible=true,lost=false;
  var rgb=[.12,.35,.3];
  function reduced() { return media.matches || document.documentElement.classList.contains("motion-reduced"); }
  function draw() {
    frame=0;if(lost || !visible || document.hidden) return;
    var box=canvas.getBoundingClientRect(), cap=innerWidth<700?540:760;
    var dpr=Math.min(devicePixelRatio||1,1.25,cap/Math.max(box.width,box.height,1));
    var w=Math.max(1,Math.round(box.width*dpr)),h=Math.max(1,Math.round(box.height*dpr));
    if(canvas.width!==w || canvas.height!==h){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
    if(reduced()){x=0;y=0;}else{x+=(tx-x)*.22;y+=(ty-y)*.22;}
    gl.uniform2f(size,w,h);gl.uniform2f(pointer,x,y);gl.uniform3fv(tint,rgb);gl.drawArrays(gl.TRIANGLES,0,6);
    canvas.dataset.opticState="ready";
    host.classList.add("optic-ready");
    if(!reduced() && (Math.abs(tx-x)+Math.abs(ty-y)>.003))frame=requestAnimationFrame(draw);
  }
  function schedule(){if(!frame && !lost && visible && !document.hidden)frame=requestAnimationFrame(draw);}
  host.addEventListener("pointermove",function(e){if(reduced() || e.pointerType==="touch")return;var r=host.getBoundingClientRect();tx=(e.clientX-r.left)/r.width*2-1;ty=(e.clientY-r.top)/r.height*2-1;schedule();},{passive:true});
  host.addEventListener("pointerleave",function(){tx=ty=0;schedule();});
  host.addEventListener("focusin",function(e){var r=e.target.getBoundingClientRect(),b=host.getBoundingClientRect();tx=((r.left+r.width/2-b.left)/b.width-.5)*.7;schedule();});
  host.addEventListener("focusout",function(){tx=ty=0;schedule();});
  document.addEventListener("visibilitychange",function(){if(document.hidden && frame){cancelAnimationFrame(frame);frame=0;}else schedule();});
  if(media.addEventListener)media.addEventListener("change",schedule);
  new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
  var showcase=document.querySelector("[data-showcase]");
  if(showcase)new MutationObserver(function(){var c=showcase.style.getPropertyValue("--selected-app").trim();if(/^#[0-9a-f]{6}$/i.test(c))rgb=[1,3,5].map(function(i){return parseInt(c.slice(i,i+2),16)/255;});schedule();}).observe(showcase,{attributes:true,attributeFilter:["style"]});
  if(window.IntersectionObserver)new IntersectionObserver(function(entries){visible=entries[0].isIntersecting;if(!visible && frame){cancelAnimationFrame(frame);frame=0;}else schedule();},{rootMargin:"80px"}).observe(host);
  if(window.ResizeObserver)new ResizeObserver(schedule).observe(host);else window.addEventListener("resize",schedule);
  canvas.addEventListener("webglcontextlost",function(e){e.preventDefault();lost=true;cancelAnimationFrame(frame);frame=0;host.classList.remove("optic-ready");canvas.dataset.opticState="fallback";});
  // 復旧時はCSSの硝子面を保ち、再読込まで操作を止めない。
  schedule();
})();
