const primaryUrl = 'http://127.0.0.1:41741/';
const oopifUrl = 'http://127.0.0.1:41741/oopif.html';
const resultUrl = 'http://127.0.0.1:41741/api/chrome-debugger-result';
const expectedValue = 'browser-use-spike';

let probeTabId;
let coverTabId;
let foregroundWindowId;
const attachedEvents = [];

chrome.debugger.onEvent.addListener((source, method, params = {}) => {
  if (source.tabId !== probeTabId || method !== 'Target.attachedToTarget') return;
  attachedEvents.push({
    sourceSessionId: source.sessionId,
    childSessionId: params.sessionId,
    targetType: params.targetInfo?.type,
    targetUrl: params.targetInfo?.url,
  });
});

function waitForTabComplete(tabId, timeoutMs = 10_000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('tab-load-timeout'));
    }, timeoutMs);
    const onUpdated = (updatedTabId, changeInfo) => {
      if (updatedTabId !== tabId || changeInfo.status !== 'complete') return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    void chrome.tabs.get(tabId).then(tab => {
      if (tab.status !== 'complete') return;
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    });
  });
}

async function navigate(tabId, url) {
  await chrome.tabs.update(tabId, { url, active: true });
  await waitForTabComplete(tabId);
}

function debuggerCommand(tabId, method, params = {}, sessionId) {
  return chrome.debugger.sendCommand(
    { tabId, ...(sessionId ? { sessionId } : {}) },
    method,
    params,
  );
}

function evaluate(tabId, expression, sessionId) {
  return debuggerCommand(
    tabId,
    'Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true },
    sessionId,
  ).then(result => result.result?.value);
}

function applyProbeFavicon() {
  const marker = '__panerelayChromeDebuggerProbe__';
  if (!window[marker]) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.setAttribute('data-panerelay-probe', '');
    document.head?.appendChild(link);
    window[marker] = link;
  }
  window[marker].href =
    'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
}

async function applyInterleave(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: applyProbeFavicon,
    injectImmediately: true,
  });
}

async function installEventProbe(tabId, command) {
  await command(tabId, 'Runtime.evaluate', {
    expression: `(()=>{
        window.__chromeDebuggerProbe = {};
        for (const name of ['keydown','keypress','keyup','input','change','mousedown','mouseup','click','submit']) {
          window.__chromeDebuggerProbe[name] = 0;
          document.addEventListener(name, () => window.__chromeDebuggerProbe[name]++, true);
        }
        const input = document.querySelector('#fixture-value');
        input.focus();
        return { active: document.activeElement === input, focused: document.hasFocus() };
      })()`,
    returnByValue: true,
  });
}

async function sendBrowserHarnessKeys(tabId, command) {
  const selectAll = {
    key: 'a',
    code: 'KeyA',
    modifiers: 4,
    windowsVirtualKeyCode: 65,
    nativeVirtualKeyCode: 65,
  };
  await command(tabId, 'Input.dispatchKeyEvent', { type: 'rawKeyDown', ...selectAll });
  await command(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', ...selectAll });
  await command(tabId, 'Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Backspace',
    code: 'Backspace',
    modifiers: 0,
    windowsVirtualKeyCode: 8,
    nativeVirtualKeyCode: 8,
  });
  await command(tabId, 'Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Backspace',
    code: 'Backspace',
    modifiers: 0,
    windowsVirtualKeyCode: 8,
    nativeVirtualKeyCode: 8,
  });
  for (const character of expectedValue) {
    const base = {
      key: character,
      code: character,
      modifiers: 0,
      windowsVirtualKeyCode: character.codePointAt(0),
      nativeVirtualKeyCode: character.codePointAt(0),
    };
    await command(tabId, 'Input.dispatchKeyEvent', { type: 'keyDown', ...base });
    await command(tabId, 'Input.dispatchKeyEvent', {
      type: 'char',
      text: character,
      ...base,
    });
    await command(tabId, 'Input.dispatchKeyEvent', { type: 'keyUp', ...base });
  }
}

