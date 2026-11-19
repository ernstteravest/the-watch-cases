import { simplePage } from "@/components/content/simple-page";

const page = simplePage("cookies", "cookies", { legal: true });

export const generateMetadata = page.generateMetadata;
export default page.Page;
