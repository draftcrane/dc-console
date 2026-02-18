/**
 * TypeScript declarations for Google Picker API.
 * https://developers.google.com/workspace/drive/picker/reference
 */

declare namespace google.picker {
  enum ViewId {
    DOCS = "all",
    DOCUMENTS = "documents",
    FOLDERS = "folders",
    SPREADSHEETS = "spreadsheets",
    PRESENTATIONS = "presentations",
  }

  enum Feature {
    MULTISELECT_ENABLED = "multiselectEnabled",
    NAV_HIDDEN = "navHidden",
    SIMPLE_UPLOAD_ENABLED = "simpleUploadEnabled",
  }

  enum Action {
    CANCEL = "cancel",
    PICKED = "picked",
  }

  interface ResponseObject {
    action: string;
    docs?: DocumentObject[];
    viewToken?: string[];
  }

  interface DocumentObject {
    id: string;
    name: string;
    mimeType: string;
    url: string;
    type: string;
    lastEditedUtc: number;
    sizeBytes: number;
  }

  class DocsView {
    constructor(viewId?: ViewId);
    setIncludeFolders(include: boolean): DocsView;
    setMimeTypes(mimeTypes: string): DocsView;
    setSelectFolderEnabled(enabled: boolean): DocsView;
    setParent(parentId: string): DocsView;
  }

  class PickerBuilder {
    enableFeature(feature: Feature): PickerBuilder;
    disableFeature(feature: Feature): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
    setOrigin(origin: string): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    setLocale(locale: string): PickerBuilder;
    addView(view: DocsView | ViewId): PickerBuilder;
    build(): Picker;
  }

  class Picker {
    setVisible(visible: boolean): void;
    dispose(): void;
  }
}

declare namespace gapi {
  function load(api: string, callback: () => void): void;
}

interface Window {
  gapi?: typeof gapi;
  google?: {
    picker: typeof google.picker;
  };
}
