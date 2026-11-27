# Unresolved target mechanism: finite subnormal values

**Ticket 13 is not fully satisfied.** The emitter/CLI/example and local structural
checks exist, but full subset-v1 finite-double conformance cannot yet be claimed.
This is an unresolved mechanism/policy question, not an approved subset limit.
No valid finite input has been silently rejected to obtain green tests.

## Concrete accepted counterexample

```declare
App [ width = 400, height = 160, gain: number = 1,
 gainControl: View [
  width = { parent.width * 1e-310 === 0 ? 1 : 2 }, height = 24
 ]
]
```

Use the normal v1 binding and stereo sample DSP. The public `buildEffect`
interface accepts this source. At actual viewport width 400, finite-double
arithmetic gives a nonzero product (approximately `4e-308`) and control width
**2**. The current emitted expression includes a temporary assignment of
`1e-310`. If EEL2 filters that finite subnormal literal to zero, the comparison
instead chooses width **1**. Exact `===` does not recover a value already lost.
Runtime-generated subnormals present the related problem; this is not solved
only by rewriting tiny literals.

This is a primary-source-derived counterexample, **not an executed EEL2 or
REAPER failure**. The proprietary host's precise build options/platform FPU
behavior have not been measured. A host-only success claim would be fabricated.

## Official source evidence

The official WDL SDK at
[`6a67ec5788ca6ee252b19cd8071796db49d763a7`](https://github.com/justinfrankel/WDL/tree/6a67ec5788ca6ee252b19cd8071796db49d763a7)
contains:

- [`nseel-compiler.c`, line 2745](https://github.com/justinfrankel/WDL/blob/6a67ec5788ca6ee252b19cd8071796db49d763a7/WDL/eel2/nseel-compiler.c#L2745):
  stored direct constants pass through `denormal_filter_double2`.
- [`denormal.h`, lines 102–112](https://github.com/justinfrankel/WDL/blob/6a67ec5788ca6ee252b19cd8071796db49d763a7/WDL/denormal.h#L102-L112):
  the standard filtering path maps subnormal doubles to zero. Build-time FTZ /
  do-not-filter alternatives exist; their availability/behavior in the selected
  REAPER targets is not established by these sources.
- [`asm-nseel-x64-sse.asm`, lines 193–230](https://github.com/justinfrankel/WDL/blob/6a67ec5788ca6ee252b19cd8071796db49d763a7/WDL/eel2/asm-nseel-x64-sse.asm#L193-L230):
  checked arithmetic assignments can filter exceptional/tiny results. Thus an
  overflow guard only *after* assignment can see zero instead of infinity.

This is not merely a new SDK behavior: the compiler constant-filter path is
also present at line 2726 of the
[2023 SDK revision `a7d6a232bcc496ba288463bdcf8b095212168617`](https://github.com/justinfrankel/WDL/blob/a7d6a232bcc496ba288463bdcf8b095212168617/WDL/eel2/nseel-compiler.c#L2726),
with the same default filter in its `denormal.h`.

The emitter now checks arithmetic results in comparison context **before**
assigning temporaries, positions and drag arithmetic, preserving overflow
invalidity rather than allowing assignment filtering to turn it into valid zero.
That fixes the overflow-detection mechanism; it does not establish preservation
of finite subnormal operands/results.

[`ext_nodenorm`](https://www.reaper.fm/sdk/js/vars.php#ext_nodenorm)
only documents disabling anti-denormal *input noise*, not compiler constant
filtering or a portable gradual-underflow mode. The SDK's internal optimization
flags/intrinsics are not a verified documented solution for literal filtering,
runtime arithmetic, all target architectures and REAPER 7.02+. None has been
emitted based on an unsupported guess.

## What must resolve this

Either establish and validate a supported target mechanism preserving the
agreed finite values/comparisons, or explicitly decide a revised numeric domain
and underflow policy in the canonical contract. Silently excluding subnormals,
flushing them by policy, weakening exact comparisons or introducing an unapproved
software numeric runtime is not an implementation fix.

Actual REAPER experiments should include the counterexample and runtime
underflow/overflow/division/exact-comparison cases, with exact host/build/OS/CPU
and output recorded. Ordinary gain 0/1/2 renders within `1e-6` do not answer this
question: tiny values can change a branch with visible geometry consequences.
Until resolved, leave ticket 13 open and do not describe the whole proof as
complete or merely awaiting interrupted-gesture host evidence.
