# Load with GAP -L calendar7-dag-front-chain.ws. P has exact front-base order.
Read("research/calendar-7x7/en-physical-review/partial_transporter.g");;
Read("research/calendar-7x7/english/evidence/front-goals.g");;
if BaseStabChain(P){[1..49]}<>frontT then Error("front base order changed");fi;
words:=[];;failures:=[];;t:=Runtime();;
for i in [1..Length(frontS)] do
  answer:=PartialFrontTransporter(P,frontT,frontS[i]);
  if answer.found then
    if answer.word![2]<>answer.perm then Error("DAG label permutation mismatch");fi;
    if OnTuples(frontS[i],answer.perm)<>frontT then Error("goal point mismatch");fi;
    Add(words,answer.word);
    Print("target\t",i,"\tFOUND\n");
  else
    Add(failures,i);
    Print("target\t",i,"\tUNKNOWN\t",answer.failedIndex,"\t",answer.reason,"\n");
  fi;
od;
Print("all_targets_ms\t",Runtime()-t,"\n");
Print("found\t",Length(words),"\tfailed\t",Length(failures),"\n");
if IsEmpty(failures) then
  t:=Runtime();
  Print("export_nodes\t",ExportCalendarDAG(words,"research/calendar-7x7/en-physical-review/all-targets-dag.tsv"),"\n");
  Print("export_ms\t",Runtime()-t,"\n");
fi;
QUIT;
