# Candidate-generation labels with constant-time multiplication/inversion.
# These labels are NOT a proof authority: exported words require native replay.
DeclareCategory("IsCalendarWord",IsMultiplicativeElementWithInverse);
DeclareRepresentation("IsCalendarWordRep",IsPositionalObjectRep,[]);
CalendarWordFamily:=NewFamily("CalendarWordFamily",IsCalendarWord);;
CalendarWordType:=NewType(CalendarWordFamily,IsCalendarWord and IsCalendarWordRep);;
CalendarNodes:=[];;CalendarSeedCount:=0;;
CalendarNodeCache:=NewDictionary([1,1],true);;
CalendarWord:=function(id,perm)return Objectify(CalendarWordType,[id,perm]);end;;

InstallMethod(OneOp,[IsCalendarWord],function(w)return CalendarWord(0,());end);
InstallMethod(InverseOp,[IsCalendarWord],function(w)return CalendarWord(-w![1],w![2]^-1);end);
InstallMethod(\=,[IsCalendarWord,IsCalendarWord],function(a,b)return a![2]=b![2];end);
InstallMethod(\<,[IsCalendarWord,IsCalendarWord],function(a,b)return a![2]<b![2];end);
InstallMethod(Order,[IsCalendarWord],function(w)return Order(w![2]);end);
InstallMethod(ViewObj,[IsCalendarWord],w->Print("<legal-word-node:",w![1],">") );
InstallMethod(\*,[IsCalendarWord,IsCalendarWord],function(a,b)
  local x,y,key,id;
  x:=a![1];y:=b![1];
  if x=0 then return b;fi;
  if y=0 then return a;fi;
  if x=-y then return CalendarWord(0,());fi;
  key:=Immutable([x,y]);id:=LookupDictionary(CalendarNodeCache,key);
  if id=fail then
    Add(CalendarNodes,[x,y]);id:=Length(CalendarNodes);
    AddDictionary(CalendarNodeCache,key,id);
  fi;
  return CalendarWord(id,a![2]*b![2]);
end);

StartCalendarWords:=function(gens)
  local n;n:=Length(gens);
  CalendarSeedCount:=n;
  CalendarNodes:=List([1..n],i->[0,i]);
  CalendarNodeCache:=NewDictionary([1,1],true);
  return List([1..n],function(i)return CalendarWord(i,gens[i]);end);
end;

EvalCalendarWord:=function(word,originalGenerators)
  local used,visit,i,values,a,b,id;
  used:=BlistList([1..Length(CalendarNodes)],[]);
  visit:=function(id)
    id:=AbsInt(id);
    if id=0 or used[id] then return;fi;
    used[id]:=true;
    if id>CalendarSeedCount then
      visit(CalendarNodes[id][1]);visit(CalendarNodes[id][2]);
    fi;
  end;
  visit(word![1]);values:=[];
  for i in [1..Length(CalendarNodes)] do
    if used[i] then
      if i<=CalendarSeedCount then values[i]:=originalGenerators[i];
      else
        a:=CalendarNodes[i][1];b:=CalendarNodes[i][2];
        values[i]:=values[AbsInt(a)]^SignInt(a)*values[AbsInt(b)]^SignInt(b);
      fi;
    fi;
  od;
  id:=word![1];
  if id=0 then return ();fi;
  return values[AbsInt(id)]^SignInt(id);
end;

ExportCalendarDAG:=function(words,path)
  local used,visit,mapping,i,count,stream,mapped,w;
  used:=BlistList([1..Length(CalendarNodes)],[]);
  visit:=function(id)
    id:=AbsInt(id);
    if id=0 or used[id] then return;fi;
    used[id]:=true;
    if id>CalendarSeedCount then
      visit(CalendarNodes[id][1]);visit(CalendarNodes[id][2]);
    fi;
  end;
  for w in words do visit(w![1]);od;
  mapping:=List([1..CalendarSeedCount],i->i);count:=CalendarSeedCount;
  for i in [CalendarSeedCount+1..Length(CalendarNodes)] do
    if used[i] then count:=count+1;mapping[i]:=count;fi;
  od;
  mapped:=function(id)if id=0 then return 0;else return SignInt(id)*mapping[AbsInt(id)];fi;end;
  stream:=OutputTextFile(path,false);SetPrintFormattingStatus(stream,false);
  AppendTo(stream,"cubistry.calendar7.legal-dag.v1\t264\t",CalendarSeedCount,"\n");
  for i in [1..CalendarSeedCount] do AppendTo(stream,"generator\t",i,"\t",i,"\n");od;
  for i in [CalendarSeedCount+1..Length(CalendarNodes)] do
    if used[i] then
      AppendTo(stream,"product\t",mapping[i],"\t",mapped(CalendarNodes[i][1]),"\t",mapped(CalendarNodes[i][2]),"\n");
    fi;
  od;
  for i in [1..Length(words)] do AppendTo(stream,"result\t",i,"\t",mapped(words[i]![1]),"\n");od;
  CloseStream(stream);
  return count;
end;
