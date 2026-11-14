#!/usr/bin/env bash
# usage: run-all.sh <outDir>   Runs both variants for all four prints; one heavy process at a time.
set -u
out=${1:?outDir}
J=${JULIA:-julia}
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$out"
for id in de-a de-a-unpadded en-3-zero en-3-unpadded; do
  for v in app own; do
    timeout 900 nice -n 10 "$J" "$here/run_steps.jl" "$id" "$v" "$out/front-$id-$v.tsv" 100 120 12 2> "$out/front-$id-$v.log"
    echo "$id $v exit $?"
  done
done
