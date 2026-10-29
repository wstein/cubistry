/* Seconds-first H/S/M search and witness engine (generator side only).
 *
 * The independent Python checker (verify.py) imports none of this code.
 * Model: 2x2x2, eight rigid corners, 24 immutable stickers, all 18 outer-face
 * turns, HTM. A display is blank / letter / tens / units on the front face,
 * every nonblank glyph upright. Corner c has home position POS[c] and
 * rotation index r (one of 24); stickers are c*3+j with j the home axis.
 */
#include <math.h>
/* ---- geo ---- */
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
typedef struct {
  int m[3][3];
} Rot; // columns? we use v' = M v
static Rot R[24];
static int nR = 0;
static int comp[24][24]; // comp[a][b] = a∘b (apply b then a)
static int inv[24];
static int UNIT[6][3] = {{1, 0, 0}, {-1, 0, 0}, {0, 1, 0}, {0, -1, 0}, {0, 0, 1}, {0, 0, -1}};
static void mv(const Rot *a, const int *v, int *o) {
  for (int i = 0; i < 3; i++) {
    o[i] = 0;
    for (int j = 0; j < 3; j++)
      o[i] += a->m[i][j] * v[j];
  }
}
static int findR(Rot *a) {
  for (int i = 0; i < nR; i++)
    if (!memcmp(&R[i], a, sizeof(Rot)))
      return i;
  return -1;
}
static void initR(void) {
  for (int x = 0; x < 6; x++)
    for (int y = 0; y < 6; y++) {
      int *a = UNIT[x], *b = UNIT[y];
      if (a[0] * b[0] + a[1] * b[1] + a[2] * b[2])
        continue;
      int c[3] = {a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]};
      Rot r;
      for (int i = 0; i < 3; i++) {
        r.m[i][0] = a[i];
        r.m[i][1] = b[i];
        r.m[i][2] = c[i];
      }
      // identity first
      R[nR++] = r;
    }
  // put identity at 0
  for (int i = 0; i < 24; i++) {
    int id = 1;
    for (int a = 0; a < 3; a++)
      for (int b = 0; b < 3; b++)
        if (R[i].m[a][b] != (a == b))
          id = 0;
    if (id) {
      Rot t = R[0];
      R[0] = R[i];
      R[i] = t;
    }
  }
  for (int a = 0; a < 24; a++)
    for (int b = 0; b < 24; b++) {
      Rot c;
      for (int i = 0; i < 3; i++)
        for (int j = 0; j < 3; j++) {
          c.m[i][j] = 0;
          for (int k = 0; k < 3; k++)
            c.m[i][j] += R[a].m[i][k] * R[b].m[k][j];
        }
      comp[a][b] = findR(&c);
    }
  for (int a = 0; a < 24; a++)
    for (int b = 0; b < 24; b++)
      if (comp[a][b] == 0)
        inv[a] = b;
}
// moves: faces R L U D F B ; axis,layer ; quarter about +axis direction positive = counterclockwise looking
// from +axis. Face turn X (clockwise looking at face) = rotation by -90deg about outward normal.
static int FACEAX[6] = {0, 0, 1, 1, 2, 2}, FACEL[6] = {1, -1, 1, -1, 1, -1};
static int MOVR[18], MOVAX[18], MOVL[18];
static int rotAxis(int axis, int q) { // rotation by q*90deg ccw about +axis
  Rot r;
  memset(&r, 0, sizeof r);
  int c = (int[]){1, 0, -1, 0}[q & 3], s = (int[]){0, 1, 0, -1}[q & 3];
  int i = (axis + 1) % 3, j = (axis + 2) % 3;
  r.m[axis][axis] = 1;
  r.m[i][i] = c;
  r.m[j][j] = c;
  r.m[i][j] = -s;
  r.m[j][i] = s;
  return findR(&r);
}
static void initM(void) {
  for (int f = 0; f < 6; f++)
    for (int k = 0; k < 3; k++) {
      int m = f * 3 + k;
      int amt = k == 0 ? 1 : k == 1 ? 2 : -1;
      int q = -FACEL[f] * amt;
      MOVR[m] = rotAxis(FACEAX[f], (q % 4 + 4) % 4);
      MOVAX[m] = FACEAX[f];
      MOVL[m] = FACEL[f];
    }
}
static int movInv(int m) {
  int k = m % 3;
  return k == 0 ? m + 2 : k == 2 ? m - 2 : m;
}
static int POS[8][3]; // index = ((x>0)<<2)|((y>0)<<1)|(z>0)
static int posIdx(const int *p) { return ((p[0] > 0) << 2) | ((p[1] > 0) << 1) | (p[2] > 0); }
static void initP(void) {
  for (int i = 0; i < 8; i++) {
    POS[i][0] = (i & 4) ? 1 : -1;
    POS[i][1] = (i & 2) ? 1 : -1;
    POS[i][2] = (i & 1) ? 1 : -1;
  }
}
static int FRONTP[4][3] = {{-1, 1, 1}, {1, 1, 1}, {-1, -1, 1}, {1, -1, 1}};
// rotPos[r][p] = position index of R[r]*POS[p]
static int rotPos[24][8];
static void initRP(void) {
  for (int r = 0; r < 24; r++)
    for (int p = 0; p < 8; p++) {
      int o[3];
      mv(&R[r], POS[p], o);
      rotPos[r][p] = posIdx(o);
    }
}
static void initAll(void) {
  initR();
  initM();
  initP();
  initRP();
}
/* ---- ev ---- */
// ---------- core tables ----------
static int TR[8][18][24]; // per corner transition
static int TS[4][18][24]; // per slot relative transition
static uint8_t D4[331776];
static int TW[8][24];      // twist of corner c with rotation r
static int RPOS3[8][8][3]; // rotations placing corner c at position p
static int FP[4];
static int RT[8][3][4]; // target rotation for corner c face j at slot s
static int axisOf(const int *v) {
  for (int a = 0; a < 3; a++)
    if (v[a])
      return a;
  return -1;
}
static int twf(int c, int r) {
  for (int j = 0; j < 3; j++) {
    int n[3] = {0, 0, 0};
    n[j] = POS[c][j];
    int o[3];
    mv(&R[r], n, o);
    if (axisOf(o) == 1) {
      int hpar = POS[c][0] * POS[c][1] * POS[c][2];
      int k = (j + 2) % 3;
      if (hpar < 0)
        k = (3 - k) % 3;
      return k;
    }
  }
  return -1;
}
static inline int enc4(int a, int b, int c, int d) { return ((a * 24 + b) * 24 + c) * 24 + d; }
static void initEv(void) {
  initAll();
  for (int s = 0; s < 4; s++)
    FP[s] = posIdx(FRONTP[s]);
  for (int c = 0; c < 8; c++)
    for (int m = 0; m < 18; m++)
      for (int r = 0; r < 24; r++) {
        int p = rotPos[r][c];
        TR[c][m][r] = POS[p][MOVAX[m]] == MOVL[m] ? comp[MOVR[m]][r] : r;
      }
  for (int s = 0; s < 4; s++)
    for (int m = 0; m < 18; m++)
      for (int q = 0; q < 24; q++) {
        int p = rotPos[q][FP[s]];
        TS[s][m][q] = POS[p][MOVAX[m]] == MOVL[m] ? comp[MOVR[m]][q] : q;
      }
  for (int c = 0; c < 8; c++)
    for (int r = 0; r < 24; r++)
      TW[c][r] = twf(c, r);
  for (int c = 0; c < 8; c++) {
    int cnt[8] = {0};
    for (int r = 0; r < 24; r++) {
      int p = rotPos[r][c];
      RPOS3[c][p][cnt[p]++] = r;
    }
    for (int p = 0; p < 8; p++) {
      if (cnt[p] != 3) {
        fprintf(stderr, "rpos\n");
        exit(1);
      }
      int t[3] = {0};
      for (int i = 0; i < 3; i++)
        t[TW[c][RPOS3[c][p][i]]]++;
      if (t[0] != 1 || t[1] != 1 || t[2] != 1) {
        fprintf(stderr, "tw\n");
        exit(1);
      }
    }
  }
  for (int c = 0; c < 8; c++)
    for (int j = 0; j < 3; j++)
      for (int s = 0; s < 4; s++) {
        RT[c][j][s] = -1;
        for (int r = 0; r < 24; r++) {
          if (rotPos[r][c] != FP[s])
            continue;
          int n[3] = {0, 0, 0};
          n[j] = POS[c][j];
          int o[3];
          mv(&R[r], n, o);
          if (o[2] == 1)
            RT[c][j][s] = r;
        }
        if (RT[c][j][s] < 0) {
          fprintf(stderr, "rt\n");
          exit(1);
        }
      }
  memset(D4, 255, sizeof D4);
  int *Q = malloc(sizeof(int) * 331776);
  int h = 0, t = 0;
  Q[t++] = 0;
  D4[0] = 0;
  while (h < t) {
    int k = Q[h++];
    int a0 = k / 13824, a1 = k / 576 % 24, a2 = k / 24 % 24, a3 = k % 24;
    for (int m = 0; m < 18; m++) {
      int kk = enc4(TS[0][m][a0], TS[1][m][a1], TS[2][m][a2], TS[3][m][a3]);
      if (D4[kk] == 255) {
        D4[kk] = D4[k] + 1;
        Q[t++] = kk;
      }
    }
  }
  if (t != 136080) {
    fprintf(stderr, "bfs %d\n", t);
    exit(1);
  }
  free(Q);
}
// ---------- print ----------
// sticker types: 0..5 tens, 6..15 units, 16 H,17 S,18 M,19 blank
enum { TH = 16, TSl = 17, TMl = 18, TB = 19 };
static int typeSlot(int t) { return t < 6 ? 2 : t < 16 ? 3 : t < 19 ? 1 : 0; }
typedef struct {
  int ty[8][3];
} Print;
static int parsePrint(const char *s, Print *P) { // 24 tokens
  int c = 0, j = 0;
  const char *p = s;
  while (*p && c < 8) {
    while (*p == ' ' || *p == ',' || *p == '|')
      p++;
    if (!*p)
      break;
    int t;
    if (*p == 'T') {
      t = p[1] - '0';
      p += 2;
    } else if (*p == 'U') {
      t = 6 + p[1] - '0';
      p += 2;
    } else if (*p == 'H') {
      t = TH;
      p++;
    } else if (*p == 'S') {
      t = TSl;
      p++;
    } else if (*p == 'M') {
      t = TMl;
      p++;
    } else if (*p == '_') {
      t = TB;
      p++;
    } else
      return -1;
    P->ty[c][j] = t;
    if (++j == 3) {
      j = 0;
      c++;
    }
  }
  return c == 8 ? 0 : -1;
}
static void printPrint(const Print *P, char *out) {
  char *o = out;
  for (int c = 0; c < 8; c++) {
    for (int j = 0; j < 3; j++) {
      int t = P->ty[c][j];
      if (t < 6)
        o += sprintf(o, "T%d", t);
      else if (t < 16)
        o += sprintf(o, "U%d", t - 6);
      else if (t == TH)
        o += sprintf(o, "H");
      else if (t == TSl)
        o += sprintf(o, "S");
      else if (t == TMl)
        o += sprintf(o, "M");
      else
        o += sprintf(o, "_");
      if (j < 2)
        *o++ = ' ';
    }
    if (c < 7)
      o += sprintf(o, " | ");
  }
  *o = 0;
}
// option = 4 stickers (c,j) per slot
typedef struct {
  uint8_t c[4], j[4];
} Opt;
static int optionsFor(const Print *P, int letter, int tens, int units, Opt *out) {
  int want[4] = {TB, letter, tens, 6 + units};
  int n = 0;
  int lc[4][24], lj[4][24], ln[4] = {0};
  for (int s = 0; s < 4; s++)
    for (int c = 0; c < 8; c++)
      for (int j = 0; j < 3; j++)
        if (P->ty[c][j] == want[s]) {
          lc[s][ln[s]] = c;
          lj[s][ln[s]] = j;
          ln[s]++;
        }
  for (int a = 0; a < ln[0]; a++)
    for (int b = 0; b < ln[1]; b++)
      for (int x = 0; x < ln[2]; x++)
        for (int y = 0; y < ln[3]; y++) {
          int cs[4] = {lc[0][a], lc[1][b], lc[2][x], lc[3][y]};
          int bad = 0;
          for (int i = 0; i < 4; i++)
            for (int k = i + 1; k < 4; k++)
              if (cs[i] == cs[k])
                bad = 1;
          if (bad)
            continue;
          if (n >= 64)
            return 999;
          Opt o;
          int js[4] = {lj[0][a], lj[1][b], lj[2][x], lj[3][y]};
          for (int i = 0; i < 4; i++) {
            o.c[i] = cs[i];
            o.j[i] = js[i];
          }
          out[n++] = o;
        }
  return n;
}
// full state: r[8]
typedef uint64_t Key;
static inline Key packS(const uint8_t *r) {
  Key k = 0;
  for (int c = 0; c < 8; c++)
    k = k * 24 + r[c];
  return k;
}
static inline void unpackS(Key k, uint8_t *r) {
  for (int c = 7; c >= 0; c--) {
    r[c] = k % 24;
    k /= 24;
  }
}
static inline int costTo(const uint8_t *r, const Opt *o, int no, int *best) {
  int d = 255;
  for (int i = 0; i < no; i++) {
    int q[4];
    for (int s = 0; s < 4; s++) {
      int c = o[i].c[s];
      q[s] = comp[r[c]][inv[RT[c][o[i].j[s]][s]]];
    }
    int v = D4[enc4(q[0], q[1], q[2], q[3])];
    if (best)
      best[i] = v;
    if (v < d)
      d = v;
  }
  return d;
}
/* ---- wcache ---- */
// Cache of shortest-word lists keyed by (remaining depth, sorted active 4-tuples)
typedef struct {
  int rem, n;
  int *keys;
  int woff, wn;
} WEntry;
static WEntry *wE;
static int wEn, wEcap;
static int *wHead;
static int *wNext;
static int wHcap = 1 << 16;
static uint8_t *wWords;
static long wWn, wWcap; // each word stored as 8 bytes (len + moves)
static int cmpInt(const void *a, const void *b) {
  int x = *(const int *)a, y = *(const int *)b;
  return x < y ? -1 : x > y;
}
static void wInit(void) {
  if (wE)
    return;
  wEcap = 1024;
  wE = malloc(wEcap * sizeof(WEntry));
  wHead = malloc(wHcap * 4);
  memset(wHead, 0xff, wHcap * 4);
  wNext = malloc(wEcap * 4);
  wWcap = 1 << 20;
  wWords = malloc(wWcap);
}
static void wReset(void) {
  wInit();
  for (int i = 0; i < wEn; i++)
    free(wE[i].keys);
  wEn = 0;
  memset(wHead, 0xff, wHcap * 4);
  wWn = 0;
}
static uint8_t curW[8];
static void wCollect(int rem, int depth, int n, int (*q)[4]) {
  if (rem == 0) {
    if (wWn + 8 > wWcap) {
      wWcap *= 2;
      wWords = realloc(wWords, wWcap);
    }
    wWords[wWn] = depth;
    memcpy(wWords + wWn + 1, curW, 7);
    wWn += 8;
    return;
  }
  for (int m = 0; m < 18; m++) {
    int nq[256][4];
    int n2 = 0;
    for (int i = 0; i < n; i++) {
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
    curW[depth] = m;
    wCollect(rem - 1, depth + 1, n2, nq);
  }
}
// returns entry index
static int wGet(int rem, int n, int (*q)[4]) {
  int k[256];
  for (int i = 0; i < n; i++)
    k[i] = enc4(q[i][0], q[i][1], q[i][2], q[i][3]);
  qsort(k, n, 4, cmpInt);
  int m = 0;
  for (int i = 0; i < n; i++)
    if (!m || k[i] != k[m - 1])
      k[m++] = k[i];
  uint64_t h = rem * 1000003ULL;
  for (int i = 0; i < m; i++)
    h = h * 0x9E3779B97F4A7C15ULL + k[i];
  int b = (h >> 20) & (wHcap - 1);
  for (int e = wHead[b]; e >= 0; e = wNext[e])
    if (wE[e].rem == rem && wE[e].n == m && !memcmp(wE[e].keys, k, m * 4))
      return e;
  if (wEn == wEcap) {
    wEcap *= 2;
    wE = realloc(wE, wEcap * sizeof(WEntry));
    wNext = realloc(wNext, wEcap * 4);
  }
  WEntry *E = &wE[wEn];
  E->rem = rem;
  E->n = m;
  E->keys = malloc(m * 4);
  memcpy(E->keys, k, m * 4);
  E->woff = wWn;
  int qq[256][4];
  for (int i = 0; i < m; i++) {
    qq[i][0] = k[i] / 13824;
    qq[i][1] = k[i] / 576 % 24;
    qq[i][2] = k[i] / 24 % 24;
    qq[i][3] = k[i] % 24;
  }
  wCollect(rem, 0, m, qq);
  E->wn = (wWn - E->woff) / 8;
  wNext[wEn] = wHead[b];
  wHead[b] = wEn;
  return wEn++;
}
/* ---- graph ---- */
// ---- hash map Key->int ----
typedef struct {
  Key *k;
  int *v;
  size_t cap;
  size_t n;
} HMap;
static void hmInit(HMap *h, size_t cap) {
  h->cap = cap;
  h->n = 0;
  h->k = malloc(cap * 8);
  h->v = malloc(cap * 4);
  memset(h->v, 0xff, cap * 4);
}
static void hmFree(HMap *h) {
  free(h->k);
  free(h->v);
}
static inline size_t hh(Key k, size_t cap) {
  k ^= k >> 29;
  k *= 0xbf58476d1ce4e5b9ULL;
  k ^= k >> 32;
  return k & (cap - 1);
}
static int hmGet(HMap *h, Key k) {
  size_t i = hh(k, h->cap);
  while (h->v[i] != -1) {
    if (h->k[i] == k)
      return h->v[i];
    i = (i + 1) & (h->cap - 1);
  }
  return -1;
}
static int hmPut(HMap *h, Key k, int v) {
  size_t i = hh(k, h->cap);
  while (h->v[i] != -1) {
    if (h->k[i] == k)
      return h->v[i];
    i = (i + 1) & (h->cap - 1);
  }
  h->k[i] = k;
  h->v[i] = v;
  h->n++;
  return v;
}
// ---- graph ----
typedef struct {
  HMap map;
  int n;
  Key *key;
  int *layer;
  uint8_t *cost;
  int *eoff;
  int *edst;
  long ne;
  int N;
  int layerStart[61];
} Graph;
static int letterType(char L) { return L == 'H' ? TH : L == 'S' ? TSl : TMl; }
static int PERM4[24][4];
static void initPerm(void) {
  int n = 0;
  for (int a = 0; a < 4; a++)
    for (int b = 0; b < 4; b++)
      for (int c = 0; c < 4; c++)
        for (int d = 0; d < 4; d++) {
          if (a == b || a == c || a == d || b == c || b == d || c == d)
            continue;
          PERM4[n][0] = a;
          PERM4[n][1] = b;
          PERM4[n][2] = c;
          PERM4[n][3] = d;
          n++;
        }
}
// DFS state
static Key *gEnd;
static int gNend, gCapEnd;
static long gWords;
static int cmpKey(const void *a, const void *b) {
  Key x = *(const Key *)a, y = *(const Key *)b;
  return x < y ? -1 : x > y;
}
static int buildGraph(const Print *P, char L, int N, int dir, Graph *G) {
  int lt = letterType(L);
  G->N = N;
  // enumerate nodes
  int cap = 1 << 20;
  G->key = malloc(cap * 8);
  G->layer = malloc(cap * 4);
  G->n = 0;
  static Opt opts[60][256];
  int nopt[60];
  long est = 0;
  for (int v = 0; v < N; v++) {
    nopt[v] = optionsFor(P, lt, v / 10, v % 10, opts[v]);
    if (nopt[v] == 0 || nopt[v] > 64) {
      free(G->key);
      free(G->layer);
      return -1;
    }
    est += nopt[v] * 648L;
  }
  size_t hc = 1024;
  while (hc < (size_t)est * 2)
    hc <<= 1;
  HMap H;
  hmInit(&H, hc);
  for (int v = 0; v < N; v++) {
    G->layerStart[v] = G->n;
    for (int i = 0; i < nopt[v]; i++) {
      Opt *o = &opts[v][i];
      uint8_t r[8];
      int used[8] = {0}, posUsed[8] = {0};
      int tws = 0;
      for (int s = 0; s < 4; s++) {
        int c = o->c[s];
        r[c] = RT[c][o->j[s]][s];
        used[c] = 1;
        posUsed[FP[s]] = 1;
        tws += TW[c][r[c]];
      }
      int rc[4], rp[4], nc = 0, np = 0;
      for (int c = 0; c < 8; c++)
        if (!used[c])
          rc[nc++] = c;
      for (int p = 0; p < 8; p++)
        if (!posUsed[p])
          rp[np++] = p;
      for (int pm = 0; pm < 24; pm++)
        for (int ot = 0; ot < 81; ot++) {
          int o3[4] = {ot % 3, ot / 3 % 3, ot / 9 % 3, ot / 27};
          int t = tws;
          for (int k = 0; k < 4; k++) {
            int c = rc[k];
            r[c] = RPOS3[c][rp[PERM4[pm][k]]][o3[k]];
            t += TW[c][r[c]];
          }
          if (t % 3)
            continue;
          Key k = packS(r);
          if (hmGet(&H, k) >= 0)
            continue;
          if (G->n == cap) {
            cap *= 2;
            G->key = realloc(G->key, cap * 8);
            G->layer = realloc(G->layer, cap * 4);
          }
          hmPut(&H, k, G->n);
          G->key[G->n] = k;
          G->layer[G->n] = v;
          G->n++;
        }
    }
  }
  G->layerStart[N] = G->n;
  // edges
  G->cost = malloc(G->n);
  G->eoff = malloc((G->n + 1) * sizeof(int));
  long ecap = 1 << 22;
  G->edst = malloc(ecap * 4);
  G->ne = 0;
  gCapEnd = 1024;
  gEnd = malloc(gCapEnd * 8);
  wReset();
  for (int i = 0; i < G->n; i++) {
    G->eoff[i] = G->ne;
    int v = G->layer[i];
    int nv = (v + dir + N) % N;
    uint8_t r[8];
    unpackS(G->key[i], r);
    int best[256];
    int d = costTo(r, opts[nv], nopt[nv], best);
    G->cost[i] = d;
    int q[256][4], na = 0;
    for (int k = 0; k < nopt[nv]; k++)
      if (best[k] == d) {
        Opt *o = &opts[nv][k];
        for (int s = 0; s < 4; s++) {
          int c = o->c[s];
          q[na][s] = comp[r[c]][inv[RT[c][o->j[s]][s]]];
        }
        na++;
      }
    gNend = 0;
    {
      int e = wGet(d, na, q);
      for (int w = 0; w < wE[e].wn; w++) {
        const uint8_t *W = wWords + wE[e].woff + w * 8;
        uint8_t r2[8];
        memcpy(r2, r, 8);
        for (int t = 0; t < W[0]; t++)
          for (int c = 0; c < 8; c++)
            r2[c] = TR[c][W[1 + t]][r2[c]];
        if (gNend == gCapEnd) {
          gCapEnd *= 2;
          gEnd = realloc(gEnd, gCapEnd * 8);
        }
        gEnd[gNend++] = packS(r2);
        gWords++;
      }
    }

    qsort(gEnd, gNend, 8, cmpKey);
    for (int e = 0; e < gNend; e++) {
      if (e && gEnd[e] == gEnd[e - 1])
        continue;
      int t = hmGet(&H, gEnd[e]);
      if (t < 0) {
        fprintf(stderr, "end state not a node!\n");
        exit(1);
      }
      if (G->ne == ecap) {
        ecap *= 2;
        G->edst = realloc(G->edst, ecap * 4);
      }
      G->edst[G->ne++] = t;
    }
  }
  G->eoff[G->n] = G->ne;
  G->map = H;
  free(gEnd);
  return 0;
}
static void freeGraph(Graph *G) {
  hmFree(&G->map);
  free(G->key);
  free(G->layer);
  free(G->cost);
  free(G->eoff);
  free(G->edst);
}
/* ---- howard ---- */
// min mean cycle on node-weighted graph restricted to alive nodes
typedef struct {
  long A;
  long L;
  int *cyc;
  int clen;
  int maxc;
} MMC;
static int computeAlive(Graph *G, int cap, uint8_t *alive) {
  int n = G->n;
  for (int v = 0; v < n; v++)
    alive[v] = G->cost[v] <= cap;
  int changed = 1;
  while (changed) {
    changed = 0;
    for (int v = 0; v < n; v++)
      if (alive[v]) {
        int ok = 0;
        for (int e = G->eoff[v]; e < G->eoff[v + 1]; e++)
          if (alive[G->edst[e]]) {
            ok = 1;
            break;
          }
        if (!ok) {
          alive[v] = 0;
          changed = 1;
        }
      }
  }
  int cnt = 0;
  for (int v = 0; v < n; v++)
    cnt += alive[v];
  return cnt;
}
static int howard(Graph *G, uint8_t *alive, MMC *res) {
  int n = G->n;
  int *pi = malloc(n * 4);
  double *eta = malloc(n * 8), *x = malloc(n * 8);
  int *col = malloc(n * 4);
  int *stk = malloc(n * 4);
  for (int v = 0; v < n; v++) {
    pi[v] = -1;
    if (!alive[v])
      continue;
    int bc = 999;
    for (int e = G->eoff[v]; e < G->eoff[v + 1]; e++) {
      int u = G->edst[e];
      if (alive[u] && G->cost[u] < bc) {
        bc = G->cost[u];
        pi[v] = u;
      }
    }
  }
  int iter = 0;
  const double eps = 1e-9;
  while (1) {
    iter++;
    // evaluate
    for (int v = 0; v < n; v++)
      col[v] = 0; // 0 unvisited,1 on stack,2 done
    for (int s = 0; s < n; s++) {
      if (!alive[s] || col[s])
        continue;
      int sp = 0;
      int v = s;
      while (col[v] == 0) {
        col[v] = 1;
        stk[sp++] = v;
        v = pi[v];
      }
      if (col[v] == 1) { // new cycle starting at v
        double sum = 0;
        int len = 0;
        int u = v;
        do {
          sum += G->cost[u];
          len++;
          u = pi[u];
        } while (u != v);
        double m = sum / len;
        // x on cycle: x(v)=0, go along: x(u)=c(u)-m+x(pi(u)); set root then reverse
        // compute by walking backward is hard; walk forward accumulating
        // x(pi^k v) = x(v) - sum_{i<k}(c - m) ; choose x(v)=0
        double acc = 0;
        u = v;
        do {
          eta[u] = m;
          x[u] = acc;
          acc -= (G->cost[u] - m);
          u = pi[u];
          col[u] = 2;
        } while (u != v);
        col[v] = 2;
      }
      // unwind stack
      while (sp) {
        int w = stk[--sp];
        if (col[w] == 2)
          continue;
        eta[w] = eta[pi[w]];
        x[w] = G->cost[w] - eta[w] + x[pi[w]];
        col[w] = 2;
      }
    }
    // improve phase 1
    int ch = 0;
    for (int v = 0; v < n; v++) {
      if (!alive[v])
        continue;
      int bu = pi[v];
      double be = eta[bu];
      for (int e = G->eoff[v]; e < G->eoff[v + 1]; e++) {
        int u = G->edst[e];
        if (alive[u] && eta[u] < be - eps) {
          be = eta[u];
          bu = u;
        }
      }
      if (bu != pi[v] && be < eta[v] - eps) {
        pi[v] = bu;
        ch = 1;
      }
    }
    if (!ch) {
      for (int v = 0; v < n; v++) {
        if (!alive[v])
          continue;
        int bu = pi[v];
        double bx = G->cost[v] - eta[v] + x[bu];
        for (int e = G->eoff[v]; e < G->eoff[v + 1]; e++) {
          int u = G->edst[e];
          if (alive[u] && fabs(eta[u] - eta[v]) < eps) {
            double t = G->cost[v] - eta[v] + x[u];
            if (t < bx - eps) {
              bx = t;
              bu = u;
            }
          }
        }
        if (bu != pi[v] && bx < x[v] - eps) {
          pi[v] = bu;
          ch = 1;
        }
      }
    }
    if (!ch || iter > 500)
      break;
  }
  // best cycle
  double bm = 1e9;
  int bv = -1;
  for (int v = 0; v < n; v++)
    if (alive[v] && eta[v] < bm - eps) {
      bm = eta[v];
      bv = v;
    }
  // walk to cycle
  for (int v = 0; v < n; v++)
    col[v] = 0;
  int v = bv;
  while (!col[v]) {
    col[v] = 1;
    v = pi[v];
  }
  // v on cycle; rotate to start at a layer-0 node
  int len = 0;
  long sum = 0;
  int u = v;
  int start = -1;
  do {
    if (G->layer[u] == 0 && start < 0)
      start = u;
    len++;
    sum += G->cost[u];
    u = pi[u];
  } while (u != v);
  res->A = sum;
  res->L = len;
  res->cyc = malloc(len * 4);
  res->clen = len;
  u = start < 0 ? v : start;
  res->maxc = 0;
  for (int i = 0; i < len; i++) {
    res->cyc[i] = u;
    if (G->cost[u] > res->maxc)
      res->maxc = G->cost[u];
    u = pi[u];
  }
  free(pi);
  free(eta);
  free(x);
  free(col);
  free(stk);
  return iter;
}
// exact certificate: no cycle with mean < A/L among alive nodes. weights w=L*c-A. returns passes or -1
static long certify(Graph *G, uint8_t *alive, long A, long L, long *pot) {
  int n = G->n;
  for (int v = 0; v < n; v++)
    pot[v] = 0;
  for (int pass = 0; pass < 100000; pass++) {
    int ch = 0;
    for (int lay = G->N - 1; lay >= 0; lay--)
      for (int v = G->layerStart[lay]; v < G->layerStart[lay + 1]; v++) {
        if (!alive[v])
          continue;
        long w = L * G->cost[v] - A;
        for (int e = G->eoff[v]; e < G->eoff[v + 1]; e++) {
          int u = G->edst[e];
          if (!alive[u])
            continue;
          if (w + pot[u] < pot[v]) {
            pot[v] = w + pot[u];
            ch = 1;
          }
        }
      }
    if (!ch)
      return pass;
    // negative cycle guard: potentials bounded below by -(n)*max|w|
  }
  return -1;
}
/* ---- solve ---- */
// IDA* from state a (r[8]) to target t (r[8]) using two 4-corner pattern tables
static uint8_t PA[331776], PB[331776];
static int TSA[4][18][24], TSB[4][18][24];
static void buildPDB(const int *homes, int TT[4][18][24], uint8_t *Dt) {
  for (int s = 0; s < 4; s++)
    for (int m = 0; m < 18; m++)
      for (int q = 0; q < 24; q++) {
        int p = rotPos[q][homes[s]];
        TT[s][m][q] = POS[p][MOVAX[m]] == MOVL[m] ? comp[MOVR[m]][q] : q;
      }
  memset(Dt, 255, 331776);
  int *Q = malloc(sizeof(int) * 331776);
  int h = 0, t = 0;
  Q[t++] = 0;
  Dt[0] = 0;
  while (h < t) {
    int k = Q[h++];
    int a0 = k / 13824, a1 = k / 576 % 24, a2 = k / 24 % 24, a3 = k % 24;
    for (int m = 0; m < 18; m++) {
      int kk = enc4(TT[0][m][a0], TT[1][m][a1], TT[2][m][a2], TT[3][m][a3]);
      if (Dt[kk] == 255) {
        Dt[kk] = Dt[k] + 1;
        Q[t++] = kk;
      }
    }
  }
  free(Q);
}
static int solW[32];
static long solNodes;
static int ida(int qa[4], int qb[4], int g, int bound, int last) {
  int h1 = PA[enc4(qa[0], qa[1], qa[2], qa[3])], h2 = PB[enc4(qb[0], qb[1], qb[2], qb[3])];
  int h = h1 > h2 ? h1 : h2;
  if (g + h > bound)
    return 0;
  if (h == 0)
    return 1;
  solNodes++;
  for (int m = 0; m < 18; m++) {
    if (last >= 0 && m / 3 == last / 3)
      continue;
    if (last >= 0 && m / 3 == (last / 3 ^ 1) && m / 3 < last / 3)
      continue; // opposite faces commute: canonical order
    int na[4], nb[4];
    for (int s = 0; s < 4; s++) {
      na[s] = TSA[s][m][qa[s]];
      nb[s] = TSB[s][m][qb[s]];
    }
    solW[g] = m;
    if (ida(na, nb, g + 1, bound, m))
      return 1;
  }
  return 0;
}
// returns length, word in solW
static int solveTo(const uint8_t *a, const uint8_t *t) {
  int hA[4], hB[4];
  for (int c = 0; c < 4; c++) {
    hA[c] = rotPos[t[c]][c];
    hB[c] = rotPos[t[c + 4]][c + 4];
  }
  buildPDB(hA, TSA, PA);
  buildPDB(hB, TSB, PB);
  int qa[4], qb[4];
  for (int c = 0; c < 4; c++) {
    qa[c] = comp[a[c]][inv[t[c]]];
    qb[c] = comp[a[c + 4]][inv[t[c + 4]]];
  }
  for (int b = 0; b < 30; b++) {
    solNodes = 0;
    if (ida(qa, qb, 0, b, -1))
      return b;
  }
  return -1;
}
/* ---- greedy ---- */
// replicate generate.mjs greedy policy with one-step lookahead
static int gdBest(const uint8_t *r, const Opt *o, int no, int *bi) {
  int d = 255, b = -1;
  for (int i = 0; i < no; i++) {
    int q[4];
    for (int s = 0; s < 4; s++) {
      int c = o[i].c[s];
      q[s] = comp[r[c]][inv[RT[c][o[i].j[s]][s]]];
    }
    int v = D4[enc4(q[0], q[1], q[2], q[3])];
    if (v < d) {
      d = v;
      b = i;
    }
  }
  if (bi)
    *bi = b;
  return d;
}
static int greedyMove(uint8_t *r, const Opt *o, int no, const Opt *nx, int nnx, int policy, int *word) {
  int bi;
  int d = gdBest(r, o, no, &bi);
  int q[4];
  for (int s = 0; s < 4; s++) {
    int c = o[bi].c[s];
    q[s] = comp[r[c]][inv[RT[c][o[bi].j[s]][s]]];
  }
  int len = 0;
  while (d) {
    int m = -1, look = 256;
    for (int j = 0; j < 18; j++) {
      int cand = (j + policy) % 18;
      int a = TS[0][cand][q[0]], b = TS[1][cand][q[1]], c = TS[2][cand][q[2]], e = TS[3][cand][q[3]];
      if (D4[enc4(a, b, c, e)] != d - 1)
        continue;
      int v = 0;
      if (nx) {
        uint8_t r2[8];
        for (int k = 0; k < 8; k++)
          r2[k] = TR[k][cand][r[k]];
        v = gdBest(r2, nx, nnx, 0);
      }
      if (v < look) {
        m = cand;
        look = v;
      }
    }
    word[len++] = m;
    for (int k = 0; k < 8; k++)
      r[k] = TR[k][m][r[k]];
    for (int s = 0; s < 4; s++)
      q[s] = TS[s][m][q[s]];
    d--;
  }
  return len;
}
/* ---- univ ---- */
// Universal arbitrary-source bound: max over legal poses of min over options (<=7 always).
static int U7[3144][4];
static int nU7 = 0;
static void initU7(void) {
  if (nU7)
    return;
  for (int k = 0; k < 331776; k++)
    if (D4[k] == 7) {
      U7[nU7][0] = k / 13824;
      U7[nU7][1] = k / 576 % 24;
      U7[nU7][2] = k / 24 % 24;
      U7[nU7][3] = k % 24;
      nU7++;
    }
}
// returns 7 if some legal pose needs 7 for this display, else 6 (bound proven by exhaustion of all dist-7
// configs of option 0)
static int universalDisplay(const Print *P, int lt, int v, long *checked) {
  initU7();
  static Opt o[256];
  int no = optionsFor(P, lt, v / 10, v % 10, o);
  if (no <= 0 || no > 64)
    return 99;
  int inK[8] = {0};
  for (int i = 0; i < no; i++)
    for (int s = 0; s < 4; s++)
      inK[o[i].c[s]] = 1;
  int nk = 0;
  for (int c = 0; c < 8; c++)
    nk += inK[c];
  const Opt *a = &o[0];
  for (int u = 0; u < nU7; u++) {
    uint8_t r[8];
    int isA[8] = {0};
    int pu[8] = {0};
    for (int s = 0; s < 4; s++) {
      int c = a->c[s];
      r[c] = comp[U7[u][s]][RT[c][a->j[s]][s]];
      isA[c] = 1;
      pu[rotPos[r[c]][c]] = 1;
    }
    int ex[4], ne = 0;
    for (int c = 0; c < 8; c++)
      if (inK[c] && !isA[c])
        ex[ne++] = c;
    int fp[4], nf = 0;
    for (int p = 0; p < 8; p++)
      if (!pu[p])
        fp[nf++] = p;
    // enumerate injective placements of ex corners into fp positions with 3 orientations
    int idx[4] = {0};
    int total = 1;
    for (int i = 0; i < ne; i++)
      total *= nf * 3; // over-enumerate then filter injective
    for (int t = 0; t < total; t++) {
      int x = t;
      int ok = 1;
      int posu[8] = {0};
      for (int i = 0; i < ne; i++) {
        int pi = x % nf;
        x /= nf;
        int oi = x % 3;
        x /= 3;
        if (posu[pi]) {
          ok = 0;
          break;
        }
        posu[pi] = 1;
        r[ex[i]] = RPOS3[ex[i]][fp[pi]][oi];
      }
      if (!ok)
        continue;
      if (nk == 8) {
        int tw = 0;
        for (int c = 0; c < 8; c++)
          tw += TW[c][r[c]];
        if (tw % 3)
          continue;
      }
      (*checked)++;
      int d = costTo(r, o, no, 0);
      if (d >= 7)
        return 7;
    }
    (void)idx;
  }
  return 6;
}
static int universalBound(const Print *P, int *worstL, int *worstV) {
  int m = 0;
  long ch = 0;
  for (int lt = TH; lt <= TMl; lt++)
    for (int v = 0; v < 60; v++) {
      int b = universalDisplay(P, lt, v, &ch);
      if (b > m) {
        m = b;
        *worstL = lt;
        *worstV = v;
      }
      if (m >= 7)
        return m;
    }
  return m;
}
/* ---- canon ---- */
// Relabel a print by a legal assembly state to minimize changed stickers versus a reference print.
static void relabel(const Print *P, const int *perm, const int *ori, Print *out) {
  for (int c = 0; c < 8; c++) {
    int h = perm[c];
    int r = RPOS3[c][h][ori[c]];
    for (int j = 0; j < 3; j++) {
      int n[3] = {0, 0, 0};
      n[j] = POS[c][j];
      int o[3];
      mv(&R[r], n, o);
      int jj = o[0] ? 0 : o[1] ? 1 : 2;
      out->ty[h][jj] = P->ty[c][j];
    }
  }
}
static int canonicalize(const Print *P, const Print *ref, Print *best) {
  int bestCost = 99, blankCorner = 0;
  for (int c = 0; c < 8; c++)
    if (P->ty[c][0] == TB && P->ty[c][1] == TB && P->ty[c][2] == TB)
      blankCorner = 1;
  // iterate permutations lexicographically
  int a[8];
  for (int i = 0; i < 8; i++)
    a[i] = i;
  while (1) { // DP over corners with twist sum
    int cost[8][3];
    for (int c = 0; c < 8; c++)
      for (int o = 0; o < 3; o++) {
        int r = RPOS3[c][a[c]][o];
        int k = 0;
        for (int j = 0; j < 3; j++) {
          int n[3] = {0, 0, 0};
          n[j] = POS[c][j];
          int v[3];
          mv(&R[r], n, v);
          int jj = v[0] ? 0 : v[1] ? 1 : 2;
          if (P->ty[c][j] != ref->ty[a[c]][jj])
            k++;
        }
        cost[c][o] = k;
      }
    int dp[9][3];
    int ch[9][3];
    for (int t = 0; t < 3; t++)
      dp[0][t] = t ? 99 : 0;
    for (int c = 0; c < 8; c++)
      for (int t = 0; t < 3; t++) {
        dp[c + 1][t] = 99;
        for (int o = 0; o < 3; o++) {
          int tw = TW[c][RPOS3[c][a[c]][o]];
          int pt = ((t - tw) % 3 + 3) % 3;
          if (dp[c][pt] + cost[c][o] < dp[c + 1][t]) {
            dp[c + 1][t] = dp[c][pt] + cost[c][o];
            ch[c + 1][t] = o;
          }
        }
      }
    // A fully blank corner looks identical in all three twists, so its twist is a
    // symmetry of the print and every final twist class is the same physical print.
    int tEnd = 0;
    for (int t = 1; t < 3; t++)
      if (blankCorner && dp[8][t] < dp[8][tEnd])
        tEnd = t;
    if (dp[8][tEnd] < bestCost) {
      bestCost = dp[8][tEnd];
      int ori[8];
      int t = tEnd;
      for (int c = 7; c >= 0; c--) {
        int o = ch[c + 1][t];
        ori[c] = o;
        int tw = TW[c][RPOS3[c][a[c]][o]];
        t = ((t - tw) % 3 + 3) % 3;
      }
      relabel(P, a, ori, best);
    }
    int i = 6;
    while (i >= 0 && a[i] > a[i + 1])
      i--;
    if (i < 0)
      break;
    int j = 7;
    while (a[j] < a[i])
      j--;
    int t = a[i];
    a[i] = a[j];
    a[j] = t;
    for (int l = i + 1, r = 7; l < r; l++, r--) {
      t = a[l];
      a[l] = a[r];
      a[r] = t;
    }
  }
  return bestCost;
}
