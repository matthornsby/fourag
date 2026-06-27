import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy ✤ Fourag",
  description: "How Fourag handles your data, photos, and location — and the privacy choices you control over each find.",
  openGraph: {
    title: "Privacy Policy ✤ Fourag",
    description: "How Fourag handles your data, photos, and location — and the privacy choices you control over each find.",
  },
};

export default function PrivacyPage() {
  return (
    <main id="privacy-page" className="page">
      <h1>Privacy Policy</h1>
      <p className="page-subtitle">Last updated: June 2026</p>

      <div className="page-sections">

        <section>
          <h2>Overview</h2>
          <p>
            Fourag is a community for sharing treasure finds. This policy explains
            what data we collect, how we handle it, and the choices you have over
            what others can see.
          </p>
        </section>

        <section>
          <h2>Location Data</h2>
          <p>
            When you add a find, Fourag reads GPS coordinates embedded in the
            photo&rsquo;s EXIF metadata and stores the precise latitude and
            longitude on our servers. What gets shared publicly depends entirely
            on the <strong>location setting</strong> you choose for that find:
          </p>
          <ul>
            <li>
              <strong>Public</strong> &mdash; the exact coordinates are visible to
              anyone viewing the find.
            </li>
            <li>
              <strong>Approximate</strong> &mdash; only a rough area (a few
              kilometres) is shown publicly. The precise location is stored but
              never exposed.
            </li>
            <li>
              <strong>Private</strong> &mdash; no location information is shown to
              other users. The stored coordinates are used only to power features
              like your personal finds map.
            </li>
          </ul>
          <p>
            If your photo has no GPS metadata, no location is recorded and the
            find defaults to private.
          </p>
        </section>

        <section>
          <h2>Image Metadata</h2>
          <p>
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
          <h2>Analytics</h2>
          <p>
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
            >
              Google Analytics Opt-out Browser Add-on
            </a>
            .
          </p>
        </section>

        <section>
          <h2>Account Data</h2>
          <p>
            We store the information you provide when creating an account: your
            username, display name, bio, and avatar. Your email address is used
            only for authentication and is never shown to other users.
          </p>
        </section>

        <section>
          <h2>Data Deletion</h2>
          <p>
            You can delete individual finds at any time from your account. You can delete your account at any time from the profile edit screen. To request the deletion of a you account if you cannot log in or to request the removal of an anonymous find, please contact us at <a href="mailto:hi@fourag.ing">hi@fourag.ing</a>.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            Questions about this policy or your data? Reach us at{" "}
            <a href="mailto:hi@fourag.ing">hi@fourag.ing</a>
            .
          </p>
        </section>

      </div>
    </main>
  );
}
