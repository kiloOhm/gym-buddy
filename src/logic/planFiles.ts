// File side of plan export/import: the only module that touches Expo file/share/picker APIs.
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
// The picked file is read straight from its content:// URI. Copying it to the cache first breaks
// inside Expo Go, whose file-system module only allows its own scoped directories.
import { readAsStringAsync } from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import type { WorkoutPlan } from '@/types';

import { serializePlans, suggestedFileName } from './planExport';

/** Writes the plans to a JSON file in the cache directory and opens the share sheet. */
export async function exportPlansToFile(plans: readonly WorkoutPlan[]): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  const file = new File(Paths.cache, suggestedFileName(plans));
  file.create({ overwrite: true });
  await file.write(serializePlans(plans));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export plans',
    UTI: 'public.json',
  });
}

/** Lets the user pick a file and returns its text, or undefined when cancelled. */
export async function pickAndReadPlanFile(): Promise<string | undefined> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: false,
  });
  if (result.canceled) return undefined;
  const asset = result.assets[0];
  if (!asset) return undefined;
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
