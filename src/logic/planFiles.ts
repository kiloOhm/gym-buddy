// File side of plan, exercise-library and history export/import: the only module that touches Expo file/share/picker APIs.
// On web, export downloads the file and import reads the browser File the picker returns; expo-file-system
// and expo-sharing are not used there (their web modules are stubs, importing them is harmless).
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
// The picked file is read straight from its content:// URI. Copying it to the cache first breaks
// inside Expo Go, whose file-system module only allows its own scoped directories.
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import type { Exercise, WeightUnit, WorkoutPlan, WorkoutSession } from '@/types';

import { historyFileName, serializeHistory } from './historyExport';
import { libraryFileName, serializeLibrary } from './library';
import { serializePlans, suggestedFileName } from './planExport';

/** Web: saves the JSON through a temporary download link. */
function downloadJsonFile(fileName: string, json: string): void {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Revoke after the click has been handled; revoking synchronously can cancel the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Writes the JSON to a file in the cache directory and opens the share sheet (web: downloads it). */
export async function shareJsonFile(fileName: string, json: string, dialogTitle: string): Promise<void> {
  if (Platform.OS === 'web') {
    downloadJsonFile(fileName, json);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  await file.write(json);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle,
    UTI: 'public.json',
  });
}

/** Writes the plans to a JSON file in the cache directory and opens the share sheet. */
export function exportPlansToFile(plans: readonly WorkoutPlan[]): Promise<void> {
  return shareJsonFile(suggestedFileName(plans), serializePlans(plans), 'Export plans');
}

/** Writes the whole exercise library to a JSON file and opens the share sheet. */
export function exportLibraryToFile(exercises: readonly Exercise[]): Promise<void> {
  return shareJsonFile(libraryFileName(), serializeLibrary(exercises), 'Export exercise library');
}

/** Writes the finished workouts to a history JSON file and opens the share sheet. */
export function exportHistoryToFile(sessions: readonly WorkoutSession[], unit: WeightUnit): Promise<void> {
  return shareJsonFile(historyFileName(), serializeHistory(sessions, unit), 'Export history');
}

/** Lets the user pick a file and returns its text, or undefined when cancelled. */
export async function pickAndReadJsonFile(): Promise<string | undefined> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: false,
  });
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  if (!asset) return undefined;
  // Web: the picker hands back the browser File itself.
  if (asset.file) return await asset.file.text();
  try {
    // The File class resolves SAF content:// URIs through the content resolver.
    return await new File(asset.uri).text();
  } catch (primary) {
    // Older/other providers: fall back to the legacy reader before giving up.
    try {
      return await readAsStringAsync(asset.uri);
    } catch {
      throw primary;
    }
  }
}

/** Lets the user pick a plans file and returns its text, or undefined when cancelled. */
export function pickAndReadPlanFile(): Promise<string | undefined> {
  return pickAndReadJsonFile();
}
