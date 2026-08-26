/**
 * A stand-in for the `server-only` package while these tests run.
 *
 * That package exists to turn "this module was imported into a client bundle" into a build error.
 * There is no client bundle here: this is a node process calling server code directly, which is the
 * whole point of the suite. The real guarantee is still enforced where it matters, by `npm run
 * build`, and nothing in these tests changes that.
 */
export {};
