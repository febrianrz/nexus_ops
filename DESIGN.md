---
name: NexusOps
description: Compact operational workspace for human and agent collaboration
colors:
  bg: "#111214"
  sidebar: "#151618"
  surface: "#191a1d"
  surface-raised: "#1e1f23"
  surface-hover: "#25262a"
  border: "#2b2c30"
  border-subtle: "#232428"
  text: "#ececef"
  secondary: "#a0a1a9"
  muted: "#8b8d96"
  lime: "#d3ed97"
  lime-dim: "#222a1c"
  amber: "#e3bd78"
  violet: "#b5a2e7"
  blue: "#93b2e9"
  red: "#e29498"
  light-bg: "#f8f9f6"
  light-sidebar: "#f0f1ed"
  light-surface: "#fff"
  light-surface-raised: "#f4f5f1"
  light-surface-hover: "#e7e9e2"
  light-border: "#d7dad1"
  light-border-subtle: "#e4e6de"
  light-text: "#24281f"
  light-secondary: "#5c6356"
  light-muted: "#606858"
  light-lime: "#456c13"
  light-lime-dim: "#e7efd9"
  light-amber: "#946514"
  light-violet: "#7653b0"
  light-blue: "#3d69ae"
  light-red: "#ad4049"
typography:
  headline:
    fontFamily: "DM Sans, Arial, sans-serif"
    fontSize: "27px"
    fontWeight: 550
    lineHeight: 1.3
    letterSpacing: "-0.85px"
  body:
    fontFamily: "DM Sans, Arial, sans-serif"
    fontSize: "13px"
  label:
    fontFamily: "IBM Plex Mono, monospace"
rounded:
  keyboard: "4px"
  control: "6px"
  avatar: "7px"
  card: "8px"
  popover: "10px"
spacing:
  control-gap: "8px"
  column-gap: "15px"
  form-padding: "24px"
components:
  button-primary:
    backgroundColor: "{colors.lime}"
    textColor: "#263415"
    rounded: "{rounded.control}"
    padding: "0 12px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 12px"
  task-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.card}"
  input:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "11px 12px"
  auth-input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px 13px"
    height: "43px"
  auth-submit:
    backgroundColor: "{colors.lime}"
    textColor: "#263415"
    rounded: "{rounded.control}"
    width: "100%"
    height: "43px"
---
# Design System: NexusOps

## Overview

**Creative North Star: "The Human-Agent Relay"**

The user-pinned Linear/Raycast-inspired direction is a compact operational workspace: restrained dark surfaces, clear borders, lime execution cues and amber requests for human attention. Light mode preserves the same hierarchy with explicit surface and text overrides.

The implemented code is the visual authority; there is no approved image comp. Human-agent context relay is the signature: ownership, delegation depth, live execution and human approval remain visible inside the work.

**Key Characteristics:**
- Compact operational chrome with a clear content hierarchy.
- Sans-serif task content paired with monospace identifiers and telemetry.
- Purposeful spring movement that explains delegation and state changes.

## Colors

The frontmatter records the exact CSS palette: unprefixed keys are dark mode, and `light-` keys are the light-theme overrides. `app/globals.css` remains the implementation source of truth.

### Primary

Lime marks primary actions, live execution, selected navigation and successful completion. Its dim companion supports quiet accent backgrounds.

### Secondary

Amber marks human attention, security identity and circuit-breaker warnings. Violet identifies triage actors and queued work; blue identifies QA. Red supports error and bug semantics.

### Neutral

Canvas, sidebar, surface, raised and hover tones form the workspace layers. Border and subtle-border tones separate those layers. Text, secondary and muted tones establish reading priority. Light mode uses all corresponding overrides rather than placing dark text tokens on light surfaces.

**The State Color Rule.** Lime communicates active work; amber calls for human attention. Always retain the accompanying label or icon.

## Typography

**Body and heading font:** DM Sans, with Arial and sans-serif fallbacks. **Identifier font:** IBM Plex Mono, with a monospace fallback.

