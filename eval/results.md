# Baseline vs. hybrid eval (Phase 4)

Model: `gpt-4o-mini` · Temperature: 0.7 · Date: 2026-09-26 · n per persona: 3

**Deviation from spec:** the hybrid path reuses the cached meal pool (`generate.load_cached("data/meals.json")`) instead of calling fresh `generate_meals` per run. Fresh generation is a second, uncached LLM call per run (9 more calls, more cost and wall time) that mostly reproduces the same pool this cache already holds; reusing it keeps the eval cheap and fast while `solve()` is still exercised fresh every run. State this if the numbers are quoted.

## Summary

| Method | runs | % over budget | % ineligible charged to SNAP | % all slots covered | mean sufficiency violations | % all nutrition targets met | mean time (ms) |
|---|---|---|---|---|---|---|---|
| Baseline (plain LLM) | 9 | 0% | 0% | 100% | 3.9 | 0% | 2940 |
| Hybrid (generate + solve) | 9 | 0% | 0% | 100% | 0.0 | 33% | 119 |

Parse/solve failures: baseline 0/9, hybrid 0/9.

Notes: percentages are over all attempted runs (a failed run counts as not-over-budget, not-ineligible, slots-not-covered, targets-not-met, since its true value is unknown). Mean sufficiency violations is averaged over successful runs only. Ingredient-sufficiency counts an ingredient as satisfied if packages bought (plus one full package for staples, matching solve.py's assume_staples default) cover the grams the plan's meals need.

## Per persona

| Persona | Method | runs | % over budget | % ineligible charged to SNAP | % all slots covered | mean sufficiency violations | % all nutrition targets met | mean time (ms) |
|---|---|---|---|---|---|---|---|---|
| P1 typical | Baseline | 3 | 0% | 0% | 100% | 5.0 | 0% | 4470 |
| P1 typical | Hybrid | 3 | 0% | 0% | 100% | 0.0 | 0% | 173 |
| P2 microwave-only, tight | Baseline | 3 | 0% | 0% | 100% | 0.7 | 0% | 1906 |
| P2 microwave-only, tight | Hybrid | 3 | 0% | 0% | 100% | 0.0 | 100% | 57 |
| P3 vegetarian family | Baseline | 3 | 0% | 0% | 100% | 6.0 | 0% | 2444 |
| P3 vegetarian family | Hybrid | 3 | 0% | 0% | 100% | 0.0 | 0% | 128 |

## Raw per-run rows

| Method | Persona | Run | Basket | EBT | Cash | Over budget | Ineligible on SNAP | Slots covered | Suff. violations | Targets met | Error |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Baseline | P1 typical | 0 | $26.59 | $26.59 | $0.00 | False | False | True | 0 | False |  |
| Baseline | P1 typical | 1 | $38.08 | $38.08 | $0.00 | False | False | True | 15 | False |  |
| Baseline | P1 typical | 2 | $27.78 | $27.78 | $0.00 | False | False | True | 0 | False |  |
| Baseline | P2 microwave-only, tight | 0 | $10.31 | $10.31 | $0.00 | False | False | True | 0 | False |  |
| Baseline | P2 microwave-only, tight | 1 | $14.24 | $14.24 | $0.00 | False | False | True | 0 | False |  |
| Baseline | P2 microwave-only, tight | 2 | $20.31 | $20.31 | $0.00 | False | False | True | 2 | False |  |
| Baseline | P3 vegetarian family | 0 | $18.38 | $18.38 | $0.00 | False | False | True | 0 | False |  |
| Baseline | P3 vegetarian family | 1 | $26.94 | $26.94 | $0.00 | False | False | True | 9 | False |  |
| Baseline | P3 vegetarian family | 2 | $29.42 | $29.42 | $0.00 | False | False | True | 9 | False |  |
| Hybrid | P1 typical | 0 | $55.03 | $55.03 | $0.00 | False | False | True | 0 | False |  |
| Hybrid | P1 typical | 1 | $55.03 | $55.03 | $0.00 | False | False | True | 0 | False |  |
| Hybrid | P1 typical | 2 | $55.03 | $55.03 | $0.00 | False | False | True | 0 | False |  |
| Hybrid | P2 microwave-only, tight | 0 | $37.74 | $37.74 | $0.00 | False | False | True | 0 | True |  |
| Hybrid | P2 microwave-only, tight | 1 | $37.74 | $37.74 | $0.00 | False | False | True | 0 | True |  |
| Hybrid | P2 microwave-only, tight | 2 | $37.74 | $37.74 | $0.00 | False | False | True | 0 | True |  |
| Hybrid | P3 vegetarian family | 0 | $92.20 | $92.20 | $0.00 | False | False | True | 0 | False |  |
| Hybrid | P3 vegetarian family | 1 | $92.20 | $92.20 | $0.00 | False | False | True | 0 | False |  |
| Hybrid | P3 vegetarian family | 2 | $92.20 | $92.20 | $0.00 | False | False | True | 0 | False |  |

