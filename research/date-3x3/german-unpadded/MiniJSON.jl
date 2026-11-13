# Minimal JSON reader (Julia has no JSON parser in the standard library).
module MiniJSON
export parse_json
mutable struct P; s::String; i::Int; end
function ws!(p) while p.i <= ncodeunits(p.s) && p.s[p.i] in (' ', '\n', '\t', '\r'); p.i += 1; end end
function parse_json(s::AbstractString)
    p = P(String(s), 1); v = val!(p); ws!(p)
    p.i > ncodeunits(p.s) || error("trailing characters")
    v
end
function val!(p)
    ws!(p); c = p.s[p.i]
    if c == '{'
        p.i += 1; d = Dict{String,Any}(); ws!(p)
        if p.s[p.i] == '}'; p.i += 1; return d; end
        while true
            ws!(p); k = str!(p); ws!(p); p.s[p.i] == ':' || error("colon"); p.i += 1
            d[k] = val!(p); ws!(p)
            c = p.s[p.i]; p.i += 1
            c == ',' && continue; c == '}' && return d; error("object")
        end
    elseif c == '['
        p.i += 1; a = Any[]; ws!(p)
        if p.s[p.i] == ']'; p.i += 1; return a; end
        while true
            push!(a, val!(p)); ws!(p)
            c = p.s[p.i]; p.i += 1
            c == ',' && continue; c == ']' && return a; error("array")
        end
    elseif c == '"'
        return str!(p)
    elseif startswith(SubString(p.s, p.i), "true"); p.i += 4; return true
    elseif startswith(SubString(p.s, p.i), "false"); p.i += 5; return false
    elseif startswith(SubString(p.s, p.i), "null"); p.i += 4; return nothing
    else
        j = p.i
        while j <= ncodeunits(p.s) && p.s[j] in "+-0123456789.eE"; j += 1; end
        t = p.s[p.i:j-1]; p.i = j
        return occursin(r"[.eE]", t) ? parse(Float64, t) : parse(Int, t)
    end
end
function str!(p)
    p.s[p.i] == '"' || error("string expected"); p.i += 1
    io = IOBuffer()
    while true
        c = p.s[p.i]; p.i = nextind(p.s, p.i)
        if c == '"'; break
        elseif c == '\\'
            e = p.s[p.i]; p.i += 1
            if e == 'u'
                print(io, Char(parse(UInt16, p.s[p.i:p.i+3]; base=16))); p.i += 4
            else
                print(io, e == 'n' ? '\n' : e == 't' ? '\t' : e == 'r' ? '\r' : e == 'b' ? '\b' : e == 'f' ? '\f' : e)
            end
        else print(io, c) end
    end
    String(take!(io))
end
end
