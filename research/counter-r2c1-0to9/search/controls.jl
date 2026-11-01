# Generates mutated negative-control inputs for the 2x2x2 r2c1 (0-9) counter checkers.
# Usage: julia controls.jl EVIDENCE_DIR CONTROLS_DIR
function main(args)
    ev = args[1]; out = args[2]
    mkpath(out)

    p_closed = readlines(joinpath(ev, "print-closed.tsv"))
    r_closed = readlines(joinpath(ev, "routes-closed.tsv"))
    r_wrap1  = readlines(joinpath(ev, "routes-wrap1.tsv"))

    # 1. wrong-glyph: sticker 8 at (-1,-1,1) (0,0,1) printed as '9' instead of '0'
    let rows = copy(p_closed)
        f = split(rows[10], "\t"); f[4] = "9"; rows[10] = join(f, "\t")
        write(joinpath(out, "print-wrong-glyph.tsv"), join(rows, "\n") * "\n")
    end

    # 1b. wrong-move: step 0->1 uses "D" (with inverse "D'") instead of "L", landing '7' at LL instead of '1'
    let rows = copy(r_closed)
        f = split(rows[2], "\t"); f[5] = "D"; f[10] = "D'"; rows[2] = join(f, "\t")
        write(joinpath(out, "routes-wrong-move.tsv"), join(rows, "\n") * "\n")
    end

    # 2. wrong-up: digit 0 (sticker 8 at (-1,-1,1) normal (0,0,1)) given up=(-1,0,0) instead of (0,1,0)
    let rows = copy(p_closed)
        f = split(rows[10], "\t"); f[5] = "-1,0,0"; rows[10] = join(f, "\t")
        write(joinpath(out, "print-wrong-up.tsv"), join(rows, "\n") * "\n")
    end

    # 3. front-nonblank: UL sticker 2 at (-1,1,1) normal (0,0,1) printed as digit 5 instead of blank
    let rows = copy(p_closed)
        f = split(rows[4], "\t"); f[4] = "5"; f[5] = "0,1,0"; rows[4] = join(f, "\t")
        write(joinpath(out, "print-front-nonblank.tsv"), join(rows, "\n") * "\n")
    end

    # 4. two-touch-moves: step 0->1 uses "L D" (2 moves touching r2c1) instead of "L"
    let rows = copy(r_closed)
        f = split(rows[2], "\t")
        f[5] = "L D"; f[6] = "2"; f[7] = "0"; f[8] = "2"
        f[10] = "D' L'"; f[11] = "2"; f[12] = "0"; f[13] = "2"
        rows[2] = join(f, "\t")
        write(joinpath(out, "routes-two-touch.tsv"), join(rows, "\n") * "\n")
    end

    # 5. three-prep-moves: step 3->4 uses "R U B L" (3 prep moves + 1 touch move)
    let rows = copy(r_closed)
        f = split(rows[5], "\t")
        f[5] = "R U B L"; f[6] = "4"; f[7] = "3"; f[8] = "1"
        f[10] = "L' B' U' R'"; f[11] = "4"; f[12] = "3"; f[13] = "1"
        rows[5] = join(f, "\t")
        write(joinpath(out, "routes-three-prep.tsv"), join(rows, "\n") * "\n")
    end

    # 6. prep-after-touch: step 3->4 uses "L B" (prep move placed after touch move)
    let rows = copy(r_closed)
        f = split(rows[5], "\t")
        f[5] = "L B"; f[6] = "2"; f[7] = "1"; f[8] = "1"
        f[10] = "B' L'"; f[11] = "2"; f[12] = "1"; f[13] = "1"
        rows[5] = join(f, "\t")
        write(joinpath(out, "routes-prep-after-touch.tsv"), join(rows, "\n") * "\n")
    end

    # 7. bad-inverse: step 0->1 decrement is "L" instead of "L'"
    let rows = copy(r_closed)
        f = split(rows[2], "\t"); f[10] = "L"; rows[2] = join(f, "\t")
        write(joinpath(out, "routes-bad-inverse.tsv"), join(rows, "\n") * "\n")
    end

    # 8. short-claim: step 6->7 claims inc_shortest = 1 when exact is 2
    let rows = copy(r_closed)
        f = split(rows[8], "\t"); f[9] = "1"; rows[8] = join(f, "\t")
        write(joinpath(out, "routes-short-claim.tsv"), join(rows, "\n") * "\n")
    end

    # 9. hidden-unreachable: digit 5 (sticker 12) reprinted as 6, making display 5 unreachable
    let rows = copy(p_closed)
        f = split(rows[14], "\t"); f[4] = "6"; rows[14] = join(f, "\t")
        write(joinpath(out, "print-hidden-unreachable.tsv"), join(rows, "\n") * "\n")
    end

    # 10. open-closure: wrap1 routes run in 'closed' mode (fails full-state closure after 9->0)
    let rows = [replace(r, r"^wrap1\t" => "closed\t") for r in r_wrap1]
        write(joinpath(out, "routes-open-as-closed.tsv"), join(rows, "\n") * "\n")
    end

    # 11. non-const-touch: closed routes run in 'constL-closed' mode (step 1->2 uses D instead of L)
    let rows = [replace(r, r"^closed\t" => "constL-closed\t") for r in r_closed]
        write(joinpath(out, "routes-non-const-touch.tsv"), join(rows, "\n") * "\n")
    end
end

main(ARGS)
