import { simplePage } from "@/components/content/simple-page";

const page = simplePage("business", "business", { email: true });

export const generateMetadata = page.generateMetadata;
export default page.Page;
