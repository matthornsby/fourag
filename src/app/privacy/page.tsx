export default function PrivacyPage() {
  return (
    <main id="privacy-page" className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-12">
      <h1 className="text-serif" style={{ fontSize: "var(--text-5xl)", lineHeight: "var(--text-5xl--line-height)", marginBottom: "calc(var(--spacing) * 2)" }}>Privacy Policy</h1>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", marginBottom: "calc(var(--spacing) * 12)" }}>Last updated: June 2026</p>

      <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--spacing) * 12)" }}>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "calc(var(--spacing) * 4)" }}>Overview</h2>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            Fourag is a community for sharing treasure finds. This policy explains
            what data we collect, how we handle it, and the choices you have over
            what others can see.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "calc(var(--spacing) * 4)" }}>Location Data</h2>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7, marginBottom: "calc(var(--spacing) * 4)" }}>
            When you add a find, Fourag reads GPS coordinates embedded in the
            photo&rsquo;s EXIF metadata and stores the precise latitude and
            longitude on our servers. What gets shared publicly depends entirely
            on the <strong style={{ color: "var(--color-text-primary)" }}>location setting</strong> you choose for that find:
          </p>
          <ul style={{ display: "flex", flexDirection: "column", gap: "calc(var(--spacing) * 3)", paddingLeft: "calc(var(--spacing) * 6)" }}>
            <li style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--color-text-primary)" }}>Public</strong> &mdash; the exact coordinates are visible to
              anyone viewing the find.
            </li>
            <li style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--color-text-primary)" }}>Approximate</strong> &mdash; only a rough area (a few
              kilometres) is shown publicly. The precise location is stored but
              never exposed.
            </li>
            <li style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
              <strong style={{ color: "var(--color-text-primary)" }}>Private</strong> &mdash; no location information is shown to
              other users. The stored coordinates are used only to power features
              like your personal finds map.
            </li>
          </ul>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7, marginTop: "calc(var(--spacing) * 4)" }}>
            If your photo has no GPS metadata, no location is recorded and the
            find defaults to private.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "calc(var(--spacing) * 4)" }}>Image Metadata</h2>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            Before your photo is uploaded to our servers, Fourag strips all EXIF
            and other embedded metadata from the image file. This means the copy
            of your photo we store &mdash; and the copy other users see &mdash;
            contains no camera model, timestamp, GPS coordinates, or any other
            technical metadata. Location coordinates are extracted first and saved
            separately (subject to your location setting above), then discarded
            from the image itself.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "calc(var(--spacing) * 4)" }}>Analytics</h2>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            Fourag uses Google Analytics to understand how the site is used in
            aggregate. When analytics is active, Google collects standard usage
            data including pages visited, time spent, general geographic region
            (derived from your IP address, not from find location data), device
            type, and browser. This data is processed by Google under their own
            privacy policy and is used solely to help us improve the product. We
            do not sell or share analytics data with third parties beyond
            Google&rsquo;s own processing. You can opt out using standard browser
            mechanisms such as the{" "}
            <a
              href="https://tools.google.com/dlpage/gaoptout"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--color-accent)", textDecoration: "underline" }}
            >
              Google Analytics Opt-out Browser Add-on
            </a>
            .
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "calc(var(--spacing) * 4)" }}>Account Data</h2>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            We store the information you provide when creating an account: your
            username, display name, bio, and avatar. Your email address is used
            only for authentication and is never shown to other users.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "calc(var(--spacing) * 4)" }}>Data Deletion</h2>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            You can delete individual finds at any time from your account. To
            request deletion of your entire account and all associated data,
            contact us at the address below.
          </p>
        </section>

        <section>
          <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, marginBottom: "calc(var(--spacing) * 4)" }}>Contact</h2>
          <p style={{ color: "var(--color-text-secondary)", lineHeight: 1.7 }}>
            Questions about this policy or your data? Reach us at{" "}
            <a
              href="mailto:hello@fourag.com"
              style={{ color: "var(--color-accent)", textDecoration: "underline" }}
            >
              hello@fourag.com
            </a>
            .
          </p>
        </section>

      </div>
    </main>
  );
}
