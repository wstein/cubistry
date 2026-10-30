# Load with GAP -L calendar7-dag-group.ws. Preserve S as word resolver.
Read("research/calendar-7x7/en-physical-review/partial_transporter.g");;
oldbase:=BaseStabChain(S);;
P:=StructuralCopy(S);;
t:=Runtime();;
if not ChangeStabChain(P,frontT,false) then Error("plain base change failed");fi;
if BaseStabChain(P){[1..49]}<>frontT then Error("front base is not exact");fi;
if BaseStabChain(S)<>oldbase then Error("word resolver was mutated");fi;
Print("plain_base_change_ms\t",Runtime()-t,"\n");
ResolveCache:=NewDictionary((),true);;
ResolveCount:=0;;
ResolveLegalWord:=function(p)
  local word;
  if p=() then return S.idimage;fi;
  word:=LookupDictionary(ResolveCache,p);
  if word<>fail then return word;fi;
  word:=ImageSiftedBaseImage(S,OnTuples(oldbase,p),S.idimage,OnRight)^-1;
  if word![2]<>p then Error("resolved legal word disagrees with permutation");fi;
  AddDictionary(ResolveCache,p,word);ResolveCount:=ResolveCount+1;
  return word;
end;;
t:=Runtime();;
Q:=P;;
while BasePoint(Q)<>false do
  Q.idimage:=S.idimage;Q.transimages:=[];
  for q in Q.orbit do
    if q=BasePoint(Q) then Q.transimages[q]:=S.idimage;
    else Q.transimages[q]:=ResolveLegalWord(Q.transversal[q]);fi;
  od;
  if not IsBound(Q.stabilizer) then break;fi;
  Q:=Q.stabilizer;
od;
Print("resolved_transversal_words\t",ResolveCount,"\n");
Print("resolve_ms\t",Runtime()-t,"\n");
SaveWorkspace("/workspace/shared/calendar-tooling/calendar7-dag-front-chain.ws");
Print("front_workspace_saved\n");
t:=Runtime();;
answer:=PartialFrontTransporter(P,frontT,frontS[1]);;
Print("first_found\t",answer.found,"\n");
if answer.found then
  Print("first_word_perm_matches\t",answer.word![2]=answer.perm,"\n");
  Print("first_dag_replay\t",EvalCalendarWord(answer.word,gens)=answer.perm,"\n");
  Print("first_nodes\t",ExportCalendarDAG([answer.word],"research/calendar-7x7/en-physical-review/first-target-dag.tsv"),"\n");
else
  Print("first_failed_index\t",answer.failedIndex,"\t",answer.reason,"\n");
fi;
Print("first_ms\t",Runtime()-t,"\n");
QUIT;
