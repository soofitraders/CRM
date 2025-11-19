import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        sidebarBg: "var(--sidebar-bg)",
        sidebarActiveBg: "var(--sidebar-active-bg)",
        sidebarText: "var(--sidebar-text)",
        sidebarMuted: "var(--sidebar-muted)",
        pageBg: "var(--page-bg)",
        cardBg: "var(--card-bg)",
        borderSoft: "var(--border-soft)",
        headingText: "var(--heading-text)",
        bodyText: "var(--body-text)",
        success: "var(--success)",
        warning: "var(--warning)",
        danger: "var(--danger)",
      },
      borderRadius: {
        card: "18px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)",
      },
    },
  },
  plugins: [],
};
export default config;

