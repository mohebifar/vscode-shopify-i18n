import {
  CancellationToken,
  Hover,
  HoverProvider,
  Position,
  TextDocument,
  workspace,
  MarkdownString
} from "vscode";
import TranslationCache from "./translationCache";
import {
  getKeyAndKeyRangeFromCallRange,
  getI18nCallRangeAtPosition
} from "./utilities";

class I18nHoverProvider implements HoverProvider {
  private cache: TranslationCache;

  constructor(cache: TranslationCache) {
    this.cache = cache;
  }

  public async provideHover(
    document: TextDocument,
    position: Position,
    token: CancellationToken
  ) {
    const range = getI18nCallRangeAtPosition(document, position);
    if (!range) {
      return;
    }

    const [key, keyRange] = getKeyAndKeyRangeFromCallRange(document, range);
    if (!keyRange.contains(position)) {
      return;
    }

    const translation = await this.cache.getTranslation(document, key);
    if (!translation || !translation.value) {
      return;
    }

    const translationText =
      translation.markdownValue || `**${translation.value}**`;

    const markdownText = new MarkdownString(
      `${translationText}\n\n*Defined in* ${translation.file}`
    );
    markdownText.isTrusted = true;

    return new Hover(markdownText, keyRange);
  }
}

export default I18nHoverProvider;
