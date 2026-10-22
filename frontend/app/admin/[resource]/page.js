import { notFound } from "next/navigation";
import AdminShell from "@/components/AdminShell";
import ResourceManager from "@/components/ResourceManager";
import { RESOURCES } from "@/lib/resources";

export default async function ResourcePage({ params }) {
  const { resource } = await params;
  const config = RESOURCES[resource];
  if (!config) notFound();
  return (
    <AdminShell title={config.title}>
      <ResourceManager resource={resource} config={config} />
    </AdminShell>
  );
}
