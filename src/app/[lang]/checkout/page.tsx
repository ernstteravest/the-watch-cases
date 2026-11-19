import { simplePage } from "@/components/content/simple-page";

const page = simplePage("checkout", "checkout", { complete: true, link: { route: "cart", label: (t) => t.nav.cart } });

export const generateMetadata = page.generateMetadata;
export default page.Page;
