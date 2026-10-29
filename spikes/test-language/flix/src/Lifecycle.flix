import java.lang.System

/// An audit checksum over every complete reached frame. The original checker
/// still runs unchanged; this extra audit is identical on the first and warm runs.
def frameChecksum(s: Sticker): Int64 = match s {
    case Sticker.S(i,c,p,n,u,image) =>
        Int32.toInt64(i + 1) * Int32.toInt64(
            coordinate(p,0) + 3 * coordinate(p,1) + 7 * coordinate(p,2)
            + 11 * coordinate(n,0) + 17 * coordinate(n,1) + 23 * coordinate(n,2)
            + 29 * coordinate(u,0) + 31 * coordinate(u,1) + 37 * coordinate(u,2))
        + Int32.toInt64(c + String.length(image))
}

def replayChecksum(): Int64 = List.foldLeft((acc, f) -> {
    let (moves, _) = f;
    let reached = applyWord(source(), moves);
    acc + List.foldLeft((total, s) -> total + frameChecksum(s), 0i64, reached)
}, 0i64, fixtures())

/// Timings are relative within this JVM. The observing Python process times
/// process startup and final exit separately with its own monotonic clock.
def lifecycleMain(): Unit \ IO = Assert.runWithIO(() -> {
    System.out.println("CUBISTRY_PHASE {\"event\":\"READY\"}");
    System.out.flush();
    foreach (iteration <- List.range(0,4)) {
        let started = System.nanoTime();
        let correct = geometryChecks();
        let checksum = replayChecksum();
        Assert.assertTrue(correct);
        let elapsedNs = System.nanoTime() - started;
        let elapsedMs = Int64.toFloat64(elapsedNs) / 1000000.0f64;
        System.out.println("CUBISTRY_PHASE {\"event\":\"RESULT\",\"iteration\":${iteration},\"elapsedNs\":${elapsedNs},\"elapsedMs\":${elapsedMs},\"canonicalStates\":100,\"inverseChecks\":100,\"negativeControls\":6,\"auditReplays\":100,\"checksum\":${checksum},\"passed\":true}");
        System.out.flush()
    };
    System.out.println("CUBISTRY_PHASE {\"event\":\"DONE\"}");
    System.out.flush()
})
