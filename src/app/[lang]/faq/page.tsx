import { simplePage } from "@/components/content/simple-page";

const page = simplePage("faq", "faq", { email: true });

export const generateMetadata = page.generateMetadata;
export default page.Page;
