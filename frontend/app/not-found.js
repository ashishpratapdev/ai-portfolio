import { Container, TextLink } from "@/components/ui";

export default function NotFound() {
  return (
    <Container className="py-20">
      <h1 className="text-4xl font-bold">Page not found</h1>
      <p className="mt-4 max-w-xl text-lg text-muted">The page may have been moved, unpublished, or never existed. Try one of these instead:</p>
      <ul className="mt-6 space-y-2 text-lg">
        <li><TextLink href="/projects">Browse projects</TextLink></li>
        <li><TextLink href="/services">See services</TextLink></li>
        <li><TextLink href="/contact">Get in touch</TextLink></li>
      </ul>
    </Container>
  );
}
