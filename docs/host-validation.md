# Real-host validation protocol — all checks pending

**Compiler proof; host validation pending.** No REAPER/EEL2, numerical render,
automation recording, GUI, HiDPI, reload or performance check has run for this
handoff on Linux, macOS or Windows. REAPER is not on this implementer's PATH;
this is a bounded local observation, not a search of remote machines. Do not
install/provision REAPER automatically. The coordinator must create/link the
concrete host-validation handoff issue outside the parent map; **not created yet**.
[Automated CI is independently pending](proof-evidence.md), not excused by this
manual-host exception.

Canonical requirements: [CLI/validation](https://github.com/gmcnicol/DeclareFX/issues/2#issuecomment-7193405886),
[ownership](https://github.com/gmcnicol/DeclareFX/issues/3#issuecomment-7162839879),
[subset](https://github.com/gmcnicol/DeclareFX/issues/6#issuecomment-7187429622),
and [numeric amendment](https://github.com/gmcnicol/DeclareFX/issues/6#issuecomment-7219873850).
Target REAPER **7.02+** is only a floor. Results cover only exact builds,
architectures, devices and display scales actually checked, not that entire range.

## Evidence record (one record per case)

Record case ID, PASS/FAIL/UNRUN/BLOCKED, date/operator, expected and observed
behavior, exact reproduction steps, and durable evidence links. Include:

- compiler Git revision, clean/dirty status, Node/pnpm/TypeScript versions;
  SHA-256 of UI, JSON binding, DSP, generated JSFX and every input/render/project
  or diagnostic variant; link the passing integration CI run separately;
- exact REAPER version/build/architecture, OS version/build/architecture,
  audio device/backend, project sample rate, **observed processing block sizes**,
  render settings, display pixel dimensions, OS scale, REAPER UI scale and
  observed `gfx_w`, `gfx_h`, `gfx_ext_retina`;
- `.RPP`, input/output WAVs, screenshots/video with pointer/envelope/native
  parameter visible, render/analysis commands and tool versions, result tables,
  and instrumentation source/logs where used. Hash evidence files too.

Never substitute a screenshot of a passing compiler test or a golden/header
scan for a host result. A modified diagnostic effect must be separately named,
hashed and reported; rerun the relevant behavior with the **unmodified** golden.
Unobservable behavior is BLOCKED/UNRUN, not an inferred pass.

## Setup and standalone load — each OS family

1. Use the pinned development tools and [build instructions](../README.md).
   Hash inputs and the freshly emitted file and compare it to
   [`examples/gain.jsfx`](../examples/gain.jsfx). Keep author inputs unchanged.
2. In an already available REAPER installation, use **Options → Show REAPER
   resource path**. Manually copy only the generated file to a named subdirectory
   of `Effects/`, rescan/add that JS effect to an otherwise empty stereo track.
   Use the same filename for reload checks to retain native slot identity. No
   imports, compiler, Node, pnpm, browser, service or repository should be needed
   at effect execution time. Test from a separate copy without those inputs
   available to the host. Capture load/compile errors verbatim; errors fail load.
3. Verify native `Gain` is continuous linear amplitude, range 0–2, new-instance
   default 1, and two audio channels. The UI should show background, literal
   `Gain`, and a half-viewport-width control with its nested level rectangle.
   There is no dB mapping, dynamic label, bundled font or nested clipping promise.

## Numerical stereo renders — primary tested platform

Use a separate project without other processing, normalization, limiter,
resampling, dither, pan-law attenuation or non-unity track/master/item gains;
center pan with unity stereo routing, no fades/time stretching. Keep sample
positions aligned and disable render tails. Record all actual settings.

1. Prepare a deterministic ten-second stereo input WAV at **each** rate
   44100 and 48000 Hz. Suggested sample definition, with zero-based frame `n`:
   `L[n] = float32(0.0625 * sin(2*pi*997*n/rate))`,
   `R[n] = float32(0.03125 * cos(2*pi*1499*n/rate))`.
   Save stereo IEEE float32 WAV; preserve the exact generator source/command,
   version and WAV hashes. Compare against the **decoded stored input samples**,
   not a newly calculated sine. Unequal channels expose routing/crosstalk errors;
   doubling remains well below clipping.
2. For every combination of rate **44100/48000**, actual processing block
   **64/512**, and gain **0/1/2**, render with the custom editor open and closed:
   **24 steady-state cases**. Include offline rendering at those actual blocks
   (24 more cases if the first set was real-time). Save stereo IEEE float32 WAV,
   identical rate/length/start. Set the parameter before playback/render and
   allow at least one second to settle.
3. A requested hardware buffer is **not evidence** of processing block size,
   especially offline. Observe `samplesblock` in REAPER's JSFX debugger or a
   separate, saved diagnostic DSP variant with bounded counters for the actual
   block sizes seen. Preserve its source/hash and report instrumentation effects.
   Do not add logging/allocation/UI work to the audio hot path. Record final
   partial blocks separately. If requested blocks cannot be achieved or measured,
   mark those cases BLOCKED and retain the gate; do not rename a different size.
4. With a recorded independent offline WAV reader/analysis command, decode input
   `x[c,n]` and output `y[c,n]`, verify two channels, equal rate, frame count and
   sample alignment (no permissive alignment fitting). For both channels over
   frames `rate <= n < 9*rate`, compute
   `max_abs_error[c] = max(abs(y[c,n] - gain*x[c,n]))`.
   Require every sample finite and each maximum **<= 0.000001**. Report maxima,
   offending frame/channel, analyzed frame count and non-finite count for each
   case; no average/RMS error may substitute for the maximum. Gain 0 must mute,
   1 preserve and 2 double both channels. Save the analysis source and results.
5. Separately play/record stepped host gain automation and UI edits. Report
   observed block-rate transition timing and unsmoothed edges; do not apply the
   steady-state window to hide transitions or claim sample accuracy/click-free
   behavior. Repeat audio observation with the UI closed and in offline rendering.
   No smoothing or deterministic concurrent host/UI winner is promised.

## Input, automation and UI gestures — each OS family

Use a separate test project with gain envelope and continuous low-level stereo
audio. Capture the native parameter, envelope and custom control together.

- **Host → UI/audio:** set native gain 0, 1, 2 and intermediate values; then play
  an envelope with ramps/steps. Level rectangle follows the currently observed
  native gain, audio follows without requiring `@slider` or an open editor, and
  mere drawing/observation does not write automation points.
- **UI → host/audio:** at gain 1 press the visible control without moving: no
  value jump, parameter edit or synthetic notification. With measured current
  control width `W`, move by `+W/4`: expect latest gain +0.5, clamped to 0–2;
  move negatively and through both limits. One width spans the full range.
  Only actual value changes should publish; stationary frames and clamp-limit
  no-change motion must not spam the host. Observe automation/envelope activity,
  not merely the presence of `slider_automate` in generated source.
- **Concurrent host changes:** begin a drag, hold the pointer stationary while
  native/envelope gain changes (for example to 1.5). It must not replay the
  press-time value. Move by `+W/8`: expect latest native +0.25 (clamped), not a
  press-time baseline. Record automation mode and event timing; simultaneous
  competing writes have no guaranteed winner or UI-exclusive lock.
- **Recording/playback:** exercise REAPER Read, Write, Touch, Latch and any
  Latch Preview mode used; record which modes are tested rather than assume
  identical behavior. Verify actual UI edits can be recorded and played back,
  Read follows the host policy, and notified Touch completes on release/cancel
  (returns to the host's envelope behavior). Latch may legitimately keep
  writing per host policy; distinguish this from a stuck UI gesture.
- **Every interruption:** after a notified edit, independently test release
  inside, release outside the control/window, focus transfer to another window,
  editor close while held, and resize/invalid width while held. On resuming,
  no stale replay, rollback or stuck touch; new press starts a fresh gesture.
  Repeat interruption before any value change: no invented touch/edit.
  Record touch-end/closure latency; `options:gfx_idle` can run at a reduced rate,
  so immediate closed-editor cancellation is not promised.
- Wheel, fine adjustment, reset, keyboard/numeric entry are not custom v1 modes.

## Geometry, numerical safety and displays — each OS family

- Resize large/small while playing and dragging: half-width geometry, level,
  hit regions and sensitivity update together, before the next hit/edit. Click
  old-only regions and outside the root viewport: no edit. Verify source-order
  drawing/nested translation and root clipping, including negative positions
  in a separately hashed supported fixture; nested clipping is not required.
- Try tiny/zero host dimensions and zero/nonpositive control width. If the host
  enforces a minimum editor size, record that limit and test a separately built
  supported fixture whose control width becomes zero as native gain changes.
  Never describe an unreachable zero-size host window as tested.
- Use separately hashed source variants with runtime-dependent overflow and
  division by a represented zero (for example width depending on
  `parent.width / (app.gain - 1)`). Observe retained last-valid geometry,
  initially zero, sticky bounded numeric-error flag and separate invalid width
  eligibility: a retained positive width must not keep a bad drag active.
  Negative size results are invalid; negative positions are allowed. Check
  lazy untaken branches and exact represented-value comparisons. Author DSP
  itself remains trusted, not sandboxed.
- Test tiny literals and intermediates as **native EEL2 observations**, not an
  IEEE gradual-underflow/Node parity oracle. Tiny normals may also flush; report
  represented results/branches for that exact backend. A flushed denominator
  must be guarded, without invalid geometry/audio. Plain-decimal source/header
  inspection proves syntax only, not that any expression ran successfully.
- If the host/debugger permits out-of-range/non-finite native injection, record
  the method and verify finite clamp 0–2 / non-finite safe gain 1 before DSP,
  without synthetic observation-only host edits. If injection is impossible,
  retain that case as UNRUN/BLOCKED, not passed from a JavaScript model.
- At normal and available HiDPI/Retina scales, and across mixed-scale monitors
  where available, record actual OS/REAPER scales and gfx/mouse coordinates.
  Verify painted edges, hit regions and drag distance align, without a second
  scaling transform. Record bitmap glyph coverage/metrics; UTF-8 acceptance is
  not universal glyph/font parity. Missing hardware/scales remain UNRUN.

## Persistence, author ownership and regression reminders — each OS family

- Save project at a non-default gain (for example 1.375), close/reopen project
  and editor, stop/start playback, and exercise the relevant sample-rate/device
  reinitialization. Native gain/slot identity remains, no generated/author init
  reset and no custom duplicate serialization; transient drag never persists.
- In a separately hashed author-DSP variant, use ordinary persistent scalar and
  indexed scratch plus optional `@init`/`@block`. Verify author body bytes are
  preserved by regeneration, repeated init is safe, block alias is prepared
  before author work and stable for that block, and UI/resize does not clobber
  author state. Do not write reserved names/aliases or read gain in direct init.
- Hash author inputs before/after regeneration. Rebuild safely, compare outputs;
  deliberately invalid input must preserve previous output, and an unmarked
  destination/input alias must be refused. Automated publication tests supplement,
  not replace, standalone host reload observations.
- Stress idle, stationary drag, moving drag and resize with tone and silence.
  Look for panel churn, flicker, stuck automation or scratch collisions. Capture
  observed failures. Historical fixes are reminders, not a requirement for a
  cache framework, release-only publication or unmeasured CPU/speedup claims.

## Current host status and completion

| Platform | Exact REAPER build | Load / renders | Automation / interruption | UI / HiDPI / reload |
| --- | --- | --- | --- | --- |
| Linux | None run | UNRUN | UNRUN | UNRUN |
| macOS | None run | UNRUN | UNRUN | UNRUN |
| Windows | None run | UNRUN | UNRUN | UNRUN |

Numerical coverage is required on a primary tested platform; manual categories
are recorded separately for every tested OS family. Missing cases stay explicit.
Update this table only from durable real-host records, linking the handoff issue
and exact evidence. Investigate concrete failures without silently relaxing the
contract. No release-ready, cross-platform host, audio/UI correctness or performance
claim is currently justified.

Official references checked directly (Context7 quota exhausted):
[sections/gfx_idle](https://www.reaper.fm/sdk/js/js.php),
[graphics/focus/visibility/HiDPI](https://www.reaper.fm/sdk/js/gfx.php),
[automation/end_touch](https://www.reaper.fm/sdk/js/advfunc.php).
These documents explain APIs, not measured success on this effect.
