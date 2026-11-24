# Prior JSFX performance fixes: constraints for DeclareFX

Research for [DeclareFX #9](https://github.com/gmcnicol/DeclareFX/issues/9), informing the still-human-owned [parameter/DSP contract #3](https://github.com/gmcnicol/DeclareFX/issues/3) and [Wayfinder map](https://github.com/gmcnicol/DeclareFX/issues/1). This note proposes constraints and tests, not an accepted parameter-ownership policy.

## Bottom line

The history does **not** say simply “copy sliders once per block.” The strongest first-party regression account concerns **host UI churn and graphics presentation**, followed by an **audio/graphics scratch-state race**. There is also genuine caching of repeated musical-policy derivation. Preserve those lessons before finalizing the block-rate proposal:

- Separate UI painting, live interaction, host publication, and audio consumption; a snapshot of raw host sliders alone would miss the historical live-drag path.
- Do not turn every pointer frame into backing-slider writes, host-panel notifications, layout recomputation, or resource allocation.
- Isolate generated UI scratch, hand-written DSP scratch, persistent audio state, and memory ranges. A block snapshot does not prevent scratch collisions elsewhere.
- Cache derivations with explicit dependencies; keep smoothing in audio. Block-boundary sampling is neither smoothing nor proof of sample-accurate automation or a coherent cross-thread transaction.
- Host automation and audio must work without an open editor. Release-only host publication, automation recording, concurrent edits and editor closure still require a human contract and REAPER experiments.

Evidence below distinguishes **historical report**, **source/diff fact**, **inference/proposal**, and **unknown**. No CPU percentages, timing speedups, or new REAPER success claims were recovered or invented.

## Scope and reproducibility

Read #9, parent map #1, #3 and the resolution of runtime research #7. Cloned `https://github.com/gmcnicol/jsfx.git` into `/tmp/declarefx-prior-jsfx`, outside this deliverable tree. Inspected main at **`f8eab4773b45e701905d536b61a96e2dbdd2c30c`**, full fetched commit subjects, relevant diffs, current source and available remote branch history (including `codex/ui-refactor`). Codegraph `codegraph_explore` was called first with absolute `projectPath=/tmp/declarefx-prior-jsfx`; it returned no index. Used direct source/history instead; did not install, index or reconfigure it.

Inspected the repository's all-state GitHub issue/PR inventory (issues through #26, one PR #1), relevant bodies and comments, and PR #1 reviews/comments. This is a bounded investigation of fetched/publicly accessible evidence, not a claim about deleted refs, private chat, unpublished recordings or every line of every plugin. The UI-refactor branch has parallel commit histories; citations below use mainline commits where available rather than counting duplicate changes as separate fixes.

Reproduce the central inspection with:

```sh
git clone https://github.com/gmcnicol/jsfx.git /tmp/prior-jsfx-review
git -C /tmp/prior-jsfx-review checkout f8eab4773b45e701905d536b61a96e2dbdd2c30c
git -C /tmp/prior-jsfx-review show 0fb3793 aa4c0bb -- Docs/JSFX_GFX_NOTES.md
git -C /tmp/prior-jsfx-review show 9d05ef6 e12a135 746d7b2 b946c61 -- Effects/UndertowWerk_v1.jsfx
python3 /tmp/prior-jsfx-review/scripts/test_pulsewerk_transport.py
```

The last command **ran successfully in this investigation**, printing `PulseWerk transport regression checks passed.` It is a Python model/source regression check, not execution of EEL2 in REAPER and not a performance benchmark. [Pinned test source](https://github.com/gmcnicol/jsfx/blob/f8eab4773b45e701905d536b61a96e2dbdd2c30c/scripts/test_pulsewerk_transport.py).

## Recovered fixes and their reasons

### 1. ParallelTap: host-panel churn and independently disappearing UI regions

**Historical report:** the first GFX notes explicitly identify two bad patterns: writing tap-level sliders every graphics frame while dragging, and splitting background/header/ADSR/taps into separate images with multiple visible blits. The notes say a screen recording showed tap regions disappearing independently. Their remedy was live interaction state with backing-slider commit on click/release, one persistent cache image, bounded dirty-region painting within it and one final visible blit. Host-slider/panel changes were treated as expensive host UI operations, not paint-loop work. Layout was to be recomputed only on invalidation, geometry or scale change. [Original findings, `0fb3793967d3b7e566d90ae706f6758acb228f7f`](https://github.com/gmcnicol/jsfx/commit/0fb3793967d3b7e566d90ae706f6758acb228f7f).

**Source facts:** ParallelTap entered the repository already containing the cache/live-state design in [`224b455844a6dae349e35b31d3759869f860921e`](https://github.com/gmcnicol/jsfx/commit/224b455844a6dae349e35b31d3759869f860921e). Current `commit_tap_slider_state()` writes backing values; `sync_tap_slider_state()` avoids overwriting actively dragged fields; `@gfx` ends drags before committing, checks layout invalidation, repaints flagged sections to `IMG_CACHE`, then presents once. See [state/commit helpers, lines 623–680](https://github.com/gmcnicol/jsfx/blob/f8eab4773b45e701905d536b61a96e2dbdd2c30c/Effects/ParallelTap_v1.jsfx#L623-L680) and [graphics loop, lines 1600–1730](https://github.com/gmcnicol/jsfx/blob/f8eab4773b45e701905d536b61a96e2dbdd2c30c/Effects/ParallelTap_v1.jsfx#L1600-L1730).

**Additional recorded fix:** later notes require resetting presentation color/alpha before the final blit, otherwise the entire UI can dim/flicker by inheriting the last offscreen draw alpha. The same commit adds that reset to ParallelTap. [`aa4c0bb6d1f2168eeda312f5cf18b90c7ae8ca12`](https://github.com/gmcnicol/jsfx/commit/aa4c0bb6d1f2168eeda312f5cf18b90c7ae8ca12).

**Limits:** the cited recording and a pre-fix ParallelTap implementation were not recovered as attached artifacts. The first committed implementation already has the central remedy; this is a first-party historical account corroborated by fixed source, not a reconstructed A/B benchmark. No redraw time, host notification count or CPU delta is reported. One cache/one blit is a proven repository pattern/report, not a universal Cockos requirement.

**DeclareFX inference:** block-rate audio snapshots cannot fix graphics invalidation, inherited alpha, multiple visible blits, or host-panel churn. Generated reactive/layout machinery needs its own dependency/invalidation and publication boundaries. Preserve responsive *audible* live gain during a drag rather than waiting until host commit.

### 2. OvumTone: graphics scratch corrupted per-sample audio

**Historical report:** the expanded notes explicitly attribute one-sample crackles/low-frequency thumps to `@gfx` and `@sample` sharing generic global scratch variables. The stable fix moved the oscillator loop into `process_audio_sample()` with `local(...)` scratch and reduced `@sample` to that call. [Recorded cause and remedy](https://github.com/gmcnicol/jsfx/blob/aa4c0bb6d1f2168eeda312f5cf18b90c7ae8ca12/Docs/JSFX_GFX_NOTES.md#L87-L101).

**Source facts:** current [OvumTone audio function, lines 1123–1196](https://github.com/gmcnicol/jsfx/blob/f8eab4773b45e701905d536b61a96e2dbdd2c30c/Effects/OvumTone_v1.jsfx#L1123-L1196) declares audio scratch locally, reads target arrays, smooths frequency/cutoff/wave/trim/pan, handles disabled voices, and writes bounded scope history. [`@sample`](https://github.com/gmcnicol/jsfx/blob/f8eab4773b45e701905d536b61a96e2dbdd2c30c/Effects/OvumTone_v1.jsfx#L1236-L1255) calls the function. Source also guards sample-rate-dependent coefficient refresh. This supports isolation and explicit dependency handling, not the claim that all derivation was removed from audio.

**Limits:** this implementation and the explanatory notes were introduced together; no isolated before/after race reproducer or quantitative crackle measurement was found. Locals prevent accidental scratch sharing, but do not make intentional shared parameter arrays transactionally coherent.

**DeclareFX inference:** generated symbol names and memory ownership must prevent collisions with hand-written DSP, not merely use different section labels. Keep audio-owned smoothing/filter/delay state out of UI scratch. Do not “optimize” by moving nontrivial DSP expressions into shared graphics globals. A new block-rate copy must itself have an explicit producer/consumer protocol.

### 3. Undertow: repeated policy derivation became planned cached lookups

**Diff facts:** a four-commit sequence adds per-bar false-peak-release and afterglow-entry arrays, separates computation from access, and reuses flags in runtime role generators:

- [`9d05ef68bc2c27662c4e888c2304af6e76f74401`](https://github.com/gmcnicol/jsfx/commit/9d05ef68bc2c27662c4e888c2304af6e76f74401): cache scaffolding and memory-layout changes. This also changes musical cooldown behavior; it is not a pure performance-only patch.
- [`e12a135ec5679483380f4e1eb3b1f150a136f751`](https://github.com/gmcnicol/jsfx/commit/e12a135ec5679483380f4e1eb3b1f150a136f751): public helpers become array reads; `compute_*` functions populate caches in `plan_form()`. Release flags are populated before dependent plan decisions; afterglow-entry flags follow class planning.
- [`746d7b2736a7772243f9be4850b123775d6b55b2`](https://github.com/gmcnicol/jsfx/commit/746d7b2736a7772243f9be4850b123775d6b55b2): role generators reuse local `clock_active_i`, release and halftime state. This also adds release gating, so whole-patch output equivalence must not be assumed.
- [`b946c613462cc7488bab74081c5bad301d0498ac`](https://github.com/gmcnicol/jsfx/commit/b946c613462cc7488bab74081c5bad301d0498ac): deduplicates cooldown and clock predicates into named helpers.

Current [planning trigger](https://github.com/gmcnicol/jsfx/blob/f8eab4773b45e701905d536b61a96e2dbdd2c30c/Effects/UndertowWerk_v1.jsfx#L2180-L2248) checks dirty/dependency state in `@block`, rather than rebuilding unconditionally for each event. The earlier computed release helper scanned false-peak spans via `is_false_peak_bar()`; cached reads avoid repeating that work. **Inference:** reduced repeated work is evident structurally; no measured speedup or identified CPU-overrun incident accompanies these diffs. This is MIDI/runtime policy planning, not a per-sample stereo gain benchmark.

**DeclareFX inference:** distinguish “observe parameter values per block” from “recompute every derived expression per block.” Invalidate derived gains/coefficients only when their dependencies (including sample rate where relevant) change. Preserve dependency order and bounds when laying out caches. Do not inherit Undertow's clamped indexing as a desired language semantic without a separate decision.

### 4. Smaller and adjacent history: do not inflate it into performance evidence

- **CC interpolation:** [`08464fa9c2a8f266b5a20be1f59c9c50fdff83ba`](https://github.com/gmcnicol/jsfx/commit/08464fa9c2a8f266b5a20be1f59c9c50fdff83ba) contains the explicit user request to remove needless arithmetic, changing `(cc - 0)/(127 - 0)` into `cc/127`. [`9339d39515963f246705a7d4c2f1d16387fd3637`](https://github.com/gmcnicol/jsfx/commit/9339d39515963f246705a7d4c2f1d16387fd3637) stores slider values in `@slider`. These are actual edits, not evidence of a measurable JIT improvement or endorsement of a block snapshot architecture.
- **Life Grain smoothing/state:** [`acbed2383fd0f6bc2d17f027a4073e362dae134f`](https://github.com/gmcnicol/jsfx/commit/acbed2383fd0f6bc2d17f027a4073e362dae134f) adds local audio processing, control smoothing, explicit buffer/safety reset, and checks buffer duration/sample-rate changes before resizing state. It still computes some coefficients per sample; do not describe it as wholesale coefficient hoisting. Later [`6af35c26bc5d2b3ece298eeaf74568b18a35e6de`](https://github.com/gmcnicol/jsfx/commit/6af35c26bc5d2b3ece298eeaf74568b18a35e6de) adds zero-crossing/loop crossfade and voice-allocation changes. Voice allocation here selects a fixed pool slot, not evidence of a heap allocator bottleneck.
- **BloomWerk transition safety:** [`4d01bdcd2840ae955cb8a84e440bf18a37f611eb`](https://github.com/gmcnicol/jsfx/commit/4d01bdcd2840ae955cb8a84e440bf18a37f611eb) changes loop-boundary selection, avoids stealing active grains in `alloc_grain()`, stages provisional/full captures and bounds retry cadence. It concerns audible transitions and lifecycle, not a reported CPU result. Do not transplant granular machinery into the one-gain proof.
- **PulseWerk boundary regression:** [`bda7eb10349d122c3d80b2cd36b485e56fa22250`](https://github.com/gmcnicol/jsfx/commit/bda7eb10349d122c3d80b2cd36b485e56fa22250) fixes automation-boundary phase reset, retains a legacy serialization slot without restoring runtime phase, and adds regression tests. The final inspected [`f8eab4773b45e701905d536b61a96e2dbdd2c30c`](https://github.com/gmcnicol/jsfx/commit/f8eab4773b45e701905d536b61a96e2dbdd2c30c) changes reset to “next playback” and schedules relative to the chosen origin. This is correctness evidence: update cadence and lifecycle matter, and an earlier fix's policy can later change. It is not a reason to add transport/reset features to the first slice.

## Issue/PR corroboration and its limits

[JSFX #25](https://github.com/gmcnicol/jsfx/issues/25) explicitly asks for a reusable skill preserving cached drawing, bounded dirty redraws, final blit, drag state/commit-on-release and local DSP scratch, with flicker, host-panel churn and crackle diagnosis. [#26](https://github.com/gmcnicol/jsfx/issues/26) independently requires no graphics/DSP scratch collision and reuse of the notes/ParallelTap. These corroborate the repository's intended lessons; they are requirements, not completed experiments.

[BloomWerk #12 comments](https://github.com/gmcnicol/jsfx/issues/12) report deployment/static checks but explicitly leave live REAPER compile/audition feedback outstanding; do not count deployment as a successful audio validation. [PR #1](https://github.com/gmcnicol/jsfx/pull/1) describes deterministic scheduling, scale parsing and incoming MIDI-offset fixes and explicitly says no automated JSFX tests ran. Its retrieved review and inline-comment lists were empty. No separate ParallelTap/OvumTone performance PR, benchmark report, hidden-editor regression report, lock-contention measurement or original recording was found in the inspected tracker evidence.

## Host documentation: constraints on interpreting these patterns

Consulted the `find-docs` skill, resolved the official REAPER JSFX SDK with Context7, then checked the relevant Cockos pages directly. These are live official references, not pinned host binaries:

- [Section lifecycle](https://www.reaper.fm/sdk/js/js.php#sec_gfx): ordinary `@gfx` runs around 30 times/second while the GUI is open, on a separate thread from audio; simultaneous access can leave variables/RAM unpredictable. `options:gfx_idle` is a distinct optional behavior. **Inference:** ordinary audio correctness/automation must not depend on graphics executing. The docs do not establish the editor-close-mid-drag outcome of our future generated code.
- [Atomic variable access](https://www.reaper.fm/sdk/js/advfunc.php#cat_atomic): scalar access/update operations explicitly guarantee atomicity across contexts. They do not document an arbitrary array copy or multi-parameter snapshot as one atomic transaction. No locking or lock-free publication policy is chosen here.
- [Host notifications](https://www.reaper.fm/sdk/js/advfunc.php#sliderchange): `sliderchange()` does not send automation notifications; `slider_automate()` does, with optional end-touch support from REAPER 6.74. The old repository's “no sliderchange in mouse handling” is a churn-avoidance pattern, **not permission to omit required automation notifications**. Release-only backing commits do not prove continuous automation capture. #3 must decide and test this conflict rather than blindly copy the old pattern.
- [Sample-accurate automation](https://www.reaper.fm/sdk/js/vars.php#slider_next_chg): `slider_next_chg()` exposes within-block offsets, endpoints and inflection points. A single target per block discards that information unless a separate event/interpolation path preserves it. The docs say constant blocks return -1; a whole-block transition can return `samplesblock-1`. Do not infer sample accuracy from block-rate snapshots or smoothing alone.

## Proposed contract constraints and concrete gates

These are **inferences/proposals for #3/#6/#2**, all unrun in REAPER here. The human still chooses authority, gestures, publication, supported versions and numerical/timing tolerances.

| Proposed constraint | Validation case and observable evidence |
| --- | --- |
| Audio-owned applied target/smoothing; GUI-independent host observation | Automate gain with editor open, closed and reopened, plus offline render. Compare stereo output/target traces for the same host events. Hidden UI must not freeze gain or leave stale coefficients. Record actual host/version/block size. |
| Live drag target is distinct from backing host commit | Drag slowly across many graphics frames while sounding a tone. Trace UI requested value, audio-consumed value and backing slider separately. Audible gain must follow the agreed live path, not wait silently for mouse-up. Count actual host writes/notifications; idle frames must not publish unchanged values. |
| Host publication does not ride the paint loop | Repeat identical drag with native host panel shown/hidden; record notification counts and UI recordings. Verify publication cadence and automation-envelope contents against the chosen policy, including touch end. Reusing release-only commits requires proving what gets recorded, not just what is heard. |
| Explicit conflict and interruption policy | Host automation changes the same gain mid-drag; unrelated parameter changes; release outside editor; close editor mid-drag; stop/reload before release. Check for jumps, stale overwrite, stuck touch, lost persisted value. Historical per-field drag guards are evidence to consider, not a universal winner rule. |
| Bounded dirty drawing and geometry invalidation | Instrument layout/render/resource calls for idle, one gain change, resize and scale change. Idle should not recreate images/layout; a value change should dirty only dependent content. Verify one final opaque cache presentation and no disappearing/dimming regions with a recording. Counts are structural gates; latency/CPU still needs profiling. |
| No generated/author scratch or memory collision | Compose DSP deliberately using ordinary names such as `i`, `sum_l`, `out_l`; stress dragging/resizing during tone and silence. Inspect generated namespaces/memory intervals and compare audio with editor closed. No accidental UI writes to audio scratch/filter/smoother state. |
| Derived values have complete invalidation dependencies | Compare host edit, live drag, reload and sample-rate change for the same gain. Count derivations: unchanged dependency sets should not redo expensive work; UI-only dependencies must never enter audio work. Verify initialization and both update paths produce the same derived gain. |
| Snapshot semantics are explicit | Instrument reads/applied values under rapid host/UI updates and multiple parameters; check for mixed generations if coherence is promised. Bound audio work; no unbounded retry/spin waiting for graphics. A once-per-block copy alone cannot satisfy a transaction guarantee. |
| Smoothing remains audio-rate where needed | Render a stepped gain change on a known sine at multiple sample rates/block sizes. Check expected gain trajectory, discontinuities, silence, clipping/nonfinite values and stereo equality. Define acceptable response/click metrics before claiming success; do not prescribe historical time constants for the new gain control. |
| Block-rate automation limitation is stated or separately solved | Place ramp/square automation inflections inside blocks at different offsets. Compare expected/applied timing and endpoints at small/large block sizes. Choose explicitly whether first slice accepts block quantization or needs the documented intra-block path; smoothing does not settle this. |
| Resource work is owned and bounded | Static-check generated audio sections for UI calls, host-panel work, layout and allocation; inspect composed DSP too. Exercise reload/resize/sample-rate changes and report resource high-water marks. History supports isolation but supplies no heap/contention performance budget. |
| Persistence is separate from ephemeral interaction/runtime state | Save/reload gain while idle and during a gesture, per chosen semantics. Verify declared stable slider IDs and value restoration without accidentally persisting scratch/phase or overwriting existing author serialization. PulseWerk's legacy-slot fix is a warning, not a serialization design mandate. |

For any actual performance claim, record plugin/compiler revision, REAPER version, OS/CPU, sample rate, block size, instance count, UI visibility/geometry and workload. Compare idle, host automation, live drag and resize; report audio processing and UI work separately, with repeatable measurements and deadline/dropout evidence. No absolute performance threshold is selected by this research.

## What remains unknown / decision hand-back

**Measured here:** only the existing Python regression check passed; source/diff/tracker/document inspection completed. No REAPER executable was found on PATH (`command -v reaper`); no host, audio, GUI, automation, serialization or benchmark experiment ran. This is not an exhaustive installed-host search.

**Historically reported, not remeasured:** ParallelTap disappearing regions/flicker and host churn; OvumTone scratch-induced crackles. The notes state causes/fixes, but do not provide raw recordings, CPU numbers or an isolated pre-fix reproducer in the inspected evidence.

**Not established:** that hidden UI previously caused a repository regression; that allocation/locks were the historical bottleneck; that fixed arrays are coherent across threads; that release-only backing commits capture continuous automation; that every current plugin follows all notes; or that a block snapshot meets the desired latency/automation contract on any supported platform.

**Required before #3 finalizes:** explicitly connect the proposed snapshot's input to both host and live-UI edits; define scalar/coherent publication promises and interruption behavior; retain audio smoothing and scratch/memory isolation; preserve bounded UI invalidation and intentional host notification cadence. Decide any block-quantization trade-off with the human. #2 owns actual REAPER proof gates; #6 owns generated dependency/layout semantics. No production implementation, policy acceptance, PR or merge is part of this investigation.
