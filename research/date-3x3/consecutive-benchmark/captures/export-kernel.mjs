// Usage: node export-kernel.mjs /path/to/packages/solver-3x3-picture > kernel-2048.json
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const {centerKernelReference,centerKernelReferenceStatistics}=await import(pathToFileURL(resolve(process.argv[2], 'src/center-reference.mjs')).href);
const rows=[];
for(let i=0;i<4096;i++){const o=Array.from({length:6},(_,j)=>(i>>(2*j))&3);const r=centerKernelReference(o);if(o.reduce((a,b)=>a+b,0)%2){if(r.status!=='invalid')throw Error('Odd parity accepted');}else{if(r.status!=='reference')throw Error('Even rejected');rows.push({i,o,word:r.moves.join(' '),htm:r.htm});}}
process.stdout.write(JSON.stringify({revision:'ffe513c43f5d622810b9a3c9aff2fac88163d0f0',statistics:centerKernelReferenceStatistics(),rows}));
