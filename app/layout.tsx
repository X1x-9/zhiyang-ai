/* eslint-disable @next/next/no-page-custom-font -- root layout loads fonts once for the whole app */
import type { Metadata } from "next";
import { Providers } from "./providers";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "智养 AI — 让健康计划跟得上真实生活",
  description: "懂你的饮食、训练与日常节奏的健康生活搭子。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preload" href="/fonts/lemi-xiaoyu.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Serif+SC:wght@500;600&family=Raleway:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
