import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About ✤ Fourag",
  description: "What Fourag is, who built it, and why — a public field journal for four-leaf clover finds.",
  openGraph: {
    title: "About ✤ Fourag",
    description: "What Fourag is, who built it, and why — a public field journal for four-leaf clover finds.",
  },
};

export default function AboutPage() {
  return (
    <main id="about-page" className="page">
      <h1>About</h1>
      <p className="page-subtitle">Last updated: June 2026</p>

<div className="page-sections">

  <section>
    <h2>Who?</h2>
    <p>
      Hi. I'm <a href="https://matthornsby.com" target="_blank">Matt</a>. If you have some clovers to share, <a href="/account/finds/new">please do</a>.
       If you've got some suggestions on how I can make this better, also <a href="mailto:hi@fourag.ing">please do</a>.
    </p>
  </section>

  <section>
    <h2>Why</h2>
    <p>
    I built Fourag as an excute to learn a little about React, Tailwind, and Claude Code between jobs. 
    </p>
  </section>


  <section>
    <h2>What</h2>
    <p>
      Check the <a href="https://github.com/matthornsby/fourag/blob/main/README.md" target="_blank">README</a> on <a href="https://github.com/matthornsby/fourag"  target="_blank">Github</a> to see what's what, I'll do my best to keep it accurate and up to date.
    </p>
    <p>
      There are definitely still things on my list, like completing a UI for display settings, manual location controls, and cleaning up some a lot of the Tailwind utility classes, which are, if I'm being honest, kind of gross.
    </p>
  </section>


</div>
</main>
  );
}
