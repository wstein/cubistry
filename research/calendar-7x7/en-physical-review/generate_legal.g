# Run with GAP --quitonbreak. Output is a candidate requiring native replay.
Read("research/calendar-7x7/en-physical-review/action.g");;
Read("research/calendar-7x7/en-physical-review/known_order.g");;
Read("research/calendar-7x7/en-physical-review/front_base.g");;
Read("research/calendar-7x7/en-physical-review/dag_words.g");;
Read("research/calendar-7x7/en-physical-review/partial_transporter.g");;
Read("research/calendar-7x7/en-physical-review/rebase_legal_chain.g");;
if not IsBound(calendarGoalFile) then
  calendarGoalFile:="research/calendar-7x7/english/evidence/front-goals.g";
fi;
if not IsBound(calendarWitnessFile) then
  calendarWitnessFile:="research/calendar-7x7/en-physical-review/all-targets-dag.tsv";
fi;
Read(calendarGoalFile);;
if T<>frontT then Error("front point order mismatch");fi;
labels:=StartCalendarWords(gens);;H:=Group(labels);;
map:=GroupGeneralMappingByImages(G,H,gens,labels);;SetIsTotal(map,true);;
t:=Runtime();;
S:=StabChainMutable(map,rec(base:=fullbase));;
Print("dag_sgs_ms\t",Runtime()-t,"\n");
rebase:=RebaseLegalChain(S,frontT);;P:=rebase.chain;;
Print("rebase_resolve_ms\t",rebase.milliseconds,"\n");
Print("resolved_transversals\t",rebase.resolved,"\n");
words:=[];;t:=Runtime();;
for i in [1..Length(frontS)] do
  answer:=PartialFrontTransporter(P,frontT,frontS[i]);
  if not answer.found then Error("no candidate transporter at target ",i," point ",answer.failedIndex);fi;
  if answer.word![2]<>answer.perm then Error("word label mismatch");fi;
  if OnTuples(frontS[i],answer.perm)<>frontT then Error("front target mismatch");fi;
  Add(words,answer.word);
od;
Print("transport_all_ms\t",Runtime()-t,"\n");
Print("candidate_targets\t",Length(words),"\n");
Print("export_nodes\t",ExportCalendarDAG(words,calendarWitnessFile),"\n");
Print("candidate_generation\tCOMPLETE_REQUIRES_INDEPENDENT_NATIVE_REPLAY\n");
QUIT;
