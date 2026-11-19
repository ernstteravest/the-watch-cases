import { notFound } from "next/navigation";

/** Any unknown URL renders the site's own 404 (with header and footer). */
export default function CatchAll() {
  notFound();
}
