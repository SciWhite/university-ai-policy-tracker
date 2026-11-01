"use client";

import { createContext, useContext, type ReactNode } from "react";

const ReadingUiTextContext = createContext<Readonly<Record<string, string>>>({});

export function ReadingUiTextProvider({ value, children }: { value: Readonly<Record<string, string>>; children: ReactNode }) {
  return <ReadingUiTextContext.Provider value={value}>{children}</ReadingUiTextContext.Provider>;
}

export function useReadingUiText() {
  return useContext(ReadingUiTextContext);
}
