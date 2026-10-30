// Re-mounts on every Studio navigation: the page content fades in while the shell stays still.
export default function StudioTemplate({ children }: { children: React.ReactNode }) {
  return <div className="fade-in">{children}</div>;
}
