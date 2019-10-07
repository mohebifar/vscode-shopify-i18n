import {
  DiagnosticCollection,
  ExtensionContext,
  languages,
  TextDocument,
  Diagnostic,
  DocumentSelector,
  Uri,
  Range,
  DiagnosticSeverity,
  workspace,
  window
} from "vscode";
import { getAllKeysInDocument } from "./utilities";
import TranslationCache from "./translationCache";

export class I18nDiagnosticProvider {
  private collection: DiagnosticCollection;
  private cache: TranslationCache;
  private selector: DocumentSelector;

  constructor(cache: TranslationCache, selector: DocumentSelector) {
    this.collection = languages.createDiagnosticCollection("shopify-i18n");
    this.cache = cache;
    this.selector = selector;
  }

  async update(document: TextDocument) {
    if (document && languages.match(this.selector, document)) {
      const problems: Diagnostic[] = [];
      this.collection.delete(document.uri);

      const documentTranslationKeys = getAllKeysInDocument(document);
      const allTranslationKeys = await this.cache.getAllTranslationKeys(
        document
      );

      documentTranslationKeys.forEach(({ key, start, end }) => {
        const translation = allTranslationKeys[key];
        if (!translation || !translation.value) {
          problems.push({
            message: translation
              ? `"${key}" is a dictionary not a translation key`
              : `Missing translation "${key}"`,
            range: new Range(
              document.positionAt(start),
              document.positionAt(end)
            ),
            severity: DiagnosticSeverity.Error
          });
        }
      });

      this.collection.set(document.uri, problems);
    } else {
      this.collection.clear();
    }
  }

  clear() {
    this.collection.clear();
  }

  clearUri(uri: Uri) {
    this.collection.delete(uri);
  }
}

export default I18nDiagnosticProvider;
