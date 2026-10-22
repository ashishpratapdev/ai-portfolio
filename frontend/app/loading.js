import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-16" >
      <p role="status" className="animate-pulse text-muted">Loading…</p>
    </Container>
  );
}
