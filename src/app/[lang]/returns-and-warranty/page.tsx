import { simplePage } from "@/components/content/simple-page";

const page = simplePage("returns", "returns", { email: true });

export const generateMetadata = page.generateMetadata;
export default page.Page;
