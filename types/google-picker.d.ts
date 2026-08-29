// Minimal ambient types for the bits of the Google Picker JS API we use.
// The full @types/google.picker package is large, stale, and drags in @types/gapi.

export {}

declare global {
  namespace google.picker {
    enum ViewId {
      SPREADSHEETS = "spreadsheets",
    }
    enum Action {
      PICKED = "picked",
      CANCEL = "cancel",
    }
    enum Feature {
      NAV_HIDDEN = "navHidden",
      MULTISELECT_ENABLED = "multiselectEnabled",
    }

    class DocsView {
      constructor(viewId?: ViewId)
      setMimeTypes(mimeTypes: string): this
      setMode(mode: unknown): this
    }

    interface DocObject {
      id: string
      name: string
      url: string
      mimeType: string
    }
    interface ResponseObject {
      action: Action
      docs: DocObject[]
    }

    interface Picker {
      setVisible(visible: boolean): void
      dispose(): void
    }

    class PickerBuilder {
      addView(view: DocsView | ViewId): this
      setOAuthToken(token: string): this
      setDeveloperKey(key: string): this
      setCallback(callback: (data: ResponseObject) => void): this
      setTitle(title: string): this
      enableFeature(feature: Feature): this
      build(): Picker
    }
  }

  interface Window {
    gapi: {
      load(name: string, config: { callback: () => void; onerror?: () => void }): void
    }
    google: {
      picker: typeof google.picker
    }
  }
}
