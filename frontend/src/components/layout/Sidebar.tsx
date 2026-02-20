'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore, Role } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { cn, formatCurrency } from '@/lib/utils';
import {
  LayoutDashboard, Users, Trophy, BarChart3, Settings,
  LogOut, ChevronLeft, ChevronRight, Zap, FileText,
  Megaphone, Image, Gamepad2, ChevronDown, ChevronUp,
  Bot, Wallet, TrendingUp, X, Menu, Ticket, Landmark, MessageCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';

/* ============================================
   TYPES
   ============================================ */

interface NavLink {
  href: string;
  label: string;
  icon: any;
  section?: string;
  children?: { href: string; label: string }[];
}

/* ============================================
   ROLE-BASED NAVIGATION CONFIG
   ============================================ */

const superAdminLinks: NavLink[] = [
  // Main
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Main' },
  { href: '/in-play', label: 'In-Play', icon: Zap, section: 'Main' },
  { href: '/matches', label: 'Matches', icon: Trophy, section: 'Main' },
  // Management
  { href: '/children', label: 'User Management', icon: Users, section: 'Management' },
  { href: '/casino', label: 'Casino', icon: Gamepad2, section: 'Management' },
  // Reports
  {
    href: '/reports', label: 'Reports', icon: BarChart3, section: 'Reports',
    children: [
      { href: '/reports/account-log', label: 'Account Log' },
      { href: '/reports/activity-log', label: 'Activity Log' },
      { href: '/reports/bet-history', label: 'Bet History' },
      { href: '/reports/profit-loss', label: 'Profit & Loss' },
      { href: '/reports/commission', label: 'Commission' },
      { href: '/reports/collection', label: 'Collection' },
      { href: '/reports/earning', label: 'Earning' },
      { href: '/reports/data-report', label: 'Data Report' },
    ],
  },
  // Admin
  { href: '/automation', label: 'Automation', icon: Bot, section: 'Admin' },
  { href: '/announcements', label: 'Announcements', icon: Megaphone, section: 'Admin' },
  { href: '/banners', label: 'Banners', icon: Image, section: 'Admin' },
  { href: '/deposits', label: 'Deposits', icon: Landmark, section: 'Admin' },
  { href: '/promo-codes', label: 'Promo Codes', icon: Ticket, section: 'Admin' },
  { href: '/settings', label: 'Settings', icon: Settings, section: 'Admin' },
];

const adminLinks: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Main' },
  { href: '/in-play', label: 'In-Play', icon: Zap, section: 'Main' },
  { href: '/matches', label: 'Matches', icon: Trophy, section: 'Main' },
  { href: '/children', label: 'User Management', icon: Users, section: 'Management' },
  { href: '/casino', label: 'Casino', icon: Gamepad2, section: 'Management' },
  {
    href: '/reports', label: 'Reports', icon: BarChart3, section: 'Reports',
    children: [
      { href: '/reports/account-log', label: 'Account Log' },
      { href: '/reports/activity-log', label: 'Activity Log' },
      { href: '/reports/bet-history', label: 'Bet History' },
      { href: '/reports/profit-loss', label: 'Profit & Loss' },
      { href: '/reports/commission', label: 'Commission' },
      { href: '/reports/collection', label: 'Collection' },
      { href: '/reports/earning', label: 'Earning' },
      { href: '/reports/data-report', label: 'Data Report' },
    ],
  },
  { href: '/automation', label: 'Automation', icon: Bot, section: 'Admin' },
  { href: '/announcements', label: 'Announcements', icon: Megaphone, section: 'Admin' },
  { href: '/banners', label: 'Banners', icon: Image, section: 'Admin' },
  { href: '/deposits', label: 'Deposits', icon: Landmark, section: 'Admin' },
  { href: '/promo-codes', label: 'Promo Codes', icon: Ticket, section: 'Admin' },
];

const agentLinks: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Main' },
  { href: '/in-play', label: 'In-Play', icon: Zap, section: 'Main' },
  { href: '/matches', label: 'Matches', icon: Trophy, section: 'Main' },
  { href: '/children', label: 'Clients', icon: Users, section: 'Management' },
  {
    href: '/reports', label: 'Reports', icon: BarChart3, section: 'Reports',
    children: [
      { href: '/reports/account-log', label: 'Account Log' },
      { href: '/reports/bet-history', label: 'Bet History' },
      { href: '/reports/profit-loss', label: 'Profit & Loss' },
      { href: '/reports/commission', label: 'Commission' },
    ],
  },
  { href: '/deposits', label: 'Deposits', icon: Landmark, section: 'Management' },
  { href: '/community', label: 'Community', icon: MessageCircle, section: 'Management' },
  { href: '/promo-codes', label: 'Promo Codes', icon: Ticket, section: 'Management' },
];

