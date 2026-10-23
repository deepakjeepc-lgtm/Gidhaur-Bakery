# Luxury Architectural Admin Panel & Staff Portals

Upgrade the Admin Panel, Staff Login, Kitchen Display, Preparing Portal, and Delivery Rider Portal with a high-precision, luxury architectural interface built on geometric sans-serif typography (`Plus Jakarta Sans`), strict tracking hierarchy, tabular numerals, sharp `0px–2px` border geometry, and a dual-theme palette (`#0A0A0C` OLED Dark Mode default with an instant `#FAFAFA` Architectural Paper Light Mode toggle).

## User Review & Critical Decisions

> [!IMPORTANT]
> All confirmed design and scope choices from your responses have been locked into this plan. No Storefront customer views, Firestore read/write guards, or backend business logic will be altered.

- **Confirmed Color Mode**: Default **Dark Mode (`#0A0A0C` Rich OLED Black)** with a persistent **Light/Dark Theme Toggle** switching seamlessly to **Architectural Paper Light Mode (`#FAFAFA` canvas / `#FFFFFF` cards)**.
- **Confirmed Screen Scope**: Applied uniformly across **Admin Dashboard** (Orders, Catalog, Stock, Categories, Extras, Staff, History, Settings), **Staff Login**, **Kitchen Display**, **Preparing & Packing Portal**, and **Delivery Rider Portal**.
- **Confirmed Typography Scope**: Strictly apply UI Typography & Geometry rules (Sections 1, 2.A–2.D, and 3) across all Admin and Staff screens, omitting A4 academic print rules (Section 2.E).

---

## 1. Overview & Core Concept

- **What It Does**: Transforms the operational consoles of Swadeep Cake Shop & Restaurant into a luxury architectural command center with crisp legibility, zero-lag transitions, and disciplined typographic contrast.
- **Target Audience / Persona**: Store administrators, kitchen chefs, preparing/packing staff, and delivery riders operating in high-tempo environments who need instant visual scannability across mobile and desktop screens.
- **Key Value**: Eliminates visual clutter, cramped bold text, rounded pill noise, and inconsistent font weights by enforcing a systematic 4-tier typographic scale and high-contrast surface hierarchy in both OLED Dark and Architectural Paper Light themes.

---

## 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Staff Authentication**: Minimalist architectural login card featuring only the ID input, Password input, and solid high-contrast Login button (`#FFFFFF` on `#0A0A0C` in Dark Mode; `#111111` on `#FFFFFF` in Light Mode) with a 1-minute lockout countdown after every 3 failed attempts.
  2. **Admin Console & Sub-Views**: Instant 0ms tab switching across Live Orders, Product Catalog, Stock Inventory, Staff Management, Order Archive, and Payment/Store Settings, plus a header toggle to switch between OLED Dark Mode and Architectural Paper Light Mode at any time.
  3. **Kitchen, Preparing & Delivery Portals**: Unified architectural header, sharp bordered order cards, tabular-numeral timers/amounts, and high-contrast status action buttons.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: High-precision architectural console — sharp `0px` to `2px` square corners, crisp `1px solid` structural hairlines, generous vertical breathing room, zero fuzzy drop-shadows, and zero rounded pill capsules.
  - *Color Palette & Mood*:
    - **Dark Mode (Default)**:
      - Canvas Background (`--admin-bg`): `#0A0A0C` (Rich OLED Black)
      - Card / Surface Background (`--admin-surface`): `#141418` & `#18181D`
      - Structural Borders (`--admin-border`): `#26262B` & `#2E2E36`
      - Primary Typography (`--admin-text`): `#FFFFFF` & `#F5F5F7`
      - Micro Label / Muted Typography (`--admin-muted`): `#A1A1AA`
      - Primary CTA Button: `#FFFFFF` background with `#111111` text
    - **Light Mode (Toggleable)**:
      - Canvas Background (`--admin-bg`): `#FAFAFA` (Architectural Paper Off-White)
      - Card / Modal Surface (`--admin-surface`): `#FFFFFF`
      - Structural Borders (`--admin-border`): `#E5E5E0` & `#D4D4D0`
      - Primary Typography (`--admin-text`): `#111111`
      - Micro Label / Muted Typography (`--admin-muted`): `#71717A`
      - Primary CTA Button: `#111111` background with `#FFFFFF` text
    - **Semantic & Accent Highlights**:
      - Deep Architectural Red (`#CC0000`) for critical alerts, lockouts, and high-priority indicators
      - Warm Gold Amber (`#B45309`) for pending/attention states and active highlights
  - *Typography & Hierarchy*:
    - **Primary Sans-Serif**: `"Plus Jakarta Sans", system-ui, -apple-system, sans-serif` (with `Inter, Helvetica, Arial, sans-serif` fallback).
    - **Tabular Numeric Discipline**: `font-variant-numeric: tabular-nums` enforced globally on all currency values (`₹`), order IDs, timestamps, phone numbers, stock quantities, and counters.
    - **Tier A — Micro Labels, Section Headers & Eyebrows**: `UPPERCASE`, `font-weight: 700/800`, `10px–11px`, extended letter-spacing `+0.18em` (`0.16em–0.22em`), muted zinc (`#71717A` Light / `#A1A1AA` Dark) for input labels, table headers, and section tags.
    - **Tier B — Component Titles & Card Headings**: `UPPERCASE` or clean Sentence Case, `font-weight: 700`, `12px–14px`, moderate tracking `+0.08em` to `+0.12em`, high-contrast `#111111` (Light) / `#FFFFFF` (Dark).
    - **Tier C — Input Fields & Dropdowns**: `12px–13px`, `font-weight: 600` (SemiBold), background `#FAFAFA` (Light) / `#18181D` (Dark), `1px solid` border `#D4D4D0` (Light) / `#2E2E36` (Dark), text `#111111` / `#F5F5F7`, placeholder `#A1A1AA`.
    - **Tier D — Action Buttons & CTA Badges**: Sharp `0px` border-radius, `UPPERCASE`, `font-weight: 700`, `11px–12px`, wide tracking `+0.16em` to `+0.18em`, solid high-contrast fill (`#111111` in Light Mode / `#FFFFFF` in Dark Mode).

