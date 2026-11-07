---
name: Monochrome Logic
colors:
  surface: '#f9f9f9'
  surface-dim: '#dadada'
  surface-bright: '#f9f9f9'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f3'
  surface-container: '#eeeeee'
  surface-container-high: '#e8e8e8'
  surface-container-highest: '#e2e2e2'
  on-surface: '#1a1c1c'
  on-surface-variant: '#4c4546'
  inverse-surface: '#2f3131'
  inverse-on-surface: '#f1f1f1'
  outline: '#7e7576'
  outline-variant: '#cfc4c5'
  surface-tint: '#5e5e5e'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1b1b1b'
  on-primary-container: '#848484'
  inverse-primary: '#c6c6c6'
  secondary: '#5d5f5f'
  on-secondary: '#ffffff'
  secondary-container: '#dfe0e0'
  on-secondary-container: '#616363'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#1b1c1c'
  on-tertiary-container: '#848484'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e2e2e2'
  primary-fixed-dim: '#c6c6c6'
  on-primary-fixed: '#1b1b1b'
  on-primary-fixed-variant: '#474747'
  secondary-fixed: '#e2e2e2'
  secondary-fixed-dim: '#c6c6c7'
  on-secondary-fixed: '#1a1c1c'
  on-secondary-fixed-variant: '#454747'
  tertiary-fixed: '#e3e2e2'
  tertiary-fixed-dim: '#c7c6c6'
  on-tertiary-fixed: '#1b1c1c'
  on-tertiary-fixed-variant: '#464747'
  background: '#f9f9f9'
  on-background: '#1a1c1c'
  surface-variant: '#e2e2e2'
typography:
  display:
    fontFamily: Geist
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Geist
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Geist
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Geist
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Geist
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-md:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-caps:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
  mono-data:
    fontFamily: Geist
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: -0.01em
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  margin-mobile: 20px
  gutter: 12px
---

## Brand & Style

This design system is built on the principles of **Architectural Minimalism**. It targets a user base that values precision, utility, and a sophisticated aesthetic for financial coordination. By stripping away all unnecessary ornamentation, the UI transforms from a mere tool into a structured canvas for financial data.

The emotional response is one of **clarity and control**. The interface uses "Void-Space" (intentional white space) to reduce the cognitive load of complex debt calculations. The style is characterized by sharp precision, hairline strokes, and high-contrast typography, evoking the feeling of a premium printed ledger or a blueprint.

## Colors

The palette is strictly achromatic to ensure maximum contrast and professional focus.

- **Primary (#000000):** Used for all high-intent actions, primary text, and structural outlines.
- **Surface (#FFFFFF):** The base for the entire application, providing a clean, expansive feel.
- **Muted (#737373):** For secondary information, metadata, and placeholder text.
- **Subtle (#F5F5F5):** For large container backgrounds or "off-white" zones to separate sections without using lines.
- **Lines (#E5E5E5):** Specifically for 1px hairline dividers and subtle component borders.

Negative states (errors) should not use red; instead, use bolded black text or a heavy 2px black border to signal urgency through weight rather than hue.

## Typography

This design system utilizes **Geist** for its technical precision and systematic feel. The type hierarchy relies on extreme weight variance and tight letter-spacing for headings to create an "editorial" look.

- **Display & Headlines:** Should be set with tight tracking (-0.02em to -0.04em) to feel cohesive and structural.
- **Numerical Data:** While Geist is used, tabular lining figures should be enabled to ensure cost columns align perfectly.
- **Label-Caps:** Used for section headers or small metadata to provide a visual anchor.

## Layout & Spacing

The layout philosophy follows a **strict 4px rhythm**. 

- **Grid:** A 4-column grid for mobile with 20px side margins.
- **Vertical Rhythm:** Elements are separated by generous "white blocks." Use 40px (xl) spacing between major logical sections (e.g., between the "Total Balance" and the "Recent Transactions" list).
- **Dividers:** Use 1px #E5E5E5 dividers only when necessary. Prefer whitespace to delineate rows in a list unless the information density is extremely high.

## Elevation & Depth

This system avoids shadows entirely. Depth is achieved through **Tonal Layering** and **Line Weight**.

- **Level 0 (Base):** Pure #FFFFFF.
- **Level 1 (Subtle Inset):** Use #F5F5F5 for input fields or secondary containers to create a "recessed" look.
- **Level 2 (Overlay):** For modals or drawers, use a solid 1px black border with a sharp corner. 
- **Backdrop:** When a modal is active, the background should be dimmed using a 10% black tint (very light grey) or a heavy blur with no color shift to maintain the monochrome integrity.

## Shapes

The shape language is **unapologetically sharp**. 

- **Corners:** All primary buttons, input fields, and cards must have 0px border radius. This reinforces the architectural and technical nature of the app.
- **Iconography:** Use 1px or 1.5px stroke icons (Linear style). Icons must also feature sharp terminals rather than rounded caps.

## Components

### Buttons
- **Primary:** Solid black background (#000000) with white text. Sharp corners.
- **Secondary:** 1px black border with transparent background and black text.
- **Tertiary:** Text only, bold, with a 1px underline on hover/active states.

### Input Fields
- Underline-only style is preferred for a clean look, or a full 1px #E5E5E5 border that turns 1px #000000 on focus. No rounded corners.

### Lists & Cells
- Use 1px #E5E5E5 bottom-borders for list items. 
- Maintain a minimum height of 64px for trip expense items to allow for generous vertical whitespace around text.

### Chips / Tags
- Small, 1px black border, sharp corners, 10px Geist Medium in all-caps.

### Cards
- No shadows. Use either a 1px #E5E5E5 border or a subtle #F5F5F5 background fill to define the card area.
