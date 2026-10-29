/* Seconds-first print search: simulated annealing over 24-sticker prints.
 *
 * Objective (lexicographic, the first item drives annealing):
 *   feasibility: all 180 displays exist, at most 64 sticker selections per
 *   display, every display within six HTM from any legal pose, and M up and
 *   M down each admit a recurrent shortest-edge cycle with every edge <= 5;
 *   then the exact minimum per-lap HTM of the recurrent S +1 cycle.
 * Secondary objectives are evaluated by generate.c for the reported print.
 * Usage: search START_PRINT SEED ITERATIONS T_START T_END
 */
#include "engine.h"
static uint64_t rs;
static uint64_t rnd(void) {
  rs ^= rs << 13;
  rs ^= rs >> 7;
  rs ^= rs << 17;
  return rs;
}
static double urand(void) { return (rnd() >> 11) * (1.0 / 9007199254740992.0); }
static int displaysOK(const Print *P) {
  static Opt o[256];
  for (int l = TH; l <= TMl; l++)
    for (int v = 0; v < 60; v++) {
      int k = optionsFor(P, l, v / 10, v % 10, o);
      if (!k || k > 64)
        return 0;
    }
  return 1;
}
static int countsOK(const Print *P) {
  int cnt[20] = {0};
  for (int c = 0; c < 8; c++)
    for (int j = 0; j < 3; j++)
      cnt[P->ty[c][j]]++;
  for (int t = 0; t < 20; t++)
    if (!cnt[t])
      return 0;
  return 1;
}
static double evalS(const Print *P, int dir) {
  Graph G;
  if (buildGraph(P, 'S', 60, dir, &G))
    return 1e9;
  uint8_t *al = malloc(G.n);
  computeAlive(&G, 6, al);
  MMC r;
  howard(&G, al, &r);
  double v = (double)r.A / r.L * 60;
  free(r.cyc);
  free(al);
  freeGraph(&G);
  return v;
}
static int mOK(const Print *P) {
  for (int dir = -1; dir <= 1; dir += 2) {
    Graph G;
    if (buildGraph(P, 'M', 60, dir, &G))
      return 0;
    uint8_t *al = malloc(G.n);
    int na = computeAlive(&G, 5, al);
    free(al);
    freeGraph(&G);
    if (!na)
      return 0;
  }
  return 1;
}
int main(int argc, char **argv) {
  if (argc < 6) {
    fprintf(stderr, "usage: search PRINT SEED ITERATIONS T0 T1\n");
    return 2;
  }
  initEv();
  initPerm();
  Print P;
  if (parsePrint(argv[1], &P)) {
    fprintf(stderr, "bad print\n");
    return 2;
  }
  Print app = P;
  rs = strtoull(argv[2], 0, 10) * 2654435761ULL + 1;
  int iters = atoi(argv[3]);
  double T0 = atof(argv[4]), T1 = atof(argv[5]);
  int wl, wv;
  if (!displaysOK(&P) || universalBound(&P, &wl, &wv) > 6 || !mOK(&P)) {
    fprintf(stderr, "start infeasible\n");
    return 1;
  }
  double cur = evalS(&P, 1), bestv = cur;
  Print best = P;
  char buf[512];
  printPrint(&P, buf);
  printf("start %.3f %s\n", cur, buf);
  fflush(stdout);
  for (int it = 0; it < iters; it++) {
    double T = T0 * pow(T1 / T0, (double)it / iters);
    Print Q = P;
    int kind = rnd() % 10;
    if (kind < 6) { /* swap two stickers */
      int a = rnd() % 24, b = rnd() % 24, t = Q.ty[a / 3][a % 3];
      Q.ty[a / 3][a % 3] = Q.ty[b / 3][b % 3];
      Q.ty[b / 3][b % 3] = t;
    } else if (kind < 8) { /* cyclically turn one corner's stickers */
      int c = rnd() % 8, t = Q.ty[c][0];
      Q.ty[c][0] = Q.ty[c][1];
      Q.ty[c][1] = Q.ty[c][2];
      Q.ty[c][2] = t;
    } else { /* reprint one sticker with any glyph or blank */
      int a = rnd() % 24;
      Q.ty[a / 3][a % 3] = rnd() % 20;
    }
    if (!countsOK(&Q) || !displaysOK(&Q))
      continue;
    double v = evalS(&Q, 1);
    if (v >= 1e9)
      continue;
    if (v <= cur || urand() < exp((cur - v) / T)) {
      if (universalBound(&Q, &wl, &wv) > 6)
        continue;
      if (!mOK(&Q))
        continue;
      P = Q;
      cur = v;
      if (v < bestv - 1e-9) {
        bestv = v;
        best = Q;
        printPrint(&best, buf);
        printf("it %d best %.3f %s\n", it, bestv, buf);
        fflush(stdout);
      }
    }
    if (it % 500 == 0) {
      printf("it %d T %.3f cur %.3f best %.3f\n", it, T, cur, bestv);
      fflush(stdout);
    }
  }
  printPrint(&best, buf);
  printf("final %.3f %s\n", bestv, buf);
  Print canon;
  int changed = canonicalize(&best, &app, &canon);
  printPrint(&canon, buf);
  printf("canonical %.3f changed %d %s\n", evalS(&canon, 1), changed, buf);
  return 0;
}
