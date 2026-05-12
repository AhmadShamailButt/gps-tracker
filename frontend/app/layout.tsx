import type { Metadata } from "next";
import { DM_Sans, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import BreachTracker from "@/components/BreachTracker";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans-loaded",
  display: "swap",
});

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display-loaded",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GPS Tracker · Live geofence dashboard",
  description:
    "ESP32 + Azure IoT Hub + Mosquitto + Leaflet. Live GPS tracking with geofence alerts and AI anomaly detection.",
};

const themeBootstrap = `
(function(){try{
  var s=localStorage.getItem('gps-tracker-theme');
  var prefers=window.matchMedia('(prefers-color-scheme: dark)').matches;
  var t=s||(prefers?'dark':'light');
  if(t==='dark') document.documentElement.classList.add('dark');
}catch(e){}})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="font-sans">
        <ThemeProvider>
          <BreachTracker />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
