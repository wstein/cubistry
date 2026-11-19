import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { dropTrailingCommas, fingerprint, fmt } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("formats a small module", async () => {
    const out = await fmt(`mod M{pub def add(x:Int32,y:Int32):Int32=x+y
def id(x:a):a=x}`);
    assert.equal(out, `mod M {
    pub def add(x: Int32, y: Int32): Int32 = x + y
    def id(x: a): a = x
}
`);
});

test("lets, matches and blocks", async () => {
    const out = await fmt(`def f(x: Option[Int32]): Int32 = {
let y = 1;
match x { case Some(v) => v+y
case None => y }
}`);
    assert.equal(out, `def f(x: Option[Int32]): Int32 = {
    let y = 1;
    match x {
        case Some(v) => v + y
        case None => y
    }
}
`);
});

test("wraps long argument lists and operator chains", async () => {
    const out = await fmt(
        "def f(): Int32 = g(aaaaaaaaaaaaaaaa, bbbbbbbbbbbbbbbbbbbb, cccccccccccccccccccc, dddddddddddddddddddd)\n",
    );
    assert.equal(out, `def f(): Int32 =
    g(
        aaaaaaaaaaaaaaaa,
        bbbbbbbbbbbbbbbbbbbb,
        cccccccccccccccccccc,
        dddddddddddddddddddd
    )
`);
});

test("hugs a trailing multi-line lambda argument", async () => {
    const out = await fmt(`def f(): Unit = List.forEach(xs, x -> {
println(x);
println(x)
})
`);
    assert.equal(out, `def f(): Unit = List.forEach(xs, x -> {
    println(x);
    println(x)
})
`);
});

test("keeps comments and one blank line", async () => {
    const out = await fmt(`// header


def a(): Int32 = 1 // trailing

/// doc
def b(): Int32 = {
    // inside
    2
}
`);
    assert.equal(out, `// header

def a(): Int32 = 1 // trailing

/// doc
def b(): Int32 = {
    // inside
    2
}
`);
});

test("preserves whitespace-sensitive tokens", async () => {
    const out = await fmt(`use Foo::Bar.{baz,qux}
def f(s: S[r]): Int32 \\ IO = s->field + (x -> x)(1)
`);
    assert.match(out, /^use Foo::Bar\.\{baz, qux\}/);
    assert.match(out, /s->field/);
    assert.deepEqual(fingerprint(out).errors, []);
});

test("string interpolation is untouched", async () => {
    const src = "def f(x: Int32): String = \"a \${x+1} b\"\n";
    assert.match(await fmt(src), /"a \$\{x \+ 1\} b"/);
});

test("reports syntax errors with a location", async () => {
    await assert.rejects(fmt("def ("), (e) => e instanceof SyntaxError && e.loc.start.line === 1);
});

test("empty and comment-only files", async () => {
    assert.equal(await fmt(""), "");
    assert.equal(await fmt("// only a comment\n"), "// only a comment\n");
});

test("respects tabWidth and printWidth", async () => {
    const out = await fmt("def f(): Int32 = {\n1\n}\n", { tabWidth: 2 });
    assert.equal(out, "def f(): Int32 = {\n  1\n}\n");
});

// ---- corpus invariants: the formatter must never change the program ----

const corpusDirs = [join(here, "."), join(here, "../../../proof-checkers/flix/src"), join(here, "../../../spikes/test-language/flix")];
const files = [];
const walk = (p) => {
    for (const e of readdirSync(p)) {
        const full = join(p, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (e.endsWith(".flix") && statSync(full).size < 40_000) files.push(full);
    }
};
corpusDirs.forEach((d) => { try { walk(d); } catch { /* optional corpus */ } });

for (const f of files) {
    test(`invariants: ${f.slice(f.indexOf("cubistry/") + 9 || 0)}`, async () => {
        const src = readFileSync(f, "utf8");
        const before = fingerprint(src);
        assert.deepEqual(before.errors, [], "fixture must parse");
        const out = await fmt(src);
        const after = fingerprint(out);
        assert.deepEqual(after.errors, [], "output must parse");
        assert.deepEqual(dropTrailingCommas(after.tokens), dropTrailingCommas(before.tokens), "tokens");
        assert.deepEqual(after.comments, before.comments, "comments");
        assert.equal(after.shape, before.shape, "parse-tree shape");
        assert.equal(await fmt(out), out, "idempotent");
    });
}
