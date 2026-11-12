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
    @testset "producer smoke (max_edges=0, no edge solved)" begin
        mktempdir() do d
            months=joinpath(d,"months.tsv");write(months,"2027-04\n")
            producer(out,args...;layout=nothing,pin=nothing)=begin
                c=addenv(`$(Base.julia_cmd()) --startup-file=no --threads=2 $(joinpath(@__DIR__,"window_chain.jl")) $out $ALT_PRINT $args`,
                    "CAL7_WINDOW_MONTHS"=>months,"CAL7_WINDOW_MONTHS_SHA256"=>sha(months),"CAL7_ROOT_MONTH"=>"2026-05","CAL7_WINDOW_PRINT_SHA"=>sha(ALT_PRINT),
                    (layout===nothing ? () : ("CAL7_WINDOW_LAYOUT"=>layout,))...,(pin===nothing ? () : ("CAL7_WINDOW_LAYOUT_SHA256"=>pin,))...)
                run(pipeline(ignorestatus(c);stdout=devnull,stderr=devnull)).exitcode
            end
            progress(out)=Dict(String.(split(l,'='))[1]=>String.(split(l,'='))[2] for l in readlines(joinpath(out,"PROGRESS.txt")))
            # alternative layout with its pin: recorded in PROGRESS.txt and segments.tsv (exit 3: no edge was requested)
            o1=joinpath(d,"alt");@test producer(o1,"max_edges=0";layout=ALT_LAYOUT,pin=sha(ALT_LAYOUT))==3
            @test progress(o1)["layout_sha256"]==sha(ALT_LAYOUT)
            @test split(read_segments(joinpath(o1,"segments.tsv"))[1],'\t')[end]==sha(ALT_LAYOUT)
            # wrong pin: hard error before any output
            o2=joinpath(d,"wrong");@test !(producer(o2,"max_edges=0";layout=ALT_LAYOUT,pin="0"^64) in (0,3)) && !isfile(joinpath(o2,"PROGRESS.txt"))
            # no layout variables: the built-in layout, whose SHA-256 is recorded (behavior unchanged)
            o3=joinpath(d,"default");@test producer(o3,"max_edges=0")==3 && progress(o3)["layout_sha256"]==sha(DEFAULT_LAYOUT)
            if get(ENV,"CAL7_LAYOUT_TEST_EDGE","")=="1"      # one real edge into April 2027 with the AP|RIL layout: the new state shows AP and RIL
                o4=joinpath(d,"edge");@test producer(o4,"max_edges=1";layout=ALT_LAYOUT,pin=sha(ALT_LAYOUT))==0
                texts=Set(split(l,'\t')[6] for l in readlines(joinpath(o4,"states","state-02.tsv"))[2:end])
                @test "AP" in texts && "RIL" in texts && !("APR" in texts)
            end
        end
    end
end
