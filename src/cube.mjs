// Right-handed world frame: +x right, +y up, +z front. All sticker frames
// stay attached to their physical cubies, including during layer turns.
export const FACES={R:[0,1,-1],L:[0,-1,1],U:[1,1,-1],D:[1,-1,1],F:[2,1,-1],B:[2,-1,1]};
export const POSITIONS=[];
for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])POSITIONS.push([x,y,z]);
export const UNITS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const eq=(a,b)=>a.every((x,i)=>x===b[i]);
export const rotate=(v,R)=>[0,1,2].map(i=>v.reduce((s,x,j)=>s+x*R[j][i],0));
export const ROTATIONS=UNITS.flatMap(x=>UNITS.filter(y=>dot(x,y)===0).map(y=>[x,y,cross(x,y)]));
export function quarter(v,axis){const u=UNITS[axis*2];return cross(u,v).map((x,i)=>x+u[i]*dot(u,v));}
export function solved(){return POSITIONS.flatMap((p,cubie)=>UNITS.filter(n=>dot(p,n)===1).map((n,j)=>({id:cubie*3+j,cubie,p:[...p],n:[...n],up:Math.abs(n[1])===1?[0,0,-n[1]]:[0,1,0]})));}
export function move(state,notation){
 const m=/^([RLUDFB])(2|')?$/.exec(notation);if(!m)throw Error('Unsupported move '+notation);
 const [axis,layer,direction]=FACES[m[1]],turns=((m[2]==='2'?2:m[2]==="'"?-1:1)*direction+4)%4;
 return state.map(s=>{if(s.p[axis]!==layer)return s;let p=s.p,n=s.n,up=s.up;for(let i=0;i<turns;i++){p=quarter(p,axis);n=quarter(n,axis);up=quarter(up,axis);}return{...s,p,n,up};});
}
export function apply(state,alg){return alg.trim()?alg.trim().split(/\s+/).reduce(move,state):state;}
export function inverse(alg){return alg.trim()?alg.trim().split(/\s+/).reverse().map(m=>m.endsWith('2')?m:m.endsWith("'")?m.slice(0,-1):m+"'").join(' '):'';}
export const FRONT=[[-1,1,1],[1,1,1],[-1,-1,1],[1,-1,1]];
export function front(state){return FRONT.map(p=>state.find(s=>eq(s.p,p)&&eq(s.n,[0,0,1])));}
export function assertDisplay(state,value,padded=true){
 const expected=['title-left','title-right',value<10&&!padded?' ':String(Math.floor(value/10)),String(value%10)];
 const f=front(state);if(f.some((s,i)=>s.image!==expected[i]||s.image!==' '&&!eq(s.up,[0,1,0])))throw Error('Incorrect physical display '+value);
 return true;
}