- **Interactive Feedback & Motion**:
  - Instant `0ms` view and tab switching inside the Admin and Staff portals to preserve zero-lag responsiveness.
  - Instant theme switching persisted in `localStorage` (`swadeep_admin_theme`) so the chosen Light or Dark mode remains active across sessions.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: CSS Custom Properties Scoped to `.admin-curator-console`**
  - *Chosen Approach*: Define semantic architectural CSS variables (`--admin-bg`, `--admin-surface`, `--admin-input`, `--admin-border`, `--admin-text`, `--admin-muted`, `--admin-cta-bg`, `--admin-cta-text`, `--admin-accent-red`, `--admin-accent-amber`) on `.admin-curator-console` with `[data-admin-theme="light"]` and `[data-admin-theme="dark"]` selectors, plus automatic class mapping for all Admin/Staff child views.
  - *Why*: Ensures 100% visual consistency across all 19 Admin sub-screens and 3 Staff portals while keeping the customer Storefront completely isolated and untouched.
  - *Alternatives Considered*: Hardcoding separate ternary class strings in every sub-component, which adds unnecessary code bloat and risks missed borders or labels.

- **Decision 2: Strict Zero-Read/Write Frontend Isolation**
  - *Chosen Approach*: Keep all typography, layout, and theme state strictly within the presentation layer and `localStorage`.
  - *Why*: Respects the project's strict loop and spike immunity directives—zero extra Firestore reads, writes, or listeners.

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

- **Architecture & Component Diagram**:

```
┌───────────────────────────────────────────────────────────────────────────┐
│                .admin-curator-console [data-admin-theme]                  │
│   Typography Engine ("Plus Jakarta Sans" + tabular-nums + Tracking Tiers) │
│   Theme Tokens: Dark (#0A0A0C / #141418) <─> Light (#FAFAFA / #FFFFFF)    │
└─────────────────────────────────────┬─────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┼─────────────────────────────┐
        ▼                             ▼                             ▼
┌───────────────────┐       ┌───────────────────┐       ┌───────────────────┐
│    Staff Login    │       │  Admin Dashboard  │       │   Staff Portals   │
│  - ID Input       │       │  - Theme Toggle   │       │  - Kitchen View   │
│  - Password Input │       │  - Live Orders    │       │  - Preparing View │
│  - Solid CTA Btn  │       │  - Catalog & Form │       │  - Delivery View  │
│  - 3-Try Lockout  │       │  - Stock & Staff  │       │  - Sharp Cards &  │
│    (60s Timer)    │       │  - Archive & Pay  │       │    Tabular Timers │
└───────────────────┘       └───────────────────┘       └───────────────────┘
```

- **Data Model & State**:
  - `adminTheme`: `'dark' | 'light'` stored in `localStorage` (`swadeep_admin_theme`), defaulting to `'dark'` (`#0A0A0C` OLED Black) and toggled via a dedicated header button across Admin and Staff portals.
  - Typographic utility classes and scoped architectural rules applied to labels (`label`), headings (`h1–h4`), inputs (`input`, `select`, `textarea`), buttons (`button`), and numeric displays (`.font-mono`, `.font-price`, `.font-amount`, `.tabular-nums`).

- **Interactive Component & State Mapping**:
  - **Theme Toggle Control**: Clicking the Light/Dark button in the Admin or Staff Portal header flips `data-admin-theme` between `"dark"` and `"light"` in 0ms and persists the choice in `localStorage`.
  - **Form & Filter Controls**: All inputs, dropdowns, search bars, and category/stock editors inherit the exact `#FAFAFA` / `#18181D` background, `1px solid` `#D4D4D0` / `#2E2E36` border, `12px–13px` `600` SemiBold text, and `+0.18em` uppercase field labels.
  - **Primary Action Buttons**: Primary submit/confirm buttons render with sharp square edges, `+0.16em` uppercase bold typography, and solid `#FFFFFF` (Dark) / `#111111` (Light) contrast.
