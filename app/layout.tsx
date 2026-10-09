import type { Metadata } from "next";
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "@fontsource/noto-sans-khmer/400.css";
import "@fontsource/noto-sans-khmer/500.css";
import "@fontsource/noto-sans-khmer/600.css";
import "@fontsource/noto-sans-khmer/700.css";
import "./globals.css";
export const metadata: Metadata = {
  title: "ប្រតិទិនសេដ្ឋកិច្ច Forex",
  description:
    "ប្រតិទិនសេដ្ឋកិច្ច Forex factory ជាភាសាខ្មែរ តាមម៉ោងកម្ពុជា។ តាមដានព្រឹត្តិការណ៍តាមកាលបរិច្ឆេទ រូបិយប័ណ្ណ ប្រទេស និងកម្រិតឥទ្ធិពល។",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="km"
      className="scroll-pt-6 scroll-smooth motion-reduce:scroll-auto"
    >
      <body className="bg-canvas font-sans text-[14px] leading-[1.8] text-ink [&_h2]:text-[16px] [&_h2]:font-semibold [&_h2]:leading-[1.8] [&_button]:cursor-pointer [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-60 [&_:is(button,a,input,select,summary)]:[-webkit-tap-highlight-color:transparent] [&_:is(button,a,input,select,summary):focus-visible]:outline-3 [&_:is(button,a,input,select,summary):focus-visible]:outline-offset-3 [&_:is(button,a,input,select,summary):focus-visible]:outline-[#4cb9a0]">
        {children}
      </body>
    </html>
  );
}
