# Streamline Settings: Relocate FSSAI License & Store Toggle, Remove Store Profile Tab

A complete architectural plan to declutter the administrative Settings panel by removing the redundant Store Profile tab, consolidating the official 14-digit FSSAI Food Safety License editor and live order acceptance toggle cleanly inside the Website & Logos tab, and preserving all database values without regression.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were clarified and confirmed during Phase 1:
>
> - **Confirmed Placement for FSSAI License**: Relocated directly inside the **Website & Logos** tab as a dedicated, official compliance card with live footer badge preview.
> - **Confirmed Placement for Live Store Toggle**: Preserved inside the **Website & Logos** tab as a prominent operational status control at the top of the tab.
> - **Confirmed Default Settings Sub-Tab**: **Website & Logos** remains the default view whenever entering the Settings view.
> - **Retained Data Guarantees**: Any backend restaurant properties previously displayed in Store Profile (store address, opening hours, contact phone, preparation minutes, min order amount) will be preserved safely in state and storage payloads so existing database configurations are never overwritten or lost.

---

### 1. Overview & Core Concept

- **What It Does**: Simplifies the administrative navigation in `PaymentSettings` by eliminating the redundant "Store Profile" tab and consolidating essential operational and compliance controls into the primary "Website & Logos" tab.
- **Target Audience / Persona**: Store owners and bakery administrators managing storefront branding, daily operational readiness, and government compliance.
- **Key Value**: Reduces clutter, eliminates unnecessary tab hopping, and presents a single, cohesive storefront identity view containing both visual branding (logos, favicons, metadata) and regulatory compliance (FSSAI license).

---

### 2. User Experience & Visual Design

- **Key User Flows**:
  1. **Entering Settings**: Administrator clicks the Settings tab in the Admin Dashboard. The system immediately presents the **Website & Logos** sub-tab.
  2. **Toggling Live Store Status**: At the top of the Website & Logos view, an operational status card displays the live order acceptance toggle with clear visual feedback (emerald when accepting orders, slate when closed).
  3. **Updating FSSAI Food Safety License**: Below the website SEO and logo controls, administrators find the official FSSAI Food Safety License card featuring the official government mark, 14-digit numeric input, and live footer badge preview.
  4. **Saving Changes**: Clicking "Save All Changes" persists both visual branding, operational status, and FSSAI license numbers in a single atomic update.

- **Visual Identity & Theme**:
  - *Aesthetic Direction*: Professional, utilitarian SaaS admin aesthetic following clean modern dashboard principles.
  - *Color Palette & Mood*: Dominant neutral slate canvas (`#FFFFFF` on `#F8FAFC`), crisp hairline borders (`border-slate-200/80`), emerald indicators for open store states (`#059669`), and rich sky/indigo accents for official regulatory badges.
  - *Typography & Hierarchy*: Sans-serif display with tabular numerals (`tabular-nums font-mono`) for the 14-digit FSSAI license number to prevent misreads.
  - *Component Styling & Layout*: Clean single-level surface elevation, generous inner padding, zero-pill metadata labels with bullet separators, and clear segmented sub-navigation.

- **Interactive Feedback & Motion**:
  - Fast, immediate state toggles with smooth pill switch transitions ($\le 150\text{ms}$).
  - Live preview badge updating character-by-character as the administrator enters or edits their 14-digit FSSAI license number.
  - Dismissible emerald success toast confirming saved changes without page reload.

---

### 3. Key Product Decisions & Trade-Offs

- **Decision 1: Relocating FSSAI License to Website & Logos**
  - *Chosen Approach*: Place the FSSAI license card directly after the Website SEO & Logo previews inside the Website & Logos tab.
  - *Why*: The FSSAI license number is rendered on the public website footer alongside the website logo and legal copyright. Grouping website legal badges with website identity creates a logical conceptual grouping.
  - *Alternatives Considered*: Placing FSSAI under Delivery & Coverage or Payments & UPI was considered, but neither relates to public website trust badges.

- **Decision 2: Preserving Underlying Restaurant Settings in State**
  - *Chosen Approach*: Retain existing state properties for contact details, opening hours, and preparation times, ensuring the `handleSave()` payload merges current database records without resetting them to empty defaults.
  - *Why*: Prevents destructive data wipes for fields whose editing UI is hidden, maintaining backward compatibility with customer-facing views that reference `settings.contactPhone` or `settings.address`.
  - *Alternatives Considered*: Dropping fields from the database would break live order receipts and customer contact displays.

- **Decision 3: Single-Row Sub-Navigation Bar Cleanliness**
  - *Chosen Approach*: Update the `SECTIONS` list from 6 items to 5 items (`Website & Logos`, `Payments & UPI`, `Delivery & Coverage`, `Email Notifications`, `Staff & Security`), removing `Store Profile`.
  - *Why*: Eliminates horizontal scrolling on medium screens and provides a balanced dock navigation.

---

### 4. Technical Architecture & Data Strategy

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Admin Dashboard (Settings)                      │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ Sub-Navigation Dock:                                           │   │
│   │ [🌐 Website & Logos] [💳 Payments] [🚚 Delivery] [📧 Email] ... │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ ACTIVE: Website & Logos Sub-Tab                                │   │
│   │                                                                │   │
│   │  1. Live Store Operational Status (Accepting Orders Toggle)   │   │
│   │  2. Floating Navbar Brand Logo (Wordmark Upload & Zoom)        │   │
│   │  3. Website & Google Search Logo (Favicon / PWA Upload)        │   │
│   │  4. Website Title & SEO Snippet Description                    │   │
│   │  5. Official FSSAI Food Safety License (14-digit input & badge)│   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│   ┌───────────────────────────┐      ┌─────────────────────────────┐   │
│   │ Atomic Save Handler       │─────▶│ Firestore / Local Persistence│   │
│   └───────────────────────────┘      └─────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

- **State Management & Data Model**:
  - `activeSection`: typed as `'website' | 'payments' | 'delivery' | 'emails' | 'security'`.
  - `isStoreOpen`: boolean toggle bound to `settings.isStoreOpen`.
  - `fssaiLicenseNumber`: string sanitized to numbers only (up to 14 digits), bound to `settings.fssaiLicenseNumber`.
  - All existing fields (`restaurantName`, `contactPhone`, `address`, `openingHours`, etc.) remain safely bound in state so saving emits full valid `RestaurantSettings` objects.

- **Interactive Component & State Mapping**:
  - `Store Accepting Orders Toggle`: Immediate visual state flip with standard accessible switch control.
  - `FSSAI License Input`: Real-time input masking (`/[^0-9]/g`) with a max length of 14 and synchronized live badge preview.
  - `Save Button`: Emits asynchronous update to `saveRestaurantSettings()`, synchronizes branding to document, and triggers parent `onUpdate`.
