"use client";

export default function Error({ error, reset }) {
  return (
    <div className="theme-site flex min-h-screen items-center bg-paper text-ink">
      <div className="mx-auto max-w-xl px-6 py-20">
        <p className="eyebrow">Something went wrong</p>
        <h1 className="mt-3 text-4xl font-extrabold">This page could not load</h1>
        <p className="mt-4 text-muted" role="alert">The content service is not responding. On the free plan it sleeps when idle and needs up to a minute to wake up, so please try again in a moment.</p>
        <button className="btn btn-primary mt-6" onClick={reset}>Try again</button>
      </div>
    </div>
  );
}
