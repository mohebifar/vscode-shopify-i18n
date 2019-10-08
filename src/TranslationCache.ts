import {
  TextDocument,
  workspace,
  Location,
  Range,
  Position,
  Uri
} from "vscode";
import { merge } from "lodash";
import { relative } from "path";
import { prepareJson, TranslationDictionary } from "./utilities";

interface TranslationCacheDictionary {
  [fileName: string]: TranslationDictionary;
}

interface TranslationResult {
  file: string;
  key: string;
  value?: string;
  markdownValue?: string;
  location: Location;
}

type FilePathResolver = (document: TextDocument) => Promise<string[]>;

class TranslationCache {
  private translationsCache: TranslationCacheDictionary = {};
  private filePathResolver: FilePathResolver;

  constructor(filePathResolver: FilePathResolver) {
    this.filePathResolver = filePathResolver;
  }

  public prepareTranslationsForFile(document: TextDocument) {
    return this.filePathResolver(document).then(paths => {
      const promises = paths.map(path => {
        if (!this.translationsCache[path]) {
          return workspace
            .openTextDocument(path)
            .then((document: TextDocument) => {
              this.translationsCache[path] = prepareJson(document.getText());

              workspace.createFileSystemWatcher(path).onDidChange(() => {
                delete this.translationsCache[path];
              });

              return path;
            });
        }
        return path;
      });

      return Promise.all(promises);
    });
  }

  public async getAllTranslationKeys(
    document: TextDocument
  ): Promise<TranslationDictionary> {
    const cacheKeys = await this.prepareTranslationsForFile(document);

    return merge(
      {},
      ...cacheKeys.map(cacheKey => this.translationsCache[cacheKey])
    );
  }

  public async getTranslation(document: TextDocument, key: string) {
    const translationKeys = await this.getMatchingTranslations(document, key);

    return translationKeys[0];
  }

  public async getMatchingTranslations(
    document: TextDocument,
    prefix: string,
    limit = 10
  ) {
    const cacheKeys = await this.prepareTranslationsForFile(document);
    const result: TranslationResult[] = [];

    for (let i = 0; result.length < limit && i < cacheKeys.length; i++) {
      const cacheKey = cacheKeys[i];
      const file = relative(workspace.rootPath || "/", cacheKey);
      const dictionary = this.translationsCache[cacheKey];
      const translationKeys = Object.keys(dictionary);
      const uri = Uri.file(cacheKey);

      for (
        let j = 0;
        result.length < limit && j < translationKeys.length;
        j++
      ) {
        if (translationKeys[j].startsWith(prefix)) {
          const key = translationKeys[j];
          const { markdownValue, value, loc } = dictionary[key];
          const range = loc
            ? new Range(
                new Position(loc.start.line - 1, loc.start.column - 1),
                new Position(loc.end.line - 1, loc.end.column - 1)
              )
            : new Range(new Position(0, 0), new Position(0, 0));
          const location = new Location(uri, range);

          result.push({
            file,
            key,
            location,
            value,
            markdownValue
          });
        }
      }
    }

    return result;
  }
}

export default TranslationCache;