The base body is compact (13px). The default workspace heading uses the headline token; it becomes smaller on mobile (23px), larger on wide desktops (31px), and compact on short desktop viewports (25px). Task titles range from 12px to 14px across the implemented media queries. Buttons use 12px type; auxiliary operational labels are smaller. Identifiers, JSON, branches, hop counters and keyboard shortcuts use mono, with tabular numerals for identifiers and counters.

The authentication story uses the same font pair: its desktop headline is `clamp(40px, 4.2vw, 64px)`, weight 450 and line height 1.14. The form heading is 30px, weight 500 and line height 1.35; it becomes 27px at 1000px and returns to 30px on mobile. This larger type is scoped to entry screens.

## Layout

The desktop shell has a fixed sidebar (216px), a breadcrumb bar (61px), and a flexible main area. Content is capped (1900px) and uses desktop horizontal padding (29px). The board has five equal columns, a default gap (15px), and stacked cards with a gap (12px). Summary metrics share one divided container.

Responsive conditions are exact CSS queries, including their boundary values:

- At `min-width: 1600px`, the sidebar grows (236px), content horizontal padding grows (38px), and the board gap grows (19px).
- At `max-width: 1250px`, the sidebar contracts (192px) and operational chrome becomes denser.
- At `max-width: 1000px`, the board uses five fixed columns (215px) with horizontal scrolling; the summary becomes three columns and the toolbar stacks.
- At `max-width: 760px`, the sidebar becomes an off-canvas drawer (216px) with a scrim, the main margin disappears, content horizontal padding becomes 18px, and the board columns become 240px. The topbar is 55px tall. Fleet cards become a single column.
- At `min-width: 761px` and `max-height: 800px`, desktop vertical gaps and card padding contract to keep work visible.

The inspector is a right-side panel (530px), capped at the available width, with independently scrolling content. At the mobile breakpoint it uses `width: 100%` and `max-width: 530px`; it fills narrow phones while remaining capped on wider mobile viewports. The simulator dock and bottom status bar stay fixed; content reserves bottom space for them.

### Authentication Entry Screens

`/login` and `/register` share a full-height (`100dvh`) story/form grid: `minmax(340px, .95fr) minmax(480px, 1.05fr)`. The story uses the sidebar tone and a right divider; the form sits directly on the canvas, centered at a maximum width of 370px. The account-switch link sits above the form and quiet branding anchors the footers. This split layout is scoped to authentication.

At `max-width: 1000px`, the grid becomes `minmax(300px, .85fr) minmax(400px, 1.15fr)`, panel horizontal padding becomes 30px, and the story relay becomes denser. At `max-width: 760px`, it becomes one column: only the brand remains from the story panel, the form has a maximum width of 390px with 25px page gutters, and the account-switch link moves below it. Inputs grow from 43px to 46px minimum height and the submit action from 43px to 45px. At `min-width: 761px` and `max-height: 800px`, story padding, orbit spacing, relay and note gaps contract; the story headline becomes 48px. Preserve natural vertical scrolling for longer registration forms.

## Elevation & Depth

Tonal surface layering and single-pixel borders carry most depth. Task cards are flat at rest and change border/background on hover. Shadows belong to floating layers: small popovers, notification panels, dialogs, the inspector and simulator dock. The circuit warning has a restrained amber shadow pulse. Exact shadow values live in the sidecar.

## Shapes

Controls use gently rounded corners (6px), cards use 8px, popovers use 8–10px, and keyboard labels use 4px. Agent avatars are rounded squares (7px); human avatars are circles. Preserve this identity distinction. Status dots and small counters remain compact.

## Components

### Buttons

Secondary buttons use a bordered surface, minimum height (33px), horizontal padding (12px) and a compact gap (8px). Primary buttons use lime and a dark foreground in dark mode; light mode explicitly switches to a pale foreground. Hover brightens the action. Motion wrappers scale on hover (1.02) and press (0.96). Disabled buttons reduce opacity (0.45) and use a disabled cursor.

### Inputs / Fields

