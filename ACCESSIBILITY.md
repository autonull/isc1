# ISC Accessibility Specification (WCAG 2.1 AA)

> **Purpose**: Accessibility standards and testing requirements for the ISC UI.

---

## Screen Reader Support

- All interactive elements must have accessible names.
- Live regions must be used for dynamic content (e.g., match results, chat messages).
- The application must be tested with major screen readers: NVDA, VoiceOver, and JAWS.

## Keyboard Navigation

- Tab order must follow the visual layout of the page.
- All functionality must be accessible via keyboard (no mouse-only interactions).
- Focus indicators must be clearly visible (e.g., 3px outline, 3:1 contrast ratio).
- Skip links must be provided to bypass repetitive navigation blocks and jump to main content.

## Color Contrast

- Text must have a minimum contrast ratio of 4.5:1 against its background.
- Large text (18px and above) must have a minimum contrast ratio of 3:1.
- UI components (e.g., buttons, inputs) must have a minimum contrast ratio of 3:1.
- Color contrast must be verified using tools like axe or WAVE.

## Cognitive Load

- Navigation must be consistent across all views and states.
- Labels must be clear and descriptive (avoid using icons without text labels).
- Destructive actions must provide an undo option or confirmation step.
- Time limits (e.g., chat timeouts, match expiry) must be adjustable or provide sufficient warning.

## Testing Requirements

- **Automated**: Integrate `axe-core` in the CI pipeline to catch structural and syntax issues.
- **Manual**: Conduct quarterly screen reader testing manually.
- **User Testing**: Include users with disabilities in beta testing phases to ensure real-world usability.
