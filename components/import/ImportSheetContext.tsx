import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import {
  SocialImportDrawers,
  type ImportPlatform,
} from "@/components/import/SocialImportDrawers";
import { useLanguage } from "@/lib/i18n/LanguageProvider";

type ImportSheetContextValue = {
  /** Opens the import bottom sheet on its platform list. */
  open: () => void;
};

const ImportSheetContext = createContext<ImportSheetContextValue | null>(null);

/**
 * Hosts the import bottom sheet once for the whole tab area so the tab bar's
 * add button and any tab screen can open it.
 */
export function ImportSheetProvider({ children }: { children: ReactNode }) {
  const { t } = useLanguage();
  const [sheetState, setSheetState] = useState<"closed" | "platforms" | "guide">("closed");
  const [selectedPlatform, setSelectedPlatform] = useState<ImportPlatform | null>(null);

  const open = useCallback(() => {
    setSelectedPlatform(null);
    setSheetState("platforms");
  }, []);

  const value = useMemo(() => ({ open }), [open]);

  return (
    <ImportSheetContext.Provider value={value}>
      {children}
      <SocialImportDrawers
        isPrimaryVisible={sheetState !== "closed"}
        selectedPlatform={sheetState === "guide" ? selectedPlatform : null}
        t={t}
        onClosePrimary={() => {
          setSelectedPlatform(null);
          setSheetState("closed");
        }}
        onSelectPlatform={(platform) => {
          setSelectedPlatform(platform);
          setSheetState("guide");
        }}
        onCloseGuide={() => {
          setSelectedPlatform(null);
          setSheetState("platforms");
        }}
      />
    </ImportSheetContext.Provider>
  );
}

export function useImportSheet() {
  const context = useContext(ImportSheetContext);
  if (!context) {
    throw new Error("useImportSheet must be used within ImportSheetProvider");
  }
  return context;
}
