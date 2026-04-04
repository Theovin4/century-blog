import Link from "next/link";
import { categoryOptions, getCategoryMeta } from "@/lib/site";

export function PostFilters({ query = "", category = "" }) {
  return (
    <section className="filter-bar">
      <form className="filter-bar__form" method="GET" action="/">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search posts, topics, or authors"
          aria-label="Search posts"
        />
        <button type="submit" className="button button-primary">
          Search
        </button>
      </form>

      <div className="filter-bar__chips">
        <Link href="/" className={`filter-chip ${category ? "" : "is-active"}`}>
          All posts
        </Link>
        {categoryOptions.map((item) => (
          <Link
            key={item}
            href={`/category/${item}`}
            className={`filter-chip ${category === item ? "is-active" : ""}`}
          >
            {getCategoryMeta(item).label}
          </Link>
        ))}
      </div>
    </section>
  );
}
