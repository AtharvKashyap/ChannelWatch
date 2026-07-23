import { act } from "react";

/**
 * Interaction helpers for the react-dom/client + act() harness (tests/render).
 * React tracks controlled-input values via an internal value tracker, so a plain
 * `el.value = x` does not fire `onChange`; we set the value through the native
 * prototype setter and dispatch the event React listens for.
 */

export function type(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

export function select(el: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export function click(el: Element): void {
  act(() => {
    (el as HTMLElement).click();
  });
}

export function submit(form: HTMLFormElement): void {
  act(() => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}
