#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Best-effort corner choice for February/Sunday/28 on print B: one-edge chains (root 2026-05, list [month]) whose front shows the
# month board with exactly one wrong cell, (7,1) or (7,7). Replays the Julia checker and the independent verifier on the stored chains
# and compares with the stored receipts; the Flix receipts must equal the Julia receipts byte for byte. A chain with a wrong cell
# that is not the real one must be rejected. About 2 minutes: julia test_corner_choice.jl
using Test, SHA
const B=@__DIR__
const EV=normpath(joinpath(B,".."))
const CH=normpath(joinpath(EV,".."))
const PB=joinpath(EV,"print-b")
sha(p)=bytes2hex(sha256(read(p)))
const CASES=[(m,rc) for m in ("2026-02","2037-02","2043-02") for rc in ("71","77")]
function envs(d)
    Dict("CAL7_WINDOW_LAYOUT"=>joinpath(PB,"layout.tsv"),"CAL7_WINDOW_LAYOUT_SHA256"=>sha(joinpath(PB,"layout.tsv")),
         "CAL7_WINDOW_MONTHS"=>joinpath(d,"months.tsv"),"CAL7_WINDOW_MONTHS_SHA256"=>strip(read(joinpath(d,"months.sha256"),String)),
         "CAL7_WINDOW_PRINT_SHA"=>sha(joinpath(PB,"printing.tsv")),"CAL7_ROOT_MONTH"=>"2026-05")
end
function run_tool(script,d,chain,states)
    out=IOBuffer();err=IOBuffer()
    cmd=addenv(`$(Base.julia_cmd()) --startup-file=no $(joinpath(CH,script)) $(joinpath(PB,"layout.tsv")) $(joinpath(PB,"printing.tsv")) $chain $states`,envs(d))
    ok=success(pipeline(cmd;stdout=out,stderr=err))
    (ok,String(take!(out)),String(take!(err)))
end
@testset "February best-effort corner choice on print B" begin
    @test sha(joinpath(PB,"printing.tsv"))==split(first(filter(l->endswith(l,"  printing.tsv"),readlines(joinpath(PB,"sha256.txt")))))[1]
    for (m,rc) in CASES
        d=joinpath(B,"$m-$rc");r,c=rc[1],rc[2]
        @testset "$m wrong cell ($r,$c)" begin
            ok,out,err=run_tool("check.jl",d,joinpath(d,"moves.tsv"),joinpath(d,"states"))
            @test ok && out==read(joinpath(d,"julia.tsv"),String)
            @test occursin("\tBEST_EFFORT\t1\t$r,$c\n",out) && occursin("\nstatus\texact\t0\tbest_effort\t1\n",out) && occursin("\nverdict\tBEST_EFFORT\t",out)
            ok,out,err=run_tool("verify_chain.jl",d,joinpath(d,"moves.tsv"),joinpath(d,"states"))
            @test ok && out==read(joinpath(d,"independent.tsv"),String)
            @test occursin("independent-verdict\tACCEPT_BEST_EFFORT_CHAIN",out)
            @test read(joinpath(d,"flix.tsv"),String)==read(joinpath(d,"julia.tsv"),String)
        end
    end
    # mutation: the listed wrong cell is not the real one -> every checker must refuse (here the Julia checker and the verifier)
    mktempdir() do tmp
        d=joinpath(B,"2037-02-71");mv=read(joinpath(d,"moves.tsv"),String)
        @test occursin("wrong\t7\t1\n",mv)
        bad=joinpath(tmp,"moves.tsv");write(bad,replace(mv,"wrong\t7\t1\n"=>"wrong\t4\t4\n"))
        for s in ("check.jl","verify_chain.jl")
            ok,out,err=run_tool(s,d,bad,joinpath(d,"states"))
            @test !ok && occursin("strict",out*err)
        end
    end
    # the cost table lists nine candidates for (7,1) and one for (7,7) with the stored minimum
    rows=[split(l,'\t') for l in readlines(joinpath(B,"costs.tsv"))[2:end]]
    @test count(r->r[2]=="7,1",rows)==9 && count(r->r[2]=="7,7",rows)==1
    @test minimum(parse(Int,r[5]) for r in rows if r[2]=="7,1")==436 && only(parse(Int,r[5]) for r in rows if r[2]=="7,7")==443
    # the producer reproduces the stored chain (needs the full research toolchain; about 15 s)
    mktempdir() do tmp
        out=joinpath(tmp,"o")
        pb=PB;p=pipeline(`$(Base.julia_cmd()) --startup-file=no --threads=2 $(joinpath(B,"corner_edge.jl")) $out $(joinpath(pb,"layout.tsv")) $(joinpath(pb,"printing.tsv")) 2037-02 7 1 cand=3`;stdout=devnull,stderr=devnull)
        @test success(p)
        @test read(joinpath(out,"moves.tsv"),String)==read(joinpath(B,"2037-02-71","moves.tsv"),String)
    end
end
