// The text of the notifications the server sends, in the language of the phone they go to.

export type PushLanguage = "en" | "ar";

export type ImportFinishedRecipe = {
  title: string;
  titles: { en: string | null; ar: string | null };
};

const IMPORT_READY = {
  en: { title: "Your recipe is ready", body: (name: string) => `"${name}" is saved in your library.` },
  ar: { title: "وصفتك جاهزة", body: (name: string) => `تم حفظ «${name}» في مكتبتك.` },
};

const IMPORT_READY_UNNAMED = {
  en: "Your recipe is saved in your library.",
  ar: "تم حفظ وصفتك في مكتبتك.",
};

const IMPORT_FAILED = {
  en: { title: "We couldn't import that recipe", body: "Open Wasfa to try the link again." },
  ar: { title: "تعذّر استيراد الوصفة", body: "افتح وصفة وجرّب الرابط مرة أخرى." },
};

/** What a phone shows when an import is over: the saved recipe by name, or that it failed. */
export function importFinishedMessage(params: {
  language: PushLanguage;
  recipe: ImportFinishedRecipe | null;
}): { title: string; body: string } {
  const { language, recipe } = params;
  if (!recipe) return IMPORT_FAILED[language];

  const name = (recipe.titles[language] ?? recipe.title).trim();
  return {
    title: IMPORT_READY[language].title,
    body: name ? IMPORT_READY[language].body(name) : IMPORT_READY_UNNAMED[language],
  };
}

/** True for a token issued by Expo's push service, the only kind the server sends to. */
export function isExpoPushToken(token: string): boolean {
  return /^Expo(nent)?PushToken\[[^\]\s]+\]$/.test(token);
}

/**
 * The tokens Expo reported as no longer registered, from its reply to a send. The
 * reply has one ticket per message, in the order the messages were sent.
 */
export function unregisteredTokens(tokens: string[], reply: unknown): string[] {
  const tickets = (reply as { data?: unknown } | null)?.data;
  if (!Array.isArray(tickets)) return [];
  return tokens.filter((_, index) => {
    const ticket = tickets[index] as { status?: unknown; details?: { error?: unknown } } | null;
    return ticket?.status === "error" && ticket.details?.error === "DeviceNotRegistered";
  });
}
