"use client";
import { usePathname } from "next/navigation";
import AdminLayout from "@/components/AdminLayout";

// One shared shell (sidebar + panel) for every admin page except the login screen.
export default function AdminRootLayout({ children }) {
  const pathname = usePathname();
  const bare = pathname === "/admin/login";
  return <div className="theme-admin min-h-screen bg-paper text-ink">{bare ? children : <AdminLayout>{children}</AdminLayout>}</div>;
}
