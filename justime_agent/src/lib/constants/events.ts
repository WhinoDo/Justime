/**
 * Custom DOM event names used across the application.
 *
 * Centralising these avoids magic strings and makes it easy to
 * discover all producers/consumers via a simple grep for the constant name.
 */

/** Dispatched on `window` when the user triggers a "new chat" action (Cmd/Ctrl+N). */
export const JUSTIME_NEW_CHAT_EVENT = 'justime:new-chat'