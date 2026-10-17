import { useEffect } from "react";

/** Keep keyboard and pointer interaction in the single foreground dialog. */
export function useDialogFocus(active: string | null, onClose: () => void) {
  useEffect(() => {
    if (!active) return;
    const dialog = document.querySelector<HTMLElement>(
      '[role="dialog"][aria-modal="true"]',
    );
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    const inerted: Array<[HTMLElement, boolean]> = [];
    let branch: HTMLElement = dialog;
    while (branch.parentElement && branch !== document.body) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
        inerted.push([sibling, sibling.inert]);
        sibling.inert = true;
      }
      branch = branch.parentElement;
    }
    const focusable = () =>
      [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ].filter((el) => !el.hidden && el.getClientRects().length > 0);
    const initial = focusable()[0];
    initial?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
      if (event.key !== "Tab") return;
      const items = focusable(),
        first = items[0],
        last = items.at(-1);
      if (!first) {
        event.preventDefault();
        return;
      }
      if (
        event.shiftKey &&
        (document.activeElement === first ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        last?.focus();
      }
      if (
        !event.shiftKey &&
        (document.activeElement === last ||
          !dialog.contains(document.activeElement))
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      for (const [element, wasInert] of inerted) element.inert = wasInert;
      if (previous?.isConnected) previous.focus();
    };
    // onClose only closes setters; rerendering a note must not steal dialog focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
}
