/* Seconds-first H/S/M witness generator.
 *
 * For one fixed print and each counting mode, builds the complete graph of
 * settled full poses whose edges are all shortest legal words from the actual
 * pose, finds a minimum-mean recurrent cycle (Howard policy iteration), checks
 * it with integer Bellman-Ford potentials, lowers the maximum edge while the
 * mean stays optimal, and writes setup and period words.
 * Usage: generate PRINT NEW_OUTPUT.json [LABEL]   (refuses to overwrite)
 */
#include "engine.h"
static const char *MN[18] = {"R", "R2", "R'", "L", "L2", "L'", "U", "U2", "U'",
                             "D", "D2", "D'", "F", "F2", "F'", "B", "B2", "B'"};
static int fw[8];
static int fwFound;
static Key fwTarget;
static void dfsFind(uint8_t *r, int rem, int depth, int nact, int (*q)[4]) {
  if (fwFound)
    return;
  if (rem == 0) {
    if (packS(r) == fwTarget)
      fwFound = 1;
    return;
  }
  for (int m = 0; m < 18 && !fwFound; m++) {
    int nq[256][4];
    int n2 = 0;
    for (int i = 0; i < nact; i++) {
      int a = TS[0][m][q[i][0]], b = TS[1][m][q[i][1]], c = TS[2][m][q[i][2]], d = TS[3][m][q[i][3]];
      if (D4[enc4(a, b, c, d)] == rem - 1) {
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
    dfsFind(r2, rem - 1, depth + 1, n2, nq);
  }
}
static int edgeWord(Key from, Key to, const Opt *o, int no) {
  uint8_t r[8];
  unpackS(from, r);
  int best[256];
  int d = costTo(r, o, no, best);
  int q[256][4], n = 0;
  for (int k = 0; k < no; k++)
    if (best[k] == d) {
      for (int s = 0; s < 4; s++) {
        int c = o[k].c[s];
        q[n][s] = comp[r[c]][inv[RT[c][o[k].j[s]][s]]];
      }
      n++;
    }
  fwFound = 0;
  fwTarget = to;
  dfsFind(r, d, 0, n, q);
  if (!fwFound) {
    fprintf(stderr, "no word\n");
    exit(1);
  }
  return d;
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
static void printJSON(FILE *f, const Print *P) {
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
typedef struct {
  char L;
  int N, dir, cap;
} Mode;
int main(int argc, char **argv) {
  initEv();
  initPerm();
  Print P;
  if (parsePrint(argv[1], &P)) {
    fprintf(stderr, "bad print\n");
    return 1;
  }
  FILE *f = fopen(argv[2], "wx");
  if (!f) {
    fprintf(stderr, "refusing to overwrite or cannot open output\n");
    return 1;
  }
  const char *label = argc > 3 ? argv[3] : "candidate";
  Mode modes[8] = {{'S', 60, 1, 6}, {'S', 60, -1, 6}, {'M', 60, 1, 5}, {'M', 60, -1, 5},
                   {'H', 24, 1, 6}, {'H', 24, -1, 6}, {'H', 12, 1, 6}, {'H', 12, -1, 6}};
  char pbuf[512];
  printPrint(&P, pbuf);
  int wl = 0, wv = 0;
  int universal = universalBound(&P, &wl, &wv);
  if (universal > 6) {
    fprintf(stderr, "universal bound %d exceeds six\n", universal);
    return 1;
  }
  fprintf(f,
          "{\n  \"schema\": \"cubistry.hsm-seconds-first\",\n  \"version\": 1,\n  \"label\": \"%s\",\n  "
          "\"printCode\": \"%s\",\n  \"universalArbitrarySourceHTM\": %d,\n",
          label, pbuf, universal);
  printJSON(f, &P);
  fprintf(f, "  \"modes\": [\n");
  for (int mi = 0; mi < 8; mi++) {
    Mode M = modes[mi];
    Graph G;
    if (buildGraph(&P, M.L, M.N, M.dir, &G)) {
      fprintf(stderr, "infeasible display\n");
      return 1;
    }
    uint8_t *al = malloc(G.n);
    if (!computeAlive(&G, M.cap, al)) {
      fprintf(stderr, "no cycle under cap %c\n", M.L);
      return 1;
    }
    MMC r;
    howard(&G, al, &r);
    long A = r.A, L = r.L;
    long *pot = malloc(G.n * 8);
    long passes = certify(&G, al, A, L, pot);
    if (passes < 0) {
      fprintf(stderr, "certificate failed\n");
      return 1;
    }
    // tighten max while keeping the same optimal mean
    MMC best = r;
    uint8_t *al2 = malloc(G.n);
    for (int c2 = r.maxc - 1; c2 >= 1; c2--) {
      if (!computeAlive(&G, c2, al2))
        break;
      MMC r2;
      howard(&G, al2, &r2);
      if (r2.A * L == A * r2.L && certify(&G, al2, r2.A, r2.L, pot) >= 0) {
        free(best.cyc);
        best = r2;

      } else {
        free(r2.cyc);
        break;
      }
    }
    // greedy policy-13 app-style period for comparison
    static Opt gop[60][256];
    int gno[60];
    int lt = letterType(M.L);
    for (int v = 0; v < M.N; v++)
      gno[v] = optionsFor(&P, lt, v / 10, v % 10, gop[v]);
    long gper = 0, gHTM = 0;
    int gmax = 0, gpre = 0;
    {
      uint8_t rr[8] = {0};
      int w[16];
      int n0 = (M.dir + M.N) % M.N;
      greedyMove(rr, gop[0], gno[0], gop[n0], gno[n0], 13, w);
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
          gpre = seen;
          gper = steps - seen;
          gHTM = tot - cum[seen];
          gmax = mx;
          break;
        }
        hmPut(&H, k, steps);
        for (int j = 0; j < M.N; j++) {
          cum[steps] = tot;
          int t = (value + M.dir + M.N) % M.N, t2 = (t + M.dir + M.N) % M.N;
          int h = greedyMove(rr, gop[t], gno[t], gop[t2], gno[t2], 13, w);
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
    // setup from print source state to cycle start
    uint8_t src[8] = {0}, tgt[8];
    unpackS(G.key[best.cyc[0]], tgt);
    int sl = solveTo(src, tgt);
    char sw[256];
    wordStr(solW, sl, sw);
    long g = gcdl(best.A, best.L);
    fprintf(f,
            "    {\"letter\": \"%c\", \"maximum\": %d, \"direction\": %d, \"htmCap\": %d, \"graphNodes\": "
            "%d, \"graphEdges\": %ld, \"certificatePasses\": %ld,\n",
            M.L, M.N - 1, M.dir, M.cap, G.n, G.ne, passes);
    fprintf(f,
            "     \"optimalMeanHTM\": \"%ld/%ld\", \"periodHTM\": %ld, \"periodEdges\": %ld, \"maximumHTM\": "
            "%d,\n",
            best.A / g, best.L / g, best.A, best.L, best.maxc);
    fprintf(f,
            "     \"appPolicy13\": {\"preperiodEdges\": %d, \"periodEdges\": %ld, \"periodHTM\": %ld, "
            "\"maximumHTM\": %d},\n",
            gpre, gper, gHTM, gmax);
    fprintf(f, "     \"setup\": \"%s\", \"periodStart\": 0,\n     \"periodStartFrames\": [", sw);
    for (int c = 0; c < 8; c++)
      for (int j = 0; j < 3; j++) {
        int t = P.ty[c][j], r = tgt[c], home = RT[c][j][typeSlot(t)];
        int y[3] = {0, 1, 0}, up0[3], n0[3] = {0, 0, 0}, p[3], n[3], up[3];
        mv(&R[inv[home]], y, up0);
        n0[j] = POS[c][j];
        mv(&R[r], POS[c], p);
        mv(&R[r], n0, n);
        mv(&R[r], up0, up);
        fprintf(f, "%s{\"id\": %d, \"p\": [%d, %d, %d], \"n\": [%d, %d, %d], \"up\": [%d, %d, %d]}",
                c + j ? ", " : "", c * 3 + j, p[0], p[1], p[2], n[0], n[1], n[2], up[0], up[1], up[2]);
      }
    fprintf(f, "],\n     \"steps\": [\n");
    for (int i = 0; i < best.cycleLength; i++) {
      int a = best.cyc[i], b = best.cyc[(i + 1) % best.cycleLength];
      int nv = G.layer[b];
      int d = edgeWord(G.key[a], G.key[b], gop[nv], gno[nv]);
      char ws[64];
      wordStr(fw, d, ws);
      fprintf(f, "       {\"from\": %d, \"to\": %d, \"word\": \"%s\"}%s\n", G.layer[a], nv, ws,
              i + 1 < best.cycleLength ? "," : "");
    }
    fprintf(f, "     ]}%s\n", mi < 7 ? "," : "");
    fprintf(stderr,
            "%c %d %+d: mean %ld/%ld=%.4f lap %.2f max %d (cap %d) nodes %d edges %ld passes %ld | app13 pre "
            "%d per %ld HTM %ld lap %.2f max %d | setup %d\n",
            M.L, M.N - 1, M.dir, best.A, best.L, (double)best.A / best.L, (double)best.A / best.L * M.N,
            best.maxc, M.cap, G.n, G.ne, passes, gpre, gper, gHTM, gper ? (double)gHTM / gper * M.N : 0, gmax,
            sl);
    free(best.cyc);
    free(al);
    free(al2);
    free(pot);
    freeGraph(&G);
  }
  fprintf(f, "  ]\n}\n");
  fclose(f);
  return 0;
}
