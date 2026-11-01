# Pure stacked split with month-letter scheme A (research only).
# Layout: F31 24/31 red, S30 23/30 red, S31 23/30 red + 24/31 dark, no overflow marks;
# month letters January-September at columns 5-7, October-December at columns 2-4.
include(joinpath(@__DIR__,"stacked_common.jl"))
const PURE_VARIANT="F31=bfold,S30=bfold,S31=bfold;H=555555555222"
const PR99_PRINT=joinpath(@__DIR__,"..","english","evidence","physical-print.tsv")

# The artwork class a printed surface supplies, and its surface orbit: the class of the
# requirement it shows upright (angle 0) on the one front cell of its orbit where it
# is upright. Blank surfaces supply the blank class.
function surface_class(s)
    for r in 1:7,c in 1:7,rot in ROTATIONS
        pos=(c-4,4-r,3)
        (rotate(s.home,rot)==pos && rotate(s.normal,rot)==FRONT_NORMAL) || continue
        isempty(s.text) && return (orbit(r,c),("","0","blank"))
        findfirst(==(rotate(s.up,rot)),IMAGE_UPS)==1 || continue
        a=artwork(s.text,s.ink,r,c)
        return (orbit(r,c),(a[1],string(a[2]),a[3]))
    end
    error("surface reaches no front cell upright")
end
# Required strict demand per orbit: class => peak, and the blank peak.
function pure_requirement(goals)
    req=Dict{Tuple{Int,Int},Dict{NTuple{3,String},Int}}()
    for k in sort!(unique(orbit(r,c) for r in 1:7,c in 1:7))
        peak=Dict{NTuple{3,String},Int}()
        for t in goals
            counts=Dict{NTuple{3,String},Int}()
            for r in 1:7,c in 1:7
                orbit(r,c)==k || continue
                g,ink=t.board[r,c]
                key=isempty(g) ? ("","0","blank") : (a=artwork(g,ink,r,c);(a[1],string(a[2]),a[3]))
                counts[key]=get(counts,key,0)+1
            end
            for (a,v) in counts;peak[a]=max(get(peak,a,0),v);end
        end
        req[k]=peak
    end
    req
end
# Strict print supply check: in every orbit, each required class (blank included)
# must be supplied by at least as many surfaces as its peak demand.
function print_supply(source,goals)
    req=pure_requirement(goals);have=Dict{Tuple{Int,Int},Dict{NTuple{3,String},Int}}()
    for s in source
        k,a=surface_class(s);d=get!(have,k,Dict{NTuple{3,String},Int}());d[a]=get(d,a,0)+1
    end
    short=0
    for k in sort!(collect(keys(req)))
        h=get(have,k,Dict{NTuple{3,String},Int}())
        need=sum(v for (a,v) in req[k] if a[3]!="blank";init=0);blank=get(req[k],("","0","blank"),0)
        printed=sum(v for (a,v) in h if a[3]!="blank";init=0);blanks=get(h,("","0","blank"),0)
        missing=sum(max(0,v-get(h,a,0)) for (a,v) in req[k];init=0);short+=missing
        println("pure-print-orbit\t",k[1],'\t',k[2],'\t',need,'\t',blank,'\t',printed,'\t',blanks,'\t',missing)
    end
    short
end
function check_pure(new_path,dag_path,targets)
    @assert bytes2hex(sha256(read(PR99_PRINT)))==PR99_PRINT_SHA "unchanged PR99 printing provenance"
    old=read_physical(PR99_PRINT);source=read_physical(new_path)
    for id in 1:294
        a=old[id];b=source[id]
        @assert (a.piece,a.home,a.normal)==(b.piece,b.home,b.normal) "surface identity changed at $id"
        (a.text,a.ink,a.up)==(b.text,b.ink,b.up) && continue
        println("pure-print-change\t",id,'\t',a.text,'\t',a.ink,'\t',b.text,'\t',b.ink,'\t',a.up==b.up ? "same-up" : "new-up")
    end
    goals=stacked_goals(PURE_VARIANT)
    ids=targets=="all" ? collect(1:91) : [canonical_integer(String(t)) for t in split(targets,',')]
    @assert !isempty(ids) && allunique(ids) && all(1<=i<=91 for i in ids) "TARGETS must be distinct ids 1..91 or all"
    short=print_supply(source,goals)
    proof=replay_dag(dag_path);failed=Int[]
    for id in ids
        state=decode_physical(source,signed_perm(proof.registers,proof.targets[id]),proof.action)
        cell=front_failure(state,goals[id].board,"strict");ok=cell=="-\t-\t-\t-"
        ok || push!(failed,id)
        println("pure-target\t",id,'\t',goals[id].year,'\t',goals[id].month,'\t',ok ? "PASS" : "FAIL",'\t',cell,'\t',state_digest(state))
    end
    printed=count(s->!isempty(s.text),source)
    verdict=isempty(failed) && short==0 ? "ACCEPT" : "REJECT"
    println("pure-summary\t",verdict,'\t',length(ids)-length(failed),'\t',length(failed),'\t',short,'\t',printed)
    @assert short==0 "print misses $short required class copies"
    @assert isempty(failed) "$(length(failed)) of $(length(ids)) states fail the pure-split front: targets $(join(failed,","))"
end
# Cubie-level front matchability (design check): for each display and body orbit, the
# number of front cells a maximum matching of cells to cubies leaves unmatched (two
# stickers on one cubie cannot serve two cells at once). Kuhn's augmenting paths.
function unmatched_count(source,board)
    total=0
    for key in unique(bodykey(h) for h in all_homes())
        hs=[h for h in all_homes() if bodykey(h)==key]
        cs=[(r,c) for r in 1:7 for c in 1:7 if bodykey((c-4,4-r,3))==key]
        stick=Dict(h=>filter(s->s.home==h,source) for h in hs)
        adj=[[j for j in eachindex(hs) if !isempty(piece_options(stick[hs[j]],hs[j],(c-4,4-r,3),board[r,c]))] for (r,c) in cs]
        owner=Dict{Int,Int}()
        function aug(i,seen)
            for j in adj[i]
                j in seen && continue
                push!(seen,j)
                if !haskey(owner,j) || aug(owner[j],seen);owner[j]=i;return true;end
            end
            false
        end
        total+=count(i->!aug(i,Set{Int}()),eachindex(cs))
    end
    total
end
function matchability_report(print_path)
    source=read_physical(print_path);goals=stacked_goals(PURE_VARIANT);bad=0
    for (id,g) in enumerate(goals)
        u=unmatched_count(source,g.board)
        u>0 && (bad+=1;println("pure-unmatched\t",id,'\t',g.year,'\t',g.month,'\t',u))
    end
    println("pure-matchability\t",bad)
    @assert bad==0 "$bad displays have no cubie-level front matching"
end
