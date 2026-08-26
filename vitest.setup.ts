import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

/**
 * Every component test unmounts what it rendered, so one test cannot see another's markup. The
 * matchers from jest-dom are what let an assertion read as "the message is visible" rather than as
 * a poke at the DOM.
 */
afterEach(() => {
  cleanup();
});
