import Image from "next/image";
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
          <div className="brand-lockup dashboard-brand-lockup">
            <div className="brand-mark dashboard-brand-mark">
              <Image
                src="/century-blog-logo.png"
                alt="Century Blog logo"
                width={120}
                height={120}
                priority
                className="brand-mark__image"
              />
            </div>
            <div className="brand-copy">
              <span className="eyebrow eyebrow-brand">Admin Dashboard</span>
              <p className="brand-copy__tag">Manage stories, uploads, and publishing flow</p>
            </div>
          </div>
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
