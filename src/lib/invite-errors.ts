/** The only messages the invite page will show from its ?error= parameter (anyone can craft that URL). */
export const INVITE_ERRORS = [
  "This invite is no longer valid.",
  "You already belong to a business on BuildFlow.",
  "This invite was sent to a different email address.",
  "Please verify your email first. Check your inbox for the link, or resend it from your account page.",
] as const;
