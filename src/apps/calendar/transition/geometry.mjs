// Generator-only geometry. Independent verification must use another move engine.
export const eq=(a,b)=>a.every((v,i)=>v===b[i]);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const axes=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export const rotations=axes.flatMap(x=>axes.filter(y=>dot(x,y)===0).map(y=>[x,y,cross(x,y)]));
export const rotate=(v,R)=>[0,1,2].map(i=>v.reduce((s,n,j)=>s+n*R[j][i],0));
export const positions=[-1,0,1].flatMap(x=>[-1,0,1].flatMap(y=>[-1,0,1].map(z=>[x,y,z]))).filter(p=>p.some(Boolean));
export const front=[1,0,-1].flatMap(y=>[-1,0,1].map(x=>[x,y,1]));
export const faces={R:[0,1,-1],L:[0,-1,1],U:[1,1,-1],D:[1,-1,1],F:[2,1,-1],B:[2,-1,1],x:[0,null,-1],y:[1,null,-1],z:[2,null,-1]};
export function solved(){let id=0;return positions.flatMap((p,cubie)=>axes.filter(n=>dot(p,n)===1).map(n=>({id:id++,cubie,p:[...p],n:[...n],up:Math.abs(n[1])===1?[0,0,-n[1]]:[0,1,0]})));}
const quarter=(v,a)=>{const[x,y,z]=v;return [[x,-z,y],[z,y,-x],[-y,x,z]][a].map(n=>n===0?0:n);};
export function apply(state,word){
 for(const token of word.split(/\s+/).filter(Boolean)){
  const match=/^([RLUDFBxyz])(2|')?$/.exec(token);if(!match)throw Error('Illegal token '+token);
  const[a,layer,d]=faces[match[1]],turns=((match[2]==='2'?2:match[2]==="'"?-1:1)*d+4)%4;
  state=state.map(s=>{
   if(layer!==null&&s.p[a]!==layer)return s;
   let{p,n,up}=s;for(let i=0;i<turns;i++){p=quarter(p,a);n=quarter(n,a);up=quarter(up,a);}return {...s,p,n,up};
  });
 }return state;
}
