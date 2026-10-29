/* Exhaustive one-change neighborhood check (local optimality) of a print.
 *
 * Neighbors: every swap of two stickers, every cyclic turn of one corner's
 * three stickers, and every reprint of one sticker with any glyph or blank.
 * Feasibility filters are those of search.c. Repeats first-improvement
 * descent on the exact S +1 per-lap minimum until no neighbor improves.
 * Usage: polish PRINT
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
int main(int argc, char **argv) {
  initEv(); initPerm();
  Print P; if (argc < 2 || parsePrint(argv[1], &P)) { fprintf(stderr, "usage: polish PRINT\n"); return 2; }
  double cur = evalS(&P, 1); char buf[512];
  int improved = 1, rounds = 0;
  while (improved) {
    improved = 0; rounds++;
    long tried = 0;
    for (int k = 0; k < 276 + 8 + 24 * 20; k++) {
      Print Q; int wl, wv;
      if (!neighbor(&P, k, &Q) || !countsOK(&Q) || !displaysOK(&Q)) continue;
      double v = evalS(&Q, 1); tried++;
      if (v < cur - 1e-9 && universalBound(&Q, &wl, &wv) <= 6 && mOK(&Q)) {
        P = Q; cur = v; improved = 1; printPrint(&P, buf);
        printf("round %d neighbor %d improves to %.3f %s\n", rounds, k, cur, buf); fflush(stdout);
        break;
      }
    }
    printf("round %d evaluated %ld neighbors, current %.3f\n", rounds, tried, cur); fflush(stdout);
  }
  printPrint(&P, buf); printf("local optimum %.3f %s\n", cur, buf);
  return 0;
}
