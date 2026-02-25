"use client";

import { Link } from "@heroui/react";

function AceAILogo() {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M16 2L28.5 9V23L16 30L3.5 23V9L16 2Z"
          fill="url(#aceai-grad)"
        />
        <path
          d="M16 8L22 22H18.5L17.2 18.5H14.8L13.5 22H10L16 8Z"
          fill="white"
          opacity="0.95"
        />
        <path d="M15.1 15.5H16.9L16 12.5L15.1 15.5Z" fill="url(#aceai-grad)" />
        <circle cx="23" cy="9.5" r="1.8" fill="#60efff" opacity="0.9" />
        <defs>
          <linearGradient
            id="aceai-grad"
            x1="3.5"
            y1="2"
            x2="28.5"
            y2="30"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#6366f1" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>

      <span
        className="text-xl font-black"
        style={{
          fontFamily: "'DM Sans', sans-serif",
          letterSpacing: "-0.04em",
        }}
      >
        <span className="text-white">ace</span>
        <span
          className="bg-clip-text text-transparent"
          style={{
            backgroundImage: "linear-gradient(135deg, #6366f1, #06b6d4)",
          }}
        >
          ai
        </span>
      </span>
    </div>
  );
}

export default function AppNavbar() {
  return (
    <>
      <header className="sticky top-0 z-50 w-full ">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="no-underline">
              <AceAILogo />
            </Link>

            <div className="flex items-center gap-3"></div>
          </div>
        </div>
      </header>
    </>
  );
}
