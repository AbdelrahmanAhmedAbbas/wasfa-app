import AsyncStorage from "@react-native-async-storage/async-storage";

const IMPORT_HINT_SEEN_KEY = "@wasfa/import_hint_seen";

/** True once the reader has opened the import sheet or closed the hint that points at it. */
export async function getImportHintSeen(): Promise<boolean> {
  return (await AsyncStorage.getItem(IMPORT_HINT_SEEN_KEY)) === "true";
}

export async function setImportHintSeen(): Promise<void> {
  await AsyncStorage.setItem(IMPORT_HINT_SEEN_KEY, "true");
}
