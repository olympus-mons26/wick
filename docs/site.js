(function () {
  "use strict";

  const root = document.documentElement;
  const toggle = document.getElementById("theme-toggle");
  const themeColor = document.querySelector('meta[name="theme-color"]');
  const cursorGlow = document.getElementById("cursor-glow");
  const key = "wick.site-theme.v2";

  function setTheme(theme) {
    const light = theme === "light";
    root.dataset.theme = light ? "light" : "dark";
    toggle.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
    if (themeColor) themeColor.content = light ? "#f5f0e6" : "#11100f";
  }

  try {
    setTheme(localStorage.getItem(key) || "dark");
  } catch {
    setTheme("dark");
  }

  toggle.addEventListener("click", function () {
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    setTheme(theme);
    try {
      localStorage.setItem(key, theme);
    } catch {
      // Theme still changes for the current page when browser storage is unavailable.
    }
  });

  if (cursorGlow && window.matchMedia("(pointer: fine)").matches) {
    document.addEventListener("pointermove", function (event) {
      cursorGlow.style.setProperty("--pointer-x", event.clientX + "px");
      cursorGlow.style.setProperty("--pointer-y", event.clientY + "px");
      cursorGlow.classList.add("is-visible");
    }, { passive: true });
    document.addEventListener("pointerleave", function () {
      cursorGlow.classList.remove("is-visible");
    });
  }
})();
