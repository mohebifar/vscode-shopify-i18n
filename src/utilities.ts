import { workspace, TextDocument, Position, Range, Uri } from "vscode";
import { dirname, relative } from "path";
import { flatten } from "lodash";
import jsonToAst from "json-to-ast";

interface TranslationRecord {
  markdownValue?: string;
  value?: string;
  loc?: jsonToAst.Location;
}

export interface TranslationDictionary {
  [s: string]: TranslationRecord;
}

const i18nCallRegex = /i18n\.t(ranslate)?\([\r\n\s]*[\"\']([\w-\.]*)[\"\'\.]/g;

const pluralizationRules = ["zero", "one", "two", "few", "many", "other"];

export async function getFilePaths(
  document: TextDocument,
  searchPaths: string[],
  excludePath: string | undefined,
  preferredLanguage: string
) {
  const relativeDirname = relative(
    workspace.rootPath || "",
    dirname(document.uri.fsPath)
  );

  const promises = searchPaths
    .map((pattern) =>
      pattern
        .replace("${fileDirname}", relativeDirname)
        .replace("${preferredLanguage}", preferredLanguage)
    )
    .map((pattern) => workspace.findFiles(pattern, excludePath));

  const allValues = await Promise.all(promises);

  let currentDirSearch = relativeDirname;
  let foundRecursiveResult: Uri[];
  do {
    foundRecursiveResult = await workspace.findFiles(
      `${currentDirSearch}/{locales,translations}/${preferredLanguage}.json`,
      excludePath
    );
  } while (
    foundRecursiveResult.length === 0 &&
    currentDirSearch !== (currentDirSearch = dirname(currentDirSearch))
  );

  return flatten([...allValues, ...foundRecursiveResult]).map(
    ({ path }) => path
  );
}

export function getI18nCallRangeAtPosition(
  document: TextDocument,
  position: Position
) {
  return document.getWordRangeAtPosition(position, i18nCallRegex);
}

export function getKeyAndKeyRangeFromCallRange(
  document: TextDocument,
  range: Range
): [string, Range] {
  const keyPrefix = document.getText(range).replace(i18nCallRegex, "$2");
  const end = range.end.character - 1;
  return [
    keyPrefix,
    new Range(
      new Position(range.end.line, end),
      new Position(range.end.line, end - keyPrefix.length)
    )
  ];
}

export function getAllKeysInDocument(document: TextDocument) {
  const keys = [];
  const text = document.getText();
  let match = null;

  while ((match = i18nCallRegex.exec(text))) {
    const index = match.index;
    const matchExpression = match[0];
    const matchKey = match[2];
    const end = index + matchExpression.length - 1;
    const start = end - matchKey.length;
    keys.push({
      key: matchKey,
      start,
      end
    });
  }

  return keys;
}

export function prepareJson(json: string) {
  return flattenJsonAst(jsonToAst(json));
}

export function flattenJsonAst(
  object: jsonToAst.ValueNode,
  path: string[] = []
): TranslationDictionary {
  if (object.type === "Object") {
    return object.children.reduce(
      (current, node) => ({
        ...current,
        [[...path, node.key.value].join(".")]: { loc: node.key.loc },
        ...(node.value.type === "Object" && isPluralTranslation(node.value)
          ? {
              [[...path, node.key.value].join(".")]: {
                loc: node.key.loc,
                markdownValue: getPluralMarkdown(node.value.children),
                value: "[Plural]"
              }
            }
          : flattenJsonAst({ ...node.value, loc: node.key.loc }, [
              ...path,
              node.key.value
            ]))
      }),
      {} as TranslationDictionary
    );
  }

  return {
    [path.join(".")]: {
      loc: object.loc,
      value: (object as jsonToAst.LiteralNode).value
    } as TranslationRecord
  };
}

function isPluralTranslation(object: jsonToAst.ObjectNode) {
  return object.children.every(({ key }) =>
    pluralizationRules.includes(key.value)
  );
}

function getPluralMarkdown(children: jsonToAst.PropertyNode[]) {
  return children
    .map(
      ({ key, value }) =>
        `**${key.value}**: ${value.type === "Literal" ? value.value : ""}`
    )
    .join("\n\n");
}
