export default function manifest() {
  return {
    name: "Portugal Masters 2026",
    short_name: "Portugal Masters",
    description: "Portugal Masters 2026 — Penina, Algarve",
    start_url: "/",
    display: "standalone",
    background_color: "#07140e",
    theme_color: "#07140e",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
