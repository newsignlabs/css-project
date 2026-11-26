// Themes made with create_theme, by themeId, for the rest of a session (specs/003 US4): generate_css and build_page
// accept `theme: { themeId }`. Each server instance owns one store, so ids never leak between sessions; the lib
// functions fall back to a process-wide store when called directly.

export interface StoredTheme {
  name: string;
  css: string;
  colorScheme: "light" | "dark" | "both";
}

/** A small least-recently-used map: the oldest theme is dropped once `limit` are held. */
export class ThemeStore {
  private readonly themes = new Map<string, StoredTheme>();
  constructor(private readonly limit = 100) {}

  get(id: string): StoredTheme | undefined {
    const theme = this.themes.get(id);
    if (theme) {
      this.themes.delete(id);
      this.themes.set(id, theme);
    }
    return theme;
  }

  set(id: string, theme: StoredTheme): void {
    this.themes.delete(id);
    this.themes.set(id, theme);
    while (this.themes.size > this.limit) {
      const oldest = this.themes.keys().next().value;
      if (oldest === undefined) break;
      this.themes.delete(oldest);
    }
  }

  get size(): number {
    return this.themes.size;
  }
}

export const defaultThemes = new ThemeStore();
