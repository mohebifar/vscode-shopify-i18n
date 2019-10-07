// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { memoize } from "lodash";

import I18nDefinitionProvider from "./I18nDefinitionProvider";
import I18nHoverProvider from "./I18nHoverProvider";
import I18nCompletionProvider from "./I18nCompletionProvider";
import TranslationCache from "./TranslationCache";
import { getFilePaths } from "./utilities";
import I18nDiagnosticProvider from "./I18nDiagnosticProvider";

export function activate(context: vscode.ExtensionContext) {
  console.log("Shopify i18n activted");
  const fileTypes =
    vscode.workspace
      .getConfiguration("shopifyI18n")
      .get<string[]>("languageIdentifiers") || [];

  const searchPaths =
    vscode.workspace
      .getConfiguration("shopifyI18n")
      .get<string[]>("searchPaths") || [];

  const excludePath = vscode.workspace
    .getConfiguration("shopifyI18n")
    .get<string | undefined>("excludePath");

  const preferredLanguage =
    vscode.workspace
      .getConfiguration("shopifyI18n")
      .get<string>("preferredLanguage") || "en";

  const filePathResolver = memoize(path =>
    getFilePaths(path, searchPaths, excludePath, preferredLanguage)
  );

  const cache = new TranslationCache(filePathResolver);

  const documentFilters = fileTypes.map(
    fileType =>
      ({
        language: fileType,
        scheme: "file",
      } as vscode.DocumentFilter)
  );

  const diagnosticProvider = new I18nDiagnosticProvider(cache, documentFilters);

  if (vscode.window.activeTextEditor) {
    diagnosticProvider.update(vscode.window.activeTextEditor.document);
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        diagnosticProvider.update(editor.document);
      }
    })
  );
  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(e =>
      diagnosticProvider.clearUri(e.uri)
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(doc =>
      diagnosticProvider.update(doc.document)
    )
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(e =>
      diagnosticProvider.clearUri(e.uri)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerDefinitionProvider(
      documentFilters,
      new I18nDefinitionProvider(cache)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      documentFilters,
      new I18nHoverProvider(cache)
    )
  );

  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      documentFilters,
      new I18nCompletionProvider(cache),
      ..."abcdefghijklmnopqrstuvwxyz.'\"".split("")
    )
  );

  context.subscriptions.push();
}

export function deactivate() {}
