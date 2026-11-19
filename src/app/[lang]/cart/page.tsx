import { simplePage } from "@/components/content/simple-page";

const page = simplePage("cart", "cart", { complete: true, link: { route: "collection", label: (t) => t.collection.title } });

export const generateMetadata = page.generateMetadata;
export default page.Page;
