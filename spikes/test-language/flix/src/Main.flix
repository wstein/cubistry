enum Vec with Eq, ToString { case V(Int32, Int32, Int32) }
enum Sticker with Eq, ToString { case S(Int32, Int32, Vec, Vec, Vec, String) }
enum Move with Eq, ToString { case M(Int32, Int32, Int32) }

def coordinate(v: Vec, axis: Int32): Int32 = match v {
    case Vec.V(x, y, z) => if (axis == 0) x else if (axis == 1) y else z
}

def quarter(v: Vec, axis: Int32): Vec = match v {
    case Vec.V(x, y, z) => if (axis == 0) Vec.V(x, -z, y)
        else if (axis == 1) Vec.V(z, y, -x) else Vec.V(-y, x, z)
}

def rotate(v: Vec, axis: Int32, amount: Int32): Vec =
    let n = Int32.modulo(amount, 4);
    List.foldLeft((p, _) -> quarter(p, axis), v, List.range(0, n))

def legal(m: Move): Bool = match m {
    case Move.M(a, layer, n) => a >= 0 and a < 3 and (layer == -1 or layer == 1)
        and (n == -2 or n == -1 or n == 1 or n == 2)
}

def turn(s: Sticker, m: Move): Sticker = match (s, m) {
    case (Sticker.S(i,c,p,n,u,image), Move.M(a,layer,amount)) =>
        if (coordinate(p,a) == layer)
            Sticker.S(i,c,rotate(p,a,amount),rotate(n,a,amount),rotate(u,a,amount),image)
        else s
}

def applyWord(state: List[Sticker], moves: List[Move]): List[Sticker] =
    List.foldLeft((s, m) -> List.map(x -> turn(x,m), s), state, moves)

def inverseWord(moves: List[Move]): List[Move] =
    List.map(m -> match m { case Move.M(a,l,n) => Move.M(a,l,-n) }, List.reverse(moves))

def all(l: List[Bool]): Bool = List.foldLeft((a,b) -> a and b, true, l)

def verify(f: (List[Move], List[Sticker])): Bool =
    let (moves, expected) = f;
    let actual = applyWord(source(),moves);
    all(List.map(legal,moves)) and actual == expected
        and applyWord(actual,inverseWord(moves)) == source()

def flipFirst(s: List[Sticker]): List[Sticker] = match s {
    case Nil => Nil
    case Sticker.S(i,c,p,n,Vec.V(x,y,z),image) :: rest =>
        Sticker.S(i,c,p,n,Vec.V(-x,-y,-z),image) :: rest
}

def negativeChecks(): Bool =
    let firstFixture = match fixtures() { case x :: _ => x
        case Nil => (Nil, Nil) };
    let (moves, expected) = firstFixture;
    all(List#{not verify((moves, flipFirst(expected))),
        not verify((moves, Nil)),
        not legal(Move.M(3,1,1)), not legal(Move.M(0,0,1)),
        not legal(Move.M(0,1,3)), not legal(Move.M(0,1,0))})

def geometryChecks(): Bool = all(List.map(verify, fixtures())) and negativeChecks()
    and rotate(Vec.V(1,2,3),1,-1) == Vec.V(-3,2,1)
    and all(List.map(a -> rotate(Vec.V(1,2,3),a,4) == Vec.V(1,2,3),List.range(0,3)))

def main(): Unit \ IO = Assert.runWithIO(() -> {
    Assert.assertTrue(geometryChecks());
    println("PASS: 100 full 24-sticker states, 100 inverses, 6 negative controls")
})