const clientLinks: NavLink[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Main' },
  { href: '/in-play', label: 'In-Play', icon: Zap, section: 'Main' },
  { href: '/matches', label: 'Matches', icon: Trophy, section: 'Main' },
  { href: '/casino', label: 'Casino', icon: Gamepad2, section: 'Main' },
  {
    href: '/reports', label: 'Reports', icon: FileText, section: 'Reports',
    children: [
      { href: '/reports/account-log', label: 'Account Log' },
      { href: '/reports/bet-history', label: 'Bet History' },
      { href: '/reports/profit-loss', label: 'Profit & Loss' },
      { href: '/reports/activity-log', label: 'Activity Log' },
    ],
  },
  { href: '/deposits', label: 'Deposit / Withdraw', icon: Landmark, section: 'Main' },
  { href: '/bank-accounts', label: 'Bank Accounts', icon: Wallet, section: 'Main' },
  { href: '/promo-codes', label: 'Redeem Code', icon: Ticket, section: 'Main' },
  { href: '/settings', label: 'Settings', icon: Settings, section: 'Main' },
];

function getLinks(role: Role): NavLink[] {
  switch (role) {
    case 'SUPER_ADMIN': return superAdminLinks;
    case 'ADMIN': return adminLinks;
    case 'AGENT': return agentLinks;
    case 'CLIENT': return clientLinks;
  }
}

/* ============================================
   SECTION LABELS
   ============================================ */

const sectionLabels: Record<string, string> = {
  Main: 'Main',
  Management: 'Management',
  Reports: 'Reports',
  Admin: 'Admin',
};

/* ============================================
   ROLE DISPLAY CONFIG
   ============================================ */

const roleConfig: Record<Role, { label: string; color: string; bgColor: string }> = {
  SUPER_ADMIN: { label: 'Super Admin', color: 'text-purple-300', bgColor: 'bg-purple-500/15' },
  ADMIN: { label: 'Admin', color: 'text-blue-300', bgColor: 'bg-blue-500/15' },
  AGENT: { label: 'Agent', color: 'text-amber-300', bgColor: 'bg-amber-500/15' },
  CLIENT: { label: 'Client', color: 'text-emerald-300', bgColor: 'bg-emerald-500/15' },
};

