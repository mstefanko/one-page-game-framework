# Shared audio backend proof — C1 status

Implemented a small native Web Audio backend in `packages/music-web-audio/src/index.ts`. Importing it does not construct an AudioContext. Editor preview, standalone/game playback, and offline WAV rendering use the identical oscillator/filter/envelope/pan graph. Pulse duty uses PeriodicWave harmonics; noise uses deterministic context-cached kit buffers: a sine sweep for MIDI36 kick, noise plus tone for38 snare, and separately filtered/enveloped42/46 hats. Other noise pitches use xorshift noise. Playback compiles the canonical 480-PPQ score and schedules against the audio clock with a 150 ms lookahead, refreshed every 25 ms. This is a native-node baseline, not a hardware-emulation claim.

## Verified design properties and limits

- Stop cancels future sources, mutes envelopes, clears scheduling and invalidates pending asynchronous starts. Browser suspension/interruption stops transport; callers show Resume and explicitly restart.
- Live capture can read `setEnergy(1|2|3)` without restarting the clock, `currentTime` (audio-clock seconds), `getPositionTick()` and `isPlaying`. Call `enable()` from a user gesture before `previewNote`; otherwise audition returns an inert cancellation callback.
- Seeking restarts overlapping notes with a fresh attack. It does not reconstruct envelope phase. Loop range defaults to score loop bounds for live looping; explicit start/end overrides are supported. Playback release tails may overlap the next cycle.
- At most 256 active voices; overflow stops live transport or rejects offline rendering. At most 100,000 scheduled offline events, 128 repetitions, 600 seconds and 32 million stereo frames (approximately 256 MB of PCM before WAV encoding). Render allocations and output downloads still require practical device testing.
- Offline export schedules the whole bounded graph before rendering, rather than using wall-clock timers. It returns PCM with the requested finite tail (default 0.2 seconds), so a long release can be deliberately cropped. WAV is stereo/mono PCM16, clamps out-of-range values and sanitizes nonfinite samples. No compressed codec or network dependency.
- Timing targets are scheduling parameters, not measured audible latency guarantees. No SharedArrayBuffer, AudioWorklet, ScriptProcessor or service worker is required by this backend.

## Measured comparison and unresolved proof

The established composer plan asks for a custom-versus-BeepBox backend proof. `node scripts/backend-proof.mjs` exercises the pinned BeepBox4.2.0 candidate and emits `.local/backend-proof.json` (local generated evidence, not committed music). Native code remains the provisional production baseline. BeepBox is a development comparison dependency and is not shipped in the composer/player.

Local Node26/esbuild measurement on October17,2026: exported native engine/render entry **116083 bytes minified /29561 gzip**, versus BeepBox Synth/Song entry **191004 /46431**. These are different feature sets, not an equivalent-instrument quality or CPU benchmark; changes to either bundle require remeasurement. BeepBox has24 parts per beat versus480 canonical ticks; arbitrary canonical positions need rounding/adaptation. Its JSON import changed requested6.5 beatsPerBar to6. Padding to7 beats and cropping output produced156000 stereo48kHz frames (3.25 seconds) with nonzero PCM. That proves an adapter is possible but requires explicit bar/timing translation; it does not justify silently changing score timing.

The browser proof now renders through OfflineAudioContext, verifies finite/nonzero PCM and expected frames, tests energy changes without clock reset, stop/dispose and a deliberate short main-thread stall. The downloaded player runs at `file://` with zero network requests. [Integration measurements](08-implementation-validation.md) include loop-boundary discontinuity values. A zero-tail file does not yet equal a steady-state loop with previous-iteration release tails.

Outstanding comparison gates: comparable musical/preset fixtures and listening; representative polyphony CPU/memory; real Safari/mobile suspension and touch latency; pulse/noise aliasing, envelope clicks, mix levels and loop joins on actual output devices. Byte-identical audio across browsers is not promised. C1 remains open until these comparative and listening checks are recorded.

Sources: [Web Audio specification](https://www.w3.org/TR/webaudio/), [OfflineAudioContext](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext), [BeepBox source](https://github.com/johnnesky/beepbox).
