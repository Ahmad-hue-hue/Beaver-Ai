// Beaver theme bootstrap — runs before first paint to avoid a light/dark flash.
// Loaded as an external script so the CSP can stay strict (script-src 'self').
(function () {
  try {
    var t = localStorage.getItem('beaver-theme');
    if (t === 'beaver' || t === 'beaver-dark') {
      document.documentElement.dataset.theme = t;
    }
  } catch (e) {
    /* storage unavailable — default theme applies */
  }
})();