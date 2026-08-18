import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function PublicPageLayout({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Header />
      <main className="flex-1 px-4 py-12 sm:px-6 md:py-16">
        <article className="mx-auto max-w-4xl rounded-2xl border bg-background p-6 shadow-sm sm:p-10">
          {eyebrow && <p className="text-xs font-bold uppercase tracking-[.18em] text-primary">{eyebrow}</p>}
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{title}</h1>
          <div className="prose prose-slate mt-8 max-w-none prose-headings:font-bold prose-a:text-primary">{children}</div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
