import Link from "next/link";
import { featuredCategoryOptions, getCategoryMeta } from "@/lib/site";

export function PostFilters({ query = "", category = "", action = "/", categories = featuredCategoryOptions }) {
  return (
    <section className="filter-bar">
      <form className="filter-bar__form" method="GET" action={action}>
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="Search news, topics, or names"
          aria-label="Search posts"
        />
        <button type="submit" className="button button-primary">
          Search
        </button>
      </form>

      <div className="filter-bar__chips filter-bar__chips--categories">
        <Link href="/" className={`filter-chip filter-chip--category ${category ? "" : "is-active"}`}>
          All News
        </Link>
        {categories.map((item) => (
          <Link
            key={item}
            href={`/category/${item}`}
            className={`filter-chip filter-chip--category ${category === item ? "is-active" : ""}`}
            style={{ "--chip-accent": getCategoryMeta(item).accent }}
          >
            {getCategoryMeta(item).label}
          </Link>
        ))}
      </div>
    </section>
  );
}
