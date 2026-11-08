# SPDX-License-Identifier: AGPL-3.0-or-later
# Strict upright rule for the feasibility study (included by the scripts here).
# Owner rule: only the digit 0 (circular, any turn) and the single digits 6 <-> 9 read
# the same after a half turn. No other glyph does, and there is NO aliasing: the letter
# O is not the digit 0 and the letter I is not the digit 1 (each needs its own sticker).
# The research code folds O to 0 and I to 1 inside `image_normal` and `artwork`; this
# file redefines both (and the half-turn table) in every module that has them. Nothing
# in the research files is edited.
const STRICT_HALF=Dict('0'=>'0','6'=>'9','9'=>'6')
function apply_strict_rule!(mods...;alias=false,half_o=false)
    for m in mods
        isdefined(m,:HALF) && (empty!(getfield(m,:HALF));merge!(getfield(m,:HALF),STRICT_HALF);half_o && (getfield(m,:HALF)['O']='O'))
        fold=alias ? :(g=replace(g,'O'=>'0','I'=>'1')) : :(nothing)
        Core.eval(m,quote
            function image_normal(g,q,ink)
                isempty(g) && return BLANK
                $fold
                g=="0" && return (g,0,ink)
                choices=[(g,mod(q,4),ink)]
                if all(c->haskey(HALF,c),g)
                    push!(choices,(join(HALF[c] for c in reverse(collect(g))),mod(q+2,4),ink))
                end
                minimum(choices)
            end
        end)
        isdefined(m,:artwork) && Core.eval(m,quote
            function artwork(g,ink,row,col)
                k=orbit(row,col);x,y=col-4,4-row;q=0
                while (x,y)!=k; x,y=-y,x;q+=1;end
                $fold
                g=="0" && return (g,0,ink)
                rotations=k==(0,0) ? (0:3) : (q:q)
                variants=Tuple{String,Int,String}[]
                for a in rotations
                    push!(variants,(g,mod(a,4),ink))
                    chars=collect(g)
                    if all(c->haskey(HALF,c),chars)
                        h=join(HALF[c] for c in reverse(chars))
                        push!(variants,(h,mod(a+2,4),ink))
                    end
                end
                minimum(variants)
            end
        end)
    end
end
