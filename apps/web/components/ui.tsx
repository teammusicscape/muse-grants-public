"use client";
import { useEffect, useRef, useState } from "react";
import { Info as InfoIcon, X } from "lucide-react";
import { KIND_LABEL, VERDICT_LABEL, type NoticeKind, type VerdictStatus } from "@muse/core";

export function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(" ");
}

export function KindBadge({ kind, className }: { kind: NoticeKind; className?: string }) {
  return (
    <span className={cx(`k-${kind}`, "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold leading-none bg-[var(--ks)] text-[var(--k)]", className)}>
      {KIND_LABEL[kind]}
    </span>
  );
}

const V_SHORT: Record<VerdictStatus, string> = { now: "지원 가능", prep: "준비 필요", indirect: "간접 참여", no: "불가" };
export function VerdictPill({ status, who, long }: { status: VerdictStatus; who?: string; long?: boolean }) {
  return (
    <span className={cx(`v-${status}`, "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium bg-[var(--vs)] text-[var(--v)] whitespace-nowrap")}>
      <span className="size-1.5 rounded-full bg-[var(--v)]" aria-hidden />
      {who && <span className="opacity-80">{who}</span>}
      {long ? VERDICT_LABEL[status] : V_SHORT[status]}
    </span>
  );
}

export function SourceBadge({ s }: { s: string }) {
  const ig = s === "IG";
  return (
    <span className={cx("inline-flex items-center rounded px-1.5 py-px text-[10.5px] font-medium border", ig ? "border-[color-mix(in_oklab,var(--seal)_40%,transparent)] text-seal" : "border-line text-mute")}>
      {s}
    </span>
  );
}

export function GradeBadge({ grade }: { grade: string }) {
  const map: Record<string, string> = {
    강추: "bg-seal-soft text-seal", 추천: "bg-brand-soft text-brand-ink", 검토: "bg-amber-soft text-amber", 비추: "bg-surface-2 text-faint",
  };
  return <span className={cx("rounded-md px-1.5 py-0.5 text-[11.5px] font-bold", map[grade])}>AI {grade}</span>;
}

export function Button({ variant = "default", size = "md", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "default" | "primary" | "ghost" | "soft"; size?: "sm" | "md" }) {
  return (
    <button
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50 select-none whitespace-nowrap",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-10 px-3.5 text-sm",
        variant === "primary" && "bg-brand text-white hover:bg-brand-ink dark:text-[#0f1413]",
        variant === "default" && "bg-surface border border-line-strong hover:border-ink text-ink",
        variant === "ghost" && "text-mute hover:text-ink hover:bg-surface-2",
        variant === "soft" && "bg-brand-soft text-brand-ink hover:brightness-95",
        className,
      )}
    />
  );
}

export function IconButton({ label, className, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button {...p} aria-label={label} title={label} className={cx("inline-grid place-items-center size-9 rounded-lg text-mute hover:text-ink hover:bg-surface-2 transition-colors", className)}>
      {children}
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: { value: T; label: React.ReactNode; title?: string }[]; onChange(v: T): void; className?: string }) {
  return (
    <div role="radiogroup" className={cx("inline-flex rounded-lg bg-surface-2 p-0.5", className)}>
      {options.map((o) => (
        <button
          key={o.value} role="radio" aria-checked={value === o.value} title={o.title}
          onClick={() => onChange(o.value)}
          className={cx("h-8 px-2.5 rounded-md text-[13px] font-medium inline-flex items-center gap-1.5 transition-all",
            value === o.value ? "bg-surface text-ink shadow-card" : "text-mute hover:text-ink")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** ℹ️ 도움말 메모 — 눌러야 펼쳐짐 */
export function Tip({ children, title = "도움말" }: { children: React.ReactNode; title?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  return (
    <span ref={ref} className="relative inline-flex align-middle">
      <button type="button" aria-label={title} aria-expanded={open} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="inline-grid place-items-center size-5 rounded-full text-faint hover:text-brand">
        <InfoIcon size={15} />
      </button>
      {open && (
        <span role="note" className="anim-fade absolute z-40 left-1/2 -translate-x-1/2 top-7 w-[min(280px,80vw)] rounded-xl border border-line bg-surface p-3 text-[13px] leading-relaxed text-ink shadow-pop font-normal normal-case tracking-normal">
          {children}
        </span>
      )}
    </span>
  );
}

/** 모달 / 모바일 바텀시트 */
export function Sheet({ open, onClose, title, children, wide, bare }: { open: boolean; onClose(): void; title: string; children: React.ReactNode; wide?: boolean; bare?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    const o = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", h); document.body.style.overflow = o; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 bg-black/35 anim-fade" onClick={onClose} />
      <div className={cx("anim-sheet relative w-full bg-surface shadow-pop rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        {bare ? (
          <div className="overflow-hidden rounded-t-2xl sm:rounded-2xl h-[88dvh] sm:h-[82dvh]">{children}</div>
        ) : (
          <>
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-line">
              <div className="sm:hidden absolute left-1/2 -translate-x-1/2 top-1.5 h-1 w-10 rounded-full bg-line-strong" />
              <h2 className="text-base font-bold">{title}</h2>
              <IconButton label="닫기" onClick={onClose}><X size={18} /></IconButton>
            </div>
            <div className="overflow-y-auto px-5 py-4 pb-safe">{children}</div>
          </>
        )}
      </div>
    </div>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div role="status" className="anim-sheet fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 lg:bottom-8 rounded-xl bg-ink text-bg px-4 py-2.5 text-sm font-medium shadow-pop max-w-[90vw]">
      {msg}
    </div>
  );
}

export function Empty({ icon, title, desc, action }: { icon?: React.ReactNode; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-16 px-6 rounded-2xl border border-dashed border-line-strong">
      {icon && <div className="text-faint mb-3">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {desc && <p className="text-sm text-mute mt-1 max-w-sm">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageTitle({ title, sub, right }: { title: string; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="font-serif text-[26px] lg:text-[30px] font-bold leading-tight">{title}</h1>
        {sub && <p className="text-sm text-mute mt-1">{sub}</p>}
      </div>
      {right}
    </div>
  );
}
