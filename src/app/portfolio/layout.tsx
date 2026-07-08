import type { Metadata } from "next";
import type { ReactNode } from "react";
import { siteName, siteUrl } from "../seo";

const title = "Portfolio";
const description =
  "Selected cinematic editing work by Krishnaprasath for fashion, jewelry, and social-first brands.";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/portfolio",
  },
  openGraph: {
    type: "website",
    url: `${siteUrl}/portfolio`,
    siteName,
    title: `${title} | ${siteName}`,
    description,
  },
  twitter: {
    card: "summary",
    title: `${title} | ${siteName}`,
    description,
  },
};

export default function PortfolioLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
