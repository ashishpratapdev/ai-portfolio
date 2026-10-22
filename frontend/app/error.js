"use client";
import { Container } from "@/components/ui";

export default function Error({ error, reset }) {
  return (
    <Container className="py-16">
      <h1 className="text-3xl font-bold">This page could not load</h1>
      <p className="mt-3 text-muted" role="alert">{error?.message || "The content service is not responding."}</p>
      <button className="btn mt-6" onClick={reset}>Try again</button>
    </Container>
  );
}
