# Resolved numeric policy blocker: native EEL2 UI underflow

The human's [explicit numeric amendment](https://github.com/gmcnicol/DeclareFX/issues/6#issuecomment-7219873850)
resolves the previous finite-double-preservation policy blocker. UI arithmetic
uses native EEL2 behavior: tiny finite literals, stored values and runtime
intermediates may flush to zero, including tiny normals affected by a backend.
There is no universal promised cutoff, gradual-underflow switch, Node parity or
cross-host tiny-branch guarantee. Exact comparisons/change detection operate on
values actually represented by EEL2; tiny-dependent branches are not portable
layout decisions.

The fix uses shared deterministic plain-decimal formatting for all generated
executable numbers, including source constants, slot/default initializers, slider
defaults, viewport sizes and finite maximum guards. Author DSP is preserved:
scientific numeric tokens in executable DSP get a source diagnostic rather than
rewriting; comments, strings and identifiers are excluded. Non-finite inputs,
overflow and division-by-zero safety remain guarded, including denominators that
underflow to zero. Lazy evaluation, retained invalid geometry and safe gain remain.

Compile-time validation rejects ordinary fractional constant failures while
conservatively deferring tiny values/intermediates and uncertain lazy branches
to guarded runtime. The deliberately coarse [analysis domain](compiler.md) and
zero-quotient underflow handling do not claim a host cutoff or preservation rule.
No blanket tiny-literal rejection, software floats, global rounding/flushing or
forced author-DSP flushing is added.
Public compiler/build/CLI regressions are structural/model evidence only.
[Initial three-platform CI passed](proof-evidence.md) at `8b89ec6`. Independent
Standards/Spec review found one fractional-proof defect, now fixed; the new fixed
revision still needs actual matrix revalidation. Real REAPER numeric/audio/UI
and performance evidence remains entirely UNRUN under [handoff #15](https://github.com/gmcnicol/DeclareFX/issues/15).

## Historical counterexample to the superseded preservation requirement

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
**2**. Before the decimal-emission fix, the emitted expression included a
temporary assignment of `1e-310`; it now emits the expanded plain decimal. If
EEL2 filters that finite subnormal literal to zero, the comparison
instead chooses width **1**. Exact `===` does not recover a value already lost.
Runtime-generated subnormals present the related problem; this is not solved
only by rewriting tiny literals.

This is a primary-source-derived counterexample, **not an executed EEL2 or
REAPER failure**. The proprietary host's precise build options/platform FPU
behavior have not been measured. A host-only success claim would be fabricated.

## Historical official source/header evidence

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
of finite subnormal operands/results, which the amendment no longer requires.

[`ext_nodenorm`](https://www.reaper.fm/sdk/js/vars.php#ext_nodenorm)
only documents disabling anti-denormal *input noise*, not compiler constant
filtering or a portable gradual-underflow mode. The SDK's internal optimization
flags/intrinsics are not a verified documented solution for literal filtering,
runtime arithmetic, all target architectures and REAPER 7.02+. None has been
emitted based on an unsupported guess.

## Remaining evidence gates

The canonical amendment explicitly revises the earlier preservation requirement;
no new target mechanism is claimed. Preserve the evidence above as historical
context, not a current policy blocker or an executed host failure.

Actual REAPER experiments should include the counterexample and runtime
underflow/overflow/division/exact-comparison cases, with exact host/build/OS/CPU
and output recorded. Ordinary gain 0/1/2 renders within `1e-6` do not measure
underflow behavior: tiny values can change branches with visible geometry
consequences. No actual EEL2/REAPER execution or audio/UI validation is claimed.
Track the [actual compiler CI/review checkpoint and pending fix revalidation](proof-evidence.md)
separately; do not close real-host gates on the strength of compiler tests.