async function clickSubmit(tabId, command) {
  const point = await evaluate(
    tabId,
    `(()=>{const r=document.querySelector('#submit').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`,
  );
  await command(tabId, 'Input.dispatchMouseEvent', {
    type: 'mousePressed',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
  await command(tabId, 'Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    x: point.x,
    y: point.y,
    button: 'left',
    clickCount: 1,
  });
}

async function inputCase(tabId, markerMode, background = false, emulateFocus = false) {
  await navigate(tabId, primaryUrl);
  if (background && typeof coverTabId === 'number') {
    await chrome.tabs.update(coverTabId, { active: true });
    if (typeof foregroundWindowId === 'number') {
      await chrome.windows.update(foregroundWindowId, { focused: true });
    }
  }
  const currentTab = await chrome.tabs.get(tabId);
  const chromeTabActiveBeforeInput = currentTab.active;
  const chromeWindowFocusedBeforeInput = (await chrome.windows.get(currentTab.windowId)).focused;
  if (emulateFocus) {
    await debuggerCommand(tabId, 'Emulation.setFocusEmulationEnabled', { enabled: true });
  }
  if (markerMode === 'once') await applyInterleave(tabId);
  const command = async (targetTabId, method, params = {}) => {
    if (markerMode === 'each') await applyInterleave(targetTabId);
    return debuggerCommand(targetTabId, method, params);
  };
  await installEventProbe(tabId, command);
  await sendBrowserHarnessKeys(tabId, command);
  await clickSubmit(tabId, command);
  const observation = await evaluate(
    tabId,
    `({
      valueMatches: document.querySelector('#fixture-value').value === ${JSON.stringify(expectedValue)},
      submitted: document.querySelector('#status').textContent === ${JSON.stringify(`Submitted: ${expectedValue}`)},
      active: document.activeElement?.id === 'submit' || document.activeElement?.id === 'fixture-value',
      focused: document.hasFocus(),
      events: window.__chromeDebuggerProbe
    })`,
  );
  return {
    ...observation,
    chromeTabActiveBeforeInput,
    chromeWindowFocusedBeforeInput,
  };
}

function errorMessage(error) {
  return error instanceof Error ? error.message.slice(0, 128) : 'unknown-error';
}

async function explicitAttachCase(tabId) {
  await navigate(tabId, oopifUrl);
  let initialTargets;
  try {
    initialTargets = await debuggerCommand(tabId, 'Target.getTargets');
  } catch (error) {
    return { getTargetsError: errorMessage(error) };
  }
  const iframeTarget = initialTargets.targetInfos?.find(
    target => target.type === 'iframe' && target.url.includes('localhost'),
  );
  let explicitAttachEvaluated = false;
  let explicitAttachSessionId;
  if (iframeTarget) {
    const attached = await debuggerCommand(tabId, 'Target.attachToTarget', {
      targetId: iframeTarget.targetId,
      flatten: true,
    });
    explicitAttachSessionId = attached.sessionId;
    if (explicitAttachSessionId) {
      const value = await evaluate(
        tabId,
        "document.querySelector('#cross-frame-value')?.value",
        explicitAttachSessionId,
      );
      explicitAttachEvaluated = value === 'cross-origin';
      await debuggerCommand(tabId, 'Target.detachFromTarget', {
        sessionId: explicitAttachSessionId,
      });
    }
  }

  return {
    childEvaluated: explicitAttachEvaluated,
    getTargetsIncludesIframe: Boolean(iframeTarget),
    sessionReturned: Boolean(explicitAttachSessionId),
  };
}

async function autoAttachCase(tabId) {
  attachedEvents.length = 0;
  let setAutoAttachError;
  try {
    await debuggerCommand(tabId, 'Target.setAutoAttach', {
      autoAttach: true,
      waitForDebuggerOnStart: false,
      flatten: true,
      filter: [{ type: 'iframe', exclude: false }],
    });
  } catch (error) {
    setAutoAttachError = errorMessage(error);
  }
  await navigate(tabId, oopifUrl);
  const deadline = Date.now() + 5_000;
  let iframeEvent;
  let childObservation;
  while (Date.now() < deadline) {
    for (const event of attachedEvents.filter(candidate => candidate.targetType === 'iframe')) {
      if (!event.childSessionId) continue;
      try {
        const observation = await evaluate(
          tabId,
          `({
            hostname: location.hostname,
            readyState: document.readyState,
            value: document.querySelector('#cross-frame-value')?.value ?? null
          })`,
          event.childSessionId,
        );
        if (observation?.hostname !== 'localhost') continue;
        iframeEvent = event;
        childObservation = observation;
        break;
      } catch {
        // The child can replace its initial document before the final OOPIF is ready.
      }
    }
    if (iframeEvent && childObservation?.readyState === 'complete') break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  let targets;
  let getTargetsError;
  try {
    targets = await debuggerCommand(tabId, 'Target.getTargets');
  } catch (error) {
    getTargetsError = errorMessage(error);
  }
  return {
    attachedEventCount: attachedEvents.length,
    attachedTargetUrls: attachedEvents.map(event => event.targetUrl ?? ''),
    attachedEvent: Boolean(iframeEvent),
    childEvaluated: childObservation?.value === 'cross-origin',
    childObservation: childObservation ?? null,
    eventSourceIsRoot: Boolean(iframeEvent && !iframeEvent.sourceSessionId),
    getTargetsIncludesIframe: Boolean(
      targets?.targetInfos?.some(target => target.type === 'iframe'),
    ),
    ...(getTargetsError ? { getTargetsError } : {}),
    ...(setAutoAttachError ? { setAutoAttachError } : {}),
  };
}

async function postResult(result) {
  await fetch(resultUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(result),
  });
}

async function runProbe() {
  let attached = false;
  try {
    const tab = await chrome.tabs.create({ url: primaryUrl, active: true });
    if (typeof tab.id !== 'number') throw new Error('tab-create-failed');
    probeTabId = tab.id;
    await waitForTabComplete(tab.id);
    const coverTab = await chrome.tabs.create({
      windowId: tab.windowId,
      url: 'about:blank',
      active: false,
    });
    coverTabId = coverTab.id;
    const foregroundWindow = await chrome.windows.create({ url: 'about:blank', focused: false });
    foregroundWindowId = foregroundWindow.id;
    await chrome.debugger.attach({ tabId: tab.id }, '1.3');
    attached = true;
    const cases = {};
    for (const [name, probe] of [
      ['rawInput', () => inputCase(tab.id, 'none')],
      ['oneTimeMarkerInput', () => inputCase(tab.id, 'once')],
      ['perCommandMarkerInput', () => inputCase(tab.id, 'each')],
      ['backgroundInput', () => inputCase(tab.id, 'none', true)],
      ['backgroundFocusEmulationInput', () => inputCase(tab.id, 'none', true, true)],
      ['explicitAttach', () => explicitAttachCase(tab.id)],
      ['autoAttach', () => autoAttachCase(tab.id)],
    ]) {
      try {
        cases[name] = { status: 'passed', result: await probe() };
      } catch (error) {
        cases[name] = { status: 'failed', error: errorMessage(error) };
      }
    }
    await postResult({ status: 'complete', cases });
  } catch (error) {
    await postResult({
      status: 'failed',
      error: errorMessage(error),
    }).catch(() => undefined);
  } finally {
    if (attached && typeof probeTabId === 'number') {
      await chrome.debugger.detach({ tabId: probeTabId }).catch(() => undefined);
    }
    if (typeof probeTabId === 'number') {
      await chrome.tabs.remove(probeTabId).catch(() => undefined);
    }
    if (typeof coverTabId === 'number') {
      await chrome.tabs.remove(coverTabId).catch(() => undefined);
    }
    if (typeof foregroundWindowId === 'number') {
      await chrome.windows.remove(foregroundWindowId).catch(() => undefined);
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void runProbe();
});
