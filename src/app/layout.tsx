import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Garment ERP",
    template: "%s — Garment ERP",
  },
  description: "ERP manufaktur garmen: order-to-shipment dalam satu sistem terpusat.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  );
}
