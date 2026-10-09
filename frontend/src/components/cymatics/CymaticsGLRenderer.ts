import type {CymaticsParticle} from '@/lib/cymatics/particles';
import type {SurfaceType} from '@/lib/cymatics/types';

const vertex=`#version 300 es
in vec2 position;in float tone;in float grainSize;uniform float aspect;out float vTone;
void main(){vec2 p=(position-.5)*1.8;p.x/=aspect;gl_Position=vec4(p.x,-p.y,0.,1.);gl_PointSize=grainSize;vTone=tone;}`;
const fragment=`#version 300 es
precision mediump float;in float vTone;out vec4 color;
void main(){vec2 p=gl_PointCoord-.5;if(dot(p,p)>.25)discard;vec3 dark=vec3(.749,.682,.541),light=vec3(.914,.863,.753);float edge=smoothstep(.5,.18,length(p));color=vec4(mix(dark,light,vTone)*(.78+.22*edge),1.);}`;
const plateVertex=`#version 300 es
const vec2 points[3]=vec2[](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));out vec2 uv;void main(){gl_Position=vec4(points[gl_VertexID],0.,1.);uv=points[gl_VertexID]*.5+.5;}`;
const plateFragment=`#version 300 es
precision mediump float;in vec2 uv;out vec4 color;uniform bool circular;uniform float aspect;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 q=uv-.5;q.x*=aspect;float d=circular?length(q):max(abs(q.x),abs(q.y));float limit=.45;if(d>limit){color=vec4(.01,.018,.035,1.);return;}float brushed=hash(vec2(floor(uv.x*900.),floor(uv.y*90.)))*.035;float light=max(0.,1.-length(uv-vec2(.25,.2))*1.2);vec3 base=circular?vec3(.11,.135,.16):vec3(.13,.16,.19);base+=light*.11+brushed;color=vec4(base,1.);}`;

function shader(gl:WebGL2RenderingContext,type:number,source:string){const value=gl.createShader(type);if(!value)throw new Error('WebGL shader unavailable');gl.shaderSource(value,source);gl.compileShader(value);if(!gl.getShaderParameter(value,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(value)??'WebGL shader compilation failed');return value;}
function program(gl:WebGL2RenderingContext,vs:string,fs:string){const value=gl.createProgram();if(!value)throw new Error('WebGL program unavailable');gl.attachShader(value,shader(gl,gl.VERTEX_SHADER,vs));gl.attachShader(value,shader(gl,gl.FRAGMENT_SHADER,fs));gl.linkProgram(value);if(!gl.getProgramParameter(value,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(value)??'WebGL link failed');return value;}

export class CymaticsGLRenderer{
  private gl:WebGL2RenderingContext;private grainProgram:WebGLProgram;private plateProgram:WebGLProgram;private position:WebGLBuffer;private tone:WebGLBuffer;private size:WebGLBuffer;
  constructor(private canvas:HTMLCanvasElement){const gl=canvas.getContext('webgl2',{alpha:false,antialias:true,preserveDrawingBuffer:false});if(!gl)throw new Error('WebGL2 unavailable');this.gl=gl;this.grainProgram=program(gl,vertex,fragment);this.plateProgram=program(gl,plateVertex,plateFragment);const buffers=[gl.createBuffer(),gl.createBuffer(),gl.createBuffer()];if(buffers.some(value=>!value))throw new Error('WebGL buffer unavailable');[this.position,this.tone,this.size]=buffers as WebGLBuffer[];}
  render(particles:CymaticsParticle[],surface:SurfaceType){const gl=this.gl,rect=this.canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),width=Math.max(320,Math.round(rect.width*dpr)),height=Math.max(240,Math.round(rect.height*dpr));if(this.canvas.width!==width||this.canvas.height!==height){this.canvas.width=width;this.canvas.height=height;}gl.viewport(0,0,width,height);const aspect=width/height;gl.disable(gl.BLEND);gl.useProgram(this.plateProgram);gl.uniform1i(gl.getUniformLocation(this.plateProgram,'circular'),surface==='circular-membrane'?1:0);gl.uniform1f(gl.getUniformLocation(this.plateProgram,'aspect'),aspect);gl.drawArrays(gl.TRIANGLES,0,3);const positions=new Float32Array(particles.length*2),tones=new Float32Array(particles.length),sizes=new Float32Array(particles.length);for(let i=0;i<particles.length;i++){positions[i*2]=particles[i].x;positions[i*2+1]=particles[i].y;tones[i]=particles[i].tone;sizes[i]=Math.max(1.2,particles[i].size*dpr*1.65);}gl.useProgram(this.grainProgram);gl.uniform1f(gl.getUniformLocation(this.grainProgram,'aspect'),aspect);const bind=(buffer:WebGLBuffer,name:string,size:number,data:Float32Array)=>{gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);const location=gl.getAttribLocation(this.grainProgram,name);gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,0,0);};bind(this.position,'position',2,positions);bind(this.tone,'tone',1,tones);bind(this.size,'grainSize',1,sizes);gl.drawArrays(gl.POINTS,0,particles.length);}
  destroy(){const gl=this.gl;gl.deleteBuffer(this.position);gl.deleteBuffer(this.tone);gl.deleteBuffer(this.size);gl.deleteProgram(this.grainProgram);gl.deleteProgram(this.plateProgram);}
}
