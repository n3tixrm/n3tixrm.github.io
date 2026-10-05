// Runs before first paint so an explicit theme choice never flashes.
(function () {
  document.documentElement.classList.add("js");
  try {
    var theme = localStorage.getItem("theme");
    if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
