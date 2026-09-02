import Image from "next/image";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LoginForm } from "@/components/dashboard/LoginForm";
import { getAllPosts } from "@/lib/posts-store";
import { getCurrentUser } from "@/lib/editorial";

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
  const currentUser = await getCurrentUser();
  const posts = currentUser ? await getAllPosts() : [];

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
              <p className="brand-copy__tag">Editorial workspace</p>
            </div>
          </div>
          <h1>Publish to Century Blog</h1>
        </div>

        {currentUser ? <DashboardShell initialPosts={posts} currentUser={currentUser} /> : <LoginForm />}
      </section>
    </main>
  );
}
