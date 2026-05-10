import { blessed } from "./blessed.ts"

export function openTextPrompt(screen: any, label: string): Promise<string | null> {
  return new Promise((resolve) => {
    const previousFocus = screen.focused
    const modal = blessed.box({
      parent: screen,
      top: "center",
      left: "center",
      width: "80%",
      height: "50%",
      label,
      border: "line",
      keys: true,
      mouse: true,
      style: {
        border: { fg: "cyan" },
        fg: "white",
        bg: "black",
      },
    })

    const input = blessed.textarea({
      parent: modal,
      top: 1,
      left: 1,
      right: 1,
      bottom: 2,
      keys: true,
      mouse: true,
      scrollable: true,
      alwaysScroll: true,
      inputOnFocus: false,
      style: {
        fg: "white",
        bg: "black",
      },
    })

    blessed.box({
      parent: modal,
      bottom: 0,
      left: 1,
      right: 1,
      height: 1,
      content: "Enter: 줄바꿈  Ctrl+X: 전송  Esc: 취소",
      style: { fg: "cyan", bg: "black" },
    })

    let settled = false
    const close = (value: unknown) => {
      if (settled) {
        return
      }
      settled = true
      screen.remove(modal)
      if (previousFocus && typeof previousFocus.focus === "function" && !previousFocus.detached) {
        previousFocus.focus()
      }
      screen.render()
      if (!value || typeof value !== "string" || !value.trim()) {
        resolve(null)
        return
      }
      resolve(value.trim())
    }

    input.key(["C-x"], () => {
      // blessed textarea keeps Enter for newlines, so submit through the active read callback.
      if (typeof input._done === "function") {
        input._done(null, input.getValue())
      }
    })

    input.readInput((err: unknown, value: unknown) => {
      close(err ? null : value)
    })
    screen.render()
  })
}

export function openLinePrompt(screen: any, label: string, initialValue = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const prompt = blessed.prompt({
      parent: screen,
      top: "center",
      left: "center",
      width: "72%",
      height: 7,
      label,
      border: "line",
      keys: true,
      mouse: true,
      style: {
        border: { fg: "cyan" },
        fg: "white",
        bg: "black",
      },
    })

    prompt.input("", initialValue, (err: unknown, value: unknown) => {
      screen.remove(prompt)
      screen.render()
      if (err || !value || typeof value !== "string" || !value.trim()) {
        resolve(null)
        return
      }
      resolve(value.trim())
    })
  })
}
