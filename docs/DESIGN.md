# City GPT SuperApp — UI/UX Design Spec

## Design System (inherited from City-Dash)

### Colors
```
LIGHT MODE:
  surface:           #feffd6   (cream background)
  surface-dim:       #f0f1c8   (slightly dimmer)
  surface-bright:    #fffff0   (bright cream)
  on-surface:        #383832   (dark text)
  on-surface-dim:    #6b6b60   (gray text)
  primary:           #007518   (dark green)
  primary-container: #00fc40   (neon green accent)
  secondary:         #006f7c   (teal)
  error:             #be2d06   (red)
  warning:           #ff9d00   (orange)

DARK MODE:
  surface:           #1a1a2e   (dark blue)
  surface-dim:       #16213e   (slightly lighter)
  surface-bright:    #0f3460   (brighter blue)
  on-surface:        #e0e0e0   (light text)
  on-surface-dim:    #8a8a9a   (dim text)
  primary:           #00fc40   (neon green)
  error:             #ff6b6b   (bright red)
  warning:           #ffd93d   (bright yellow)
```

### Typography
- Font: Space Grotesk (Google Fonts)
- Weights: 400 (body), 700 (bold), 900 (headings/buttons)
- Labels: uppercase, letter-spacing 0.06em
- Tag labels: 10px, 900 weight, 0.1em spacing

### Brutalist Rules
- NO border-radius anywhere: `* { border-radius: 0px !important; }`
- Asymmetric borders (letterpress): 2px top/left, 4px right/bottom
- Stamp shadows: `box-shadow: 4px 4px 0px 0px` (no blur)
- Hover: `transform: translate(-2px, -2px)` + shadow pop
- Active: `transform: translate(0, 0)` + shadow removed
- No gradients, no blur, no external UI libraries

### Core CSS Classes (reused from City-Dash)
```css
.ink-border     → asymmetric 2px/4px border
.stamp-shadow   → 4px 4px hard shadow
.tag-label      → uppercase badge (10px, 900 weight)
.dark-title-bar → black bg, white text, uppercase header
.dash-tabs      → horizontal tab container
.dash-tab       → individual tab button
.dash-tab-active → active tab (black bg, green text)
.dash-panel     → content below tabs
.suggestion-btn → action chips with hover translate
.animate-fade-up → fadeUp 0.3s entry animation
```

---

## Pages

### 1. LOGIN PAGE (`/login`)

Terminal-style boot sequence (same as City-Dash login).

```
┌─────────────────────────────────────────────────────────────┐
│  Dark background (#1a1a1a)                                   │
│                                                              │
│  ASCII "CITY AI" logo in neon green (#00fc40)                │
│  Subtitle: "AI Command Center · v1.0"                        │
│                                                              │
│  Boot animation:                                             │
│  > Connecting to LDAP .............. ESTABLISHED             │
│  > Loading agents .................. 10 FOUND                │
│  > Ready_                                                    │
│                                                              │
│  ┌─────────────────────────────────────┐                     │
│  │ USERNAME                            │  ink-border         │
│  └─────────────────────────────────────┘                     │
│  ┌─────────────────────────────────────┐                     │
│  │ PASSWORD                            │  ink-border         │
│  └─────────────────────────────────────┘                     │
│                                                              │
│  ┌─────────────────────────────────────┐                     │
│  │ > AUTHENTICATE                      │  stamp-shadow       │
│  └─────────────────────────────────────┘  neon green bg      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. DASHBOARD / HOME (`/home`)

Post-login landing page. Shows all apps as cards.

```
┌──────────────────────────────────────────────────────────────────┐
│ NAVBAR                                                           │
│ [CITY AI HUB]    [Search...]    [theme toggle] [user] [logout]  │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ TABS (dash-tabs):                                                │
│ [ALL] [AI AGENTS] [OPEN WEBUI] [TOOLS] [* FAVORITES]            │
│                                                                  │
│ SECTION: "AI AGENTS" (dark-title-bar)                            │
│                                                                  │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│ │ icon         │ │ icon         │ │ icon         │              │
│ │ APP NAME     │ │ APP NAME     │ │ APP NAME     │              │
│ │ description  │ │ description  │ │ description  │              │
│ │              │ │              │ │              │              │
│ │ [LAUNCH>]    │ │ [LAUNCH>]    │ │ [LAUNCH>]    │              │
│ │ or           │ │ [EMBED]      │ │              │              │
│ │ [OPEN EMBED] │ │              │ │              │              │
│ └──────────────┘ └──────────────┘ └──────────────┘              │
│  stamp-shadow     stamp-shadow     stamp-shadow                  │
│  ink-border       ink-border       ink-border                    │
│  hover: -2px      hover: -2px      hover: -2px                  │
│                                                                  │
│ Card grid: CSS Grid, 3 columns desktop, 2 tablet, 1 mobile      │
│ Cards sorted by sort_order from DB                               │
│ Cards filtered by user's LDAP groups                             │
│                                                                  │
│ SECTION: "OPEN WEBUI" (dark-title-bar)                           │
│ Smaller cards in a row for WebUI instances                       │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**App Card Structure:**
```
┌────────────────────────────┐
│ ┌──┐                [tag]  │  tag = EMBED or REDIRECT
│ │🤖│  APP NAME             │  icon from DB
│ └──┘                       │
│                            │
│ Short description text     │  from DB
│ from admin panel           │
│                            │
│ ┌──────────┐ ┌──────────┐ │
│ │ LAUNCH > │ │ * FAV    │ │  LAUNCH = primary button
│ └──────────┘ └──────────┘ │  FAV = toggle favorite
└────────────────────────────┘
 ████████████████████████████   stamp shadow
```

