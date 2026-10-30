/* All-mode periods and recovery for the seconds-first print (generator side only).
 *
 * The independent Python checker (verify_modes.py) imports none of this code.
 * Same model and engine as ../generate.c (../engine.h): 2x2x2, eight rigid
 * corners, 24 immutable stickers, all 18 outer-face turns, HTM, legal poses.
 *
 * Part 1, periods. For every letter H/S/M, range 00-11, 00-23, 00-59 and
 * direction +1/-1 it builds the complete graph of settled full poses whose edges
 * are shortest legal words from the actual pose, and finds a minimum-mean
 * recurrent cycle (Howard policy iteration, integer Bellman-Ford certificate).
 * It first runs exactly the original generator's procedure (letter cap S/H 6,
 * M 5, maximum lowered while the mean stays optimal); when that period still
 * has an edge above five HTM it repeats the search with the hard cap five.
 * Each application mode then takes the +1 period, run forward for +1 and
 * backward (every word inverted) for -1, unless the opposite direction's own
 * period run the other way is strictly cheaper per lap, or equal per lap with
 * a strictly smaller maximum edge.
 *
 * Part 2, recovery. For every application mode it builds the graph of ALL
 * legal words of at most five HTM (not only shortest ones) between consecutive
 * displays, adds the shortest six-HTM edges of the poses that have no edge of
 * at most five, and computes for every settled pose the lexicographically
 * least (six-HTM edges, steps, HTM) way to reach a node of the selected period.
 *
 * Usage: generate_modes PRINT NEW_WITNESS.json NEW_RECOVERY.json [LABEL] [SAMPLES]
 * Refuses to overwrite either output.
 */
#include "../engine.h"
static const char *MN[18] = {"R", "R2", "R'", "L", "L2", "L'", "U", "U2", "U'",
                             "D", "D2", "D'", "F", "F2", "F'", "B", "B2", "B'"};
