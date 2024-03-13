import { launchApp, icon } from "lib/utils"
import icons from "lib/icons"
import options from "options"
import PanelButton from "../bar/PanelButton"

const hyprland = await Service.import("hyprland")
const apps = await Service.import("applications")
const { monochrome, exclusive, iconSize } = options.dock.taskbar
const { position } = options.dock
import { sh } from "lib/utils"

const dispatch = (arg: string | number) => {
    sh(`hyprctl dispatch workspace ${arg}`)
}

const focus = (address: string) => hyprland.messageAsync(
    `dispatch focuswindow address:${address}`)

const DummyItem = (address: string) => Widget.Box({
    attribute: { address },
    visible: false,
})

const AppItem = (address: string, monitor: number) => {
    const client = hyprland.getClient(address)
    if (!client || client.class === "" || client.workspace.id < -1)
        return DummyItem(address)

    const app = apps.list.find(app => app.match(client.class))

    const btn = PanelButton({
        class_name: "panel-button",
        tooltip_text: Utils.watch(client.title, hyprland, () =>
            hyprland.getClient(address)?.title || "",
        ),
        on_primary_click: () => focus(address),
        on_middle_click: () => app && launchApp(app),
        child: Widget.Icon({
            class_name: "icon",
            size: iconSize.bind(),
            icon: monochrome.bind().as(m => icon(
                (app?.icon_name || client.class) + (m ? "-symbolic" : ""),
                icons.fallback.executable,
            )),
        }),
        setup: w => w.hook(hyprland, () => {
            w.toggleClassName("active", hyprland.active.client.address === address)
        })
    })

    return Widget.Box(
        {
            class_name: "app-item",
            attribute: { address },
            //visible: Utils.watch(true, [exclusive, hyprland], () => {
            //    return exclusive.value
            //        ? hyprland.active.workspace.id === client.workspace.id
            //        : true
            //}),
            setup: w => w.hook(hyprland, () => {
                w.visible = hyprland.getClient(address).monitor === monitor
            }, "event"),
        },
        Widget.Overlay({
            child: btn,
            pass_through: true,
            overlay: Widget.Box({
                className: "indicator",
                hpack: "center",
                vpack: position.bind().as(p => p === "top" ? "start" : "end"),
                setup: w => w.hook(hyprland, () => {
                    w.toggleClassName("active", hyprland.active.client.address === address)
                }),
            }),
        }),
    )
}

function sortItems<T extends { attribute: { address: string } }>(arr: T[]) {
    return arr.sort(({ attribute: a }, { attribute: b }) => {
        const aclient = hyprland.getClient(a.address)!
        const bclient = hyprland.getClient(b.address)!
        return aclient.workspace.id - bclient.workspace.id
    })
}

export default (monitor: number) => Widget.EventBox({
    child: Widget.Box({
        class_name: "taskbar",
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
    setup: self => self.on("motion-notify-event", () => {
        const [mouseX, mouseY] = self.get_pointer();
        self.child.children.forEach(child => {
            const allocation = child.get_allocation();
            const centerX = allocation.x + allocation.width / 2;
            const distance = Math.sqrt(Math.pow(mouseX - centerX, 2));
            const leewayThreshold = 35;
            const effectiveDistance = Math.max(0, distance - leewayThreshold);

            const falloffEffect = Math.pow(0.980, effectiveDistance);

            const baseSize = 1.0; // Base
            const maxSizeIncrease = 0.35;
            const newSize = baseSize + (maxSizeIncrease * falloffEffect);

            const clampedSize = Math.min(Math.max(newSize, baseSize), baseSize + maxSizeIncrease);

            child.children[0]?.child.child.child.setCss(`-gtk-icon-transform: scale(${clampedSize});`);
            child.children[0]?.child.child.setCss(`padding: ${options.theme.padding * 1.5}pt ${options.theme.padding * 1.5 - (baseSize - newSize) * 12}pt;`)
        });
    }),
    on_scroll_up: () => dispatch("m+1"),
    on_scroll_down: () => dispatch("m-1"),
    on_clicked: () => App.toggleWindow("overview"),
})
