import options from "options"
import icons from "lib/icons"
import { icon } from "lib/utils"
import PanelButton from "../bar/PanelButton"
import { ButtonProps } from "types/widgets/button"

const apps = await Service.import("applications")
const hyprland = await Service.import("hyprland")

const { position, iconSize, iconZoomMultiplier } = options.dock
const pos = position.bind()

export type DockWidget = keyof typeof widget

const dispatch = (command: string) => hyprland.messageAsync(
    `dispatch ${command}`
)

type DockButtonProps = ButtonProps & {
    address?: string,
    icon: string,
}

const DockButton = ({
    class_name = "",
    tooltip_text = "",
    icon = icons.fallback.executable,
    on_primary_click = () => { },
    ...rest
}: DockButtonProps) => {
    const btn = PanelButton({
        class_name: "panel-button",
        tooltip_text,
        child: Widget.Icon({
            class_name: "icon",
            css: `
                -gtk-icon-transform: scale(${1 / iconZoomMultiplier});
                margin: ${-iconSize * (1 - (1 / iconZoomMultiplier))}px;
            `,
            size: iconSize.bind().as(i => {
                return i * iconZoomMultiplier
            }),
            icon,
        }),
        on_primary_click,
    })

    return Widget.Box({
        class_name: "dock-button " + class_name,
        child: Widget.Overlay({
            child: btn,
            pass_through: true,
            overlay: Widget.Box({
                class_name: "indicator",
                hpack: "center",
                vpack: position.bind().as(p => p === "top" ? "start" : "end"),
            }),
        }),
        ...rest,
    })
}

const AppItem = (address: string, monitor: number) => {
    const DummyItem = (address: string) => Widget.Box({
        attribute: { address },
        visible: false,
    })

    const client = hyprland.getClient(address)
    if (!client || client.class === "")
        return DummyItem(address)

    const app = apps.list.find(app => app.match(client.class))

    return DockButton({
        attribute: { address },
        tooltip_text: Utils.watch(client.title, hyprland, () =>
            hyprland.getClient(address)?.title || "",
        ),
        icon: icon(
            (app?.icon_name || client.class),
            icons.fallback.executable,
        ),
        on_primary_click: () => dispatch(`focuswindow address:${address}`),
        setup: w => w
            .hook(hyprland, () => {
                const client = hyprland.getClient(address)
                w.visible = client.monitor === monitor && client.workspace.id >= 0 && !client.pinned

                w.toggleClassName("active", hyprland.active.client.address === address)
            }, "event")
    })
}

function sortItems<T extends { attribute: { address: string } }>(arr: T[]) {
    return arr.sort(({ attribute: a }, { attribute: b }) => {

        const aclient = hyprland.getClient(a.address)
        const bclient = hyprland.getClient(b.address)
        if (!aclient || !bclient)
            return 0

        const workspace = aclient.workspace.id - bclient.workspace.id

        if (workspace === 0) {
            const pos = aclient.at[0] - bclient.at[0]
            return pos
        }

        return workspace
    })
}

