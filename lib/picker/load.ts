"use client"

// Loads the Google Picker JS API (apis.google.com/js/api.js) once and resolves
// when `google.picker` is ready to use.

const SCRIPT_ID = "gapi-picker-script"
let ready: Promise<void> | null = null

export function loadPicker(): Promise<void> {
  if (ready) return ready

  ready = new Promise<void>((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Picker can only load in the browser"))
      return
    }

    const loadModule = () => {
      window.gapi.load("picker", {
        callback: () => resolve(),
        onerror: () => {
          ready = null
          reject(new Error("Failed to load the Google Picker module"))
        },
      })
    }

    if (window.gapi && document.getElementById(SCRIPT_ID)) {
      loadModule()
      return
    }

    const script = document.createElement("script")
    script.id = SCRIPT_ID
    script.src = "https://apis.google.com/js/api.js"
    script.async = true
    script.onload = loadModule
    script.onerror = () => {
      ready = null
      script.remove()
      reject(new Error("Failed to load apis.google.com/js/api.js"))
    }
    document.body.appendChild(script)
  })

  return ready
}
