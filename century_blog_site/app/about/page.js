export const metadata = {
  title: "About",
  description:
    "Learn about Century Blog, a Nigerian digital publication covering lifestyle, health, education, and daily gist."
};

export default function AboutPage() {
  return (
    <main className="page-shell legal-page">
      <section className="legal-card">
        <span className="eyebrow">About Century Blog</span>
        <h1>Stories that feel close to everyday life in Nigeria</h1>
        <p>
          Century Blog is a modern Nigerian blog built to cover lifestyle, health, education, and
          daily gist with a clean reading experience and clear editorial presentation.
        </p>
        <p>
          We publish stories that matter to students, families, professionals, and curious readers
          who want practical updates, cultural conversations, and useful explainers in one place.
        </p>
        <p>
          Our goal is simple: make important stories easier to understand, easier to discover, and
          more enjoyable to read on mobile and desktop.
        </p>
      </section>
    </main>
  );
}
