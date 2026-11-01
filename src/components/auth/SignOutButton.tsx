/** Sign out is a POST so a link or prefetch can never sign someone out. */
export function SignOutButton({ className, label = "Sign out", style }: { className: string; label?: string; style?: React.CSSProperties }) {
  return (
    <form action="/auth/signout" method="post" style={{ display: "contents" }}>
      <button type="submit" className={className} style={style}>{label}</button>
    </form>
  );
}
