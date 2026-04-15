import Link from "next/link";
import { getCategoryMeta, featuredCategoryOptions, getPostTypeMeta, postTypeOptions } from "@/lib/site";

export function PostFilters({ query = "", category = "", postType = "", action = "/" }) {
  return (
    <section className="filter-bar">
      <form className="filter-bar__form" method="GET" action={action}>
        {category ? <input type="hidden" name="category" value={category} /> : null}
        {postType ? <input type="hidden" name="type" value={postType} /> : null}
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
        <Link href={action === "/" ? "/" : action} className={`filter-chip ${category ? "" : "is-active"}`}>
          All categories
        </Link>
        {featuredCategoryOptions.map((item) => (
          <Link
            key={item}
            href={`/category/${item}${postType ? `?type=${encodeURIComponent(postType)}` : ""}`}
            className={`filter-chip ${category === item ? "is-active" : ""}`}
          >
            {getCategoryMeta(item).label}
          </Link>
        ))}
      </div>

      <div className="filter-bar__chips filter-bar__chips--secondary">
        <Link
          href={category ? `/category/${category}` : "/"}
          className={`filter-chip ${postType ? "" : "is-active"}`}
        >
          All posts
        </Link>
        {postTypeOptions.map((item) => {
          const href = category
            ? `/category/${category}?type=${encodeURIComponent(item)}`
            : `/?type=${encodeURIComponent(item)}`;

          return (
            <Link key={item} href={href} className={`filter-chip ${postType === item ? "is-active" : ""}`}>
              {getPostTypeMeta(item).label}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
