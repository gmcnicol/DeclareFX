# JSFX runtime and host-interaction constraints

Research for [Investigate JSFX runtime and host interaction constraints](https://github.com/gmcnicol/DeclareFX/issues/7), under [Wayfinder: Establish Declare → JSFX compiler architecture and prove the vertical slice](https://github.com/gmcnicol/DeclareFX/issues/1). Retrieved 2026-11-24. Research only: no production implementation and no human contract decisions resolved.

## Evidence and terminology

**Documented** below means stated by Cockos's live JSFX reference or release history; it does not mean tested here. **Implication** means a constraint or feasible approach inferred from those facts, not an adopted design. **Unknown / gate** means documentation is insufficient or a REAPER experiment remains necessary.

A **native parameter** is a numbered JSFX slider exposed to REAPER automation, not necessarily a visible fader. A **UI gesture** is a custom-control interaction spanning press/change/release; it is not itself a host automation mode. A **section** is one host-invoked EEL2 entry point, not an independently composable source module. **Instance memory** is the effect-local indexed numeric address space; it is distinct from explicitly shared `gmem[]`, `_global.*`, and `regXX`.

### Primary sources

- [S1: JSFX introduction, file structure, sliders, options, import and sections](https://www.reaper.fm/sdk/js/js.php).
- [S2: EEL2 language essentials, operators, memory addressing and loops](https://www.reaper.fm/sdk/js/basiccode.php).
- [S3: special variables, sliders, sample-accurate automation, initialization and shared state](https://www.reaper.fm/sdk/js/vars.php).
- [S4: graphics functions, framebuffer, keyboard, mouse and HiDPI](https://www.reaper.fm/sdk/js/gfx.php).
- [S5: memory utilities, atomic access and host interaction](https://www.reaper.fm/sdk/js/advfunc.php).
- [S6: strings and string functions](https://www.reaper.fm/sdk/js/strings.php).
- [S7: file I/O and serialization](https://www.reaper.fm/sdk/js/file.php).
- [S8: functions and namespace pseudo-objects](https://www.reaper.fm/sdk/js/userfunc.php).
- [S9: official cumulative release history](https://www.reaper.fm/whatsnew.txt), especially v6.74, v6.79 and v7.02.

Pages were fetched directly over HTTPS and read; Context7's `/websites/reaper_fm_sdk_js` lookup independently located the host-notification reference. Live documents are not version-pinned specifications. The retrieved site header advertised REAPER 7.86; that is not an installed or validated version. Historical feature floors below come from explicit reference annotations and release entries, not the header.

## 1. Execution sections and ownership

| Section | Documented invocation / role | Contract implication, not a new runtime guarantee |
| --- | --- | --- |
| `@init` | Effect load, sample-rate change and playback start; normally clears variables and RAM first. `ext_noinit` changes reinitialization behavior. [S1, S3] | Initialization is not a one-time constructor; preserve author initialization and avoid resetting restored state. |
| `@slider` | After `@init`, or when a slider changes; intended to adapt parameters, avoiding clicks/glitches. [S1] | Bounded parameter-to-DSP derivation belongs here or in bounded audio-side code, not UI layout. |
| `@block` | Before each audio block; `samplesblock` gives upcoming length. [S1, S3] | Do not assume a fixed block size. It is an audio-processing entry point. |
| `@sample` | Once per PCM sample frame; audio available through `spl0`, `spl1`, etc. [S1, S3] | Stereo gain/pass-through can remain tiny hand-written DSP. No generated layout, string formatting, event traversal or allocation here. |
| `@serialize` | Host extended-state save/load; handle 0 selects host state. [S1, S7] | Not an ordinary UI frame or an unconditional constructor; versioned state design remains a human choice. |
| `@gfx [w] [h]` | Approximately 30 Hz with GUI open, on a thread separate from audio; width/height are requests only. [S1] | Put UI evaluation, layout, event polling and drawing here; audio must work with no open UI. |

**Documented:** graphics and audio can execute simultaneously, leaving shared variables/RAM unpredictable. Atomic get/set/add/exchange/compare-and-set primitives explicitly guarantee atomic value access across contexts (REAPER 4.5+). Functions' `local()` state persists between calls but is distinct for calls from different sections. [S1, S5, S8]

**Implication:** do not treat a sequence of scalar writes, a memory buffer, or a reactive object graph as an atomic message. Atomics protect individual values, not a multi-field transaction or an entire DSP buffer. Keep UI-local scratch and audio-local scratch disjoint. Native parameters provide a documented host integration mechanism, but documentation here does not establish a full cross-thread memory model or conflict arbitration between simultaneous UI and automation writes. Those are not solved by saying “everything is a double.”

**Unknown:** the references do not fully specify thread affinity, mutual exclusion and reentrancy for every `@init`/`@slider`/`@serialize` combination. Do not invent a guarantee that `@slider` is always the UI thread or that serialization pauses all other entry points. No locks, allocation, file I/O or UI evaluation should be introduced into audio processing to compensate; this last restriction comes from the project brief, not a blanket prohibition in EEL2.

## 2. Native sliders, automation and gestures

### Documented facts

- Header declarations have explicit numbered identities: e.g. `slider1:5<0,10,1>description` defines default, range and increment. Current JSFX supports **256 sliders**. v6.74 introduced the expansion from the previous 64-slider limit; v6.79 fixed state encoding of more than 64 sliders with no preset name and project state with high slider counts/large values. [S1, S9]
- Sliders are host-automatable. A leading `-` on the description hides the standard UI without disabling automation. Named aliases (`slider1:gain=...`, REAPER 5.0+) should be accessed by the alias rather than `sliderX`. `slider(index)` provides dynamic access; its index is the native slider number (e.g. 1 for `slider1`, as also recorded in S9's v3.11 entry). [S1, S3, S9]
- Enumerations use a zero-based range and step 1 with label translations. Log/polynomial shaping is available from 6.74; changing shaping can affect existing automation. The `!` shaping form explicitly keeps shaping from affecting automation. [S1]
- `sliderchange(sliderX)` refreshes displays after a programmatic change but **does not notify automation**. `slider_automate(sliderX)` updates display and notifies the host so the move can be recorded. Such notification is unnecessary from `@slider`. [S3, S5]
- Notification arguments can be a direct slider variable or a bitmask: bit 0 selects slider1, bit 1 slider2. From 6.74, `slider_automate(mask, 1)` ends a touch-automation recording session. The documented JSFX interface is not a pair of separately named begin/end gesture functions. [S5]
- `sliderchange(-1)` from `@gfx` adds an undo point for internal-state interaction. It is not an automation gesture API. `slider_show` (6.30+) manages native-slider visibility. [S5]
- Sample-accurate automation is available through `slider_next_chg(index, nextval)` in `@block`/`@sample` (5.0+). Constant blocks return -1; ramps can report the end-of-block value, while inflections can produce intermediate offsets. It does not eliminate the DSP's responsibility to interpolate/process correctly. [S3]

### Implications and unknowns

**Bidirectional path:** a feasible UI reads current native parameter values rather than making an independent persistent UI copy authoritative. Host edits/automation update those values; UI-originated edits assign the parameter and use the appropriate notification. DSP-side derived values must be refreshed on *both* paths. The reference does not promise that assignment plus `slider_automate` from `@gfx` automatically re-enters `@slider`; that dispatch detail and timing require a test. Do not silently depend on it or duplicate large state graphs across threads. [S1, S3, S5]

**Gesture hypothesis to validate:** publish changed values during drag and explicitly end touch on release using the 6.74 API. Verify touch/latch/write/read behavior, undo grouping, a press with no value change, release outside the UI, focus loss, and closing the UI mid-drag. The docs establish notification and touch-end support, not a complete drag lifecycle, no-change touch-begin behavior, automation-mode policy or interrupted-gesture recovery.

**Identity implication:** assigning stable native slot numbers and preserving their meaning is required for a credible saved-project/automation compatibility policy. Renumbering controls by generated layout order would risk retargeting host state. Exact migration/tombstone policy, reserved slots, and host-versus-drag precedence belong to the human parameter-contract ticket, not this research. Range, units, step and normalization also need an explicit contract; the header is not proof that arbitrary programmatic writes are clamped or quantized.

**Mask limitation:** do not infer that all 256 sliders fit one portable integer mask. EEL2 integer conversions vary by operator/platform and double precision is finite (see below); direct-slider notifications are documented. High-slot notification behavior and dynamic access should be probed before claiming broad 256-parameter support. The one-gain proof does not need a large mask abstraction. [S2, S5]

## 3. Persistence, reload and initialization

**Documented:** native `sliderX` parameters save automatically. Other numeric variables/RAM require explicit `@serialize` calls to `file_var(0, x)` / `file_mem(0, offset, length)`; `file_mem` returns the actual item count. `file_string(0, str)` supports binary-safe string state. Use `file_avail(0) >= 0` to distinguish read from write; do not open or close handle 0. Numeric serialized variables/memory use a compact **32-bit representation**, potentially losing precision. [S1, S7]

A **non-empty** `@serialize` section suppresses the normal clearing of variables/RAM on `@init`; even trivial no-side-effect code can cause that change. This does **not** serialize all memory automatically. `@init` can run after `@serialize`; clearing restored variables there loses state. `ext_noinit=1` can suppress transport-start/sample-rate reinitialization; S3 warns `srate` may then be wrong in `@init` and recommends checking changes in `@block` or `@slider`. [S1, S3]

**Implications:** ordinary gain can rely on native parameter persistence without an extra custom gain copy. Avoid adding dummy serialization as supposedly harmless boilerplate to existing DSP: it changes lifecycle semantics. If extended state is needed, choose a schema, bounds/count checks and compatibility policy deliberately; do not serialize transient mouse-down/capture or derived layout by accident. Serializing a numeric string handle is not serializing its contents; use the string API. [S6, S7]

**Unknown / gates:** project reopen, preset/FX-chain restore, duplication, transport restart, sample-rate change, source recompile and effect replacement are distinct lifecycle scenarios. Documentation is not evidence that all preserve the same transient state. Test the accepted scenarios and old/new generated versions; native-slider automatic saving does not prove safe slot/range changes, regeneration or cross-version schema migration. Concurrent serialization/UI updates and partially read custom state also need an explicit policy if introduced.

## 4. Numeric, string and memory constraints

### Numeric and identifiers — documented

EEL2 variables are double-precision floating point, implicitly declared and global to the effect by default. Names are **case-insensitive**, may contain dots for namespaces, and have maximum length 127. `==` is approximate (difference less than 0.00001); `===` is exact (4.53+). Bitwise operations convert numbers to integers; `&`, `|`, `~` and remainder can use 32- or 64-bit integers depending on platform. Shifts use 32-bit integers, with documented undefined out-of-range shift counts. Remainder operates on absolute converted values, not JavaScript's signed remainder. Logical/bitwise precedence differs from C/JavaScript; parenthesize mixed operations. Loops have an approximate 1,000,000-iteration safety limit, not a real-time work budget. [S2]

**Implication:** naive textual lowering of JavaScript equality, remainder, booleans, masks or identifier case is unsound. Exact small integers can be represented in a double, but unbounded integer/BigInt semantics cannot be assumed. Decide non-finite values, division by zero, coercion, truthiness, string equality, rounding and change detection in the language contract; the references are not an ECMAScript compatibility specification. Approximate equality could incorrectly suppress a small gain/geometry update.

### Strings — documented

Strings are referenced by numeric handles, not inline JavaScript values. Literals are immutable; mutable fixed slots are 0–1023. Named strings start empty and persist for the script lifetime; temporary `#` strings have limited/unpredictable scope and undefined initial contents. The soft string limit is about 16 KB: a growth attempt past it may leave the string unmodified. Several APIs explicitly operate on byte offsets/counts; string contents are compared with functions such as `strcmp`, not by comparing handle numbers. [S6]

**Implication:** reserve named strings/fixed slots against DSP collisions, keep label formatting in `@gfx`, and do not retain temporary handles as persistent state. General JavaScript UTF-16 indexing, arbitrary-length strings and browser text layout are not established by these APIs. Unicode keyboard events do not prove grapheme-aware editing, IME support or font/rendering parity. Literal text and one formatted numeric label are a narrower feasible slice, subject to the human subset decision. [S4, S6]

### Memory — documented

`base[offset]` indexes an instance-local numeric address space using the **sum** of base and offset; defaults are approximately 8,388,608 slots. Legacy addressing rounds by adding 0.00001 then truncating. `options:maxmem=` (5.10+) can request a different limit, currently up to 128 million slots; `__memtop()` reports capacity. `options:prealloc=` (7.02+) preallocates some/all reserved memory, with `prealloc=*` selecting all. [S1, S2, S5]

Default `gmem[]` is approximately 1,048,576 slots shared across instances; named `options:gmem=...` uses an 8-million-slot shared namespace (4.6+). `_global.*` and `reg00`–`reg99` also cross instance/effect boundaries. `freembuf` is only a hint, not guaranteed freeing or clearing. Some FFT/MDCT/transform operations must not cross 65,536-item boundaries; overlapping `memcpy` crossing such a boundary can be undefined. The user stack is approximately 4096 items and has no empty-pop checking. [S2, S3, S4, S5]

**Implication:** RAM addresses and string/image/font slots are shared resources *within* an effect; pseudo-object prefixes alone do not reserve RAM. Use compile-time bounded/disjoint regions and integer bounds checks where dynamic indexing exists. Fixed indices alone are not evidence of allocation-free first access: explicitly preallocating is a documented mechanism, but real-time behavior and author DSP still need audit/measurement. No runtime allocation, file I/O, UI work or unbounded traversal belongs on the audio hot path under the project brief. Preallocating an enormous maximum by default is not a researched requirement.

## 5. Reactive/layout feasibility, graphics, events and resize

**Documented primitives:** immediate drawing includes rectangles, text, lines, circles, images and blits. `gfx_measurestr` measures the current font; `gfx_setfont` provides default bitmap font or configurable slots 1–16, whose style support can vary by OS/font. `gfx_dest=-1` targets the main framebuffer; slots 0–127 are offscreen images. `gfx_setimgdim` accepts dimensions 0–2048 and makes resized contents undefined. Graphics drawing state (`gfx_x/y`, color, mode, destination, font) is mutable. [S4]

**Documented scheduling:** `@gfx`'s nominal size is only a hint; use current `gfx_w/gfx_h`. No drawing means no display update. `options:gfx_hz` (6.44+) is a request, not guaranteed timing. `gfx_idle`/`gfx_idle_only` (6.44+) allow periodic GUI-thread work without a displayed UI, possibly reduced in rate. `gfx_ext_flags` identifies embedded TCP/MCP and idle contexts. [S1, S4]

**Feasibility inference:** background + text + a derived rectangle + a gain hit region can be evaluated/drawn in `@gfx` with scalar arithmetic, text measurement and mouse polling; no browser/DOM or runtime compiler is required. A bounded generated dependency order can recompute derived/layout values when slider inputs or dimensions change. This is not a native reactive system or constraint solver supplied by JSFX. Whether to recompute each frame or use dirty flags, how to detect cycles, and what layout semantics survive lowering remain human language-contract decisions. Nothing in these primitives establishes Declare/browser rendering parity.

**Documented input:** `mouse_x/y` are graphics-area coordinates. `mouse_cap` carries left/right/middle buttons and modifiers. Calling `gfx_getchar()` at least once enables modifier reporting even without mouse capture; its queue/poll forms expose keys and focus/visibility query flags. `mouse_wheel`/`mouse_hwheel` usually change by multiples of 120 and must be cleared by the caller after reading. Unicode keyboard values are supported from 6.74. [S4]

**Implications:** derive press/release edges from successive button states, hit-test in the same coordinate system as drawing, and retain a drag owner if that interaction is selected. Resize can be detected by comparing current dimensions; invalidate layout and recompute hit regions together, including very small dimensions without division by zero. Offscreen image resizing requires redrawing. Separate components must restore or explicitly establish graphics state to avoid compositional leakage. [S1, S4]

**Unknown / gate:** the reference is not a DOM-style event/bubbling or pointer-capture contract. It does not prove reliable release delivery after leaving the window, closing/focus loss, multiple embedded/floating views, or very fast clicks between graphics polls. Test drag continuation/cancellation and touch-end recovery. UI visibility must not be required to process automation/audio. Font availability, clipping, text metrics, wheel/trackpad behavior and resize interactions require real host checks.

## 6. DSP/import composition and regeneration

**Documented:** each section can be defined only once. `import filename` (4.25+) searches within the JS effect directory and makes functions from imported `@init` available. Imported other sections are used **only if the importing effect does not implement that section**. Import is therefore not automatic concatenation of multiple `@sample`/`@slider`/`@gfx` bodies. Import-only `.jsfx-inc` files are omitted from the FX browser. Functions defined in `@init` are accessible across sections; other-section functions are section-local. Functions cannot recurse and can call only earlier-declared functions; parameters and `local()` state are private, with persistent locals as described above. [S1, S8]

**Implications:** generating a replacement `@slider`, `@init` or `@serialize` may silently suppress an imported DSP section and its lifecycle behavior. A self-contained output requirement also means imported dependencies must be packaged or flattened intentionally; an unresolved external import is not standalone. A compiler must not simply append duplicate sections or overwrite arbitrary author source. Reserved case-insensitive symbols, memory ranges, mutable string slots, image/font slots and section ownership all need a composition agreement. Build-time namespacing cannot by itself preserve existing host parameter meanings or guarantee safe regeneration.

**Unknown / human decision:** choose author file boundaries, import restrictions, explicit call hooks versus generated section assembly, and preservation/diagnostic rules. Multiple competing imports' section precedence and imported top-level initialization side effects are not sufficiently specified here to bless arbitrary composition. If the accepted contract allows them, probe exact behavior rather than assuming conventional language-module semantics. No author DSP was inspected or modified in this research.

## 7. Version and platform assumptions (not a support policy)

| Feature | Documented floor / caveat |
| --- | --- |
| Imports / user functions | 4.25+ [S1, S8] |
| Atomic cross-context operations | 4.5+ [S5] |
| Exact comparison | 4.53+ [S2] |
| Strings, configurable fonts and text measurement | 4.59+ [S4, S6] |
| Named slider aliases / sample-accurate automation | 5.0+ [S1, S3] |
| Dynamic native-slider visibility | 6.30+ [S5] |
| Graphics idle / requested frequency | 6.44+ [S1] |
| Touch end, slider shaping, 256 sliders, Unicode key reporting | 6.74+; high-slider state fixes in 6.79 [S1, S4, S5, S9] |
| Explicit memory preallocation | 7.02+ [S1] |

**Implication:** a claim using all listed facilities needs at least 7.02; a lower feature floor is possible only by not depending on later facilities. This does not choose the minimum supported REAPER version or establish that any historical version is bug-free. The human validation ticket must choose exact versions/builds and whether older-host rejection is necessary. A single-slider proof avoids the expanded-slot persistence issue but still needs its own reload checks.

**Documented platform differences:** on macOS, initialize `gfx_ext_retina=1` to request HiDPI behavior and `gfx_w/h` etc. can be doubled; on other systems dimensions remain unchanged and `gfx_ext_retina` is a drawing-scale hint. Mouse modifier bits map Control/Command and Windows/Control differently between Windows/macOS; Alt maps to Option on macOS. Font styles depend on font and OS. Integer conversions can vary by platform/OS. [S2, S4]

**Unknown:** S4's modifier table does not explicitly define every Linux mapping. Do not extrapolate Windows/macOS labels into a verified Linux input contract. Linux display backend, per-monitor scaling, available fonts, keyboard layouts and trackpad deltas remain environmental checks. Cross-platform JSFX availability is not pixel identity, deterministic scheduling or proof of automation/gesture parity. No cross-platform host tests ran here.

## 8. Work actually performed and validation still outstanding

### Actual checks (not JSFX experiments)

- Read the research ticket, map, applicable research/Wayfinder/domain-modeling/documentation skills and related human ticket questions. Used only primary Cockos sources for runtime facts.
- Downloaded S1–S9 via Python HTTPS into `/tmp/declarefx-jsfx-sources/`, read their relevant text, and checked release headings for the slider-limit expansion (6.74) and high-slider state fixes (6.79). An initial UTF-8 decoding of the cumulative changelog failed; decoding as Windows-1252 allowed reading it. Temporary source files are not repository artifacts.
- `uname -srm` reported `Linux 7.0.0-43-generic x86_64`. `DISPLAY` and `WAYLAND_DISPLAY` were unset. `command -v reaper` found nothing. Checked `/usr/bin/reaper`, `/usr/local/bin/reaper`, `/opt/REAPER/reaper`, `/opt/reaper/reaper`, `$HOME/opt/REAPER/reaper` and `$HOME/.local/bin/reaper`; none existed. A bounded name search under `/home/gareth/src` and `/opt` (depth 4) found no `reaper`, `reaper_linux*`, `eel2*` or `ysfx*` candidate; inaccessible paths were suppressed, so this is not an exhaustive filesystem absence proof.
- No REAPER process was launched, no JSFX was compiled/executed, and no audio, automation, interaction or persistence result was measured. No production source inspection was needed (therefore no Codegraph exploration/indexing was invoked). Only this note is intended for commit.

**Limitation:** no available REAPER executable/display was established in the inspected environment. Documentation research can be completed; actual host validation is an explicitly outstanding gate, not a successful proof or a publication blocker.

### Proposed experiments for the human-selected proof gate — NOT RUN

| Experiment | Evidence to capture |
| --- | --- |
| Load standalone generated gain effect on chosen macOS/Linux/Windows builds | Exact OS/architecture, REAPER build, source hash, load/compile result and absence of external runtime/import dependencies. |
| Stereo gain/pass-through with UI open and closed; vary block size/sample rate and render offline | Known input/output comparison, channels, gain units/tolerance, smoothing policy, transport restart behavior. |
| Host native slider edit, envelope playback, UI drag | Resulting slider value, displayed value and DSP output; establish whether UI assignment triggers `@slider`; test concurrent host/UI input and automation modes. |
| Touch/write/latch/read and undo | Gesture start/change/end, no-change press, release outside, focus loss, close during drag, final automation and undo history. |
| Save/reopen project; preset/chain reload and duplicate separately | Parameter/state before and after; custom-state precision only if used; UI must not reset restored gain. |
| Restart transport, change sample rate, recompile/regenerate | Init/serialize ordering observations, author DSP preservation, slider-ID compatibility and no unintended state clearing. |
| Resize, tiny dimensions, HiDPI and fonts | Actual framebuffer/scale/input coordinates, hit-region agreement, text bounds and behavior at chosen OS scaling settings. |
| If broader contracts need them: high slider IDs, multiple imports and cross-thread snapshots | Direct notification versus masks, high-slot save/load, section precedence and invariant violations under stress. A passing run is evidence for that build, not a universal memory-model proof. |
| No audio hot-path allocation/UI work | Generated-code and composed-DSP audit; allocator/profiler evidence if a real-time guarantee is claimed. Host load success alone cannot establish it. |

## 9. Questions left for human tickets

- [Define parameter ownership and hand-written DSP composition](https://github.com/gmcnicol/DeclareFX/issues/3): stable slots/units/ranges; host-versus-drag precedence; DSP derivation on both update paths; touch lifecycle; section hooks/import restrictions; reserved symbol/memory/string/image resources; serialization ownership and regeneration safety.
- [Define the first-slice language and EEL2 semantic contract](https://github.com/gmcnicol/DeclareFX/issues/6): exact numeric/comparison/string semantics and unsupported diagnostics; finite bounds; reactive dependency/cycle policy; layout/event/resize scheduling and resource budgets. No general JavaScript semantics should be inferred from EEL2 syntax similarity.
- [Choose the reproducible CLI and proof validation gates](https://github.com/gmcnicol/DeclareFX/issues/2): minimum/exact tested host builds, platform support claim, available GUI/audio environments, acceptable tolerances and evidence; which proposed experiments gate acceptance versus remain later scope.

**Outcome:** documented primitives support a plausible standalone, graphics-thread UI plus native-slider gain/DSP slice. They do not settle its ownership/composition/semantic policies, nor replace actual REAPER validation. Those decisions remain open with the human; this research ticket can close on published evidence without claiming the vertical slice works.