#define LIMIT 5
/* ---------------- shortest-word reconstruction (as in ../generate.c) ---------------- */
static int fw[16];
static int fwFound;
static Key fwTarget;
// Canonical words of exactly `lim` moves whose active options stay within budget.
static void dfsFindAny(uint8_t *r, int depth, int lim, int nact, int (*q)[4], int last) {
  if (fwFound)
    return;
  if (depth == lim) {
    if (packS(r) == fwTarget)
      fwFound = 1;
    return;
  }
  for (int m = 0; m < 18 && !fwFound; m++) {
    if (last >= 0 && m / 3 == last / 3)
      continue;
    if (last >= 0 && m / 3 == ((last / 3) ^ 1) && m / 3 < last / 3)
      continue;
    int nq[256][4];
    int n2 = 0;
    for (int i = 0; i < nact; i++) {
      int a = TS[0][m][q[i][0]], b = TS[1][m][q[i][1]], c = TS[2][m][q[i][2]], d = TS[3][m][q[i][3]];
      if (D4[enc4(a, b, c, d)] <= lim - depth - 1) {
        nq[n2][0] = a;
        nq[n2][1] = b;
        nq[n2][2] = c;
        nq[n2][3] = d;
        n2++;
      }
    }
    if (!n2)
      continue;
    uint8_t r2[8];
    for (int c = 0; c < 8; c++)
      r2[c] = TR[c][m][r[c]];
    fw[depth] = m;
    dfsFindAny(r2, depth + 1, lim, n2, nq, m);
  }
}
static void activeKeys(const uint8_t *r, const Opt *o, int no, int (*q)[4], int *n) {
  *n = 0;
  for (int k = 0; k < no; k++) {
    for (int s = 0; s < 4; s++) {
      int c = o[k].c[s];
      q[*n][s] = comp[r[c]][inv[RT[c][o[k].j[s]][s]]];
    }
    (*n)++;
  }
}
// Word of exactly `len` HTM from `from` to `to` (len is the true distance between them).
static void wordBetween(Key from, Key to, int len, const Opt *o, int no) {
  uint8_t r[8];
  unpackS(from, r);
  int q[256][4], n;
  activeKeys(r, o, no, q, &n);
  fwFound = 0;
  fwTarget = to;
  dfsFindAny(r, 0, len, n, q, -1);
  if (!fwFound) {
    fprintf(stderr, "no word of length %d\n", len);
    exit(1);
  }
}
static void wordStr(const int *w, int n, char *o) {
  o[0] = 0;
  for (int i = 0; i < n; i++) {
    if (i)
      strcat(o, " ");
    strcat(o, MN[w[i]]);
  }
}
static long gcdl(long a, long b) {
  while (b) {
    long t = a % b;
    a = b;
    b = t;
  }
  return a;
}
/* ---------------- all words of at most LIMIT HTM toward the next display ---------------- */
static Key *eK;
static uint8_t *eD;
static int eN, eCap;
static void dfsAll(uint8_t *r, int depth, int lim, int nact, int (*q)[4], int last) {
  if (depth) {
    for (int i = 0; i < nact; i++)
      if (D4[enc4(q[i][0], q[i][1], q[i][2], q[i][3])] == 0) {
        if (eN == eCap) {
          eCap *= 2;
          eK = realloc(eK, eCap * 8);
          eD = realloc(eD, eCap);
        }
        eK[eN] = packS(r);
        eD[eN++] = depth;
        break;
      }
  }
  if (depth == lim)
    return;
  for (int m = 0; m < 18; m++) {
    if (last >= 0 && m / 3 == last / 3)
      continue;
    if (last >= 0 && m / 3 == ((last / 3) ^ 1) && m / 3 < last / 3)
      continue;
    int nq[256][4];
    int n2 = 0;
    for (int i = 0; i < nact; i++) {
      int a = TS[0][m][q[i][0]], b = TS[1][m][q[i][1]], c = TS[2][m][q[i][2]], d = TS[3][m][q[i][3]];
      if (D4[enc4(a, b, c, d)] <= lim - depth - 1) {
        nq[n2][0] = a;
        nq[n2][1] = b;
        nq[n2][2] = c;
        nq[n2][3] = d;
        n2++;
      }
    }
    if (!n2)
      continue;
    uint8_t r2[8];
    for (int c = 0; c < 8; c++)
      r2[c] = TR[c][m][r[c]];
    dfsAll(r2, depth + 1, lim, n2, nq, m);
  }
}
static int cmpKD(const void *a, const void *b) {
  const uint64_t x = *(const uint64_t *)a, y = *(const uint64_t *)b;
  return x < y ? -1 : x > y;
}
/* ---------------- modes ---------------- */
typedef struct {
  char L;
  int N, dir;
} Mode;
typedef struct {
  int ok, cap, maxc, nodes, setupLen;
  long A, L, ne, passes;
  int *cyc, len;
  long gpre, gper, gHTM;
  int gmax;
  char setup[128];
  uint8_t start[8];
} Period;
static Opt OPT[60][256];
static int NOPT[60];
static void loadOpts(const Print *P, char L, int N) {
  int lt = letterType(L);
  for (int v = 0; v < N; v++)
    NOPT[v] = optionsFor(P, lt, v / 10, v % 10, OPT[v]);
}
// One own period: original procedure, then the hard cap if needed.
static void findPeriod(const Print *P, Mode M, Graph *G, Period *out) {
  memset(out, 0, sizeof *out);
  uint8_t *al = malloc(G->n), *al2 = malloc(G->n);
  long *pot = malloc(G->n * 8);
  int caps[2] = {M.L == 'M' ? 5 : 6, LIMIT};
  for (int attempt = 0; attempt < 2; attempt++) {
    int cap = caps[attempt];
    if (attempt && caps[0] == LIMIT)
      break;
    if (!computeAlive(G, cap, al))
      continue;
    MMC r;
    howard(G, al, &r);
    long passes = certify(G, al, r.A, r.L, pot);
    if (passes < 0) {
      fprintf(stderr, "certificate failed\n");
      exit(1);
    }
    MMC best = r;
    for (int c2 = r.maxc - 1; c2 >= 1; c2--) {
      if (!computeAlive(G, c2, al2))
        break;
      MMC r2;
      howard(G, al2, &r2);
      if (r2.A * r.L == r.A * r2.L && certify(G, al2, r2.A, r2.L, pot) >= 0) {
        free(best.cyc);
        best = r2;
      } else {
        free(r2.cyc);
        break;
      }
    }
    if (out->cyc)
      free(out->cyc);
    out->ok = 1;
    out->cap = cap;
    out->A = best.A;
    out->L = best.L;
    out->maxc = best.maxc;
    out->cyc = best.cyc;
    out->len = best.cycleLength;
    out->passes = passes;
    if (best.maxc <= LIMIT)
      break;
  }
  out->nodes = G->n;
  out->ne = G->ne;
  free(al);
  free(al2);
  free(pot);
  if (!out->ok)
    return;
  // app policy 13 simulation, as in ../generate.c
  {
    uint8_t rr[8] = {0};
    int w[16];
    int n0 = (M.dir + M.N) % M.N;
    greedyMove(rr, OPT[0], NOPT[0], OPT[n0], NOPT[n0], 13, w);
    HMap H;
    hmInit(&H, 1 << 16);
    long *cum = malloc(sizeof(long) * 400000);
    int steps = 0, value = 0;
    long tot = 0;
    int mx = 0;
    for (int cy = 0; cy < 5000; cy++) {
      Key k = packS(rr);
      int seen = hmGet(&H, k);
      if (seen >= 0) {
        out->gpre = seen;
        out->gper = steps - seen;
        out->gHTM = tot - cum[seen];
        out->gmax = mx;
        break;
      }
      hmPut(&H, k, steps);
      for (int j = 0; j < M.N; j++) {
        cum[steps] = tot;
        int t = (value + M.dir + M.N) % M.N, t2 = (t + M.dir + M.N) % M.N;
        int h = greedyMove(rr, OPT[t], NOPT[t], OPT[t2], NOPT[t2], 13, w);
        tot += h;
        if (h > mx)
          mx = h;
        steps++;
        value = t;
      }
    }
    hmFree(&H);
    free(cum);
  }
  uint8_t src[8] = {0};
  unpackS(G->key[out->cyc[0]], out->start);
  out->setupLen = solveTo(src, out->start);
  wordStr(solW, out->setupLen, out->setup);
}
static void printFrames(FILE *f, const Print *P, const uint8_t *tgt) {
  fprintf(f, "[");
  for (int c = 0; c < 8; c++)
    for (int j = 0; j < 3; j++) {
      int t = P->ty[c][j], r = tgt[c], home = RT[c][j][typeSlot(t)];
      int y[3] = {0, 1, 0}, up0[3], n0[3] = {0, 0, 0}, p[3], n[3], up[3];
      mv(&R[inv[home]], y, up0);
      n0[j] = POS[c][j];
      mv(&R[r], POS[c], p);
      mv(&R[r], n0, n);
      mv(&R[r], up0, up);
      fprintf(f, "%s{\"id\": %d, \"p\": [%d, %d, %d], \"n\": [%d, %d, %d], \"up\": [%d, %d, %d]}", c + j ? ", " : "",
              c * 3 + j, p[0], p[1], p[2], n[0], n[1], n[2], up[0], up[1], up[2]);
    }
  fprintf(f, "]");
}
static void printJSONPrint(FILE *f, const Print *P) {
  fprintf(f, "  \"printing\": [\n");
  for (int c = 0; c < 8; c++)
    for (int j = 0; j < 3; j++) {
      int t = P->ty[c][j];
      int s = typeSlot(t);
      int r = RT[c][j][s];
      int y[3] = {0, 1, 0}, up[3];
      mv(&R[inv[r]], y, up);
      int n[3] = {0, 0, 0};
      n[j] = POS[c][j];
      char img[16];
      if (t < 6)
        sprintf(img, "%d", t);
      else if (t < 16)
        sprintf(img, "%d", t - 6);
      else if (t == TH)
        strcpy(img, "H");
      else if (t == TSl)
        strcpy(img, "S");
      else if (t == TMl)
        strcpy(img, "M");
      else
        img[0] = 0;
      fprintf(f,
              "    {\"id\": %d, \"cubie\": %d, \"p\": [%d, %d, %d], \"n\": [%d, %d, %d], \"slot\": %d, "
              "\"image\": \"%s\", \"up\": [%d, %d, %d]}%s\n",
              c * 3 + j, c, POS[c][0], POS[c][1], POS[c][2], n[0], n[1], n[2], s, img, up[0], up[1], up[2],
              (c == 7 && j == 2) ? "" : ",");
    }
  fprintf(f, "  ],\n");
}
/* ---------------- recovery ---------------- */
typedef struct {
  int n;
  int *off;   // CSR forward edges
  int *dst;
  uint8_t *w; // HTM of the edge
  long ne;
} Adj;
static void buildAdj(Graph *G, Adj *A, int N, int dir) {
  int n = G->n;
  A->n = n;
  A->off = malloc((n + 1) * sizeof(int));
  long cap = (long)n * 24;
  A->dst = malloc(cap * 4);
  A->w = malloc(cap);
  A->ne = 0;
  eCap = 4096;
  eK = malloc(eCap * 8);
  eD = malloc(eCap);
  uint64_t *pack = malloc(sizeof(uint64_t) * 1);
  long pcap = 1;
  for (int i = 0; i < n; i++) {
    A->off[i] = A->ne;
    int nv = (G->layer[i] + dir + N) % N;
    uint8_t r[8];
    unpackS(G->key[i], r);
    int q[256][4], na;
    activeKeys(r, OPT[nv], NOPT[nv], q, &na);
    eN = 0;
    int lim = G->cost[i] <= LIMIT ? LIMIT : G->cost[i];
    // Poses without an edge of at most five keep only their shortest edges.
    dfsAll(r, 0, lim, na, q, -1);
    if (pcap < eN) {
      pcap = eN * 2;
      pack = realloc(pack, pcap * 8);
    }
    int m = 0;
    for (int e = 0; e < eN; e++) {
      if (G->cost[i] > LIMIT && eD[e] != G->cost[i])
        continue;
      int t = hmGet(&G->map, eK[e]);
      if (t < 0) {
        fprintf(stderr, "endpoint not a node\n");
        exit(1);
      }
      pack[m++] = ((uint64_t)t << 8) | eD[e];
    }
    qsort(pack, m, 8, cmpKD);
    for (int e = 0; e < m; e++) {
      int t = pack[e] >> 8;
      if (e && (int)(pack[e - 1] >> 8) == t)
        continue; // sorted by (node, depth): first is the shortest
      if (A->ne == cap) {
        cap *= 2;
        A->dst = realloc(A->dst, cap * 4);
        A->w = realloc(A->w, cap);
      }
      A->dst[A->ne] = t;
      A->w[A->ne++] = pack[e] & 255;
    }
  }
  A->off[n] = A->ne;
  free(pack);
  free(eK);
  free(eD);
}
static void freeAdj(Adj *A) {
  free(A->off);
  free(A->dst);
  free(A->w);
}
// lexicographic cost (sixes, steps, htm) packed in one integer
#define PK(s6, st, h) (((long)(s6) << 40) | ((long)(st) << 20) | (long)(h))
typedef struct {
  long c;
  int v;
} HE;
static HE *hp;
static long hn;
static void hpush(long c, int v) {
  long i = hn++;
  hp[i].c = c;
  hp[i].v = v;
  while (i) {
    long p = (i - 1) / 2;
    if (hp[p].c <= hp[i].c)
      break;
    HE t = hp[p];
    hp[p] = hp[i];
    hp[i] = t;
    i = p;
  }
}
static HE hpop(void) {
  HE top = hp[0];
  hp[0] = hp[--hn];
  long i = 0;
  while (1) {
    long l = 2 * i + 1, r = l + 1, m = i;
    if (l < hn && hp[l].c < hp[m].c)
      m = l;
    if (r < hn && hp[r].c < hp[m].c)
      m = r;
    if (m == i)
      break;
    HE t = hp[m];
    hp[m] = hp[i];
    hp[i] = t;
    i = m;
  }
  return top;
}
typedef struct {
  long *cost;
  int *next;
  uint8_t *nextW;
} Rec;
static void recover(Adj *A, const uint8_t *onPeriod, Rec *R2) {
  int n = A->n;
  // reverse CSR
  int *roff = calloc(n + 1, sizeof(int));
  for (long e = 0; e < A->ne; e++)
    roff[A->dst[e] + 1]++;
  for (int i = 0; i < n; i++)
    roff[i + 1] += roff[i];
  int *rsrc = malloc(A->ne * 4), *fill = malloc(n * 4);
  uint8_t *rw = malloc(A->ne);
  memcpy(fill, roff, n * 4);
  for (int i = 0; i < n; i++)
    for (int e = A->off[i]; e < A->off[i + 1]; e++) {
      int t = A->dst[e];
      rsrc[fill[t]] = i;
      rw[fill[t]++] = A->w[e];
    }
  R2->cost = malloc((size_t)n * 8);
  R2->next = malloc(n * 4);
  R2->nextW = malloc(n);
  for (int i = 0; i < n; i++) {
    R2->cost[i] = -1;
    R2->next[i] = -1;
    R2->nextW[i] = 0;
  }
  hp = malloc(sizeof(HE) * (A->ne + n + 1));
  hn = 0;
  long *best = malloc((size_t)n * 8);
  for (int i = 0; i < n; i++)
    best[i] = onPeriod[i] ? 0 : -1;
  for (int i = 0; i < n; i++)
    if (onPeriod[i])
      hpush(0, i);
  int *bn = malloc(n * 4);
  uint8_t *bw = malloc(n);
  for (int i = 0; i < n; i++)
    bn[i] = -1;
  while (hn) {
    HE h = hpop();
    if (R2->cost[h.v] >= 0)
      continue;
    R2->cost[h.v] = h.c;
    R2->next[h.v] = bn[h.v];
    R2->nextW[h.v] = bw[h.v];
    for (int e = roff[h.v]; e < roff[h.v + 1]; e++) {
      int s = rsrc[e];
      if (R2->cost[s] >= 0 || onPeriod[s])
        continue;
      long c = h.c + PK(rw[e] > LIMIT, 1, rw[e]);
      if (best[s] < 0 || c < best[s] || (c == best[s] && h.v < bn[s])) {
        best[s] = c;
        bn[s] = h.v;
        bw[s] = rw[e];
        hpush(c, s);
      }
    }
  }
  free(hp);
  free(best);
  free(bn);
  free(bw);
  free(roff);
  free(rsrc);
  free(fill);
  free(rw);
}
static uint64_t rngState = 281028;
static uint64_t rng(void) {
  rngState ^= rngState << 13;
  rngState ^= rngState >> 7;
  rngState ^= rngState << 17;
  return rngState;
}
int main(int argc, char **argv) {
  if (argc < 4) {
    fprintf(stderr, "usage: generate_modes PRINT WITNESS.json RECOVERY.json [LABEL] [SAMPLES]\n");
    return 2;
  }
  initEv();
  initPerm();
  Print P;
  if (parsePrint(argv[1], &P)) {
    fprintf(stderr, "bad print\n");
    return 1;
  }
  FILE *f = fopen(argv[2], "wx");
  if (!f) {
    fprintf(stderr, "refusing to overwrite or cannot open %s\n", argv[2]);
    return 1;
  }
  FILE *fr = fopen(argv[3], "wx");
  if (!fr) {
    fprintf(stderr, "refusing to overwrite or cannot open %s\n", argv[3]);
    return 1;
  }
  const char *label = argc > 4 ? argv[4] : "candidate";
  int samples = argc > 5 ? atoi(argv[5]) : 12;
  char pbuf[512];
  printPrint(&P, pbuf);
  int wl = 0, wv = 0;
  int universal = universalBound(&P, &wl, &wv);
  if (universal > 6) {
    fprintf(stderr, "universal bound %d exceeds six\n", universal);
    return 1;
  }
  const char LET[3] = {'S', 'M', 'H'};
  const int RANGE[3] = {60, 24, 12};
  Mode modes[18];
  Period per[18];
  int nm = 0;
  for (int a = 0; a < 3; a++)
    for (int b = 0; b < 3; b++)
      for (int d = 0; d < 2; d++)
        modes[nm++] = (Mode){LET[a], RANGE[b], d ? -1 : 1};
  fprintf(f,
          "{\n  \"schema\": \"cubistry.hsm-seconds-first-modes\",\n  \"version\": 1,\n  \"label\": \"%s\",\n  "
          "\"printCode\": \"%s\",\n  \"universalArbitrarySourceHTM\": %d,\n  \"edgeLimitHTM\": %d,\n",
          label, pbuf, universal, LIMIT);
  printJSONPrint(f, &P);
  fprintf(f, "  \"modes\": [\n");
  for (int mi = 0; mi < 18; mi++) {
    Mode M = modes[mi];
    loadOpts(&P, M.L, M.N);
    Graph G;
    if (buildGraph(&P, M.L, M.N, M.dir, &G)) {
      fprintf(stderr, "infeasible display\n");
      return 1;
    }
    Period *pp = &per[mi];
    findPeriod(&P, M, &G, pp);
    if (!pp->ok) {
      fprintf(stderr, "%c %d %+d: no recurrent shortest-edge cycle under cap %d\n", M.L, M.N - 1, M.dir, LIMIT);
      fprintf(f, "    {\"letter\": \"%c\", \"maximum\": %d, \"direction\": %d, \"status\": \"UNSAT\"}%s\n", M.L,
              M.N - 1, M.dir, mi < 17 ? "," : "");
      freeGraph(&G);
      continue;
    }
    long g = gcdl(pp->A, pp->L);
    fprintf(f,
            "    {\"letter\": \"%c\", \"maximum\": %d, \"direction\": %d, \"htmCap\": %d, \"graphNodes\": "
            "%d, \"graphEdges\": %ld, \"certificatePasses\": %ld,\n",
            M.L, M.N - 1, M.dir, pp->cap, G.n, G.ne, pp->passes);
    fprintf(f,
            "     \"optimalMeanHTM\": \"%ld/%ld\", \"periodHTM\": %ld, \"periodEdges\": %ld, \"maximumHTM\": "
            "%d,\n",
            pp->A / g, pp->L / g, pp->A, pp->L, pp->maxc);
    fprintf(f,
            "     \"appPolicy13\": {\"preperiodEdges\": %ld, \"periodEdges\": %ld, \"periodHTM\": %ld, "
            "\"maximumHTM\": %d},\n",
            pp->gpre, pp->gper, pp->gHTM, pp->gmax);
    fprintf(f, "     \"setup\": \"%s\", \"periodStart\": 0,\n     \"periodStartFrames\": ", pp->setup);
    printFrames(f, &P, pp->start);
    fprintf(f, ",\n     \"steps\": [\n");
    for (int i = 0; i < pp->len; i++) {
      int a = pp->cyc[i], b = pp->cyc[(i + 1) % pp->len];
      int nv = G.layer[b];
      int d = G.cost[a];
      wordBetween(G.key[a], G.key[b], d, OPT[nv], NOPT[nv]);
      char ws[64];
      wordStr(fw, d, ws);
      fprintf(f, "       {\"from\": %d, \"to\": %d, \"word\": \"%s\"}%s\n", G.layer[a], nv, ws,
              i + 1 < pp->len ? "," : "");
    }
    fprintf(f, "     ]}%s\n", mi < 17 ? "," : "");
    fprintf(stderr,
            "%c %d %+d: cap %d mean %ld/%ld=%.4f lap %.2f max %d nodes %d edges %ld passes %ld | app13 per %ld lap "
            "%.2f max %d | setup %d\n",
            M.L, M.N - 1, M.dir, pp->cap, pp->A, pp->L, (double)pp->A / pp->L, (double)pp->A / pp->L * M.N,
            pp->maxc, G.n, G.ne, pp->passes, pp->gper, pp->gper ? (double)pp->gHTM / pp->gper * M.N : 0, pp->gmax,
            pp->setupLen);
    freeGraph(&G);
  }
  fprintf(f, "  ],\n  \"appModes\": [\n");
  // selection
  int src[18], fwd[18];
  for (int mi = 0; mi < 18; mi++) {
    int up = mi & ~1, down = mi | 1; // +1 at even index, -1 at odd
    int primary = up, alt = down;
    Period *a = &per[primary], *b = &per[alt];
    int useAlt = 0;
    int aOk = a->ok && a->maxc <= LIMIT, bOk = b->ok && b->maxc <= LIMIT;
    if (!aOk && bOk)
      useAlt = 1;
    else if (aOk && bOk) {
      long l = b->A * a->L - a->A * b->L; // <0: alt cheaper
      if (l < 0 || (l == 0 && b->maxc < a->maxc))
        useAlt = 1;
    }
    src[mi] = useAlt ? alt : primary;
    fwd[mi] = modes[src[mi]].dir == modes[mi].dir;
    if (!(useAlt ? bOk : aOk))
      src[mi] = -1;
  }
  for (int mi = 0; mi < 18; mi++) {
    Mode M = modes[mi];
    if (src[mi] < 0) {
      fprintf(f, "    {\"letter\": \"%c\", \"maximum\": %d, \"direction\": %d, \"status\": \"UNKNOWN\"}%s\n", M.L,
              M.N - 1, M.dir, mi < 17 ? "," : "");
      continue;
    }
    Period *s = &per[src[mi]];
    long g = gcdl(s->A * M.N, s->L);
    fprintf(f,
            "    {\"letter\": \"%c\", \"maximum\": %d, \"direction\": %d, \"sourceDirection\": %d, \"traversal\": "
            "\"%s\", \"periodHTM\": %ld, \"periodEdges\": %ld, \"perLapHTM\": \"%ld/%ld\", \"maximumHTM\": %d}%s\n",
            M.L, M.N - 1, M.dir, modes[src[mi]].dir, fwd[mi] ? "forward" : "inverse", s->A, s->L, s->A * M.N / g,
            s->L / g, s->maxc, mi < 17 ? "," : "");
  }
  fprintf(f, "  ]\n}\n");
  fclose(f);
  /* ---------------- recovery ---------------- */
  fprintf(fr,
          "{\n  \"schema\": \"cubistry.hsm-seconds-first-recovery\",\n  \"version\": 1,\n  \"label\": \"%s\",\n  "
          "\"printCode\": \"%s\",\n  \"edgeLimitHTM\": %d,\n  \"objective\": \"lexicographic: edges above the "
          "limit, steps, HTM\",\n  \"modes\": [\n",
          label, pbuf, LIMIT);
  for (int mi = 0; mi < 18; mi++) {
    Mode M = modes[mi];
    loadOpts(&P, M.L, M.N);
    Graph G;
    buildGraph(&P, M.L, M.N, M.dir, &G);
    if (src[mi] < 0) {
      fprintf(fr, "    {\"letter\": \"%c\", \"maximum\": %d, \"direction\": %d, \"status\": \"UNKNOWN\"}%s\n", M.L,
              M.N - 1, M.dir, mi < 17 ? "," : "");
      freeGraph(&G);
      continue;
    }
    Adj A;
    buildAdj(&G, &A, M.N, M.dir);
    uint8_t *onP = calloc(G.n, 1);
    Period *s = &per[src[mi]];
    {
      // period nodes: the source graph has the same node enumeration
      Graph GS;
      loadOpts(&P, M.L, M.N);
      buildGraph(&P, M.L, M.N, modes[src[mi]].dir, &GS);
      for (int i = 0; i < s->len; i++) {
        int t = hmGet(&G.map, GS.key[s->cyc[i]]);
        if (t < 0) {
          fprintf(stderr, "period node missing\n");
          return 1;
        }
        onP[t] = 1;
      }
      freeGraph(&GS);
      loadOpts(&P, M.L, M.N);
    }
    Rec RC;
    recover(&A, onP, &RC);
    long hist[64] = {0}, six[8] = {0}, unreachable = 0, sumSteps = 0, maxH = 0;
    int maxSteps = 0, worst = -1, forced = 0;
    long maxHnode = -1;
    int firstForced = -1;
    for (int i = 0; i < G.n; i++) {
      if (RC.cost[i] < 0) {
        unreachable++;
        continue;
      }
      int s6 = RC.cost[i] >> 40, st = (RC.cost[i] >> 20) & 0xfffff, h = RC.cost[i] & 0xfffff;
      hist[st < 63 ? st : 63]++;
      six[s6 < 7 ? s6 : 7]++;
      sumSteps += st;
      if (st > maxSteps || (st == maxSteps && worst < 0)) {
        maxSteps = st;
        worst = i;
      }
      if (h > maxH) {
        maxH = h;
        maxHnode = i;
      }
      if (G.cost[i] > LIMIT && forced++ == 0)
        firstForced = i;
    }
    fprintf(fr,
            "    {\"letter\": \"%c\", \"maximum\": %d, \"direction\": %d, \"sourceDirection\": %d, \"traversal\": "
            "\"%s\",\n",
            M.L, M.N - 1, M.dir, modes[src[mi]].dir, modes[src[mi]].dir == M.dir ? "forward" : "inverse");
    fprintf(fr, "     \"graphNodes\": %d, \"edgesAtMostLimitOrForced\": %ld, \"periodNodes\": %d, \"unreachable\": %ld,\n",
            G.n, A.ne, s->len, unreachable);
    fprintf(fr, "     \"poseWithoutEdgeAtMostLimit\": %d, \"stepsHistogram\": {", forced);
    int first = 1;
    for (int k = 0; k < 64; k++)
      if (hist[k]) {
        fprintf(fr, "%s\"%d\": %ld", first ? "" : ", ", k, hist[k]);
        first = 0;
      }
    fprintf(fr, "},\n     \"edgesAboveLimitHistogram\": {");
    first = 1;
    for (int k = 0; k < 8; k++)
      if (six[k]) {
        fprintf(fr, "%s\"%d\": %ld", first ? "" : ", ", k, six[k]);
        first = 0;
      }
    fprintf(fr, "},\n     \"maximumSteps\": %d, \"meanSteps\": %.4f, \"maximumRecoveryHTM\": %ld,\n", maxSteps,
            (double)sumSteps / (G.n - unreachable), maxH);
    // samples: the worst-steps pose, the most-HTM pose, the first pose without an
    // edge of at most five (when there is one), then pseudo-random poses
    fprintf(fr, "     \"samples\": [\n");
    rngState = 281028 + mi;
    int printed = 0;
    for (int k = 0; k < samples + 3; k++) {
      int v0 = k == 0 ? worst : k == 1 ? (int)maxHnode : k == 2 ? firstForced : (int)(rng() % G.n);
      if (v0 < 0 || RC.cost[v0] < 0)
        continue;
      uint8_t start[8], solved[8] = {0};
      unpackS(G.key[v0], start);
      int sl = solveTo(solved, start);
      char sw[256];
      wordStr(solW, sl, sw);
      fprintf(fr, "%s       {\"fromValue\": %d, \"setupFromSolved\": \"%s\", \"steps\": %ld, \"words\": [",
              printed++ ? ",\n" : "", G.layer[v0],
              sw, (RC.cost[v0] >> 20) & 0xfffff);
      int fst = 1;
      for (int v = v0; RC.next[v] >= 0; v = RC.next[v]) {
        int t = RC.next[v];
        int nv = G.layer[t];
        wordBetween(G.key[v], G.key[t], RC.nextW[v], OPT[nv], NOPT[nv]);
        char ws[64];
        wordStr(fw, RC.nextW[v], ws);
        fprintf(fr, "%s\"%s\"", fst ? "" : ", ", ws);
        fst = 0;
      }
      fprintf(fr, "]}");
    }
    fprintf(fr, "\n     ]}%s\n", mi < 17 ? "," : "");
    fprintf(stderr,
            "recovery %c %d %+d (%s): nodes %d edges %ld unreachable %ld forced6 %d maxSteps %d mean %.3f maxHTM %ld "
            "sixes[0..2] %ld %ld %ld\n",
            M.L, M.N - 1, M.dir, modes[src[mi]].dir == M.dir ? "forward" : "inverse", G.n, A.ne, unreachable, forced,
            maxSteps, (double)sumSteps / (G.n - unreachable), maxH, six[0], six[1], six[2]);
    free(RC.cost);
    free(RC.next);
    free(RC.nextW);
    free(onP);
    freeAdj(&A);
    freeGraph(&G);
  }
  fprintf(fr, "  ]\n}\n");
  fclose(fr);
  return 0;
}
