import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  SocialImportDrawers,
  type ImportPlatform,
} from "@/components/import/SocialImportDrawers";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { getImportHintSeen, setImportHintSeen } from "@/lib/import/hint-storage";

type ImportSheetContextValue = {
  /** Opens the import bottom sheet on its platform list. */
  open: () => void;
  /** True until the reader has opened the sheet once or closed the hint about it. */
  hintVisible: boolean;
  dismissHint: () => void;
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

  // Hidden until storage answers, so the hint never flashes for someone who has seen it.
  const [hintVisible, setHintVisible] = useState(false);
  useEffect(() => {
    let mounted = true;
    void getImportHintSeen()
      .then((seen) => {
        if (mounted && !seen) setHintVisible(true);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const dismissHint = useCallback(() => {
    setHintVisible(false);
    void setImportHintSeen().catch(() => {});
  }, []);

  const open = useCallback(() => {
    dismissHint();
    setSelectedPlatform(null);
    setSheetState("platforms");
  }, [dismissHint]);

  // The sheet belongs to the tabs. When another screen covers them (a recipe shared
  // from Instagram while the guide is open, say) it closes instead of staying on top.
  useFocusEffect(
    useCallback(
      () => () => {
        setSelectedPlatform(null);
        setSheetState("closed");
      },
      []
    )
  );

  const value = useMemo(() => ({ open, hintVisible, dismissHint }), [open, hintVisible, dismissHint]);

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
