import { LocalizedText as Text } from "@/components/LocalizedText";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { onboardingColors } from "@/lib/theme/onboarding";
import { RecipeFolder, RecipeSummary } from "@/lib/recipes/client";

interface AddToFolderSheetProps {
  recipe: RecipeSummary | null;
  folders: RecipeFolder[];
  visible: boolean;
  onClose: () => void;
  onAssign: (recipeId: string, folderId: string | null) => Promise<void>;
}

export function AddToFolderSheet({
  recipe,
  folders,
  visible,
  onClose,
  onAssign,
}: AddToFolderSheetProps) {
  const insets = useSafeAreaInsets();
  const { t, isRTL } = useLanguage();
  const textAlign = isRTL ? "right" : "left";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!recipe) return null;

  const handleAssign = async (folderId: string | null) => {
    try {
      setLoading(true);
      setError(null);
      await onAssign(recipe.id, folderId);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("homeAssignFolderError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 24) }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { textAlign }]}>{t("homeSaveToFolder")}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <FontAwesome name="times" size={20} color={onboardingColors.textMuted} />
            </Pressable>
          </View>

          {error ? <Text style={[styles.errorText, { textAlign }]}>{error}</Text> : null}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={onboardingColors.primary} size="large" />
            </View>
          ) : (
            <ScrollView
              style={styles.folderList}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            >
              <Pressable
                style={[
                  styles.folderItem,
                  recipe.folder_id === null && styles.folderItemSelected,
                ]}
                onPress={() => handleAssign(null)}
              >
                <View style={styles.folderIconWrap}>
                  <FontAwesome name="folder-o" size={20} color={onboardingColors.text} />
                </View>
                <Text style={[styles.folderName, { textAlign }]}>{t("uncategorized")}</Text>
                {recipe.folder_id === null && (
                  <FontAwesome name="check" size={16} color={onboardingColors.primary} />
                )}
              </Pressable>

              {folders.map((folder) => (
                <Pressable
                  key={folder.id}
                  style={[
                    styles.folderItem,
                    recipe.folder_id === folder.id && styles.folderItemSelected,
                  ]}
                  onPress={() => handleAssign(folder.id)}
                >
                  <View style={styles.folderIconWrap}>
                    <FontAwesome name="folder" size={20} color={onboardingColors.primaryDark} />
                  </View>
                  <Text style={[styles.folderName, { textAlign }]} numberOfLines={1}>
                    {folder.name}
                  </Text>
                  {recipe.folder_id === folder.id && (
                    <FontAwesome name="check" size={16} color={onboardingColors.primary} />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 24,
    paddingHorizontal: 20,
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: onboardingColors.text,
  },
  closeButton: {
    padding: 4,
  },
  errorText: {
    color: "#D32F2F",
    fontSize: 14,
    marginBottom: 16,
  },
  loadingContainer: {
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  folderList: {
    marginTop: 8,
  },
  folderItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    gap: 12,
  },
  folderItemSelected: {
    backgroundColor: "#FAFCF4",
  },
  folderIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F6EB",
    alignItems: "center",
    justifyContent: "center",
  },
  folderName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: onboardingColors.text,
  },
});
