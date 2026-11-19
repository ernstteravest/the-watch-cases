import { simplePage } from "@/components/content/simple-page";

const page = simplePage("jewellers", "jewellers", { email: true });

export const generateMetadata = page.generateMetadata;
export default page.Page;
