import { simplePage } from "@/components/content/simple-page";

const page = simplePage("terms", "terms", { legal: true });

export const generateMetadata = page.generateMetadata;
export default page.Page;
