import Taskbar from "./Taskbar"
import PopupWindow from "../PopupWindow"
import options from "options"

const pos = options.dock.position.bind()

export type DockWidget = keyof typeof widget

export default (monitor: number) => {
    const revealer = Widget.Revealer({
        child: Widget.Box({
            class_name: "dock",
            child: Taskbar(monitor),
        }),
        transition: pos.as(pos => pos === "top" ? "slide_down" : "slide_up"),
    })

    return Widget.Window({
        monitor,
        class_name: "floating-dock",
        name: `dock${monitor}`,
        anchor: pos.as(pos => [pos]),
        child: Widget.Box({
            css: `min-height: 2px;`,
            child: revealer,
        }),
        setup: self => {
            let hideTimeoutId = null

            self.on('enter-notify-event', () => {
                if (hideTimeoutId !== null) {
                    clearTimeout(hideTimeoutId)
                    hideTimeoutId = null
                }

                revealer.reveal_child = true
            });

            self.on('leave-notify-event', () => {
                hideTimeoutId = setTimeout(() => {
                    revealer.reveal_child = false
                    hideTimeoutId = null
                }, 350)

                self.child.child.child.children[0]?.child.children.forEach(child => {
                    child.child?.child.child.child.setCss(`transition: -gtk-icon-transform ${options.transition * 1.5}ms; -gtk-icon-transform: scale(1);`)
                    //child.child?.child.child.setCss(`transition: padding ${options.transition * 1.5}ms; padding: ${options.theme.padding * 1.5}pt;`)
                    child.child?.child.child.setCss(`transition: padding ${options.transition * 1.5}ms; padding: ${options.theme.padding}pt;`)
                })
            })
        }
    })
}
