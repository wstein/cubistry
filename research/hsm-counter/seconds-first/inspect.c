/* Print inspection: exact recurrent optima of every mode, the universal bound,
 * and the relabeling of the print that changes the fewest stickers of the app print.
 *
 * Usage: inspect PRINT
 * Output: one JSON line. Laps are minimum-mean shortest-edge recurrent cycles
 * (Howard policy iteration followed by an integer Bellman-Ford certificate).
 */
#include "engine.h"
static const char *APP = "T0 T1 T2 | T3 T4 T5 | U0 U1 U2 | U3 U4 U5 | U6 U7 U8 | U9 U0 U9 | H S M | _ _ _";
static void lap(const Print *P, char L, int N, int dir, int cap, char *out) {
  Graph G;
  if (buildGraph(P, L, N, dir, &G)) {
    sprintf(out, "null");
    return;
  }
  uint8_t *al = malloc(G.n);
  if (!computeAlive(&G, cap, al)) {
    sprintf(out, "null");
    free(al);
    freeGraph(&G);
    return;
  }
  MMC r;
  howard(&G, al, &r);
  long *pot = malloc(G.n * 8);
  long passes = certify(&G, al, r.A, r.L, pot);
  int floor[60];
  for (int v = 0; v < N; v++)
    floor[v] = 99;
  for (int i = 0; i < G.n; i++)
    if (al[i] && G.cost[i] < floor[G.layer[i]])
      floor[G.layer[i]] = G.cost[i];
  int fs = 0;
  for (int v = 0; v < N; v++)
    fs += floor[v];
  sprintf(out, "{\"perLap\": %.4f, \"periodHTM\": %ld, \"periodEdges\": %ld, \"max\": %d, \"certified\": %s, "
               "\"floorPerLap\": %d}",
          (double)r.A / r.L * N, r.A, r.L, r.maxc, passes >= 0 ? "true" : "false", fs);
  free(r.cyc);
  free(pot);
  free(al);
  freeGraph(&G);
}
int main(int argc, char **argv) {
  initEv();
  initPerm();
  Print P, app, canon;
  if (argc < 2 || parsePrint(argv[1], &P) || parsePrint(APP, &app)) {
    fprintf(stderr, "usage: inspect PRINT\n");
    return 2;
  }
  int wl = 0, wv = 0;
  int u = universalBound(&P, &wl, &wv);
  char b[8][256], pc[512], cc[512];
  lap(&P, 'S', 60, 1, 6, b[0]);
  lap(&P, 'S', 60, -1, 6, b[1]);
  lap(&P, 'M', 60, 1, 5, b[2]);
  lap(&P, 'M', 60, -1, 5, b[3]);
  lap(&P, 'H', 24, 1, 6, b[4]);
  lap(&P, 'H', 24, -1, 6, b[5]);
  lap(&P, 'H', 12, 1, 6, b[6]);
  lap(&P, 'H', 12, -1, 6, b[7]);
  int changed = canonicalize(&P, &app, &canon);
  printPrint(&P, pc);
  printPrint(&canon, cc);
  printf("{\"print\": \"%s\", \"universal\": %d, \"S+\": %s, \"S-\": %s, \"M+\": %s, \"M-\": %s, \"H23+\": %s, "
         "\"H23-\": %s, \"H11+\": %s, \"H11-\": %s, \"canonical\": \"%s\", \"changedVsApp\": %d}\n",
         pc, u, b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7], cc, changed);
  return 0;
}
