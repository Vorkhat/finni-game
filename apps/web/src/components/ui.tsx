import {
  createEffect,
  onCleanup,
  Show,
  type JSX,
  type ParentProps,
} from "solid-js";
import { A } from "@solidjs/router";
import { getAsset } from "../assets/registry";

export function Button(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      class={`button ${props.class ?? ""}`}
      type={props.type ?? "button"}
    />
  );
}
export function IconButton(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      class={`icon-button ${props.class ?? ""}`}
      type="button"
    />
  );
}
export function Card(props: ParentProps<{ class?: string }>) {
  return (
    <section class={`card ${props.class ?? ""}`}>{props.children}</section>
  );
}
export function ProgressBar(props: {
  value: number;
  max?: number;
  label: string;
  class?: string;
}) {
  return (
    <progress
      class={`progress ${props.class ?? ""}`}
      value={props.value}
      max={props.max ?? 1}
      aria-label={props.label}
    />
  );
}
export function Art(props: { id: string; alt?: string; class?: string }) {
  return (
    <img
      class={props.class ?? "art"}
      src={getAsset(props.id)}
      alt={props.alt ?? ""}
      aria-hidden={props.alt ? undefined : true}
      draggable={false}
    />
  );
}
export function BalanceBadge(props: { amount: number; savings?: boolean }) {
  return (
    <div
      class="balance-badge"
      classList={{ "large-balance": props.amount >= 1000000 }}
      aria-label={`${props.savings ? "В копилке" : "В кошельке"}: ${props.amount.toLocaleString("ru-RU")} монет`}
    >
      <Art id={props.savings ? "icon-savings" : "icon-coin"} />
      <span data-testid={props.savings ? "savings-balance" : "wallet-balance"}>
        {props.amount}
      </span>
    </div>
  );
}
export function ScreenHeader(props: { title?: string; back?: string }) {
  return (
    <header class="screen-header">
      <A
        class="icon-button back"
        href={props.back ?? "/home"}
        aria-label="Назад"
      >
        ‹
      </A>
      <Show
        when={props.title}
        fallback={<Art id="logo-finni" alt="Финни" class="wordmark" />}
      >
        <span>{props.title}</span>
      </Show>
      <span class="header-spacer" />
    </header>
  );
}

export function Modal(
  props: ParentProps<{
    open: boolean;
    title: string;
    onClose: () => void;
    role?: "dialog" | "alertdialog";
  }>,
) {
  let dialog!: HTMLDialogElement;
  let opener: HTMLElement | null = null;
  const requestClose = () => {
    props.onClose();
  };
  createEffect(() => {
    if (props.open && !dialog.open) {
      opener = document.activeElement as HTMLElement | null;
      dialog.showModal();
      queueMicrotask(() =>
        dialog.querySelector<HTMLElement>("button")?.focus(),
      );
    } else if (!props.open && dialog.open) {
      dialog.close();
      opener?.focus();
    }
  });
  onCleanup(() => {
    if (dialog?.open) dialog.close();
  });
  return (
    <dialog
      ref={dialog}
      class="modal"
      role={props.role ?? "dialog"}
      aria-label={props.title}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
    >
      <div class="modal-heading">
        <h2>{props.title}</h2>
        <IconButton onClick={requestClose} aria-label="Закрыть">
          ×
        </IconButton>
      </div>
      {props.children}
    </dialog>
  );
}
export function ConfirmDialog(props: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      open={props.open}
      title={props.title}
      onClose={props.onClose}
      role={props.destructive ? "alertdialog" : "dialog"}
    >
      <p>{props.text}</p>
      <Button
        class={props.destructive ? "danger" : ""}
        onClick={props.onConfirm}
      >
        {props.confirmLabel}
      </Button>
      <Button class="secondary" onClick={props.onClose}>
        {props.cancelLabel ?? "Остаться здесь"}
      </Button>
    </Modal>
  );
}
