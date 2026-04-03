export function NewsTicker({ posts }) {
  return (
    <section className="ticker" aria-label="Trending headlines">
      <div className="ticker__label">Trending now</div>
      <div className="ticker__track">
        <div className="ticker__items">
          {[...posts, ...posts].map((post, index) => (
            <span key={`${post.slug}-${index}`} className="ticker__item">
              {post.title}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
