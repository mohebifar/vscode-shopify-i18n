import { DefinitionProvider, TextDocument, Position, Range } from "vscode";

import TranslationCache from "./translationCache";
import {
  getI18nCallRangeAtPosition,
  getKeyAndKeyRangeFromCallRange
} from "./utilities";

class I18nDefinitionProvider implements DefinitionProvider {
  private cache: TranslationCache;

  constructor(cache: TranslationCache) {
    this.cache = cache;
  }

  public async provideDefinition(document: TextDocument, position: Position) {
    const range = getI18nCallRangeAtPosition(document, position);
    if (!range) {
      return;
    }

    const [_, keyRange] = getKeyAndKeyRangeFromCallRange(document, range);
    if (!keyRange.contains(position)) {
      return;
    }

    const selectedWordRange = document.getWordRangeAtPosition(position);
    if (!selectedWordRange) {
      return;
    }

    const searchKey = document.getText(
      new Range(keyRange.start, selectedWordRange.end)
    );
    const translation = await this.cache.getTranslation(document, searchKey);
    if (!translation) {
      return;
    }

    return translation.location;
  }
}
export default I18nDefinitionProvider;
