# Fast software tests for the global macro search (candidate tooling only).
# Optional: CALENDAR7_DAG=/path/to/all-targets-dag.tsv; otherwise the repository's
# compressed DAG is decompressed into a temporary directory.
using Test,Random
include(joinpath(@__DIR__,"search.jl"))
const G=GlobalSearch
const P=G.P
const M=G.M
const V=G.V

const ACTION=P.pose_action()
const A=M.Algebra(ACTION)
# Small but representative: single-layer commutators, middle-slice commutators,
# one-block conjugates, front-free setup pairs and plain words of length <= 2.
const SPEC=G.LibrarySpec(blocks=false,middle_slices=true,plain_max=2)
const LIB=G.build_library(ACTION,A,SPEC)

@testset "Macro library is legal and replays exactly" begin
    front=G.front_positions(ACTION)
    @test length(front)==49
    identity_occ=collect(UInt16,1:264)
    perms=Set{Vector{UInt16}}()
    @test length(LIB)>10000
    for m in LIB
        @test all(g->1<=abs(g)<=21,m.word)
        p=P.macro_word_perm(m.word,A.generators)
        # The stored sparse action equals the replayed word.
        @test G.apply(identity_occ,m)==UInt16.(invperm(Int.(p)))
        @test sort(Int.(m.fmoved))==[x for x in front if p[x]!=x]
        @test !isempty(m.fmoved)
        @test m.cost==M.htm(m.word)==P.chain_metrics(m.word,ACTION).htm
        push!(perms,p)
    end
    @test length(perms)==length(LIB)
    @test issorted(LIB;by=m->(m.cost,m.word))
    # Building twice gives the identical library (determinism).
    again=G.build_library(ACTION,A,SPEC)
    @test map(m->m.word,again)==map(m->m.word,LIB)
    capped=G.build_library(ACTION,A,G.LibrarySpec(blocks=false,middle_slices=false,conjugates=false,front_free_setups=false,plain_max=2,front_cap=3))
    @test all(m->1<=length(m.fmoved)<=3,capped)
    @test_throws ArgumentError G.library_spec(:L9)
end

@testset "Middle-slice turns and commutators equal their expansion" begin
    alphabet=P.chain_alphabet(ACTION)
    for axis in 1:3
        m=G.middle_slice(ACTION,axis)
        @test all(g->1<=abs(g)<=21,m)
        @test M.htm(m)==6
        @test P.macro_word_perm(m,A.generators)==alphabet.generators[21+axis]
        for y in ([g] for g in 1:21 if g%7!=0 && ACTION.moves[g][1]!=axis)
            expanded=vcat(m,y,P.macro_inverse(m),P.macro_inverse(y))
            abstract=[21+axis,y[1],-(21+axis),-y[1]]
            @test P.macro_word_perm(expanded,A.generators)==P.macro_word_perm(abstract,alphabet.generators)
        end
    end
    # The library contains macros whose cheapest word uses a middle slice; with
    # middle slices disabled those permutations are absent.
    plain=G.build_library(ACTION,A,G.LibrarySpec(blocks=false,middle_slices=false,plain_max=2))
    plainperms=Set(P.macro_word_perm(m.word,A.generators) for m in plain)
    @test count(m->!(P.macro_word_perm(m.word,A.generators) in plainperms),LIB)>0
end

