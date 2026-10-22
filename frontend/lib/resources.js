// Field types: text | textarea | number | date | list (comma-separated) | url
export const RESOURCES = {
  skills: {
    title: "Skills",
    fields: [
      { name: "name", label: "Skill", type: "text", required: true },
      { name: "category", label: "Category", type: "text", required: true, default: "General" },
      { name: "level", label: "Level (1–5, optional)", type: "number" },
    ],
  },
  experience: {
    title: "Experience",
    fields: [
      { name: "company", label: "Company", type: "text", required: true },
      { name: "role", label: "Role", type: "text", required: true },
      { name: "location", label: "Location", type: "text" },
      { name: "start_date", label: "Start date", type: "date", required: true },
      { name: "end_date", label: "End date (blank if current)", type: "date" },
      { name: "description", label: "Description", type: "textarea", required: true },
    ],
  },
  projects: {
    title: "Projects",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "slug", label: "URL slug (auto from title if blank)", type: "text" },
      { name: "summary", label: "Summary (max 300 characters)", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", required: true },
      { name: "tech", label: "Technologies (comma-separated)", type: "list" },
      { name: "repo_url", label: "Source code URL", type: "url" },
      { name: "live_url", label: "Live site URL", type: "url" },
      { name: "cover_media_id", label: "Cover image media ID (public image)", type: "number" },
    ],
  },
  services: {
    title: "Services",
    fields: [
      { name: "title", label: "Service", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea", required: true },
      { name: "price_note", label: "Pricing note (optional)", type: "text" },
    ],
  },
};
