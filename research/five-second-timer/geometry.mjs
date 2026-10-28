// Generator geometry. The Python verifier implements its own move engine.
export const FACES={R:[0,1,-1],L:[0,-1,1],U:[1,1,-1],D:[1,-1,1],F:[2,1,-1],B:[2,-1,1]};
export const eq=(a,b)=>a.every((x,i)=>x===b[i]);
export const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const UNITS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export const POSITIONS=[-1,1].flatMap(x=>[-1,1].flatMap(y=>[-1,1].map(z=>[x,y,z])));
export const FRONT=[[-1,1,1],[1,1,1],[-1,-1,1],[1,-1,1]];
export const ROTATIONS=UNITS.flatMap(x=>UNITS.filter(y=>dot(x,y)===0).map(y=>[x,y,cross(x,y)]));
export const rotate=(v,R)=>[0,1,2].map(i=>v.reduce((s,x,j)=>s+x*R[j][i],0));
export const quarter=(v,axis)=>{const [x,y,z]=v;return [[x,-z,y],[z,y,-x],[-y,x,z]][axis];};
export const solved=()=>POSITIONS.flatMap((p,cubie)=>UNITS.filter(n=>dot(p,n)===1).map((n,j)=>({id:cubie*3+j,cubie,p:[...p],n:[...n]})));
export function apply(state,word){
 for(const token of word.split(/\s+/).filter(Boolean)){
  const m=/^([RLUDFB])(2|')?$/.exec(token);if(!m)throw Error('Invalid move');
  const [axis,layer,dir]=FACES[m[1]],turns=((m[2]==='2'?2:m[2]==="'"?-1:1)*dir+4)%4;
  state=state.map(s=>{if(s.p[axis]!==layer)return s;let {p,n,up}=s;for(let j=0;j<turns;j++){p=quarter(p,axis);n=quarter(n,axis);up=quarter(up,axis);}return {...s,p,n,up};});
 }return state;
}
