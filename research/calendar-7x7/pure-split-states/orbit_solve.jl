# UNTRUSTED fallback solver (candidate generator only): the PR #99 planner's orbit-by-orbit
# macro solve (practical/solver_macros.jl, macro_solve) with orbit-isolated catalogues from
# continuous/solver_chain.jl, extended by a bounded two-macro escape in every orbit (the
# original has it for orbit 1 only). Words are legal generator words.
function orbit_solve(P,source,start,target,action,catalogs)
    pre=P.chain_core_prefix(source,start,target,action)
    state=copy(pre.state);result=copy(pre.word);gens=[UInt16.(g) for g in action.generators]
    for k in sort!(collect(keys(catalogs)))
        constraints=P.macro_front_constraints(source,target,action,k)
        occ=P.invert(state)[(24k-23):24k]
        score(v)=count(v[i] in allowed for (i,allowed) in constraints)
        cands=[(invperm(Int.(collect(key))),P.macro_normalize(w)) for (key,w) in sort!(collect(catalogs[k]);by=x->(P.macro_htm(x[2]),x[2]))]
        for step in 1:24
            before=score(occ);before==length(constraints) && break
            best=nothing;bs=before;bc=typemax(Int)
            for (inv,w) in cands
                after=score(occ[inv]);c=P.macro_htm(w)
                if after>bs || (after==bs && after>before && c<bc);best=(inv,w);bs=after;bc=c;end
            end
            if isnothing(best)
                for (inv1,w1) in cands
                    mid=occ[inv1];score(mid)>=before-1 || continue
                    for (inv2,w2) in cands
                        c=P.macro_htm(w1)+P.macro_htm(w2);c<bc || continue
                        if score(mid[inv2])>before;best=(inv1[inv2],vcat(w1,w2));bc=c;end
                    end
                    isnothing(best) || break
                end
            end
            isnothing(best) && (println(stderr,"orbit_solve stalled in orbit ",k," at ",before,"/",length(constraints));return nothing)
            inv,w=best;occ=occ[inv]
            state=P.compose(state,P.macro_word_perm(w,gens));append!(result,w)
        end
        score(occ)==length(constraints) || return nothing
    end
    P.validate_front(P.decode_physical(source,state,action),target)
    (;word=P.macro_normalize(result),state)
end
