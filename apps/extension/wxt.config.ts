import { defineConfig } from "wxt";

export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  manifest: {
    name: "Syapa • Meeting Recorder & Transcriber",
    description: "Record tab audio + microphone with live dual-channel speech-to-text.",
    version: "1.0.0",
    permissions: [
      "tabCapture",
      "offscreen",
      "storage",
      "activeTab",
      "sidePanel",
    ],
    host_permissions: ["http://localhost:3000/*"],
    side_panel: {
      default_path: "sidepanel.html",
    },
    action: {
      default_title: "Open Syapa Meeting Recorder",
    },
  },
});
