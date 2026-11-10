#!/usr/bin/env julia
# SPDX-License-Identifier: AGPL-3.0-or-later
# Join check for an extended chain: the stored chain is a byte-identical prefix, its snapshots are
# unchanged, and the first new edge starts at the stored end digest. It does not replay moves; the
# chain checkers do that for the whole extended chain.
function check_seam(stored,stored_states,extended,extended_states)
    a=String.(split(chop(read(stored,String);tail=1),'\n'));b=String.(split(chop(read(extended,String);tail=1),'\n'))
    @assert a[end]=="finish" && b[end]=="finish" "chain trailers"
    ra=a[1:end-1];rb=b[1:end-1]
    @assert length(rb)>length(ra) && rb[1:length(ra)]==ra "seam: stored chain is not a byte-identical prefix"
    edges_a=[i for (i,l) in enumerate(ra) if startswith(l,"edge\t")];k=length(edges_a)
    lastend=split(ra[edges_a[end]],'\t')[9]
    nxt=[i for (i,l) in enumerate(rb) if startswith(l,"edge\t") && i>length(ra)]
    @assert !isempty(nxt) && nxt[1]==length(ra)+1 "seam: a new edge follows the stored end directly"
    @assert split(rb[nxt[1]],'\t')[8]==lastend "seam join: first new edge does not start at the stored end digest"
    for i in 1:k+1
        n="state-"*lpad(string(i),2,'0')*".tsv"
        @assert read(joinpath(stored_states,n))==read(joinpath(extended_states,n)) "seam: stored snapshot $n changed"
    end
    println("seam\tstored_edges\t",k,"\tnew_edges\t",length(nxt),"\tJOIN_PASS")
end
if abspath(PROGRAM_FILE)==(@__FILE__)
    try
        @assert length(ARGS)==4 "check_seam.jl STORED_CHAIN STORED_STATES EXTENDED_CHAIN EXTENDED_STATES"
        check_seam(ARGS...)
    catch e
        println(stderr,"INVALID\t",sprint(showerror,e));exit(1)
    end
end
