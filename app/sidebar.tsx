"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

const NAV = [
  { href: "/", label: "Command Centre", icon: "ti-home" },
  { href: "/ideas", label: "Ideas", icon: "ti-bulb" },
  { href: "/projects", label: "Projects", icon: "ti-folder" },
];

const SOON = [
  { label: "Library", icon: "ti-book-2" },
  { label: "Writing", icon: "ti-pencil" },
];

export function Sidebar() {
  const { status } = useSession();
  const pathname = usePathname();

  if (status !== "authenticated") return null;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href);
  }

  return (
    <div
      className="font-ui flex flex-col shrink-0"
      style={{ width: 220, background: "var(--navy)", padding: "32px 22px" }}
    >
      <div className="flex items-center gap-3 mb-12">
        <div
          className="rounded-full flex items-center justify-center"
          style={{ width: 38, height: 38, border: "1.5px solid var(--gold)" }}
        >
          <div
            className="rounded-full flex items-center justify-center"
            style={{ width: 30, height: 30, border: "0.5px solid var(--gold)" }}
          >
            <span className="font-display" style={{ color: "var(--gold)", fontSize: 15 }}>
              R
            </span>
          </div>
        </div>
        <span style={{ color: "var(--paper)", fontSize: 13, letterSpacing: "0.1em" }}>
          RESEARCH OS
        </span>
      </div>

      <div className="flex flex-col gap-1" style={{ fontSize: 14 }}>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3"
            style={{
              padding: "9px 4px 9px 14px",
              borderLeft: isActive(item.href) ? "2px solid var(--gold)" : "2px solid transparent",
              color: isActive(item.href) ? "var(--paper)" : "var(--navy-text-muted)",
            }}
          >
            <i className={`ti ${item.icon}`} style={{ fontSize: 17 }} />
            {item.label}
          </Link>
        ))}
        {SOON.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 justify-between"
            style={{ padding: "9px 4px 9px 16px", color: "var(--navy-text-dim)" }}
          >
            <span className="flex items-center gap-3">
              <i className={`ti ${item.icon}`} style={{ fontSize: 17 }} />
              {item.label}
            </span>
            <span
              style={{
                fontSize: 9,
                border: "1px solid var(--navy-line)",
                padding: "1px 6px",
                borderRadius: 8,
              }}
            >
              soon
            </span>
          </div>
        ))}
      </div>

      <div className="mt-auto text-center">
        <svg width="34" height="18" viewBox="0 0 34 18" style={{ marginBottom: 10 }}>
          <circle cx="13" cy="9" r="7" fill="none" stroke="var(--gold)" strokeWidth="1" />
          <circle cx="21" cy="9" r="7" fill="none" stroke="var(--gold)" strokeWidth="1" />
        </svg>
        <div style={{ height: 1, background: "var(--navy-line)" }} />
      </div>
    </div>
  );
}
