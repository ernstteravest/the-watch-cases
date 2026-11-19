import { simplePage } from "@/components/content/simple-page";

const page = simplePage("privacy", "privacy", { legal: true });

export const generateMetadata = page.generateMetadata;
export default page.Page;
