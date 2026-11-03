"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ShellMessages } from "@/lib/i18n-messages";
import en from "@/messages/en.json";

const ReadingUiTextContext = createContext<Readonly<Record<string, string>>>({});
const ShellMessagesContext = createContext<ShellMessages>(en.Shell);

export function ReadingUiTextProvider({ value, shell, children }: {
  value: Readonly<Record<string, string>>;
  shell?: ShellMessages;
  children: ReactNode;
}) {
  const parentText = useContext(ReadingUiTextContext);
  const parentShell = useContext(ShellMessagesContext);
  const text = Object.keys(parentText).length ? { ...parentText, ...value } : value;
  return (
    <ShellMessagesContext.Provider value={shell ?? parentShell}>
      <ReadingUiTextContext.Provider value={text}>{children}</ReadingUiTextContext.Provider>
    </ShellMessagesContext.Provider>
  );
}

export function useReadingUiText() {
  return useContext(ReadingUiTextContext);
}

/** Only the current, server-resolved shell crosses the client boundary. */
export function useShellMessages() {
  return useContext(ShellMessagesContext);
}
