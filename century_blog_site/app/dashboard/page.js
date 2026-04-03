import { cookies } from "next/headers";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LoginForm } from "@/components/dashboard/LoginForm";
import { getPosts } from "@/lib/posts-store";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard",
  description: "Create and manage Century Blog posts from the admin dashboard.",
  robots: {
    index: false,
    follow: false
  }
};

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const isAuthenticated = isAdminAuthenticated(cookieStore.get("century_admin_session")?.value);
  const posts = await getPosts();

  return (
    <main className="dashboard-page">
      <section className="dashboard-panel">
        <div className="dashboard-panel__header">
          <span className="eyebrow">Admin Dashboard</span>
          <h1>Publish to Century Blog</h1>
          <p>
            Create new posts, keep the homepage fresh, and manage your editorial flow from one
            place.
          </p>
        </div>

        {isAuthenticated ? <DashboardShell initialPosts={posts} /> : <LoginForm />}
      </section>
    </main>
  );
}
