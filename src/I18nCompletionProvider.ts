import {
  CompletionItem,
  CompletionItemKind,
  Position,
  TextDocument,
  CompletionItemProvider,
  Range
} from "vscode";

import TranslationCache from "./translationCache";
import {
  getI18nCallRangeAtPosition,
  getKeyAndKeyRangeFromCallRange
} from "./utilities";

class I18nCompletionProvider implements CompletionItemProvider {
  private cache: TranslationCache;

  constructor(cache: TranslationCache) {
    this.cache = cache;
  }

  public async provideCompletionItems(
    document: TextDocument,
    position: Position
  ) {
    const range = getI18nCallRangeAtPosition(document, position);
    if (!range) {
      return;
    }

    const [_, keyRange] = getKeyAndKeyRangeFromCallRange(document, range);
    if (!keyRange.contains(position)) {
      return;
    }

    const searchRange = new Range(keyRange.start, position);
    const searchKey = document.getText(searchRange);

    const translationKeys = await this.cache.getMatchingTranslations(
      document,
      searchKey
    );

    return translationKeys.map(({ key, file }) => {
      const completionItem = new CompletionItem(key, CompletionItemKind.Value);
      completionItem.range = keyRange;
      completionItem.detail = file;
      return completionItem;
    });
  }
}

export default I18nCompletionProvider;
