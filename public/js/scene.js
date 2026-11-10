'use strict';
/* Fondo de luz volumétrica: render GPU con tone mapping, grano y dither contra el banding */
const Scene = (() => {
  const c = $('#scene');
  let gl = null, U = {}, raf = 0;
  try { gl = c.getContext('webgl', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' }); } catch {}

  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision highp float;
uniform vec2 R,C,pK,pR;uniform float T,I,G,V,RG;uniform vec3 cB,cK,cR,cH;
float h21(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*f*(f*(f*6.-15.)+10.);
return mix(mix(h21(i),h21(i+vec2(1.,0.)),f.x),mix(h21(i+vec2(0.,1.)),h21(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;mat2 m=mat2(.8,.6,-.6,.8);for(int i=0;i<4;i++){s+=a*vn(p);p=m*p*2.02+7.1;a*=.5;}return s;}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
vec2 uv=gl_FragCoord.xy/R;float ar=R.x/R.y;vec2 p=(uv-.5)*vec2(ar,1.);vec2 q=p+C;
float n1=fbm(q*1.15+vec2(T*.018,-T*.012));
float n2=fbm(q*1.9+n1*1.6+vec2(-T*.01,T*.008));
vec2 kd=p-(pK*vec2(ar,1.)*.72+C*.7+.035*vec2(sin(T*.06),cos(T*.047)));
float key=exp(-dot(kd,kd)*1.65);
vec2 rd=p-(pR*vec2(ar,1.)*.72+C*.4+.03*vec2(cos(T*.05),sin(T*.04)));
float rim=exp(-dot(rd,rd)*3.2);
vec3 c=cB;
c+=cK*key*(.3+.9*n2)*I*.17;
c+=cR*rim*(.3+.9*n1)*I*.3;
c+=cH*smoothstep(.34,.82,n2)*.07*I;
if(RG>0.){float l=length(kd);float a=exp(-pow((l-.34)/.008,2.))*.42+exp(-pow((l-.34)/.13,2.))*.2;
c*=mix(1.,smoothstep(.22,.345,l),RG*.96);c+=cK*a*RG*I*(.65+.5*n1);}
float lum=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(lum),c,.74);
float v=smoothstep(1.32,.18,length(p*vec2(.84,1.14)));
c*=mix(1.,v*v,V);
c=pow(aces(c*1.5),vec3(1./2.2));
float g=h21(gl_FragCoord.xy*.73+fract(T*3.7)*vec2(91.,57.))+h21(gl_FragCoord.xy*1.31+fract(T*5.1)*vec2(33.,77.))-1.;
c+=g*(G*.04+1.6/255.);
gl_FragColor=vec4(c,1.);}`;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  if (gl) {
    const vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
    if (vs && fs) {
      const prog = gl.createProgram();
      gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(a);
      gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      for (const n of ['R', 'C', 'pK', 'pR', 'T', 'I', 'G', 'V', 'RG', 'cB', 'cK', 'cR', 'cH']) U[n] = gl.getUniformLocation(prog, n);
    } else gl = null;
  }

  const P = { sc: SCENES[0], i: 0.8, g: 0.5, v: 0.7, m: 0.5, cx: 0, cy: 0 };
  let t = Math.random() * 300, last = performance.now(), need = true;
  const linear = (hex) => hex2rgb(hex).map((x) => Math.pow(x / 255, 2.2));

  function size(w, H) {
    if (!gl) return;
    if (c.width !== w || c.height !== H) { c.width = w; c.height = H; }
    gl.viewport(0, 0, w, H);
  }
  function fitWindow() { size(Math.ceil(innerWidth), Math.ceil(innerHeight)); need = true; }

  function draw(w = c.width, H = c.height, cx = P.cx, cy = P.cy) {
    const sc = P.sc;
    gl.uniform2f(U.R, w, H);
    gl.uniform2f(U.C, cx, cy);
    gl.uniform2f(U.pK, sc.kx, sc.ky);
    gl.uniform2f(U.pR, sc.rx, sc.ry);
    gl.uniform1f(U.T, t);
    gl.uniform1f(U.I, P.i);
    gl.uniform1f(U.G, P.g);
    gl.uniform1f(U.V, P.v);
    gl.uniform1f(U.RG, sc.ring ? 1 : 0);
    gl.uniform3fv(U.cB, linear(sc.base));
    gl.uniform3fv(U.cK, linear(sc.key));
    gl.uniform3fv(U.cR, linear(sc.rim));
    gl.uniform3fv(U.cH, linear(sc.haze));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (document.hidden || !gl) return;
    const moving = P.m > 0 && !prefersReduced();
    if (!need && (!moving || now - last < 1000 / 24)) return;
    if (moving) t += Math.min(0.1, (now - last) / 1000) * (0.4 + P.m * 2.4);
    last = now; need = false;
    draw();
  }

  function applyFallback() {
    document.body.style.background = sceneCSS(P.sc);
    c.style.display = gl ? '' : 'none';
  }

  addEventListener('resize', fitWindow);
  fitWindow();
  applyFallback();
  if (gl) raf = requestAnimationFrame(frame);

  return {
    set(meta) {
      P.sc = SCENES.find((s) => s.id === meta.id) || SCENES[0];
      P.i = meta.i ?? 0.8; P.g = meta.g ?? 0.5; P.v = meta.v ?? 0.7; P.m = meta.m ?? 0.5;
      need = true; applyFallback();
    },
    cam(x, y) {
      P.cx = clamp(-x / innerWidth, -40, 40) * 0.07;
      P.cy = clamp(y / innerHeight, -40, 40) * 0.07;
      need = true;
    },
    capture(ctx, w, H) {
      if (!gl) { const sc = P.sc; ctx.fillStyle = sc.base; ctx.fillRect(0, 0, w, H); return; }
      const cw = Math.min(4096, Math.round(w)), ch = Math.min(4096, Math.round(H));
      size(cw, ch);
      draw(cw, ch, 0, 0);
      ctx.drawImage(c, 0, 0, w, H);
      fitWindow();
      draw();
    },
  };
})();