@testset "Don't-care progress counter" begin
    front=G.front_positions(ACTION)
    rng=MersenneTwister(2027)
    weights=[Float64(k) for k in 1:11]
    perposition=[weights[div(x-1,24)+1] for x in 1:264]
    m=first(filter(m->length(m.fmoved)>=3,LIB))
    occ=collect(UInt16,1:264)
    moved=Set(Int.(m.fmoved))
    # Positions moved by m are wrong before and after: changes count zero.
    allowed=falses(264,264)
    for x in front;x in moved || (allowed[occ[x],x]=true);end
    pr=G.Problem(allowed,front,perposition)
    @test G.progress(pr,occ,m)==(0,0.0)
    @test G.unsat(pr,G.apply(occ,m))==G.unsat(pr,occ)==length(moved)
    # Allow exactly what m brings in: every moved position is gained.
    next=G.apply(occ,m)
    for x in moved;allowed[next[x],x]=true;end
    pr=G.Problem(allowed,front,perposition)
    @test G.progress(pr,occ,m)==(length(moved),sum(perposition[x] for x in moved))
    # Undoing it loses them again.
    @test G.progress(pr,next,m)[1]<=0
    # Incremental deltas equal full recomputation on random states and targets.
    for _ in 1:200
        state=P.macro_word_perm(rand(rng,[-20:-1;1:20],30),A.generators)
        occ=G.occupants(state)
        allowed=falses(264,264)
        for x in front,o in rand(rng,1:264,40);allowed[o,x]=true;end
        for x in front;rand(rng)<0.5 && (allowed[occ[x],x]=true);end
        pr=G.Problem(allowed,front,perposition)
        mac=LIB[rand(rng,eachindex(LIB))]
        after=G.apply(occ,mac)
        d,dw=G.progress(pr,occ,mac)
        @test d==G.unsat(pr,occ)-G.unsat(pr,after)
        @test isapprox(dw,G.weighted_unsat(pr,occ)-G.weighted_unsat(pr,after);atol=1e-9)
    end
end

function test_dag(dir)
    path=get(ENV,"CALENDAR7_DAG","")
    isempty(path) || return path
    path=joinpath(dir,"all-targets-dag.tsv")
    gz=joinpath(@__DIR__,"..","en-physical-review","all-targets-dag.tsv.gz")
    open(path,"w") do io;run(pipeline(`gzip -dc $gz`;stdout=io));end
    path
end

@testset "Reduced-budget integration on a cheap edge (Feb -> Mar 2026)" begin
    mktempdir() do dir
        dag=test_dag(dir)
        proof=P.replay_dag(dag);action=proof.action;a=M.Algebra(action)
        source=P.read_physical(G.SOURCE_PRINT)
        start=P.signed_perm(proof.registers,proof.targets[2])
        P.validate_front(P.decode_physical(source,start,action),P.macro_calendar_target(2026,2))
        target=P.macro_calendar_target(2026,3)
        library=G.build_library(action,a,G.library_spec(:L1))
        params=G.Params(width=8,maxdepth=30)
        first_run=G.search_edge(source,start,target,action,a,library,params)
        @test first_run.status==:solved
        @test all(g->1<=abs(g)<=21,first_run.word)
        state=P.compose(start,P.macro_word_perm(first_run.word,a.generators))
        @test state==first_run.state
        P.validate_front(P.decode_physical(source,state,action),target)
        @test first_run.htm==M.htm(first_run.word)>0
        second_run=G.search_edge(source,start,target,action,a,library,params)
        @test second_run.word==first_run.word
        # A too-small budget is reported as UNKNOWN, not as a solution.
        tiny=G.search_edge(source,start,target,action,a,library,G.Params(width=1,maxdepth=1))
        @test isnothing(tiny.word) && tiny.status in (:maxdepth,:stalled,:patience)

        # Command line: replay chain-1 through Feb 2026, search Mar 2026, export.
        # L1 stalls on this start (one wrong position whose only allowed piece
        # sits on another front position); L4 finishes.
        out=joinpath(dir,"out")
        chain=joinpath(@__DIR__,"..","minimax","verification","chain-1.moves.tsv")
        @test G.main([dag,chain,"1","2026","3",out,"library=L4","width=8","maxdepth=30"])==0
        exported=V.read_chain(joinpath(out,"candidate.moves.tsv"))
        @test length(exported.edges)==2
        @test (exported.edges[2].year,exported.edges[2].month)==(2026,3)
        # Format smoke check with the unchanged Julia chain verifier. This is a
        # software test, not a verification receipt (Flix is not run here).
        receipt=V.verify_chain(dag,joinpath(out,"candidate.moves.tsv");output=devnull)
        @test length(receipt.receipts)==2
        @test isfile(joinpath(out,"summary.tsv")) && isfile(joinpath(out,"trace.tsv"))
        @test_throws AssertionError G.main([dag,chain,"1","2026","4",joinpath(dir,"bad")])
    end
end