export default (monitor: number) => {
    const taskbar = Widget.EventBox({
        class_name: "taskbar",
        child: Widget.Box({
            children: sortItems(hyprland.clients.map(c => AppItem(c.address, monitor))),
            setup: w => w
                .hook(hyprland, (w, address?: string) => {
                    if (typeof address === "string")
                        w.children = w.children.filter(ch => ch.attribute.address !== address)
                }, "client-removed")
                .hook(hyprland, (w, address?: string) => {
                    if (typeof address === "string")
                        w.children = sortItems([...w.children, AppItem(address, monitor)])
                }, "client-added")
                .hook(hyprland, (w, event?: string) => {
                    if (event === "movewindow")
                        w.children = sortItems(w.children)
                }, "event"),
        }),
        on_scroll_up: () => dispatch("workspace m+1"),
        on_scroll_down: () => dispatch("workspace m-1"),
    })

    const revealer = Widget.Revealer({
        child: Widget.Box({
            class_name: "dock",
            children: [
                DockButton({
                    tooltip_text: "Launcher",
                    icon: icons.app.grid,
                    on_primary_click: () => App.toggleWindow("launcher"),
                    setup: w => w.hook(App, (w, win, visible) => {
                        w.toggleClassName("active", win === "launcher" && visible)
                    }),
                }),
                Widget.Separator(),
                taskbar,
                Widget.Separator(),
                DockButton({
                    tooltip_text: "Special Workspace",
                    icon: icons.app.starred,
                    on_primary_click: () => dispatch("togglespecialworkspace"),
                    setup: w => w.hook(hyprland, (w, event?: string, args?: string) => {
                        const workspace = hyprland.getWorkspace(-99)
                        w.toggleClassName("empty", !workspace || (workspace && workspace.windows === 0))

                        if (event === "activespecial") {
                            const name = args.split(",")[0]
                            w.toggleClassName("active", name === "special")
                        }
                    }, "event"),
                }),
            ],
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
            let hover = false
            let forceShow = false
            let special = false
            let launcher = false

            function showDock() {
                if (hideTimeoutId !== null) {
                    clearTimeout(hideTimeoutId)
                    hideTimeoutId = null
                }
                revealer.reveal_child = true
            }

            function hideDock() {
                revealer.reveal_child = false
            }

            function resetDock() {
                self.child.child.child.children.forEach(dockItem => {
                    if (dockItem.class_name.includes("taskbar")) {
                        taskbar.child.children.forEach(child => {
                            if (child.visible) {
                                const button = child.child?.child.child
                                if (button) {
                                    const icon = button.child

                                    icon.setCss(`
                                        transition: margin, -gtk-icon-transform, ${options.transition * 1.5}ms;
                                        -gtk-icon-transform: scale(${1 / iconZoomMultiplier});
                                        margin: ${-iconSize * (1 - (1 / iconZoomMultiplier))}px;
                                    `)
                                }
                            }
                        })
                    } else if (dockItem.class_name.includes("dock-button")) {
                        dockItem.child.child.child.child.setCss(`
                            transition: margin, -gtk-icon-transform, ${options.transition * 1.5}ms;
                            -gtk-icon-transform: scale(${1 / iconZoomMultiplier});
                            margin: ${-iconSize * (1 - (1 / iconZoomMultiplier))}px;
                        `)
                    }
                })

            }

            self.hook(App, (_, win, visible) => {
                if (win === "launcher") {
                    if (visible)
                        launcher = true
                    else {
                        launcher = false

                        hideTimeoutId = setTimeout(() => {
                            if (!forceShow) {
                                hideDock()
                                hideTimeoutId = null
                            }
                        }, 350)
                    }
                }
            })

            self.hook(hyprland, (_, event?: string, args?: string) => {
                if (hyprland.active.monitor.id === monitor) {
                    if (event === "activespecial") {
                        special = args.split(",")[0] === "special"

                        if (!special && !hover) {
                            hideDock()
                            return
                        }
                    }

                    const workspace = hyprland.getWorkspace(hyprland.active.workspace.id)
                    forceShow = (!workspace || (workspace && workspace.windows === 0)) || special || launcher

                    if (["workspace", "openwindow"].includes(event) && !forceShow && !hover) {
                        //if (event === "activewindow" && !forceShow && !hover) {
                        showDock()

                        hideTimeoutId = setTimeout(() => {
                            if (!hover) {
                                hideDock()
                                hideTimeoutId = null
                            }
                        }, 800)
                        return
                    }

                    if (forceShow)
                        showDock()
                }
            }, "event")

            self.on('enter-notify-event', () => {
                hover = true
                showDock()
            })

            self.on('leave-notify-event', () => {
                hover = false
                if (!forceShow) {
                    hideTimeoutId = setTimeout(() => {
                        hideDock()
                        hideTimeoutId = null
                    }, 350)
                }

                resetDock()
            })

            self.on("motion-notify-event", () => {
                const [mouseX, _] = self.get_pointer()

                self.child.child.child.children.forEach(dockItem => {
                    if (dockItem.class_name.includes("taskbar")) {
                        dockItem.child.children.forEach(taskbarItem => {
                            if (taskbarItem.visible) {
                                const button = taskbarItem.child?.child.child
                                if (button) {
                                    const icon = button.child

                                    const taskbarAllocation = taskbarItem.get_allocation()
                                    const dockAllocation = dockItem.get_allocation()

                                    const centerX = dockAllocation.x + taskbarAllocation.x + taskbarAllocation.width / 2
                                    const distance = Math.sqrt(Math.pow(mouseX - centerX, 2))

                                    const leewayThreshold = iconSize * 0.5
                                    const effectiveDistance = Math.max(0, distance - leewayThreshold)
                                    const falloffEffect = Math.pow(0.985, effectiveDistance)

                                    const margin = -iconSize * (1 - (1 / iconZoomMultiplier))
                                    const scale = (1 / iconZoomMultiplier) + (iconZoomMultiplier - 1) * falloffEffect
                                    icon.setCss(`
                                        -gtk-icon-transform: scale(${scale});
                                        padding: ${options.theme.padding}pt calc(${options.theme.padding}pt + ${iconSize * 0.5 * (iconZoomMultiplier - 1) * falloffEffect}px);
                                        margin: ${margin}px;
                                        margin-top: ${margin - iconSize * (iconZoomMultiplier - 1) * falloffEffect}px;
                                    `)
                                }
                            }
                        })
                    } else if (dockItem.class_name.includes("dock-button")) {
                        const allocation = dockItem.get_allocation()

                        const centerX = allocation.x + allocation.width / 2
                        const distance = Math.sqrt(Math.pow(mouseX - centerX, 2))

                        const leewayThreshold = iconSize * 0.5
                        const effectiveDistance = Math.max(0, distance - leewayThreshold)
                        const falloffEffect = Math.pow(0.985, effectiveDistance)

                        const margin = -iconSize * (1 - (1 / iconZoomMultiplier))
                        dockItem.child.child.child.child.setCss(`
                            -gtk-icon-transform: scale(${(1 / iconZoomMultiplier) + (iconZoomMultiplier - 1) * falloffEffect});
                            padding: ${options.theme.padding}pt calc(${options.theme.padding}pt + ${iconSize * 0.5 * (iconZoomMultiplier - 1) * falloffEffect}px);
                            margin: ${margin}px;
                            margin-top: ${margin - iconSize * (iconZoomMultiplier - 1) * falloffEffect}px;
                        `)
                    }
                })
            })
        }
    })
}
