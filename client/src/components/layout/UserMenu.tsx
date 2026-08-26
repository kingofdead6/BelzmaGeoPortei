import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Shield, ShieldCheck, User as UserIcon } from "lucide-react";
import { useAuthStore } from "../../stores/auth-store";
import { useLogout } from "../../lib/auth";
import { clsx } from "../../lib/clsx";

export function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const restoring = useAuthStore((state) => state.restoring);
  const hasRole = useAuthStore((state) => state.hasRole);
  const logout = useLogout();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent): void => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (restoring) {
    return <span className="h-11 w-24" aria-hidden />;
  }

  if (!user) {
    return (
      <Link
        to="/connexion"
        className="flex min-h-[44px] shrink-0 items-center rounded-control border border-forest-light/40 px-3 text-sm text-paper no-underline transition-colors duration-quick hover:bg-forest/30"
      >
        Se connecter
      </Link>
    );
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-[44px] items-center gap-2 rounded-control px-2 text-sm text-paper transition-colors duration-quick hover:bg-forest/30"
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-paper">
            <UserIcon className="h-4 w-4" aria-hidden />
          </span>
        )}
        <span className="hidden max-w-[10rem] truncate sm:block">{user.displayName}</span>
        <ChevronDown className="h-4 w-4" aria-hidden />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-[1100] mt-1 w-60 overflow-hidden rounded-card border border-forest-light/30 bg-paper shadow-raised"
        >
          <div className="border-b border-forest-light/25 px-4 py-3">
            <p className="truncate text-sm font-medium text-forest-deep">{user.displayName}</p>
            <p className="datum truncate text-2xs text-ink/55">{user.email}</p>
            {user.role !== "user" ? (
              <p className="mt-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-earth">
                {user.role === "admin" ? "Administration" : "Modération"}
              </p>
            ) : null}
          </div>

          <MenuLink to="/mon-espace" icon={UserIcon} onSelect={() => setOpen(false)}>
            Mon espace
          </MenuLink>
          <MenuLink to="/mon-espace/profil" icon={UserIcon} onSelect={() => setOpen(false)}>
            Mon profil
          </MenuLink>

          {hasRole("moderator") ? (
            <MenuLink to="/moderation" icon={ShieldCheck} onSelect={() => setOpen(false)}>
              File de modération
            </MenuLink>
          ) : null}

          {hasRole("admin") ? (
            <MenuLink to="/admin" icon={Shield} onSelect={() => setOpen(false)}>
              Administration
            </MenuLink>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={async () => {
              setOpen(false);
              await logout.mutateAsync();
              navigate("/");
            }}
            className="flex min-h-[44px] w-full items-center gap-2.5 border-t border-forest-light/25 px-4 text-left text-sm text-ink hover:bg-sand"
          >
            <LogOut className="h-4 w-4 text-ink/55" aria-hidden />
            Me déconnecter
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({
  to,
  icon: Icon,
  onSelect,
  children,
}: {
  to: string;
  icon: typeof UserIcon;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onSelect}
      className={clsx(
        "flex min-h-[44px] items-center gap-2.5 px-4 text-sm text-ink no-underline hover:bg-sand",
      )}
    >
      <Icon className="h-4 w-4 text-ink/55" aria-hidden />
      {children}
    </Link>
  );
}
