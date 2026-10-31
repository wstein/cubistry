# Generator-side diagnostic (not a proof): radius-3/4 set propagation of the
# blank-profile M chain for prints/blank.txt from one sampled start, open walk,
# reporting whether the exact start state is reached again at 59->00.
include(joinpath(@__DIR__, "solve.jl"))
using Random
toks=split(strip(read(joinpath(@__DIR__, "prints", "blank.txt"),String)))
pr=Print([t[1]=='_' ? ' ' : t[1] for t in toks],[parse(Int,t[2:end]) for t in toks]); sh=showtable(pr)
b3=makeball(3);b4=makeball(4);c3=makeclasses(b3);c4=makeclasses(b4)
rng=MersenneTwister(11)
tm=[target('M',v,true) for v in 0:59]
s=IDSTATE; while true; global s=applymove(s,rand(rng,1:18)); shows(s,sh,tm[1]) && break; end
R=[key(s)]
for i in 2:61
  need = i<=60 ? tm[i] : tm[1]
  n3=stepset(R,sh,need,b3,c3,Work(c3.nwords))
  r=3; nx=n3
  if isempty(n3); nx=stepset(R,sh,need,b4,c4,Work(c4.nwords)); r=4; end
  println(i-2,"->",(i-1)%60," r=$r size=",length(nx), i==61 ? " closes=$(insorted(nx,key(s)))" : "")
  isempty(nx) && break
  global R=nx
end
