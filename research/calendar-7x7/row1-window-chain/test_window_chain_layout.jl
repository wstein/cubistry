#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Tests of the layout input of the producers window_chain.jl and beam_edge.jl: CAL7_WINDOW_LAYOUT and CAL7_WINDOW_LAYOUT_SHA256
# (the names of run_checks.sh), the pin check and the layout SHA-256 recorded in PROGRESS.txt and segments.tsv.
#   julia --threads=4 test_window_chain_layout.jl          # unit tests and the smoke runs (no chain computation)
#   CAL7_LAYOUT_TEST_EDGE=1 julia --threads=4 test_window_chain_layout.jl   # also one real edge into April 2027 (several minutes)
using Test, SHA
include(joinpath(@__DIR__,"window_chain_lib.jl"))
using .WindowChainLib
const CAL=normpath(joinpath(@__DIR__,".."))
const DEFAULT_LAYOUT=joinpath(CAL,"row1-revision","layout.tsv")
const ALT_LAYOUT=joinpath(@__DIR__,"evidence","window-2037-01","layout.tsv")       # April tiles AP|RIL
const ALT_PRINT=joinpath(@__DIR__,"evidence","window-2037-01","printing.tsv")
sha(p)=bytes2hex(sha256(read(p)))
@testset "layout input" begin
    @testset "layout_input (environment contract)" begin
        @test layout_input(DEFAULT_LAYOUT,Dict{String,String}())==(DEFAULT_LAYOUT,sha(DEFAULT_LAYOUT))    # default: the built-in layout, no pin needed
        @test layout_input(DEFAULT_LAYOUT,Dict("CAL7_WINDOW_LAYOUT_SHA256"=>sha(DEFAULT_LAYOUT)))==(DEFAULT_LAYOUT,sha(DEFAULT_LAYOUT))
        @test_throws "CAL7_WINDOW_LAYOUT_SHA256" layout_input(DEFAULT_LAYOUT,Dict("CAL7_WINDOW_LAYOUT_SHA256"=>"0"^64))   # a pin also guards the default
        @test layout_input(DEFAULT_LAYOUT,Dict("CAL7_WINDOW_LAYOUT"=>ALT_LAYOUT,"CAL7_WINDOW_LAYOUT_SHA256"=>sha(ALT_LAYOUT)))==(ALT_LAYOUT,sha(ALT_LAYOUT))
        @test sha(ALT_LAYOUT)!=sha(DEFAULT_LAYOUT)
        @test_throws "CAL7_WINDOW_LAYOUT_SHA256" layout_input(DEFAULT_LAYOUT,Dict("CAL7_WINDOW_LAYOUT"=>ALT_LAYOUT,"CAL7_WINDOW_LAYOUT_SHA256"=>"0"^64))
        @test_throws "needs CAL7_WINDOW_LAYOUT_SHA256" layout_input(DEFAULT_LAYOUT,Dict("CAL7_WINDOW_LAYOUT"=>ALT_LAYOUT))
        @test_throws "64 lowercase hex" layout_input(DEFAULT_LAYOUT,Dict("CAL7_WINDOW_LAYOUT"=>ALT_LAYOUT,"CAL7_WINDOW_LAYOUT_SHA256"=>uppercase(sha(ALT_LAYOUT))))
        @test_throws "layout not found" layout_input(DEFAULT_LAYOUT,Dict("CAL7_WINDOW_LAYOUT"=>joinpath(@__DIR__,"nope.tsv"),"CAL7_WINDOW_LAYOUT_SHA256"=>"0"^64))
    end
    @testset "segment row and resume carry the layout SHA-256" begin
        r=segment_row(run_id="1",research_ref="a"^40,library="L5",width="40",lambda="3",print_sha="b"^64,months_sha="c"^64,root="2026-05",edges_from=0,edges_to=1,layout_sha="d"^64)
        @test split(r,'\t')[end]=="d"^64 && occursin("layout_sha256",SEGMENTS_HEADER)
        mktempdir() do d
            p=joinpath(d,"segments.tsv");write(p,join([SEGMENTS_HEADER,r],'\n')*"\n")
            @test read_segments(p)==[r]
            @test check_segments_layout([r],"d"^64)===nothing
            @test_throws "layout" check_segments_layout([r],"e"^64)
        end
    end
    @testset "window_chain.jl as a process" begin
        mktempdir() do d
            months=joinpath(d,"months.tsv");write(months,"2027-04\n")
            function producer(out,args...;layout=nothing,pin=nothing)      # (exit code, stderr text)
                c=addenv(`$(Base.julia_cmd()) --startup-file=no --threads=4 $(joinpath(@__DIR__,"window_chain.jl")) $out $ALT_PRINT $args`,
                    "CAL7_WINDOW_MONTHS"=>months,"CAL7_WINDOW_MONTHS_SHA256"=>sha(months),"CAL7_ROOT_MONTH"=>"2026-05","CAL7_WINDOW_PRINT_SHA"=>sha(ALT_PRINT),
                    (layout===nothing ? () : ("CAL7_WINDOW_LAYOUT"=>layout,))...,(pin===nothing ? () : ("CAL7_WINDOW_LAYOUT_SHA256"=>pin,))...)
                err=joinpath(d,"err-"*basename(out));code=run(pipeline(ignorestatus(c);stdout=devnull,stderr=err)).exitcode
                code,read(err,String)
            end
            progress(out)=Dict(String.(split(l,'='))[1]=>String.(split(l,'='))[2] for l in readlines(joinpath(out,"PROGRESS.txt")))
            # alternative layout with its pin: recorded in PROGRESS.txt and segments.tsv (exit 3: no edge was requested)
            o1=joinpath(d,"alt");@test producer(o1,"max_edges=0";layout=ALT_LAYOUT,pin=sha(ALT_LAYOUT))[1]==3
            @test progress(o1)["layout_sha256"]==sha(ALT_LAYOUT)
            @test split(read_segments(joinpath(o1,"segments.tsv"))[1],'\t')[end]==sha(ALT_LAYOUT)
            # wrong pin: hard error before any output (OUT is not even created)
            o2=joinpath(d,"wrong");c2,e2=producer(o2,"max_edges=0";layout=ALT_LAYOUT,pin="0"^64);@test !(c2 in (0,3)) && occursin("differs from CAL7_WINDOW_LAYOUT_SHA256",e2) && !ispath(o2)
            # no layout variables: the built-in layout, whose SHA-256 is recorded (behavior unchanged)
            o3=joinpath(d,"default");@test producer(o3,"max_edges=0")[1]==3 && progress(o3)["layout_sha256"]==sha(DEFAULT_LAYOUT)
            # one real edge into April 2027 with the AP|RIL layout: the new state shows AP and RIL
            o4=joinpath(d,"edge");@test producer(o4,"max_edges=1";layout=ALT_LAYOUT,pin=sha(ALT_LAYOUT))[1]==0
            texts=Set(split(l,'\t')[6] for l in readlines(joinpath(o4,"states","state-02.tsv"))[2:end])
            @test "AP" in texts && "RIL" in texts && !("APR" in texts)
            # resume (prior=) on the same layout runs through; on another layout it fails hard at the segment layout check
            c5,e5=producer(joinpath(d,"resume-same"),"prior=$o4";layout=ALT_LAYOUT,pin=sha(ALT_LAYOUT));@test c5==0 && progress(joinpath(d,"resume-same"))["edges_total"]=="1" && progress(joinpath(d,"resume-same"))["layout_sha256"]==sha(ALT_LAYOUT)
            c6,e6=producer(joinpath(d,"resume-other"),"prior=$o4");@test c6!=0 && occursin("layout of prior segment 1",e6) && !isfile(joinpath(d,"resume-other","states","state-01.tsv"))   # the check precedes the copy of the prior states
        end
    end
    @testset "beam_edge.jl as a process (greedy edge 2026-12 of the stored 2029-12 chain)" begin
        mktempdir() do d
            w=joinpath(@__DIR__,"evidence","window-2029-12")
            function beam_edge(out;layout=nothing,pin=nothing)
                c=addenv(`$(Base.julia_cmd()) --startup-file=no $(joinpath(@__DIR__,"beam_edge.jl")) $out $(joinpath(w,"printing.tsv")) $(joinpath(w,"moves.tsv")) $(joinpath(w,"states")) 2026 12 mode=greedy`,
                    (layout===nothing ? () : ("CAL7_WINDOW_LAYOUT"=>layout,))...,(pin===nothing ? () : ("CAL7_WINDOW_LAYOUT_SHA256"=>pin,))...)
                log=joinpath(d,"log-"*basename(out));code=run(pipeline(ignorestatus(c);stdout=log,stderr=log)).exitcode
                code,read(log,String)
            end
            c1,l1=beam_edge(joinpath(d,"default"))      # same result as the base: HTM=271, now with the layout SHA-256
            @test c1==0 && occursin(" HTM=271 ",l1) && occursin("RESULT layout_sha256=$(sha(DEFAULT_LAYOUT)) ",l1)
            c2,l2=beam_edge(joinpath(d,"pinned");layout=DEFAULT_LAYOUT,pin=sha(DEFAULT_LAYOUT))
            @test c2==0 && occursin(" HTM=271 ",l2) && occursin("RESULT layout_sha256=$(sha(DEFAULT_LAYOUT)) ",l2)
            o3=joinpath(d,"wrong");c3,l3=beam_edge(o3;layout=DEFAULT_LAYOUT,pin="0"^64)
            @test c3!=0 && occursin("differs from CAL7_WINDOW_LAYOUT_SHA256",l3) && !ispath(o3)
        end
    end
    # The stored 2029-12 chain has the APR|IL print, so beam_edge.jl cannot run it with AP|RIL. The AP|RIL print of window-2037-01 has no stored chain; the
    # fixture is its identity state (window_chain.jl max_edges=0), month list [2026-05, 2027-04] (one bridge edge), beam library L5 width 40 as the producer.
    @testset "beam_edge.jl with the AP|RIL layout (edge 2027-04, month list)" begin
        mktempdir() do d
            months=joinpath(d,"months.tsv");write(months,"2026-05\n2027-04\n")
            menv=("CAL7_WINDOW_MONTHS"=>months,"CAL7_WINDOW_MONTHS_SHA256"=>sha(months),"CAL7_WINDOW_PRINT_SHA"=>sha(ALT_PRINT),"CAL7_WINDOW_LAYOUT"=>ALT_LAYOUT)
            fix=joinpath(d,"fixture")
            @test run(pipeline(ignorestatus(addenv(`$(Base.julia_cmd()) --startup-file=no --threads=4 $(joinpath(@__DIR__,"window_chain.jl")) $fix $ALT_PRINT max_edges=0`,menv...,"CAL7_WINDOW_LAYOUT_SHA256"=>sha(ALT_LAYOUT)));stdout=devnull,stderr=devnull)).exitcode==3
            function beam_edge(out,pin)
                c=addenv(`$(Base.julia_cmd()) --startup-file=no --threads=4 $(joinpath(@__DIR__,"beam_edge.jl")) $out $ALT_PRINT $(joinpath(fix,"chain.moves.tsv")) $(joinpath(fix,"states")) 2027 4 mode=beam library=L5 width=40`,menv...,"CAL7_WINDOW_LAYOUT_SHA256"=>pin)
                log=joinpath(d,"log-"*basename(out));code=run(pipeline(ignorestatus(c);stdout=log,stderr=log)).exitcode
                code,read(log,String)
            end
            c1,l1=beam_edge(joinpath(d,"ok"),sha(ALT_LAYOUT))
            @test c1==0 && occursin("RESULT layout_sha256=$(sha(ALT_LAYOUT)) ",l1)
            texts=Set(split(l,'\t')[6] for l in readlines(joinpath(d,"ok","state-02.tsv"))[2:end])      # the target state of the edge
            @test "AP" in texts && "RIL" in texts && !("APR" in texts)
            c2,l2=beam_edge(joinpath(d,"wrong"),"0"^64);@test c2!=0 && occursin("differs from CAL7_WINDOW_LAYOUT_SHA256",l2) && !ispath(joinpath(d,"wrong"))
        end
    end
end
