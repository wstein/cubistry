Read("research/calendar-7x7/en-physical-review/action.g");;
Read("research/calendar-7x7/en-physical-review/known_order.g");;
Read("research/calendar-7x7/en-physical-review/front_base.g");;
Read("research/calendar-7x7/en-physical-review/dag_words.g");;
Read("research/calendar-7x7/en-physical-review/partial_transporter.g");;
Read("research/calendar-7x7/english/evidence/front-goals.g");;
if T<>frontT then Error("front base order differs");fi;
labels := StartCalendarWords(gens);;H := Group(labels);;
map := GroupGeneralMappingByImages(G,H,gens,labels);;
SetIsTotal(map,true);;
Print("known_order_digits\t",Length(String(Size(G))),"\n");
t := Runtime();;
S := StabChainMutable(map,rec(base:=fullbase));;
Print("dag_sgs_ms\t",Runtime()-t,"\n");
Print("dag_nodes\t",Length(CalendarNodes),"\n");
SaveWorkspace("/workspace/shared/calendar-tooling/calendar7-dag-group.ws");
Print("workspace_saved\n");
t := Runtime();;
answer := PartialFrontTransporter(S,frontT,frontS[1]);;
Print("first_found\t",answer.found,"\n");
if answer.found then
  Print("first_replay\t",EvalCalendarWord(answer.word,gens)=answer.perm,"\n");
  Print("first_nodes\t",ExportCalendarDAG([answer.word],"research/calendar-7x7/en-physical-review/first-target-dag.tsv"),"\n");
else
  Print("first_failed_index\t",answer.failedIndex,"\t",answer.reason,"\n");
fi;
Print("first_ms\t",Runtime()-t,"\n");
QUIT;
