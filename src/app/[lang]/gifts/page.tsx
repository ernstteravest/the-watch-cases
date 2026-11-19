import { simplePage } from "@/components/content/simple-page";

const page = simplePage("gifts", "gifts", { link: { route: "configure", label: (t) => t.nav.configure } });

export const generateMetadata = page.generateMetadata;
export default page.Page;