### 3. EMBED VIEW (`/embed/:slug`)

App loads inside the portal via iframe.

```
┌──────────────────────────────────────────────────────────────────┐
│ NAVBAR (same as home)                                            │
│ [< BACK] [APP NAME]                          [user] [logout]    │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │                                                              │ │
│ │  IFRAME: height = calc(100vh - navbar height)                │ │
│ │  width = 100%                                                │ │
│ │  border = none                                               │ │
│ │  src = app URL from DB                                       │ │
│ │                                                              │ │
│ │  Loading state: boot animation while iframe loads            │ │
│ │                                                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 4. ADMIN PANEL (`/admin`)

Only visible to super_admin users. Horizontal tabs (dash-tabs pattern).

```
┌──────────────────────────────────────────────────────────────────┐
│ NAVBAR + "ADMIN" badge                                           │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ TABS: [APPS] [CATEGORIES] [USERS] [ANALYTICS] [SETTINGS]        │
│                                                                  │
│ ═══════════════════════════════════════════════════════════════   │
│                                                                  │
│ TAB: APPS                                                        │
│ ┌─ dark-title-bar ────────────────────── [+ ADD APP] ──────────┐ │
│ │ REGISTERED APPS (10)                                         │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ TABLE (ink-border on rows):                                      │
│ ┌────┬────────────────┬──────────┬────────┬────────┬──────────┐ │
│ │ #  │ NAME           │ CATEGORY │ MODE   │ STATUS │ ACTIONS  │ │
│ ├────┼────────────────┼──────────┼────────┼────────┼──────────┤ │
│ │ 1  │ RO-ED CMD CTR  │ AI Agent │REDIRECT│ ACTIVE │ EDIT DEL │ │
│ │ 2  │ SCOUT RAG      │ AI Agent │ EMBED  │ ACTIVE │ EDIT DEL │ │
│ │ 3  │ DEV WEBUI      │ Open Web │REDIRECT│ DRAFT  │ EDIT DEL │ │
│ └────┴────────────────┴──────────┴────────┴────────┴──────────┘ │
│                                                                  │
│ Drag handle (≡) on left for reorder                              │
│ Status: tag-label (green=ACTIVE, yellow=DRAFT, red=DISABLED)     │
│ Mode: tag-label (REDIRECT / EMBED)                               │
│                                                                  │
│ TAB: CATEGORIES                                                  │
│ Simple CRUD: name + sort_order                                   │
│                                                                  │
│ TAB: USERS                                                       │
│ List from DB, show role, last_login                              │
│ Toggle super_admin role                                          │
│                                                                  │
│ TAB: ANALYTICS                                                   │
│ Top apps by launches, active users, recent activity              │
│                                                                  │
│ TAB: SETTINGS                                                    │
│ Portal title, logo URL, theme defaults                           │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 5. ADD/EDIT APP MODAL

Triggered by [+ ADD APP] or EDIT button.

```
┌──────────────────────────────────────────────────────────────────┐
│ dark-title-bar: "ADD NEW APP" or "EDIT APP"              [X]     │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ APP NAME *          [___________________________] ink-border      │
│ SLUG (auto)         [ro-ed-command-center_______] ink-border      │
│ APP URL *           [https://__________________] ink-border      │
│ DESCRIPTION         [___________________________] ink-border      │
│                                                                  │
│ CATEGORY *          [AI Agents         v] dropdown               │
│                                                                  │
│ LAUNCH MODE         ( ) REDIRECT — opens in new tab              │
│                     ( ) EMBED    — loads inside portal            │
│                                                                  │
│ ICON                [emoji picker or text input]                  │
│ CARD COLOR          [■ ■ ■ ■ ■ ■] color swatches                │
│                                                                  │
│ ACCESS (LDAP)       [x] all                                      │
│                     [x] pg-team                                  │
│                     [ ] ch-team                                  │
│                                                                  │
│ STATUS              ( ) ACTIVE  ( ) DRAFT  ( ) DISABLED          │
│                                                                  │
│ [TEST EMBED]            [CANCEL]  [SAVE APP]                     │
│  (only if embed)         ghost     stamp-shadow, green bg        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Responsive Breakpoints

```
Desktop:  > 1024px  → 3-column card grid, full navbar
Tablet:   768-1024  → 2-column grid, hamburger nav
Mobile:   < 768     → 1-column grid, stacked nav, embed = fullscreen
```

## Animations (from City-Dash)

```
fadeUp:        opacity 0→1, translateY 8→0, 0.3s ease-out (cards on load)
panelSlideIn:  translateX 100%→0, 0.25s ease-out (embed page transition)
headerFloat:   translateY 0→-2px→0, 3s infinite (logo)
cursorBlink:   bg opacity, 1s step-end infinite (login terminal)
bounce:        scale 0→1→0, 1.4s infinite (typing indicator)
```

## Interactions

```
Card click      → if redirect: window.open(url, '_blank')
                → if embed: navigate to /embed/:slug
Card hover      → translate(-2px, -2px) + shadow pop
Favorite toggle → POST /api/favorites, star icon fills
Search          → client-side filter on app name + description
Category tabs   → filter cards by category
Admin save      → POST/PUT to /api/admin/apps, toast notification
Theme toggle    → data-theme attribute on <html>, saved to localStorage
```