/* ============================================
   SIDEBAR COMPONENT
   ============================================ */

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { config } = useThemeStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

  // Auto-expand parent menus when navigating to a child route
  useEffect(() => {
    if (!user || !pathname) return;
    const navLinks = getLinks(user.role);
    const newExpanded = new Set(expandedMenus);
    navLinks.forEach((link) => {
      if (link.children) {
        const isChildActive = link.children.some((child) => pathname === child.href || pathname?.startsWith(child.href + '/'));
        if (isChildActive) {
          newExpanded.add(link.href);
        }
      }
    });
    if (newExpanded.size !== expandedMenus.size || Array.from(newExpanded).some((v) => !expandedMenus.has(v))) {
      setExpandedMenus(newExpanded);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, user]);

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close mobile sidebar on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!user) return null;

  const links = getLinks(user.role);
  const roleCfg = roleConfig[user.role];

  // Group links by section
  const sections = links.reduce<Record<string, NavLink[]>>((acc, link) => {
    const section = link.section || 'Main';
    if (!acc[section]) acc[section] = [];
    acc[section].push(link);
    return acc;
  }, {});

  const toggleMenu = (href: string) => {
    const next = new Set(expandedMenus);
    if (next.has(href)) next.delete(href);
    else next.add(href);
    setExpandedMenus(next);
  };

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + '/');

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo + Collapse Toggle */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-accent shadow-glow-purple">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-white">
              {config.siteName}
            </span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-accent shadow-glow-purple">
            <Zap className="h-4 w-4 text-white" />
          </div>
        )}
        {/* Desktop collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        {/* Mobile close */}
        <button
          onClick={() => setMobileOpen(false)}
          className="flex md:hidden h-7 w-7 items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-white hover:bg-white/[0.06] transition-all duration-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Quick Stats */}
      {!collapsed && (
        <div className="border-b border-white/[0.06] px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 border border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                <Wallet className="h-3 w-3" />
                Balance
              </div>
              <p className="mt-0.5 text-sm font-bold text-white tabular-nums">
                {formatCurrency(user.balance)}
              </p>
            </div>
            <div className="rounded-xl bg-white/[0.03] px-3 py-2.5 border border-white/[0.05]">
              <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                <TrendingUp className="h-3 w-3" />
                Exposure
              </div>
              <p className={cn(
                "mt-0.5 text-sm font-bold tabular-nums",
                user.exposure > 0 ? "text-red-400" : "text-green-400"
              )}>
                {formatCurrency(Math.abs(user.exposure))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {Object.entries(sections).map(([section, sectionLinks]) => (
          <div key={section}>
            {!collapsed && (
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                {sectionLabels[section] || section}
              </p>
            )}

            <div className="space-y-0.5">
              {sectionLinks.map((link) => {
                const active = isActive(link.href);
                const hasChildren = link.children && link.children.length > 0;
                const isExpanded = expandedMenus.has(link.href);

                // Expandable sub-menu
                if (hasChildren && !collapsed) {
                  return (
                    <div key={link.href}>
                      <button
                        onClick={() => toggleMenu(link.href)}
                        className={cn(
                          "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "nav-active text-white"
                            : "text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-white"
                        )}
                      >
                        <link.icon className={cn(
                          "h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200",
                          active ? "text-accent-light" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"
                        )} />
                        <span className="flex-1 text-left">{link.label}</span>
                        <div className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-md transition-all duration-200",
                          isExpanded ? "bg-white/[0.06]" : ""
                        )}>
                          {isExpanded
                            ? <ChevronUp className="h-3.5 w-3.5" />
                            : <ChevronDown className="h-3.5 w-3.5" />
                          }
                        </div>
                      </button>

                      {/* Sub-menu with animation */}
                      <div className={cn(
                        "overflow-hidden transition-all duration-200",
                        isExpanded ? "max-h-96 opacity-100 mt-0.5" : "max-h-0 opacity-0"
                      )}>
                        <div className="ml-4 space-y-0.5 border-l border-white/[0.06] pl-4 py-1">
                          {link.children!.map((child) => {
                            const childActive = pathname === child.href;
                            return (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={cn(
                                  "block rounded-lg px-3 py-2 text-xs font-medium transition-all duration-200",
                                  childActive
                                    ? "bg-accent/10 text-accent-light"
                                    : "text-[var(--color-text-muted)] hover:bg-white/[0.04] hover:text-[var(--color-text-secondary)]"
                                )}
                              >
                                {child.label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Collapsed parent with children: toggle on click instead of navigating
                if (hasChildren && collapsed) {
                  return (
                    <button
                      key={link.href}
                      onClick={() => toggleMenu(link.href)}
                      title={link.label}
                      className={cn(
                        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 w-full",
                        active
                          ? "nav-active text-white"
                          : "text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-white",
                        "justify-center px-0"
                      )}
                    >
                      <link.icon className={cn(
                        "h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200",
                        active ? "text-accent-light" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"
                      )} />
                    </button>
                  );
                }

                // Regular link
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    title={collapsed ? link.label : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      active
                        ? "nav-active text-white"
                        : "text-[var(--color-text-secondary)] hover:bg-white/[0.04] hover:text-white",
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <link.icon className={cn(
                      "h-[18px] w-[18px] flex-shrink-0 transition-colors duration-200",
                      active ? "text-accent-light" : "text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]"
                    )} />
                    {!collapsed && <span>{link.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User Profile + Logout */}
      <div className="border-t border-white/[0.06] px-3 py-3">
        {!collapsed && (
          <div className="mb-2.5 rounded-xl bg-white/[0.03] border border-white/[0.05] px-3 py-3">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-500 text-xs font-bold text-white shadow-md">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-[var(--color-text-muted)] truncate">
                    @{user.username}
                  </span>
                  <span className={cn(
                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider",
                    roleCfg.bgColor, roleCfg.color
                  )}>
                    {roleCfg.label}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Collapsed: show avatar only */}
        {collapsed && (
          <div className="mb-2 flex justify-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-blue-500 text-xs font-bold text-white shadow-md" title={user.name}>
              {user.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        <button
          onClick={logout}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium",
            "text-red-400/80 hover:text-red-300 hover:bg-red-500/[0.08] transition-all duration-200",
            collapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-[18px] w-[18px]" />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 flex md:hidden h-10 w-10 items-center justify-center rounded-xl bg-glass-light backdrop-blur-xl border border-glass-border shadow-glass-sm text-white hover:bg-glass-heavy transition-all duration-200"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="sidebar-overlay md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[272px] md:hidden",
          "backdrop-blur-2xl border-r border-white/[0.06]",
          "transition-transform duration-300 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ background: 'var(--gradient-sidebar)' }}
      >
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col flex-shrink-0 h-screen sticky top-0",
          "backdrop-blur-2xl border-r border-white/[0.06]",
          "transition-all duration-300 ease-out",
          collapsed ? "w-[72px]" : "w-[272px]"
        )}
        style={{ background: 'var(--gradient-sidebar)' }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
