"use client";

import { useState } from "react";
import Icon from "./Icon";

export default function CalendarHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  const timezone = (
    <span className="flex items-center gap-2 rounded-full border border-line bg-[#fbfcfc] px-3.5 py-2 text-[14px] text-[#526671]">
      <span aria-hidden="true">🇰🇭</span>
      <span>ភ្នំពេញ</span>
      <Icon name="clock" size={14} />
      <span>UTC+7</span>
    </span>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 shadow-[0_4px_18px_rgba(23,42,57,.035)] backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-8 py-4 max-[800px]:px-5 max-[560px]:gap-y-2.5 max-[560px]:px-4 max-[560px]:py-3">
        <a
          href="/"
          className="flex items-center gap-2.5 text-[19px] font-bold tracking-[-.6px] text-[#183b35]"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-brand text-white shadow-[0_5px_12px_rgba(22,130,105,.2)]">
            <Icon name="chart" size={22} />
          </span>
          <span>ប្រតិទិនសេដ្ឋកិច្ច Forex</span>
        </a>

        <button
          type="button"
          className="order-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-3 text-[14px] font-medium text-[#526671] min-[1000px]:hidden"
          aria-expanded={menuOpen}
          aria-controls="main-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <Icon name="menu" size={18} />
          Menu
        </button>

        <nav
          id="main-navigation"
          aria-label="ម៉ឺនុយចម្បង"
          className={`${menuOpen ? "flex flex-col" : "hidden"} order-4 w-full items-stretch gap-2 whitespace-nowrap min-[1000px]:order-none min-[1000px]:flex min-[1000px]:w-auto min-[1000px]:flex-row min-[1000px]:items-center`}
        >
          <a
            className="rounded-full bg-[#eaf5f0] px-4 py-2 text-[14px] font-semibold text-brand"
            href="#calendar"
            onClick={() => setMenuOpen(false)}
          >
            ប្រតិទិន
          </a>
          <a
            className="rounded-full px-4 py-2 text-[14px] text-[#63757b] transition-colors hover:bg-[#f3f7f5] hover:text-brand"
            href="#guide"
            onClick={() => setMenuOpen(false)}
          >
            របៀបអាន
          </a>
          <a
            className="rounded-full px-4 py-2 text-[14px] text-[#63757b] transition-colors hover:bg-[#f3f7f5] hover:text-brand"
            href="#data-source"
            onClick={() => setMenuOpen(false)}
          >
            ប្រភពទិន្នន័យ
          </a>
          <div className="min-[1000px]:hidden">{timezone}</div>
        </nav>

        <div className="hidden min-[1000px]:block">{timezone}</div>
      </div>
    </header>
  );
}
