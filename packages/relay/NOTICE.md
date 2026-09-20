# Cedia relay notices

The endpoint E2EE primitives in `src/crypto.ts`, `src/base64.ts`, and
`src/encrypted-channel.ts` are adapted from **Paseo `@getpaseo/relay`
0.8.0**, source revision
`d1b705a0cd91617a5707fae25d80cb0be3057950`. Paseo's source is licensed under
the Apache License, Version 2.0. The Cedia request/response protocol and host
and client orchestration in the remaining files are Cedia code.

The runtime dependencies are pinned to the versions reviewed for this slice:

- `tweetnacl` 1.0.3 — public domain dedication (Unlicense-style notice).
- `base64-js` 1.5.1 — MIT, Copyright (c) 2014 Jameson Little.
- `ws` 8.20.0 — MIT, Copyright (c) 2011 Einar Otto Stangvik, 2013 Arnout
  Kazemier and contributors, and 2016 Luigi Pinca and contributors.

The complete upstream license texts are retained in `LICENSES/`. This notice
does not grant a right to use the Paseo or Cedia names as trademarks.
