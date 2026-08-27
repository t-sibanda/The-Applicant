/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#ff6b35",
          dark: "#e05320",
          light: "#fff1ea",
        },
      },
      boxShadow: {
        card: "0 1px 3px rgba(15,23,42,0.04)",
        lift: "0 8px 24px rgba(15,23,42,0.08)",
      },
    },
  },
  plugins: [],
};
