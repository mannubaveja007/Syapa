export default defineBackground(() => {
  console.log("[Background] Syapa Service Worker initialized");

  // Open sidepanel when clicking the extension action icon
  chrome.action.onClicked.addListener(async (tab) => {
    if (tab.windowId) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
  });

  // Ensure offscreen document exists
  async function ensureOffscreenDocument() {
    const existing = await chrome.runtime.getContexts({
      contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    });
    if (existing.length > 0) return;

    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification: "Recording browser tab audio and microphone for meeting transcription",
    });
  }

  // Handle messages from Sidepanel
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "START_RECORDING") {
      (async () => {
        try {
          const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (!activeTab || !activeTab.id) {
            sendResponse({ success: false, error: "No active tab found" });
            return;
          }

          // Get tab capture stream ID
          const streamId = await new Promise<string>((resolve, reject) => {
            chrome.tabCapture.getMediaStreamId({ targetTabId: activeTab.id! }, (id) => {
              if (chrome.runtime.lastError || !id) {
                reject(new Error(chrome.runtime.lastError?.message || "Failed to get stream ID"));
              } else {
                resolve(id);
              }
            });
          });

          await ensureOffscreenDocument();

          // Forward to offscreen document
          chrome.runtime.sendMessage({
            type: "START_OFFSCREEN_CAPTURE",
            streamId,
            meetingId: message.meetingId,
            apiToken: message.apiToken,
          });

          sendResponse({ success: true, streamId });
        } catch (err: any) {
          console.error("[Background] Start recording error:", err);
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // async
    }

    if (message.type === "STOP_RECORDING") {
      (async () => {
        try {
          // Tell offscreen to stop and flush
          chrome.runtime.sendMessage({ type: "STOP_OFFSCREEN_CAPTURE" });
          sendResponse({ success: true });
        } catch (err: any) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true;
    }
  });
});
