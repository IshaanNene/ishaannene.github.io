import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-cream p-6">
      <div className="nb-panel max-w-md p-8">
        <p className="mono-label text-ink/50">404 · Off the map</p>
        <h1 className="mt-4 text-5xl font-bold">Lost at sky.</h1>
        <p className="mt-3 text-ink/70">This island doesn&apos;t exist (yet).</p>
        <Link href="/" className="nb-btn nb-btn--dark mt-6">
          Back to the archipelago
        </Link>
      </div>
    </main>
  );
}
