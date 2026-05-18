export default function AuthErrorPage() {
  return (
    <main>
      <h1>Authentication error</h1>
      <p>Something went wrong during sign-in. Please try again.</p>
      <a href="/auth/sign-in">Back to sign in</a>
    </main>
  );
}
