// Tells the runtime types which module `exports` from "cloudflare:workers" refers to.
declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import("../src/index");
  }
}
