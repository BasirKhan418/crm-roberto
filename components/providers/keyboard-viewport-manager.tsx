"use client";

import { useEffect } from "react";

const EDITABLE_SELECTOR = [
  'input:not([type="hidden"]):not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[contenteditable="true"]',
  '[role="textbox"]',
].join(", ");

function getEditableElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  if (target.matches(EDITABLE_SELECTOR)) {
    return target;
  }

  return target.closest<HTMLElement>(EDITABLE_SELECTOR);
}

function scrollFocusedFieldIntoView(target: EventTarget | null) {
  const field = getEditableElement(target);
  if (!field) {
    return;
  }

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const fieldRect = field.getBoundingClientRect();
      const topThreshold = 24;
      const bottomThreshold = viewportHeight - 96;

      if (fieldRect.top < topThreshold || fieldRect.bottom > bottomThreshold) {
        field.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "smooth",
        });
      }
    });
  });
}

function syncViewportVariables(root: HTMLElement) {
  const viewport = window.visualViewport;
  const viewportHeight = Math.round(viewport?.height ?? window.innerHeight);
  const viewportOffsetTop = Math.max(0, Math.round(viewport?.offsetTop ?? 0));
  const keyboardInset = Math.max(0, window.innerHeight - viewportHeight - viewportOffsetTop);
  const stabilizedKeyboardInset = keyboardInset > 80 ? keyboardInset : 0;

  root.style.setProperty("--app-viewport-height", `${viewportHeight}px`);
  root.style.setProperty("--app-keyboard-inset-height", `${stabilizedKeyboardInset}px`);
}

export function KeyboardViewportManager() {
  useEffect(() => {
    const root = document.documentElement;
    let delayedViewportSyncTimeouts: number[] = [];

    function clearDelayedViewportSync() {
      if (delayedViewportSyncTimeouts.length > 0) {
        delayedViewportSyncTimeouts.forEach((timeoutId) => {
          window.clearTimeout(timeoutId);
        });
        delayedViewportSyncTimeouts = [];
      }
    }

    function scheduleViewportSyncAfterBlur() {
      clearDelayedViewportSync();

      window.requestAnimationFrame(() => {
        syncViewportVariables(root);

        window.requestAnimationFrame(() => {
          syncViewportVariables(root);
        });
      });

      delayedViewportSyncTimeouts = [120, 260, 420].map((delay) =>
        window.setTimeout(() => {
          syncViewportVariables(root);
        }, delay)
      );
    }

    function handleFocusIn(event: FocusEvent) {
      clearDelayedViewportSync();
      syncViewportVariables(root);
      scrollFocusedFieldIntoView(event.target);
    }

    function handleFocusOut() {
      scheduleViewportSyncAfterBlur();
    }

    function handleViewportResize() {
      syncViewportVariables(root);
      scrollFocusedFieldIntoView(document.activeElement);
    }

    function handleViewportScroll() {
      syncViewportVariables(root);
    }

    syncViewportVariables(root);

    const viewport = window.visualViewport;

    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", handleFocusOut);
    viewport?.addEventListener("resize", handleViewportResize);
    viewport?.addEventListener("scroll", handleViewportScroll);
    window.addEventListener("resize", handleViewportResize);

    return () => {
      clearDelayedViewportSync();
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", handleFocusOut);
      viewport?.removeEventListener("resize", handleViewportResize);
      viewport?.removeEventListener("scroll", handleViewportScroll);
      window.removeEventListener("resize", handleViewportResize);
    };
  }, []);

  return null;
}