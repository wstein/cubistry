# Shared design helpers (untrusted design tools only).
function unmatched_cells(source,board,keys_)
    byhome=Dict(h=>filter(s->s.home==h,source) for h in all_homes());bad=0
    for key in keys_
        hs=sort!([h for h in all_homes() if bodykey(h)==key])
        cells=[(r,c) for r in 1:7,c in 1:7 if bodykey((c-4,4-r,3))==key]
        opts=[[!isempty(piece_options(byhome[h],h,(c-4,4-r,3),board[r,c])) for h in hs] for (r,c) in cells]
        occ=zeros(Int,length(hs))
        function aug(i,seen)
            for j in eachindex(hs)
                (seen[j] || !opts[i][j]) && continue
                seen[j]=true
                if occ[j]==0 || aug(occ[j],seen);occ[j]=i;return true;end
            end
            false
        end
        for i in eachindex(cells);aug(i,falses(length(hs))) || (bad+=1);end
    end
    bad
end
function printed_as(s,a,k)
    a[3]=="blank" && return merge(s,(text="",ink="blank"))
    cell=first((r,c) for r in 1:7,c in 1:7 if orbit(r,c)==k && (b=artwork(a[1],a[3],r,c);(b[1],string(b[2]),b[3]))==a)
    pos=(cell[2]-4,4-cell[1],3)
    rot=first(rr for rr in ROTATIONS if rotate(s.home,rr)==pos && rotate(s.normal,rr)==FRONT_NORMAL)
    glyph=a[3]=="month" && a[1]=="0" ? "O" : a[1]   # the class key uses the O/0 alias
    merge(s,(text=glyph,ink=a[3],up=inverse_rotate(IMAGE_UPS[1],rot)))
end
function injections(cands,m)
    m==0 && return [Int[]]
    out=Vector{Int}[]
    for (i,c) in enumerate(cands),rest in injections(cands[[j for j in eachindex(cands) if j!=i]],m-1)
        push!(out,vcat(c,rest))
    end
    out
end
