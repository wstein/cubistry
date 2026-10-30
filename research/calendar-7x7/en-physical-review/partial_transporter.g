# Exact partial point transporter using a complete labeled stabilizer chain.
# The resulting SLP must still be independently replayed geometrically.
PartialFrontTransporter := function(chain,T,source)
  local stb,w,word,i,b,aim,q,pinv,linv,h,g;
  if Length(T)<>Length(source) then Error("target tuple length");fi;
  stb:=chain;w:=();word:=chain.idimage;
  for i in [1..Length(T)] do
    aim:=source[i]/w;
    b:=BasePoint(stb);
    if b<>T[i] then
      # Full base order is T followed by all remaining action points. Therefore
      # a skipped T point is fixed by the current stabilizer.
      if aim<>T[i] then
        return rec(found:=false,failedIndex:=i,reason:="fixed point mismatch");
      fi;
    else
      if not aim in stb.orbit then
        return rec(found:=false,failedIndex:=i,reason:="stabilizer orbit mismatch");
      fi;
      q:=aim;pinv:=();linv:=chain.idimage;
      while q<>b do
        pinv:=pinv*stb.transversal[q];
        linv:=linv*stb.transimages[q];
        q:=q^stb.transversal[q];
      od;
      h:=pinv^-1;
      w:=h*w;word:=linv^-1*word;
      stb:=stb.stabilizer;
    fi;
    if OnTuples(T{[1..i]},w)<>source{[1..i]} then
      Error("partial transporter invariant failed");
    fi;
  od;
  g:=w^-1;word:=word^-1;
  if OnTuples(source,g)<>T then Error("source-to-front mapping failed");fi;
  return rec(found:=true,perm:=g,word:=word);
end;

ExportLegalSLP := function(word,path,originalGenerators)
  local seeds,program,registers,last,line,dest,expr,stream,i,seedMap;
  if not IsStraightLineProgElm(word) then Error("not compact SLP");fi;
  seeds:=word![1].seeds;
  seedMap:=List(seeds,s->Position(originalGenerators,s));
  if fail in seedMap then Error("SLP contains an unproved derived seed");fi;
  program:=LinesOfStraightLineProgram(word![2]);
  stream:=OutputTextFile(path,false);;
  SetPrintFormattingStatus(stream,false);
  AppendTo(stream,"cubistry.calendar7.legal-slp.v1\n");
  AppendTo(stream,"inputs\t",Length(seeds),"\n");
  for i in [1..Length(seeds)] do
    AppendTo(stream,"seed\t",i,"\t",seedMap[i],"\n");
  od;
  registers:=Length(seeds);last:=fail;
  for line in program do
    if not IsEmpty(line) and IsInt(line[1]) then
      dest:=registers+1;registers:=dest;expr:=line;
    elif Length(line)=2 and IsList(line[1]) and IsInt(line[2]) then
      dest:=line[2];expr:=line[1];registers:=Maximum(registers,dest);
    else
      Error("unsupported non-scalar SLP line");
    fi;
    if Length(expr) mod 2<>0 or not ForAll(expr,IsInt) then Error("invalid SLP expression");fi;
    AppendTo(stream,"store\t",dest,"\t",JoinStringsWithSeparator(List(expr,String),","),"\n");
    last:=dest;
  od;
  if last=fail then Error("SLP has no result register");fi;
  AppendTo(stream,"result\t",last,"\n");
  CloseStream(stream);
end;
