// Runs before first paint. Decides whether to show the boot sequence and
// whether motion is reduced, so the first frame is already correct.
(function () {
  var root = document.documentElement;
  var reduce = false;
  try {
    var saved = localStorage.getItem("motion");
    reduce = saved ? saved === "off" : matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  root.classList.add("js");
  if (reduce) root.classList.add("reduce");
  else {
    // Hide the hero until app.js has set its intro state, with a safety net.
    root.classList.add("pending");
    setTimeout(function () { root.classList.remove("pending"); }, 3000);
  }

  var seen = false;
  try { seen = sessionStorage.getItem("booted") === "1"; } catch (e) {}
  if (!reduce && !seen) {
    root.classList.add("is-booting");
    // Safety net: if the app fails to load, never leave the overlay up.
    setTimeout(function () { root.classList.remove("is-booting"); }, 4500);
  }
})();
