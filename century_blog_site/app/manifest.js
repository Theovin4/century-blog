export default function manifest() {
  return {
    name: "Century Blog",
    short_name: "Century Blog",
    description: "Century Blog covers lifestyle, health, education, and daily gist in Nigeria.",
    start_url: "/",
    display: "standalone",
    background_color: "#09090d",
    theme_color: "#09090d",
    icons: [
      {
        src: "/century-blog-logo.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
