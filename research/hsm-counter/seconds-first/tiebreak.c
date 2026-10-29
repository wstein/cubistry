/* Lexicographic tie-break walk on the plateau of an S optimum.
 *
 * Key, smaller is better: S +1 per-lap optimum, S +1 maximum edge, M +1 per-lap,
 * M -1 per-lap, H 00-23 +1 per-lap, H 00-11 +1 per-lap (all exact recurrent
 * shortest-edge optima). Neighborhood and feasibility filters equal polish.c.
 * Moves to the best strictly better neighbor until none exists.
 * Usage: tiebreak PRINT
 */
#include "engine.h"
static int displaysOK(const Print *P) {
  static Opt o[256];
  for (int l = TH; l <= TMl; l++)
    for (int v = 0; v < 60; v++) {
      int k = optionsFor(P, l, v / 10, v % 10, o);
      if (!k || k > 64) return 0;
    }
  return 1;
}
static int countsOK(const Print *P) {
  int cnt[20] = {0};
  for (int c = 0; c < 8; c++)
    for (int j = 0; j < 3; j++) cnt[P->ty[c][j]]++;
  for (int t = 0; t < 20; t++)
    if (!cnt[t]) return 0;
  return 1;
}
static double evalS(const Print *P, int dir) {
  Graph G;
  if (buildGraph(P, 'S', 60, dir, &G)) return 1e9;
  uint8_t *al = malloc(G.n);
  computeAlive(&G, 6, al);
  MMC r;
  howard(&G, al, &r);
  double v = (double)r.A / r.L * 60;
  free(r.cyc); free(al); freeGraph(&G);
  return v;
}
static int mOK(const Print *P) {
  for (int dir = -1; dir <= 1; dir += 2) {
    Graph G;
    if (buildGraph(P, 'M', 60, dir, &G)) return 0;
    uint8_t *al = malloc(G.n);
    int na = computeAlive(&G, 5, al);
    free(al); freeGraph(&G);
    if (!na) return 0;
  }
  return 1;
}
static int neighbor(const Print *P, int k, Print *Q) {
  *Q = *P;
  if (k < 276) { /* swap pair */
    int a = 0, b = 1, n = 0;
    for (a = 0; a < 24; a++)
      for (b = a + 1; b < 24; b++)
        if (n++ == k) goto found;
  found:;
    int t = Q->ty[a / 3][a % 3];
    Q->ty[a / 3][a % 3] = Q->ty[b / 3][b % 3];
    Q->ty[b / 3][b % 3] = t;
    return t != Q->ty[a / 3][a % 3];
  }
  k -= 276;
  if (k < 8) {
    int t = Q->ty[k][0];
    Q->ty[k][0] = Q->ty[k][1]; Q->ty[k][1] = Q->ty[k][2]; Q->ty[k][2] = t;
    return 1;
  }
  k -= 8;
  int a = k / 20, ty = k % 20;
  if (Q->ty[a / 3][a % 3] == ty) return 0;
  Q->ty[a / 3][a % 3] = ty;
  return 1;
}

static double lapOf(const Print *P, char L, int N, int dir, int cap, int *maxc) {
  Graph G;
  if (buildGraph(P, L, N, dir, &G)) return 1e9;
  uint8_t *al = malloc(G.n);
  if (!computeAlive(&G, cap, al)) { free(al); freeGraph(&G); return 1e9; }
  MMC r;
  howard(&G, al, &r);
  double v = (double)r.A / r.L * N;
  if (maxc) *maxc = r.maxc;
  free(r.cyc); free(al); freeGraph(&G);
  return v;
}
static void key(const Print *P, double *k) {
  int mx;
  k[0] = lapOf(P, 'S', 60, 1, 6, &mx);
  /* smallest maximum edge among S-optimal cycles: tighten the cap */
  k[1] = mx;
  for (int c = mx - 1; c >= 1; c--) {
    int m2;
    double v = lapOf(P, 'S', 60, 1, c, &m2);
    if (v > k[0] + 1e-9) break;
    k[1] = c;
  }
  k[2] = lapOf(P, 'M', 60, 1, 5, 0);
  k[3] = lapOf(P, 'M', 60, -1, 5, 0);
  k[4] = lapOf(P, 'H', 24, 1, 6, 0);
  k[5] = lapOf(P, 'H', 12, 1, 6, 0);
}
static int better(const double *a, const double *b) {
  for (int i = 0; i < 6; i++) {
    if (a[i] < b[i] - 1e-9) return 1;
    if (a[i] > b[i] + 1e-9) return 0;
  }
  return 0;
}
int main(int argc, char **argv) {
  initEv(); initPerm();
  Print P;
  if (argc < 2 || parsePrint(argv[1], &P)) { fprintf(stderr, "usage: tiebreak PRINT\n"); return 2; }
  double cur[6]; key(&P, cur);
  char buf[512];
  printPrint(&P, buf);
  printf("start %.3f %.0f %.3f %.3f %.3f %.3f %s\n", cur[0], cur[1], cur[2], cur[3], cur[4], cur[5], buf);
  fflush(stdout);
  for (int round = 1;; round++) {
    double best[6]; memcpy(best, cur, sizeof best);
    Print bp = P; int found = 0, plateau = 0;
    for (int k = 0; k < 276 + 8 + 24 * 20; k++) {
      Print Q; int wl, wv;
      if (!neighbor(&P, k, &Q) || !countsOK(&Q) || !displaysOK(&Q)) continue;
      double s = evalS(&Q, 1);
      if (s > cur[0] + 1e-9) continue;
      if (!mOK(&Q) || universalBound(&Q, &wl, &wv) > 6) continue;
      plateau++;
      double kq[6]; key(&Q, kq);
      if (better(kq, best)) { memcpy(best, kq, sizeof best); bp = Q; found = 1; }
    }
    printf("round %d plateau-or-better neighbors %d\n", round, plateau);
    if (!found) break;
    P = bp; memcpy(cur, best, sizeof cur);
    printPrint(&P, buf);
    printf("move %.3f %.0f %.3f %.3f %.3f %.3f %s\n", cur[0], cur[1], cur[2], cur[3], cur[4], cur[5], buf);
    fflush(stdout);
  }
  printPrint(&P, buf);
  printf("final %.3f %.0f %.3f %.3f %.3f %.3f %s\n", cur[0], cur[1], cur[2], cur[3], cur[4], cur[5], buf);
  return 0;
}
