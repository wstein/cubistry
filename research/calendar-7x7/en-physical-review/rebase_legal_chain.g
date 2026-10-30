# GAP's base-change routine preserves source permutations but not generic image
# labels. Rebuild those labels through an untouched complete resolver chain.
RebaseLegalChain:=function(oldChain,front)
  local oldBase,newChain,cache,resolved,resolve,qchain,q,t;
  oldBase:=BaseStabChain(oldChain);newChain:=StructuralCopy(oldChain);
  t:=Runtime();
  if not ChangeStabChain(newChain,front,false) then Error("plain base change failed");fi;
  if BaseStabChain(newChain){[1..Length(front)]}<>front then Error("inexact front base");fi;
  if BaseStabChain(oldChain)<>oldBase then Error("resolver mutated");fi;
  cache:=NewDictionary((),true);resolved:=0;
  resolve:=function(p)
    local word;
    if p=() then return oldChain.idimage;fi;
    word:=LookupDictionary(cache,p);
    if word<>fail then return word;fi;
    word:=ImageSiftedBaseImage(oldChain,OnTuples(oldBase,p),oldChain.idimage,OnRight)^-1;
    if word![2]<>p then Error("resolved word permutation mismatch");fi;
    AddDictionary(cache,p,word);resolved:=resolved+1;
    return word;
  end;
  qchain:=newChain;
  while BasePoint(qchain)<>false do
    qchain.idimage:=oldChain.idimage;qchain.transimages:=[];
    for q in qchain.orbit do
      if q=BasePoint(qchain) then qchain.transimages[q]:=oldChain.idimage;
      else qchain.transimages[q]:=resolve(qchain.transversal[q]);fi;
    od;
    if not IsBound(qchain.stabilizer) then break;fi;
    qchain:=qchain.stabilizer;
  od;
  return rec(chain:=newChain,resolved:=resolved,milliseconds:=Runtime()-t);
end;
