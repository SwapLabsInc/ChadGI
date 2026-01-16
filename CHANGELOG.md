# [1.4.0](https://github.com/SwapLabsInc/ChadGI/compare/v1.3.1...v1.4.0) (2026-01-16)


### Features

* add terminal hyperlink support for clickable URLs in CLI output ([#149](https://github.com/SwapLabsInc/ChadGI/issues/149)) ([51ed8ab](https://github.com/SwapLabsInc/ChadGI/commit/51ed8ab7eeabc744d47464ba33d4dc63530c3f2d)), closes [#140](https://github.com/SwapLabsInc/ChadGI/issues/140)

## [1.3.1](https://github.com/SwapLabsInc/ChadGI/compare/v1.3.0...v1.3.1) (2026-01-16)


### Bug Fixes

* use stdin instead of command-line args for Claude prompts ([ffbedba](https://github.com/SwapLabsInc/ChadGI/commit/ffbedba91950c04c9042ad6e7e0f81d8fb3a9a85))

# [1.3.0](https://github.com/SwapLabsInc/ChadGI/compare/v1.2.0...v1.3.0) (2026-01-16)


### Features

* add OpenTelemetry integration for distributed tracing and metrics ([#147](https://github.com/SwapLabsInc/ChadGI/issues/147)) ([61771e3](https://github.com/SwapLabsInc/ChadGI/commit/61771e33dbfec0086cac8916b759eb44b5756849)), closes [#137](https://github.com/SwapLabsInc/ChadGI/issues/137)

# [1.2.0](https://github.com/SwapLabsInc/ChadGI/compare/v1.1.4...v1.2.0) (2026-01-16)


### Features

* improve task templates for balanced development ([fc19418](https://github.com/SwapLabsInc/ChadGI/commit/fc1941858d72467120d60b4237c1539f981887a8))

## [1.1.4](https://github.com/SwapLabsInc/ChadGI/compare/v1.1.3...v1.1.4) (2026-01-16)


### Bug Fixes

* use azu/setup-npm-trusted-publish action for OIDC ([dd7b4b4](https://github.com/SwapLabsInc/ChadGI/commit/dd7b4b4a127f73cde7702fcd77e9e91e4fd5daea))
* use NPM_TOKEN for npm publish ([9bfeeff](https://github.com/SwapLabsInc/ChadGI/commit/9bfeeff4502818945f29ee2552bf6f5f95be03e2))

## [1.1.3](https://github.com/SwapLabsInc/ChadGI/compare/v1.1.2...v1.1.3) (2026-01-16)


### Bug Fixes

* remove registry-url and clear auth for OIDC publishing ([cb81fcd](https://github.com/SwapLabsInc/ChadGI/commit/cb81fcd50a7d94076aa52fbd17a857436c42cc6a))

## [1.1.2](https://github.com/SwapLabsInc/ChadGI/compare/v1.1.1...v1.1.2) (2026-01-16)


### Bug Fixes

* run npm publish directly in workflow for OIDC context ([7eef930](https://github.com/SwapLabsInc/ChadGI/commit/7eef930da0836f98d454922a542b9c6e7e63ee7e))

## [1.1.1](https://github.com/SwapLabsInc/ChadGI/compare/v1.1.0...v1.1.1) (2026-01-16)


### Bug Fixes

* increase timing buffer in flaky error-context test ([c0888ab](https://github.com/SwapLabsInc/ChadGI/commit/c0888ab8713b4f8aa2888291c2363518523f8b33))
* trigger release to test npm OIDC publish ([48c8135](https://github.com/SwapLabsInc/ChadGI/commit/48c8135c8ed867375fcf8a6380d24c3255ae1056))

# [1.1.0](https://github.com/SwapLabsInc/ChadGI/compare/v1.0.10...v1.1.0) (2026-01-16)


### Bug Fixes

* use exec plugin for npm publish with OIDC provenance ([b3b72bc](https://github.com/SwapLabsInc/ChadGI/commit/b3b72bcb6cb929296ea4febbd28facee04d69617))
* use npm OIDC/Trusted Publishers instead of NPM_TOKEN ([6fe3a4b](https://github.com/SwapLabsInc/ChadGI/commit/6fe3a4b9bc0b05f4bd914c2a435e2b3d72017dc8))


### Features

* add semantic-release for automated versioning and publishing ([d48cd5f](https://github.com/SwapLabsInc/ChadGI/commit/d48cd5f9fd4d9ba346389c0a8b26f85c64cfaad6))
