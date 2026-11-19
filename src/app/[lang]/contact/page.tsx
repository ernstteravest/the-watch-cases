import { simplePage } from "@/components/content/simple-page";

const page = simplePage("contact", "contact", { email: true, complete: true });

export const generateMetadata = page.generateMetadata;
export default page.Page;
