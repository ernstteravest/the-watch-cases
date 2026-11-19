import { simplePage } from "@/components/content/simple-page";

const page = simplePage("configure", "configure", { link: { route: "collection", label: (t) => t.collection.title } });

export const generateMetadata = page.generateMetadata;
export default page.Page;
