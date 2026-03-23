const THEME_KEY = "ct-theme";

export function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || "dark";
}

export function setStoredTheme(theme) {
  localStorage.setItem(THEME_KEY, theme);
}

export function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}