Form inputs, selects and textareas use canvas backgrounds, subtle borders, control corners and compact padding. Focus changes the border to lime. Buttons, links and role buttons receive a visible lime outline (2px) offset by 4px. Placeholder and caret colors follow muted and lime respectively.

### Authentication Forms and Session Controls

Login asks for email and password; registration adds full name and password confirmation. Both use the existing semantic palette and shared primary button. Auth fields use surface backgrounds, 6px corners, 12px 13px padding and a lime focus border. Labels remain visible above fields; the password visibility control sits inside the right edge and has an accessible state label. Registration keeps its password hint beneath the field.

Invalid fields have red borders and associated red error text; a form-level error uses a quiet red bordered alert. Submission disables the full-width action, shows a spinner and changes its label to the operation in progress. The form exposes its busy state. The desktop story repeats the Coder → QA → You relay with lime, blue and amber identity cues, rounded agent chips and a pill-shaped human chip. Its form enters over 250ms from an 8px offset, and one relay arrow pulses over 3s; retain the shared motion preference conventions.

Logout is available in the workspace header and settings. The header action is compact (28px minimum height), transparent and secondary in tone; at 760px its text hides while the icon retains the accessible “Log out” label. Both controls disable during logout, and the header label becomes “Signing out…”. Profile and settings show the signed-in name and email; human avatars use name-derived initials. Long profile text truncates rather than widening the sidebar.

### Navigation and Chips

Sidebar navigation uses secondary text, a raised hover surface and lime active text/icons over a quiet tinted background. Filter chips use a hover-tone fill when selected. Category labels retain compact colored border/fill combinations; do not treat every label as a primary action.

### Workspace Picker and Membership Controls

Workspace selection and membership settings extend the shared dialog, button and form patterns. The sidebar switcher truncates long workspace names and keeps role and invitation counts secondary. Picker rows use bordered surfaces, a hover tone and a lime border plus checkmark for the current workspace. Member rows separate the name from secondary email and role details with subtle dividers; long names and emails wrap. Creation and invitation acceptance actions use the existing lime primary button, while role, removal, confirmation, cancellation, decline and revoke controls retain compact secondary treatments. Pending operations disable related fields and actions, expose a busy state and announce operation-specific progress; errors use the existing red text treatment and successes use shared toasts.

At the mobile breakpoint, membership actions wrap beneath each person's details and invitation fields become one column. Dialog content retains the existing compact padding and scrolling behavior. These patterns reuse the incumbent semantic colors, typography, corners and motion rather than adding visual tokens.

### Task Cards and Delegation Relay

Cards show source identifier, title, labels, current actor, hop count and event count. Delegation adds the previous actor and an arrow; the incoming actor springs into place. `layoutId` preserves task identity while cards move, with a spring (stiffness 400, damping 30). Hop digits roll vertically as the count changes.

Live execution adds a rotating border beam (6s), active-agent shimmer (4s) and activity ticker. Ticker copy advances every 3800ms and slides over 250ms. Human approval draws a check and plays an emerald wave (650ms). At the configured four-hop limit, the card shakes over 380ms, pulses amber every 2s and presents review/resolve controls. Approval and circuit warnings remain legible without animation.

### Inspector and Motion Preference

The inspector enters with a spring (stiffness 370, damping 36). Dialogs use the shared 400/30 spring. The workspace sets Framer Motion `reducedMotion="user"`; CSS disables animations and transitions, and resets smooth scrolling, under `prefers-reduced-motion: reduce`. Live ticker content still updates; reduced motion suppresses movement rather than removing the status.

## Do's and Don'ts

### Do:
- **Do** use the semantic CSS variables in both themes.
- **Do** pair state colors with text, icons and counters.
- **Do** preserve horizontal board scrolling and independently scrolling inspector content.
- **Do** respect reduced-motion preferences.

### Don't:
- **Don't** replace the established compact workspace with a spacious marketing layout.
- **Don't** use lime and amber interchangeably: execution and human attention have distinct roles.
- **Don't** remove the four-hop warning or human review affordance.
- **Don't** introduce a display font in place of DM Sans and IBM Plex Mono.
